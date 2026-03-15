"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestDeletion = exports.exportData = exports.getComplianceRequests = void 0;
const ComplianceDB = __importStar(require("../db/compliance"));
const AuditDB = __importStar(require("../db/auditLogs"));
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'complianceController';
const getComplianceRequests = async (req, res) => {
    const companyId = req.companyId;
    try {
        const requests = await ComplianceDB.listComplianceRequests(companyId);
        res.status(200).json({ data: requests });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'getComplianceRequests', 'Failed to list compliance requests', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.getComplianceRequests = getComplianceRequests;
const exportData = async (req, res) => {
    const companyId = req.companyId;
    const userId = req.userId;
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
            } });
        await AuditDB.createAuditLog({
            companyId,
            userId,
            action: 'EXPORT',
            resourceType: 'compliance',
            resourceId: request.id,
            details: { requestType: 'export' },
        });
        res.status(200).json({ data, requestId: request.id });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'exportData', 'Failed to export company data', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.exportData = exportData;
const requestDeletion = async (req, res) => {
    const companyId = req.companyId;
    const userId = req.userId;
    const { confirm } = req.body;
    if (!confirm) {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'Deletion requires confirm=true');
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
        (0, logger_1.logInfo)(LOG_MODULE, 'requestDeletion', 'Company deletion completed', { companyId, requestId: request.id });
        res.status(200).json({ message: 'Deletion completed', requestId: request.id });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'requestDeletion', 'Failed to delete company data', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.requestDeletion = requestDeletion;
