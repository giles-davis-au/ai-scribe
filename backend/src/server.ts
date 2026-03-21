import { loadConfig, getConfig } from './infrastructure/aws/secrets';
import { initServiceAccount } from './infrastructure/supabase/serviceAccount';
import app from './app';

async function start() {
  await loadConfig();
  await initServiceAccount();
  const { port } = getConfig();

  app.listen(port, () => {
    console.log(`[server] listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error('[startup error]', err);
  process.exit(1);
});
