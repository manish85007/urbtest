import { isClientMutatorRole } from './permissions.js';

export type DocumentCloseBlocker = 'no_cod' | 'not_certified' | 'unpaid';
export type RequestorCloseBlocker = 'not_client' | 'no_requestor' | 'peer_wait';
export type CloseBlocker = DocumentCloseBlocker | RequestorCloseBlocker;

export interface CloseChecklistInput {
  hasCod: boolean;
  certified: boolean;
  paid: boolean;
  /** Who is reading the checklist. Staff see assignment status, not “you may close”. */
  audience: 'client' | 'staff';
  actorRole: string;
  actorEmail: string;
  onBehalfOf?: string | null;
  createdBy: string;
  /** True when the request was raised by a client user (not staff). */
  raisedByClient: boolean;
  /** Days since the first certificate upload. 0 if none. */
  daysSinceFirstCertificate: number;
}

export interface CloseChecklistItem {
  id: 'cod' | 'certified' | 'paid' | 'requestor';
  ok: boolean;
  text: string;
}

export function documentCloseBlocker(input: {
  hasCod: boolean;
  certified: boolean;
  paid: boolean;
}): DocumentCloseBlocker | null {
  if (!input.hasCod) return 'no_cod';
  if (!input.certified) return 'not_certified';
  if (!input.paid) return 'unpaid';
  return null;
}

/** Who may close immediately, before the 30-day peer window. */
export function effectiveCloseRequestor(input: {
  onBehalfOf?: string | null;
  createdBy: string;
  raisedByClient: boolean;
}): { email: string } | { missing: true } {
  const assigned = input.onBehalfOf?.trim();
  if (assigned) return { email: assigned };
  if (input.raisedByClient && input.createdBy.trim()) return { email: input.createdBy.trim() };
  return { missing: true };
}

export function requestorCloseBlocker(input: {
  actorRole: string;
  actorEmail: string;
  onBehalfOf?: string | null;
  createdBy: string;
  raisedByClient: boolean;
  daysSinceFirstCertificate: number;
}): RequestorCloseBlocker | null {
  if (!isClientMutatorRole(input.actorRole)) return 'not_client';
  const requestor = effectiveCloseRequestor(input);
  if ('missing' in requestor) return 'no_requestor';
  const isRequestor = input.actorEmail.trim().toLowerCase() === requestor.email.toLowerCase();
  if (!isRequestor && input.daysSinceFirstCertificate < 30) return 'peer_wait';
  return null;
}

export function closeChecklist(input: CloseChecklistInput): CloseChecklistItem[] {
  const requestorBlock =
    input.audience === 'staff'
      ? staffRequestorView(input)
      : requestorCloseBlocker(input);

  return [
    {
      id: 'cod',
      ok: input.hasCod,
      text: input.hasCod
        ? 'Certificate of Destruction is on file.'
        : 'Certificate of Destruction is not uploaded yet.',
    },
    {
      id: 'certified',
      ok: input.certified,
      text: input.certified
        ? 'Form 6 and CoD are published to the client portal.'
        : input.audience === 'staff'
          ? 'Super Admin must certify Form 6 and CoD before the client can close.'
          : 'Form 6 and CoD are not published to your portal yet.',
    },
    {
      id: 'paid',
      ok: input.paid,
      text: input.paid ? 'Invoice is paid in full.' : 'Payment is still outstanding.',
    },
    {
      id: 'requestor',
      ok: requestorBlock == null,
      text: requestorChecklistText(input.audience, requestorBlock),
    },
  ];
}

export function actorMayCloseInvoice(input: CloseChecklistInput): boolean {
  if (input.audience !== 'client') return false;
  return (
    documentCloseBlocker(input) == null &&
    requestorCloseBlocker(input) == null
  );
}

function staffRequestorView(input: CloseChecklistInput): RequestorCloseBlocker | null {
  const requestor = effectiveCloseRequestor(input);
  if ('missing' in requestor) return 'no_requestor';
  return null;
}

function requestorChecklistText(
  audience: 'client' | 'staff',
  blocker: RequestorCloseBlocker | null,
): string {
  if (audience === 'staff') {
    if (blocker === 'no_requestor') {
      return 'Assign a client requestor before this invoice can be closed.';
    }
    return 'A client requestor can close this invoice.';
  }
  switch (blocker) {
    case 'not_client':
      return 'Read-only accounts cannot close requests.';
    case 'no_requestor':
      return 'A requestor has not been assigned. You cannot close this yet.';
    case 'peer_wait':
      return 'Only the requestor can close until 30 days after the certificate.';
    default:
      return 'You can close this invoice.';
  }
}
