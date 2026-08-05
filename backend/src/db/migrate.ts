import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

async function migrate() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ||
      'postgres://nullcarbon:nullcarbon@localhost:5432/nullcarbon',
  });

  await client.connect();
  console.log('Connected to PostgreSQL');

  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    await client.query(sql);
    console.log(`Applied ${file}`);
  }

  console.log('Migration complete');
  await client.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
