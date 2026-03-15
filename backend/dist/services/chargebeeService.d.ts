declare class ChargebeeService {
    connect(companyId: string, userId: string, site: string, apiKey: string): Promise<void>;
    syncInvoices(companyId: string): Promise<{
        created: number;
        updated: number;
        skipped: number;
    }>;
    handleWebhook(companyId: string, eventType: string, content: any): Promise<void>;
    disconnect(companyId: string, userId: string): Promise<void>;
}
export declare const chargebeeService: ChargebeeService;
export {};
