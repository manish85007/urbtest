import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { auditLog } from './audit.js';
import type { SessionUser } from '../lib/auth-context.js';
import { toSessionUser } from '../lib/auth-context.js';

const LOCK_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const SESSION_HOURS = 8;

const locks = new Map<string, { count: number; until: number }>();

export async function signIn(email: string, password: string): Promise<{ user: SessionUser; token: string }> {
  const normalized = email.trim().toLowerCase();
  const lock = locks.get(normalized);
  if (lock && lock.until > Date.now()) {
    const mins = Math.ceil((lock.until - Date.now()) / 60000);
    throw new Error(
      `Account locked after ${LOCK_ATTEMPTS} failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
    );
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  const valid = user?.active && user.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!valid || !user) {
    const current = locks.get(normalized) ?? { count: 0, until: 0 };
    current.count += 1;
    if (current.count >= LOCK_ATTEMPTS) {
      current.until = Date.now() + LOCK_WINDOW_MS;
      current.count = 0;
    }
    locks.set(normalized, current);
    await auditLog({ actorEmail: normalized, action: 'auth.fail', entity: 'user', entityId: normalized });
    throw new Error('Incorrect email or password.');
  }

  locks.delete(normalized);
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: { userId: user.id, token, expiresAt },
  });

  await auditLog({
    actorEmail: user.email,
    actorId: user.id,
    action: 'auth.login',
    entity: 'user',
    entityId: user.email,
  });

  return { user: toSessionUser(user), token };
}

export async function signOut(token: string, actor?: SessionUser) {
  await prisma.session.deleteMany({ where: { token } });
  if (actor) {
    await auditLog({
      actorEmail: actor.email,
      actorId: actor.id,
      action: 'auth.logout',
      entity: 'user',
      entityId: actor.email,
    });
  }
}

export async function getSessionUser(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return toSessionUser(session.user);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function changePassword(actor: SessionUser, current: string, next: string) {
  if (next.length < 4) throw new Error('New password must be at least 4 characters.');

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) throw new Error('User not found.');

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) throw new Error('Current password is incorrect.');

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'auth.password_change',
    entity: 'user',
    entityId: actor.email,
  });

  return { ok: true };
}
