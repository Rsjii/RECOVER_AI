export declare function createComplianceRequest(input: {
    companyId: string;
    requestedByUserId: string;
    requestType: 'export' | 'delete';
    payload?: Record<string, unknown>;
}): Promise<{
    id: string;
}>;
export declare function markComplianceRequestCompleted(requestId: string, payload?: Record<string, unknown>): Promise<void>;
export declare function listComplianceRequests(companyId: string): Promise<any[]>;
export declare function exportCompanyData(companyId: string): Promise<Record<string, unknown>>;
export declare function requestCompanyDeletion(companyId: string): Promise<void>;
