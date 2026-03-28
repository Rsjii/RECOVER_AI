// Re-export audit request functions from auditRequests
import * as AuditRequests from './auditRequests';

export const getAuditRequest = AuditRequests.getAuditRequest;
export const getAuditRequestByToken = AuditRequests.getAuditRequestByToken;
export const updateAuditRequest = AuditRequests.updateAuditRequest;
export const updateAuditRequestStatusById = AuditRequests.updateAuditRequestStatusById;
export const listAuditRequests = AuditRequests.listAuditRequests;
export const getAuditRequestStats = AuditRequests.getAuditRequestStats;
export const findInProgressAudit = AuditRequests.findInProgressAudit;
export const createAuditRequest = AuditRequests.createAuditRequest;
