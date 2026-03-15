"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUser = createUser;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.findUserWithCompany = findUserWithCompany;
exports.findUserWithCompanyByEmail = findUserWithCompanyByEmail;
exports.updateLastLogin = updateLastLogin;
exports.updateUser = updateUser;
exports.deactivateUser = deactivateUser;
exports.setResetToken = setResetToken;
exports.findUserByResetToken = findUserByResetToken;
exports.updatePassword = updatePassword;
exports.clearResetToken = clearResetToken;
const database_1 = require("../config/database");
async function createUser(input) {
    const { companyId, email, passwordHash, firstName, lastName, role = 'member' } = input;
    const result = await database_1.pool.query(`INSERT INTO users (company_id, email, password_hash, first_name, last_name, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`, [companyId, email, passwordHash, firstName, lastName, role, true]);
    return result.rows[0];
}
async function findUserByEmail(email) {
    const result = await database_1.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
}
async function findUserById(id) {
    const result = await database_1.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
}
async function findUserWithCompany(userId) {
    const result = await database_1.pool.query(`SELECT u.id, u.company_id, u.email, u.first_name, u.last_name, u.role,
            c.name as company_name, c.timezone, c.preferred_currency
     FROM users u
     JOIN companies c ON u.company_id = c.id
     WHERE u.id = $1`, [userId]);
    return result.rows[0] || null;
}
async function findUserWithCompanyByEmail(email) {
    const result = await database_1.pool.query(`SELECT u.id, u.company_id, u.email, u.password_hash, u.is_active, u.first_name, u.last_name, u.role,
            c.name as company_name, c.timezone, c.preferred_currency
     FROM users u
     JOIN companies c ON u.company_id = c.id
     WHERE u.email = $1`, [email]);
    return result.rows[0] || null;
}
async function updateLastLogin(userId) {
    await database_1.pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [userId]);
}
async function updateUser(userId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await database_1.pool.query(query, [...values, userId]);
    return result.rows[0];
}
async function deactivateUser(userId) {
    await database_1.pool.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);
}
async function setResetToken(userId, token, expiresAt) {
    await database_1.pool.query('UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3', [token, expiresAt, userId]);
}
async function findUserByResetToken(token) {
    const result = await database_1.pool.query('SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()', [token]);
    return result.rows[0] || null;
}
async function updatePassword(userId, passwordHash) {
    await database_1.pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
}
async function clearResetToken(userId) {
    await database_1.pool.query('UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = $1', [userId]);
}
