"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCompany = createCompany;
exports.findCompanyByEmail = findCompanyByEmail;
exports.findCompanyById = findCompanyById;
exports.setCompanyOwner = setCompanyOwner;
exports.updateCompany = updateCompany;
const database_1 = require("../config/database");
async function createCompany(input) {
    const { name, email, timezone = 'UTC', preferredCurrency = 'USD' } = input;
    const result = await database_1.pool.query(`INSERT INTO companies (name, email, timezone, preferred_currency)
     VALUES ($1, $2, $3, $4)
     RETURNING *`, [name, email, timezone, preferredCurrency]);
    return result.rows[0];
}
async function findCompanyByEmail(email) {
    const result = await database_1.pool.query('SELECT * FROM companies WHERE email = $1', [email]);
    return result.rows[0] || null;
}
async function findCompanyById(companyId) {
    const result = await database_1.pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
    return result.rows[0] || null;
}
async function setCompanyOwner(companyId, userId) {
    await database_1.pool.query('UPDATE companies SET owner_id = $1 WHERE id = $2', [userId, companyId]);
}
async function updateCompany(companyId, updates) {
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
    const query = `UPDATE companies SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`;
    const result = await database_1.pool.query(query, [...values, companyId]);
    return result.rows[0];
}
