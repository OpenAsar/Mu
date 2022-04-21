import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import zlib from 'zlib';


// Setup dirs
const __dirname = dirname(fileURLToPath(import.meta.url));

const outDir = join(__dirname, '..', 'dist');
fs.rmSync(outDir, { force: true, recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const tmpDir = join(__dirname, '..', 'tmp');
fs.rmSync(tmpDir, { force: true, recursive: true });
fs.mkdirSync(tmpDir, { recursive: true });

// Setup utils
const remoteUrl =  'https://discord.com/api';

const getLatestHost = async (platform, channel) => (await (await fetch(remoteUrl + `/updates/${channel}?platform=${platform}&version=0.0.0`)).json()).name;
const getModules = async (platform, channel, host) => (await (await fetch(remoteUrl + `/modules/${channel}/versions.json?host_version=${host}&platform=${platform}`)).json())

console.log('starting...');
(async function() {
for (const platform of [ 'linux', 'osx' ]) { // linux, osx only
  for (const channel of [ 'canary', 'ptb', 'stable', 'development' ]) { // All channels
    const host = await getLatestHost(platform, channel);
    console.log(platform, channel, host);

    const baseDir = join(outDir, platform, channel);
    fs.mkdirSync(baseDir, { recursive: true });

    const modules = await getModules(platform, channel, host);
    console.log('saving modules...');
    fs.writeFileSync(join(baseDir, 'modules.json'), JSON.stringify(modules, null, 2));

    for (const module in modules) {
      const version = modules[module];
      console.log(`packing ${module}@${version}...`);

      const buffer = Buffer.from(await (await fetch(`https://dl${channel === 'stable' ? '' : `-${channel}`}.discordapp.net/apps/${platform}/${host}/modules/${module}-${version}.zip`)).arrayBuffer());

      const prefix = module + '-' + version;

      const zipPath = join(tmpDir, prefix + '.zip');
      fs.writeFileSync(zipPath, buffer);

      const extractDir = join(tmpDir, prefix);
      fs.rmSync(extractDir, { force: true, recursive: true });
      fs.mkdirSync(extractDir);

      const p1 = execFile('unzip', ['-o', zipPath, '-d', extractDir]);
      await new Promise((res) => p1.on('close', res));

      const tarPath = zipPath.replace('.zip', '.tar');

      let files = [];
      const walk = (f) => {
        try {
          for (const file of fs.readdirSync(f)) walk(join(f, file));
        } catch { files.push(f.replace(extractDir + '/', '')); }
      };
      walk(extractDir);

      const p2 = execFile('tar', ['-cf', tarPath, ...files ], { cwd: extractDir });
      await new Promise((res) => p2.on('close', res));

      const finalPath = join(baseDir, module);
      const p3 = execFile('brotli', ['-6', tarPath, '-o', finalPath ]);
      await new Promise((res) => p3.on('close', res));

      const getSize = (f) => (fs.statSync(f).size / (1024*1024)).toFixed(2)
      console.log('compressed', getSize(tarPath), '->', getSize(finalPath), `(${getSize(zipPath)})`);

      fs.rmSync(tarPath, { force: true });
      fs.rmSync(zipPath, { force: true });
    }
  }
}
})();