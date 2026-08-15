import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { signIn, signOut } from '../services/auth.js';
import { attachSession, requireAuth, SESSION_COOKIE } from '../middleware/session.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.parse(request.body);
    try {
      const { user, token } = await signIn(body.email, body.password);
      reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 8 * 60 * 60,
      });
      return { user };
    } catch (err) {
      return reply.badRequest(err instanceof Error ? err.message : 'Login failed');
    }
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await signOut(token, request.user!);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    return { user: request.user };
  });
}
