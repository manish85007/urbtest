import { prisma } from '../lib/prisma.js';
import { canSeeMrn, clientScopeFilter, isStaff, type SessionUser } from '../lib/auth-context.js';

export interface SearchHit {
  grp: string;
  label: string;
  sub: string;
  href: string;
}

export async function searchPortal(actor: SessionUser, qRaw: string): Promise<SearchHit[]> {
  const q = qRaw.trim().toLowerCase();
  if (q.length < 2) return [];

  const out: SearchHit[] = [];
  const push = (hit: SearchHit) => {
    if (out.length < 40) out.push(hit);
  };

  const subs = await prisma.submission.findMany({
    where: clientScopeFilter(actor),
    include: {
      client: { select: { id: true, name: true, city: true } },
      site: { select: { name: true, gstin: true } },
      invoices: {
        include: {
          mrn: true,
          recycling: true,
          certificates: true,
        },
      },
    },
    take: 250,
    orderBy: { createdAt: 'desc' },
  });

  for (const s of subs) {
    const hay = `${s.id} ${s.ref ?? ''} ${s.location ?? ''} ${s.client.name} ${s.site.name}`.toLowerCase();
    if (hay.includes(q)) {
      push({
        grp: 'Requests',
        label: s.id,
        sub: `${s.client.name} · ${s.site.name} · ${s.ref || 'no PO'}`,
        href: `/requests/${s.id}`,
      });
    }

    for (const inv of s.invoices) {
      if (inv.invoiceNo.toLowerCase().includes(q)) {
        push({
          grp: 'Invoices',
          label: inv.invoiceNo,
          sub: `${s.id} · ${s.client.name}`,
          href: `/requests/${s.id}`,
        });
      }
      if (inv.ewayBillNo.toLowerCase().includes(q)) {
        push({
          grp: 'E-way Bills',
          label: inv.ewayBillNo,
          sub: `${inv.invoiceNo} · ${s.id}`,
          href: `/requests/${s.id}`,
        });
      }
      if (canSeeMrn(actor) && inv.mrn?.mrnNo.toLowerCase().includes(q)) {
        push({
          grp: 'MRNs',
          label: inv.mrn.mrnNo,
          sub: `${inv.invoiceNo} · ${s.id}`,
          href: `/requests/${s.id}`,
        });
      }
      if (inv.recycling?.form6No.toLowerCase().includes(q)) {
        push({
          grp: 'Form 6',
          label: inv.recycling.form6No,
          sub: `${inv.invoiceNo} · ${s.id}`,
          href: `/requests/${s.id}`,
        });
      }
      for (const cd of inv.certificates) {
        if (cd.certNo.toLowerCase().includes(q)) {
          push({
            grp: 'Certificates',
            label: cd.certNo,
            sub: `${inv.invoiceNo} · ${s.id}`,
            href: `/requests/${s.id}`,
          });
        }
      }
    }
  }

  if (isStaff(actor)) {
    const clients = await prisma.client.findMany({
      where: { active: true },
      include: { sites: { where: { active: true } } },
    });
    for (const c of clients) {
      if (`${c.id} ${c.name} ${c.city ?? ''}`.toLowerCase().includes(q)) {
        push({
          grp: 'Clients',
          label: `${c.id} — ${c.name}`,
          sub: `${c.city ?? ''} · ${c.sites.length} site${c.sites.length === 1 ? '' : 's'}`,
          href: '/masters',
        });
      }
      for (const st of c.sites) {
        if (`${st.name} ${st.gstin ?? ''} ${st.address ?? ''}`.toLowerCase().includes(q)) {
          push({
            grp: 'Sites',
            label: st.name,
            sub: `${c.name} · ${st.gstin || 'no GST'}`,
            href: '/masters',
          });
        }
      }
    }
  }

  return out.slice(0, 40);
}

export async function listNotifications(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markNotificationRead(userId: string, id: string) {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
