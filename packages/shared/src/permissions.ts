export type AppRole =
  | 'admin'
  | 'factory'
  | 'operations'
  | 'client'
  | 'client_readonly'
  | 'auditor';

export type RolePermissionKey =
  | 'acknowledgeRequest'
  | 'manageVehicles'
  | 'manageInvoices'
  | 'createMrn'
  | 'editMrn'
  | 'manageRecycling'
  | 'uploadCertificate'
  | 'rejectRequest'
  | 'editRequestAsStaff'
  | 'createRequestAsStaff'
  | 'backdateRequests'
  | 'manageQueries'
  | 'adminReports'
  | 'staffScope'
  | 'viewAllClients'
  | 'closeAsClient'
  | 'raiseClientRequest';

export interface RolePermissions {
  acknowledgeRequest: boolean;
  manageVehicles: boolean;
  manageInvoices: boolean;
  createMrn: boolean;
  editMrn: boolean;
  manageRecycling: boolean;
  uploadCertificate: boolean;
  rejectRequest: boolean;
  editRequestAsStaff: boolean;
  createRequestAsStaff: boolean;
  /** Super Admin only — raise / edit requests with pick-up dates from HISTORICAL_REQUEST_FROM. */
  backdateRequests: boolean;
  manageQueries: boolean;
  adminReports: boolean;
  staffScope: boolean;
  /** Cross-client read (auditor / admin / ops / factory). */
  viewAllClients: boolean;
  /** Client requestor may close invoices after CoD + payment. */
  closeAsClient: boolean;
  /** Client requestor may raise / edit / resubmit pickup requests. */
  raiseClientRequest: boolean;
}

const FULL_ACCESS: RolePermissions = {
  acknowledgeRequest: true,
  manageVehicles: true,
  manageInvoices: true,
  createMrn: true,
  editMrn: true,
  manageRecycling: true,
  uploadCertificate: true,
  rejectRequest: true,
  editRequestAsStaff: true,
  createRequestAsStaff: true,
  backdateRequests: true,
  manageQueries: true,
  adminReports: true,
  staffScope: true,
  viewAllClients: true,
  closeAsClient: false,
  raiseClientRequest: false,
};

const OPERATIONS: RolePermissions = {
  acknowledgeRequest: true,
  manageVehicles: true,
  manageInvoices: false,
  createMrn: false,
  editMrn: false,
  manageRecycling: false,
  uploadCertificate: false,
  rejectRequest: true,
  editRequestAsStaff: false,
  createRequestAsStaff: false,
  backdateRequests: false,
  manageQueries: false,
  adminReports: true,
  staffScope: true,
  viewAllClients: true,
  closeAsClient: false,
  raiseClientRequest: false,
};

const FACTORY: RolePermissions = {
  acknowledgeRequest: false,
  manageVehicles: false,
  manageInvoices: false,
  createMrn: true,
  editMrn: false,
  manageRecycling: true,
  uploadCertificate: false,
  rejectRequest: false,
  editRequestAsStaff: false,
  createRequestAsStaff: false,
  backdateRequests: false,
  manageQueries: false,
  adminReports: false,
  staffScope: true,
  viewAllClients: true,
  closeAsClient: false,
  raiseClientRequest: false,
};

const CLIENT: RolePermissions = {
  acknowledgeRequest: false,
  manageVehicles: false,
  manageInvoices: false,
  createMrn: false,
  editMrn: false,
  manageRecycling: false,
  uploadCertificate: false,
  rejectRequest: false,
  editRequestAsStaff: false,
  createRequestAsStaff: false,
  backdateRequests: false,
  manageQueries: false,
  adminReports: false,
  staffScope: false,
  viewAllClients: false,
  closeAsClient: true,
  raiseClientRequest: true,
};

const CLIENT_READONLY: RolePermissions = {
  ...CLIENT,
  closeAsClient: false,
  raiseClientRequest: false,
};

const AUDITOR: RolePermissions = {
  acknowledgeRequest: false,
  manageVehicles: false,
  manageInvoices: false,
  createMrn: false,
  editMrn: false,
  manageRecycling: false,
  uploadCertificate: false,
  rejectRequest: false,
  editRequestAsStaff: false,
  createRequestAsStaff: false,
  backdateRequests: false,
  manageQueries: false,
  adminReports: true,
  staffScope: false,
  viewAllClients: true,
  closeAsClient: false,
  raiseClientRequest: false,
};

export function permissionsFor(role: string): RolePermissions {
  switch (role) {
    case 'admin':
      return FULL_ACCESS;
    case 'operations':
      return OPERATIONS;
    case 'factory':
      return FACTORY;
    case 'client':
      return CLIENT;
    case 'client_readonly':
      return CLIENT_READONLY;
    case 'auditor':
      return AUDITOR;
    default:
      return CLIENT_READONLY;
  }
}

/** Operational Urbeno staff (can mutate lifecycle where permitted). */
export function isStaffRole(role: string): boolean {
  return role === 'admin' || role === 'factory' || role === 'operations';
}

/** Client organisation portal roles (tenant-scoped). */
export function isClientPortalRole(role: string): boolean {
  return role === 'client' || role === 'client_readonly';
}

/** Client users who may raise / edit / close requests. */
export function isClientMutatorRole(role: string): boolean {
  return role === 'client';
}

export function isAuditorRole(role: string): boolean {
  return role === 'auditor';
}

/** Urbeno mailbox required for internal roles (staff + auditor). */
export function requiresUrbenoEmail(role: string): boolean {
  return isStaffRole(role) || isAuditorRole(role);
}

export function hasPermission(role: string, key: RolePermissionKey): boolean {
  return permissionsFor(role)[key];
}
