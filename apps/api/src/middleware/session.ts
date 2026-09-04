import type { FastifyReply, FastifyRequest } from 'fastify';
import { getSessionUser } from '../services/auth.js';
import type { SessionUser } from '../lib/auth-context.js';

const SESSION_COOKIE = 'tectrack_session';

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
  }
}

export async function attachSession(request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  request.user = await getSessionUser(token);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.unauthorized('Sign in to continue.');
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user || request.user.role !== 'admin') {
    return reply.forbidden('Admin access required.');
  }
}

/** Super Admin or Auditor — read paths for audit / compliance. */
export async function requireAdminOrAuditor(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'auditor')) {
    return reply.forbidden('Admin or auditor access required.');
  }
}

export async function requireStaff(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user || (request.user.role !== 'admin' && request.user.role !== 'factory' && request.user.role !== 'operations')) {
    return reply.forbidden('Staff access required.');
  }
}

export { SESSION_COOKIE };
