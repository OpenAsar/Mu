# Mu
μ(micro) Module Updater server. This is designed as a open (standard and source) replacement for Discord's old Module Updater API (`/api/modules`). **This is not a one-to-one / drop-in replacement, the API is completely different but offers similar/better features.**

## Design

### Infrastructure
Mu is designed as a "static API" - in which it is hosted by GitHub Pages, and updated every X minutes to have "live" data. Latency is not a concern as Discord's normal API caches every 5 minutes via query parameter anyway. This allows easy hosting and not requiring a real server.