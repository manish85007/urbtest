export type AppRole = 'admin' | 'factory' | 'operations' | 'client';

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
  | 'manageQueries'
  | 'adminReports'
  | 'staffScope';

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
  manageQueries: boolean;
  adminReports: boolean;
  staffScope: boolean;
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
  manageQueries: true,
  adminReports: true,
  staffScope: true,
};

const OPERATIONS: RolePermissions = {
  acknowledgeRequest: true,
  manageVehicles: true,
  manageInvoices: false,
  createMrn: false,
  editMrn: false,
  manageRecycling: false,
  uploadCertificate: false,
  // Ops managers can "resend request to requestor" by raising clarifications.
  rejectRequest: true,
  editRequestAsStaff: false,
  createRequestAsStaff: false,
  manageQueries: false,
  adminReports: true,
  staffScope: true,
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
  manageQueries: false,
  adminReports: false,
  staffScope: true,
};

const NO_ACCESS: RolePermissions = {
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
  manageQueries: false,
  adminReports: false,
  staffScope: false,
};

export function permissionsFor(role: string): RolePermissions {
  switch (role) {
    case 'admin':
      return FULL_ACCESS;
    case 'operations':
      return OPERATIONS;
    case 'factory':
      return FACTORY;
    default:
      return NO_ACCESS;
  }
}

export function isStaffRole(role: string): boolean {
  return role === 'admin' || role === 'factory' || role === 'operations';
}

export function hasPermission(role: string, key: RolePermissionKey): boolean {
  return permissionsFor(role)[key];
}
