#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const user = process.env.DATABASE_USER || 'tectrack';
const password = process.env.DATABASE_PASSWORD || '';
const host = process.env.DATABASE_HOST || 'localhost';
const name = process.env.DATABASE_NAME || 'tectrack';

if (!password || !host) {
  console.error('DATABASE_PASSWORD and DATABASE_HOST are required');
  process.exit(1);
}

process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${name}?schema=public`;

const migration = process.argv[2] || '20260817120000_v64_compliance';
const mode = process.argv[3] || 'fix';

function runPrisma(...args) {
  console.log(`> prisma ${args.join(' ')}`);
  const result = spawnSync(
    'pnpm',
    ['--filter', '@urb-tectrack/api', 'exec', 'prisma', ...args],
    { stdio: 'inherit', env: process.env },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

runPrisma('migrate', 'status');

if (mode === 'status') {
  process.exit(0);
}

if (mode === 'applied') {
  runPrisma('migrate', 'resolve', '--applied', migration);
} else {
  runPrisma('migrate', 'resolve', '--rolled-back', migration);
  runPrisma('migrate', 'deploy');
}

console.log('Migration repair complete.');
