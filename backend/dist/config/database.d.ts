import { Pool, PoolClient } from 'pg';
export declare const pool: Pool;
export declare function testDbConnection(): Promise<void>;
export declare function query<T = any>(sql: string, params?: any[]): Promise<{
    rows: T[];
    rowCount: number | null;
}>;
export declare function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
