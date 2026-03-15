export declare function listFeatureFlags(companyId: string): Promise<any[]>;
export declare function upsertFeatureFlag(companyId: string, key: string, enabled: boolean, value?: Record<string, unknown>): Promise<void>;
