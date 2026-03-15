"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureOwnerMembership = ensureOwnerMembership;
exports.listMembers = listMembers;
exports.updateMemberRole = updateMemberRole;
exports.revokeMember = revokeMember;
exports.createInvitation = createInvitation;
exports.listInvitations = listInvitations;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
async function ensureOwnerMembership(companyId, userId) {
    await database_1.pool.query(`INSERT INTO organization_members (company_id, user_id, role)
     VALUES ($1, $2, 'owner')
     ON CONFLICT (company_id, user_id)
     DO UPDATE SET role = 'owner', updated_at = NOW()`, [companyId, userId]);
}
async function listMembers(companyId) {
    const result = await database_1.pool.query(`SELECT om.id, om.role, om.created_at,
            u.id AS user_id, u.email, u.first_name, u.last_name, u.is_active
     FROM organization_members om
     JOIN users u ON u.id = om.user_id
     WHERE om.company_id = $1
     ORDER BY CASE om.role
       WHEN 'owner' THEN 1
       WHEN 'admin' THEN 2
       WHEN 'member' THEN 3
       ELSE 4 END, u.created_at ASC`, [companyId]);
    return result.rows;
}
async function updateMemberRole(companyId, userId, role) {
    await database_1.pool.query(`UPDATE organization_members
     SET role = $3, updated_at = NOW()
     WHERE company_id = $1 AND user_id = $2`, [companyId, userId, role]);
}
async function revokeMember(companyId, userId) {
    await database_1.pool.query(`DELETE FROM organization_members
     WHERE company_id = $1 AND user_id = $2`, [companyId, userId]);
}
async function createInvitation(input) {
    const token = crypto_1.default.randomBytes(24).toString('hex');
    await database_1.pool.query(`INSERT INTO invitations (company_id, email, role, invited_by_user_id, token, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (company_id, email)
     DO UPDATE SET
       role = EXCLUDED.role,
       invited_by_user_id = EXCLUDED.invited_by_user_id,
       token = EXCLUDED.token,
       expires_at = EXCLUDED.expires_at,
       accepted_at = NULL,
       created_at = NOW()`, [input.companyId, input.email.toLowerCase(), input.role, input.invitedByUserId, token, input.expiresAt]);
    return { token };
}
async function listInvitations(companyId) {
    const result = await database_1.pool.query(`SELECT id, email, role, token, expires_at, accepted_at, created_at
     FROM invitations
     WHERE company_id = $1
     ORDER BY created_at DESC`, [companyId]);
    return result.rows;
}
