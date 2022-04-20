import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { brotliCompressSync } from 'zlib';


// Setup dirs
const __dirname = dirname(fileURLToPath(import.meta.url));

const outDir = join(__dirname, '..', 'dist');
rmSync(outDir, { force: true, recursive: true });
mkdirSync(outDir, { recursive: true });

const tmpDir = join(__dirname, '..', 'tmp');
rmSync(tmpDir, { force: true, recursive: true });
mkdirSync(tmpDir, { recursive: true });

// Setup utils
const remoteUrl =  'https://discord.com/api';

const getLatestHost = async (platform, channel) => (await (await fetch(remoteUrl + `/updates/${channel}?platform=${platform}&version=0.0.0`)).json()).name;
const getModules = async (platform, channel, host) => (await (await fetch(remoteUrl + `/modules/${channel}/versions.json?host_version=${host}&platform=${platform}`)).json())

console.log('starting...');
(async function() {
for (const platform of [ 'linux', 'osx' ]) {
  for (const channel of [ 'canary', 'ptb', 'stable', 'development' ]) {
    const host = await getLatestHost(platform, channel);
    console.log(platform, channel, host);

    const baseDir = join(outDir, platform, channel);
    mkdirSync(baseDir, { recursive: true });

    const modules = await getModules(platform, channel, host);
    console.log('saving modules...');
    writeFileSync(join(baseDir, 'modules.json'), JSON.stringify(modules, null, 2));

    for (const module in modules) {
      const version = modules[module];
      console.log(`packing ${module}@${version}...`);

      const buffer = Buffer.from(await (await fetch(`https://dl${channel === 'stable' ? '' : `-${channel}`}.discordapp.net/apps/${platform}/${host}/modules/${module}-${version}.zip`)).arrayBuffer());

      const prefix = module + '-' + version;

      const zipPath = join(tmpDir, prefix + '.zip');
      writeFileSync(zipPath, buffer);

      const extractDir = join(tmpDir, prefix);
      rmSync(extractDir, { force: true, recursive: true });
      mkdirSync(extractDir);

      const p1 = execFile('unzip', ['-o', zipPath, '-d', extractDir]);
      await new Promise((res) => p1.on('close', res));
      rmSync(zipPath, { force: true });

      const tarPath = zipPath.replace('.zip', '.tar');

      let files = [];
      const walk = (f) => {
        try {
          for (const file of readdirSync(f)) walk(join(f, file));
        } catch { files.push(f.replace(extractDir + '/', '')); }
      };
      walk(extractDir);

      const p2 = execFile('tar', ['-cf', tarPath, ...files ], { cwd: extractDir });
      await new Promise((res) => p2.on('close', res));

      const compressed = brotliCompressSync(readFileSync(tarPath));

      const finalPath = join(baseDir, module);
      writeFileSync(finalPath, compressed);
      // rmSync(tarPath, { force: true });
    }
  }
}
})();