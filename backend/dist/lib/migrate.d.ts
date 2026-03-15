/**
 * Runs schema.sql against the database.
 * Safe to run multiple times - all statements use IF NOT EXISTS.
 * Tables that already exist are skipped automatically.
 */
export declare function runMigrations(): Promise<void>;
