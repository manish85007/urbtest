import type { SessionUser } from '../lib/auth-context.js';
import { isStaff } from '../lib/auth-context.js';
import { AppError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { loadSubmissionForActor } from '../lib/access.js';
import { deriveSubmissionStage } from '../lib/stage-mapper.js';
import { auditLog } from './audit.js';
import { notifyAdmins, notifyClientUsers } from './notifications.js';

export async function raiseQuery(actor: SessionUser, submissionId: string, text: string) {
  const body = text.trim();
  if (!body) throw new AppError('Type your query first.');

  const sub = await loadSubmissionForActor(submissionId, actor);
  if (sub.closedAt) {
    throw new AppError('This request is closed. Edits are no longer available.');
  }
  const fromRole = isStaff(actor) ? 'admin' : 'client';

  const query = await prisma.requestQuery.create({
    data: {
      submissionId: sub.id,
      fromRole,
      authorName: actor.name,
      authorEmail: actor.email,
      stage: deriveSubmissionStage(sub),
      text: body,
      status: 'open',
    },
    include: { replies: true },
  });

  if (fromRole === 'admin') {
    await notifyClientUsers(sub.clientId, 'query', `New query on ${sub.id} from ${actor.name}`, sub.id);
  } else {
    await notifyAdmins('query', `New query on ${sub.id} from ${actor.name}`, sub.id);
  }

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'query.raise',
    entity: 'submission',
    entityId: sub.id,
    details: { txt: body },
  });

  return query;
}

export async function replyToQuery(actor: SessionUser, queryId: string, text: string) {
  const body = text.trim();
  if (!body) throw new AppError('Type your reply first.');

  const query = await prisma.requestQuery.findUnique({
    where: { id: queryId },
    include: { replies: true },
  });
  if (!query) throw new AppError('Query not found.', 404);

  const sub = await loadSubmissionForActor(query.submissionId, actor);
  if (sub.closedAt) {
    throw new AppError('This request is closed. Edits are no longer available.');
  }
  const actorSide = isStaff(actor) ? 'admin' : 'client';
  if (query.fromRole === actorSide && query.status === 'open') {
    throw new AppError('Wait for the other party to reply before sending another note on this thread.');
  }

  const reply = await prisma.queryReply.create({
    data: {
      queryId: query.id,
      authorName: actor.name,
      authorEmail: actor.email,
      text: body,
    },
  });

  await prisma.requestQuery.update({
    where: { id: query.id },
    data: { status: 'resolved' },
  });

  if (query.fromRole === 'client') {
    await notifyClientUsers(sub.clientId, 'query', `Query on ${sub.id} answered by ${actor.name}`, sub.id);
  } else {
    await notifyAdmins('query', `Query on ${sub.id} answered by ${actor.name}`, sub.id);
  }

  await auditLog({
    actorEmail: actor.email,
    actorId: actor.id,
    action: 'query.reply',
    entity: 'submission',
    entityId: sub.id,
    details: { queryId: query.id, txt: body },
  });

  return reply;
}

export async function listQueries(actor: SessionUser, submissionId: string) {
  await loadSubmissionForActor(submissionId, actor);
  return prisma.requestQuery.findMany({
    where: { submissionId },
    include: { replies: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
}
