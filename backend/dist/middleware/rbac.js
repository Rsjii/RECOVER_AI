"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
const ROLE_WEIGHT = {
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4,
};
function requireRole(minRole) {
    return async (req, res, next) => {
        const userId = req.userId;
        const companyId = req.companyId;
        if (!userId || !companyId) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const result = await database_1.pool.query(`SELECT COALESCE(om.role, u.role) AS role
       FROM users u
       LEFT JOIN organization_members om ON om.user_id = u.id AND om.company_id = u.company_id
       WHERE u.id = $1 AND u.company_id = $2
       LIMIT 1`, [userId, companyId]);
        const actual = result.rows[0]?.role || 'viewer';
        if ((ROLE_WEIGHT[actual] || 0) < ROLE_WEIGHT[minRole]) {
            (0, logger_1.logInfo)('rbac', 'requireRole', 'Forbidden role', { userId, companyId, required: minRole, actual });
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        req.role = actual;
        next();
    };
}
