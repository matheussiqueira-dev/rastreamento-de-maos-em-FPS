import 'dotenv/config';
import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const main = async () => {
  const config = loadConfig();
  const app = await buildApp({ config, logger: true });

  // Encerramento gracioso: para de aceitar conexões e conclui requisições (e a fila de escrita) em andamento
  // antes de sair — evita perder gravações do store em deploys e reinícios do orquestrador.
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Encerrando backend...');
    const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(`Backend online em http://${config.host}:${config.port} (${config.environment})`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

main().catch((error: unknown) => {
  console.error('Falha ao iniciar o backend:', error instanceof Error ? error.message : error);
  process.exit(1);
});
