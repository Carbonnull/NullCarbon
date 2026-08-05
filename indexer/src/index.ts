import { Database } from './db/database';
import { StellarEventSource } from './handlers/stellar.event-source';
import { RetirementHandler } from './handlers/retirement.handler';
import { NullifierHandler } from './handlers/nullifier.handler';

const STELLAR_RPC_URL =
  process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const RETIREMENT_VERIFIER_ID = process.env.RETIREMENT_VERIFIER_ID || '';
const NULLIFIER_REGISTRY_ID = process.env.NULLIFIER_REGISTRY_ID || '';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const MAX_RETRIES = 5;

interface Pipeline {
  name: string;
  poll(): Promise<unknown>;
}

async function main() {
  console.log('NullCarbon Indexer starting...');
  console.log(`  RPC: ${STELLAR_RPC_URL}`);
  console.log(`  RetirementVerifier: ${RETIREMENT_VERIFIER_ID}`);
  console.log(`  NullifierRegistry: ${NULLIFIER_REGISTRY_ID}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);

  const db = new Database();
  await db.connect();

  const pipelines: Pipeline[] = [];
  let shuttingDown = false;

  const retirementSource = new StellarEventSource(
    STELLAR_RPC_URL,
    RETIREMENT_VERIFIER_ID,
    'retired',
    'retirement',
    db,
  );
  const retirementHandler = new RetirementHandler(db);
  pipelines.push({
    name: 'retirement',
    poll: async () => {
      for (const event of await retirementSource.poll()) {
        await retirementHandler.handle(event);
      }
    },
  });

  const nullifierSource = new StellarEventSource(
    STELLAR_RPC_URL,
    NULLIFIER_REGISTRY_ID,
    'nullified',
    'nullifier',
    db,
  );
  const nullifierHandler = new NullifierHandler(db);
  pipelines.push({
    name: 'nullifier',
    poll: async () => {
      for (const event of await nullifierSource.poll()) {
        await nullifierHandler.handle(event);
      }
    },
  });

  const retryCounts = new Map<string, number>();

  async function pollAll() {
    if (shuttingDown) return;

    for (const pipeline of pipelines) {
      try {
        await pipeline.poll();
        retryCounts.set(pipeline.name, 0);
      } catch (err) {
        const attempts = (retryCounts.get(pipeline.name) ?? 0) + 1;
        retryCounts.set(pipeline.name, attempts);
        console.error(
          `${pipeline.name}: poll error (attempt ${attempts}/${MAX_RETRIES}):`,
          err,
        );
      }
    }
  }

  await pollAll();
  const timer = setInterval(pollAll, POLL_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — shutting down indexer...`);
    clearInterval(timer);
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('Indexer running. Press Ctrl+C to stop.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
