import { prisma } from '../lib/prisma.js';

export async function notifyUsers(
  emails: string[],
  kind: string,
  text: string,
  link?: string,
) {
  const users = await prisma.user.findMany({
    where: { email: { in: emails }, active: true },
    select: { id: true },
  });

  if (!users.length) return;

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      kind,
      text,
      link: link ?? null,
    })),
  });
}

export async function notifyAdmins(kind: string, text: string, link?: string) {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', active: true },
    select: { email: true },
  });
  await notifyUsers(
    admins.map((a) => a.email),
    kind,
    text,
    link,
  );
}

export async function notifyStaff(kind: string, text: string, link?: string) {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['admin', 'operations', 'factory'] }, active: true },
    select: { email: true },
  });
  await notifyUsers(
    staff.map((u) => u.email),
    kind,
    text,
    link,
  );
}

export async function notifyClientUsers(clientId: string, kind: string, text: string, link?: string) {
  const users = await prisma.user.findMany({
    where: { clientId, active: true },
    select: { email: true },
  });
  await notifyUsers(
    users.map((u) => u.email),
    kind,
    text,
    link,
  );
}
