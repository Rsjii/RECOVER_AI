declare class QuickBooksService {
    getOAuthUrl(companyId: string, redirectUri: string): string;
    handleOAuthCallback(companyId: string, userId: string, code: string, realmId: string, redirectUri: string): Promise<void>;
    syncInvoices(companyId: string): Promise<{
        created: number;
        updated: number;
        skipped: number;
    }>;
    private fetchQBInvoices;
    disconnect(companyId: string, userId: string): Promise<void>;
    isConnected(company: {
        quickbooks_realm_id?: string | null;
        quickbooks_access_token_encrypted?: string | null;
    }): boolean;
}
export declare const quickbooksService: QuickBooksService;
export {};
