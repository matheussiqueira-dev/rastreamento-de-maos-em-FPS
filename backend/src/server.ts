import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

const main = async () => {
  const config = loadConfig();
  const app = await buildApp({ config, logger: true });

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`Backend online em http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

main();
