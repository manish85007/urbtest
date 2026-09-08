import { roleDisplayLabel } from '@urb-tectrack/shared';

/**
 * site       — portal user who can see this request's site
 * internal   — Urbeno staff member who raised the request (internal copy)
 * contact    — site contact on file, not a portal user
 * other-site — portal user on the account with no access to this request's site
 */
export type ComplianceRecipientGroup = 'site' | 'internal' | 'contact' | 'other-site';

export interface ComplianceRecipient {
  email: string;
  name: string;
  role: string | null;
  roleLabel: string;
  group: ComplianceRecipientGroup;
  siteLinked: boolean;
  allSites: boolean;
  raisedRequest: boolean;
  onBehalfOf: boolean;
  /** Pre-ticked in the picker and used when the caller sends no explicit list. */
  suggested: boolean;
  note: string;
}

export interface RecipientUser {
  email: string;
  name?: string | null;
  role: string;
  siteIds?: string[];
  active?: boolean;
}

export interface RecipientContext {
  users: RecipientUser[];
  siteId: string;
  siteName: string;
  siteContactEmail?: string | null;
  siteContactName?: string | null;
  createdBy: string;
  onBehalfOf?: string | null;
}

const PORTAL_ROLES = new Set(['client', 'client_readonly']);
const GROUP_RANK: Record<ComplianceRecipientGroup, number> = {
  site: 0,
  internal: 1,
  contact: 2,
  'other-site': 3,
};

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function displayName(name: string | null | undefined, email: string): string {
  return name?.trim() || email;
}

/**
 * Every address that may receive the compliance documents for one request, with the
 * site linkage that decides whether it is suggested by default. Pure so the rules can
 * be unit tested without a database.
 */
export function buildComplianceRecipients(ctx: RecipientContext): ComplianceRecipient[] {
  const createdBy = normalizeEmail(ctx.createdBy);
  const onBehalfOf = normalizeEmail(ctx.onBehalfOf);
  const out = new Map<string, ComplianceRecipient>();

  for (const user of ctx.users) {
    const email = normalizeEmail(user.email);
    if (!email || user.active === false || out.has(email)) continue;

    const raisedRequest = email === createdBy;
    const isOnBehalfOf = email === onBehalfOf;
    const isPortalUser = PORTAL_ROLES.has(user.role);
    if (!isPortalUser && !raisedRequest && !isOnBehalfOf) continue;

    const siteIds = user.siteIds ?? [];
    const allSites = isPortalUser && siteIds.length === 0;
    const siteLinked = isPortalUser && (allSites || siteIds.includes(ctx.siteId));

    let group: ComplianceRecipientGroup;
    let note: string;
    if (!isPortalUser) {
      group = 'internal';
      note = raisedRequest ? 'Urbeno — raised this request' : 'Urbeno — request contact';
    } else if (siteLinked) {
      group = 'site';
      note = allSites ? 'Access to all sites on this account' : `Linked to ${ctx.siteName}`;
    } else {
      group = 'other-site';
      note = `Not linked to ${ctx.siteName}`;
    }
    if (isOnBehalfOf) note = `${note} — request raised on their behalf`;
    else if (raisedRequest && isPortalUser) note = `${note} — raised this request`;

    out.set(email, {
      email,
      name: displayName(user.name, email),
      role: user.role,
      roleLabel: roleDisplayLabel(user.role),
      group,
      siteLinked,
      allSites,
      raisedRequest,
      onBehalfOf: isOnBehalfOf,
      suggested: group === 'site' || group === 'internal' || isOnBehalfOf,
      note,
    });
  }

  const contactEmail = normalizeEmail(ctx.siteContactEmail);
  if (contactEmail && !out.has(contactEmail)) {
    out.set(contactEmail, {
      email: contactEmail,
      name: displayName(ctx.siteContactName, contactEmail),
      role: null,
      roleLabel: 'Site contact',
      group: 'contact',
      siteLinked: true,
      allSites: false,
      raisedRequest: false,
      onBehalfOf: false,
      suggested: false,
      note: `Site contact on file for ${ctx.siteName} — no portal account`,
    });
  }

  return [...out.values()].sort((a, b) => {
    if (GROUP_RANK[a.group] !== GROUP_RANK[b.group]) return GROUP_RANK[a.group] - GROUP_RANK[b.group];
    if (a.role !== b.role) return (a.role ?? '').localeCompare(b.role ?? '');
    return a.name.localeCompare(b.name);
  });
}

export interface RecipientSelection {
  emails: string[];
  skipped: string[];
  unknown: string[];
  mode: 'selected' | 'default';
}

/**
 * Resolve the addresses to mail. `selected` of `null`/`undefined` means the caller made no
 * choice, so only the suggested (site-linked) addresses are used — an account user with no
 * access to the request's site is never mailed by accident. Anything outside the candidate
 * list is reported back as unknown so the endpoint cannot be used to mail arbitrary people.
 */
export function selectComplianceRecipients(
  candidates: ComplianceRecipient[],
  selected?: string[] | null,
): RecipientSelection {
  const allowed = new Map(candidates.map((c) => [c.email, c]));

  if (!selected) {
    const emails = candidates.filter((c) => c.suggested).map((c) => c.email);
    return {
      emails,
      skipped: candidates.filter((c) => !c.suggested).map((c) => c.email),
      unknown: [],
      mode: 'default',
    };
  }

  const wanted = new Set(selected.map(normalizeEmail).filter(Boolean));
  return {
    emails: candidates.filter((c) => wanted.has(c.email)).map((c) => c.email),
    skipped: candidates.filter((c) => !wanted.has(c.email)).map((c) => c.email),
    unknown: [...wanted].filter((e) => !allowed.has(e)),
    mode: 'selected',
  };
}
