#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

if (process.env.PORT && !process.env.API_PORT) {
  process.env.API_PORT = process.env.PORT;
}

const user = process.env.DATABASE_USER || 'tectrack';
const password = process.env.DATABASE_PASSWORD || '';
const host = process.env.DATABASE_HOST || 'localhost';
const name = process.env.DATABASE_NAME || 'tectrack';
const cloudSql = process.env.INSTANCE_UNIX_SOCKET || process.env.CLOUD_SQL_CONNECTION_NAME || '';

if (!process.env.DATABASE_URL && password) {
  if (cloudSql) {
    const socket = cloudSql.startsWith('/') ? cloudSql : `/cloudsql/${cloudSql}`;
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${name}?host=${encodeURIComponent(socket)}&schema=public`;
  } else if (host) {
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${name}?schema=public`;
  }
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('pnpm', ['--filter', '@urb-tectrack/api', 'exec', 'prisma', 'migrate', 'deploy']);
if (process.env.UAT_SEED === 'true') {
  run('pnpm', ['--filter', '@urb-tectrack/api', 'db:seed']);
}
run('node', ['apps/api/dist/index.js']);
