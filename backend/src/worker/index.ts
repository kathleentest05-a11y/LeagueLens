import { loadConfig } from '../shared/config';

// M0 scaffold: the sync worker process exists and stays alive, but the
// scheduler, Sleeper adapter, and alert engine land in M1/M2 (TDD Sections
// 3-5). The worker remains the only component allowed to call providers.
function main(): void {
  const config = loadConfig();
  console.log(
    `LeagueLens worker started (scaffold; sync loop lands in M1, limiter target ${config.sleeperRateLimitPerMin}/min).`,
  );
  const heartbeat = setInterval(() => {
    console.log('worker heartbeat: idle (no sync jobs scheduled yet)');
  }, 60_000);

  const shutdown = () => {
    clearInterval(heartbeat);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
