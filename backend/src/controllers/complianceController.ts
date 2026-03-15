import { Request, Response } from 'express';
import * as ComplianceDB from '../db/compliance';
import * as AuditDB from '../db/auditLogs';
import { logError, logInfo } from '../utils/logger';
import { sendErrorResponse, parseError } from '../utils/errorHandler';

const LOG_MODULE = 'complianceController';

export const getComplianceRequests = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  try {
    const requests = await ComplianceDB.listComplianceRequests(companyId);
    res.status(200).json({ data: requests });
  } catch (error) {
    logError(LOG_MODULE, 'getComplianceRequests', 'Failed to list compliance requests', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const exportData = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const userId = (req as any).userId as string;
  try {
    const request = await ComplianceDB.createComplianceRequest({
      companyId,
      requestedByUserId: userId,
      requestType: 'export',
    });
    const data = await ComplianceDB.exportCompanyData(companyId);
    await ComplianceDB.markComplianceRequestCompleted(request.id, { recordCounts: {
      users: Array.isArray(data.users) ? data.users.length : 0,
      customers: Array.isArray(data.customers) ? data.customers.length : 0,
      invoices: Array.isArray(data.invoices) ? data.invoices.length : 0,
    }});

    await AuditDB.createAuditLog({
      companyId,
      userId,
      action: 'EXPORT',
      resourceType: 'compliance',
      resourceId: request.id,
      details: { requestType: 'export' },
    });

    res.status(200).json({ data, requestId: request.id });
  } catch (error) {
    logError(LOG_MODULE, 'exportData', 'Failed to export company data', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};

export const requestDeletion = async (req: Request, res: Response): Promise<void> => {
  const companyId = (req as any).companyId as string;
  const userId = (req as any).userId as string;
  const { confirm } = req.body as { confirm?: boolean };

  if (!confirm) {
    sendErrorResponse(res, 400, 'Deletion requires confirm=true');
    return;
  }

  try {
    const request = await ComplianceDB.createComplianceRequest({
      companyId,
      requestedByUserId: userId,
      requestType: 'delete',
    });
    await ComplianceDB.requestCompanyDeletion(companyId);
    await ComplianceDB.markComplianceRequestCompleted(request.id, { deleted: true });

    logInfo(LOG_MODULE, 'requestDeletion', 'Company deletion completed', { companyId, requestId: request.id });
    res.status(200).json({ message: 'Deletion completed', requestId: request.id });
  } catch (error) {
    logError(LOG_MODULE, 'requestDeletion', 'Failed to delete company data', error, { companyId });
    const { statusCode, message } = parseError(error);
    sendErrorResponse(res, statusCode, message);
  }
};


