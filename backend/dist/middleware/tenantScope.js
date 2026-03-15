"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantScopeGuard = tenantScopeGuard;
/**
 * App-level tenant guard to prevent accidental cross-tenant access
 * when endpoints accept company_id/companyId from client payload.
 */
function tenantScopeGuard(req, res, next) {
    const tokenCompanyId = req.companyId;
    if (!tokenCompanyId) {
        return res.status(401).json({ error: 'Missing tenant scope' });
    }
    const bodyCompanyId = (req.body?.companyId || req.body?.company_id);
    const queryCompanyId = (req.query?.companyId || req.query?.company_id);
    if (bodyCompanyId && bodyCompanyId !== tokenCompanyId) {
        return res.status(403).json({ error: 'Cross-tenant body access denied' });
    }
    if (queryCompanyId && queryCompanyId !== tokenCompanyId) {
        return res.status(403).json({ error: 'Cross-tenant query access denied' });
    }
    return next();
}
