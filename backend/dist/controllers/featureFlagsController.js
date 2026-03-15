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
exports.upsertFeatureFlag = exports.listFeatureFlags = void 0;
const FeatureFlagDB = __importStar(require("../db/featureFlags"));
const AuditDB = __importStar(require("../db/auditLogs"));
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("../utils/errorHandler");
const LOG_MODULE = 'featureFlagsController';
const listFeatureFlags = async (req, res) => {
    const companyId = req.companyId;
    try {
        const flags = await FeatureFlagDB.listFeatureFlags(companyId);
        res.status(200).json({ data: flags });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'listFeatureFlags', 'Failed to list flags', error, { companyId });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.listFeatureFlags = listFeatureFlags;
const upsertFeatureFlag = async (req, res) => {
    const companyId = req.companyId;
    const userId = req.userId;
    const { key, enabled, value } = req.body;
    if (!key || typeof enabled !== 'boolean') {
        (0, errorHandler_1.sendErrorResponse)(res, 400, 'key and enabled are required');
        return;
    }
    try {
        await FeatureFlagDB.upsertFeatureFlag(companyId, key, enabled, value);
        await AuditDB.createAuditLog({
            companyId,
            userId,
            action: 'UPDATE',
            resourceType: 'feature_flag',
            resourceId: key,
            details: { enabled, value: value || {} },
        });
        res.status(200).json({ message: 'Feature flag updated' });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, 'upsertFeatureFlag', 'Failed to update feature flag', error, { companyId, key });
        const { statusCode, message } = (0, errorHandler_1.parseError)(error);
        (0, errorHandler_1.sendErrorResponse)(res, statusCode, message);
    }
};
exports.upsertFeatureFlag = upsertFeatureFlag;
