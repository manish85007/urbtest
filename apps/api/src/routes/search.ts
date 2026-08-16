import type { FastifyInstance } from 'fastify';
import { attachSession, requireAuth } from '../middleware/session.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  searchPortal,
  unreadCount,
} from '../services/search.js';

export async function searchRoutes(app: FastifyInstance) {
  app.addHook('preHandler', attachSession);

  app.get('/search', { preHandler: requireAuth }, async (request) => {
    const { q } = request.query as { q?: string };
    return searchPortal(request.user!, q ?? '');
  });

  app.get('/notifications', { preHandler: requireAuth }, async (request) => {
    const userId = request.user!.id;
    const [items, unread] = await Promise.all([
      listNotifications(userId),
      unreadCount(userId),
    ]);
    return { unread, items };
  });

  app.post('/notifications/read-all', { preHandler: requireAuth }, async (request) => {
    await markAllNotificationsRead(request.user!.id);
    return { ok: true };
  });

  app.post('/notifications/:id/read', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    await markNotificationRead(request.user!.id, id);
    return { ok: true };
  });
}
