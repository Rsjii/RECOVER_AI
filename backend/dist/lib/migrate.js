"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("../config/database");
const logger_1 = require("../utils/logger");
/**
 * Runs schema.sql against the database.
 * Safe to run multiple times - all statements use IF NOT EXISTS.
 * Tables that already exist are skipped automatically.
 */
async function runMigrations() {
    const schemaPath = path_1.default.join(__dirname, '../../schema.sql');
    if (!fs_1.default.existsSync(schemaPath)) {
        (0, logger_1.logWarn)('migrate', 'runMigrations', 'schema.sql not found, skipping migrations');
        return;
    }
    const sql = fs_1.default.readFileSync(schemaPath, 'utf-8');
    const client = await database_1.pool.connect();
    try {
        await client.query(sql);
        (0, logger_1.logInfo)('migrate', 'runMigrations', 'Schema applied');
    }
    catch (err) {
        (0, logger_1.logError)('migrate', 'runMigrations', 'Migration failed', err);
        throw err;
    }
    finally {
        client.release();
    }
}
