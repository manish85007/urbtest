import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Monorepo root `.env` lives outside `apps/api`; dotenv defaults miss it. */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

for (const envPath of [resolve(repoRoot, '.env'), resolve(repoRoot, 'apps/api/.env')]) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}
