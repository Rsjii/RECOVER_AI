export declare class ResendService {
    sendEmail(params: {
        to: string;
        subject: string;
        bodyText: string;
        bodyHtml: string;
    }): Promise<{
        success: boolean;
        messageId?: string;
        error?: string;
    }>;
    handleWebhookEvent(body: any): Promise<void>;
}
declare const _default: ResendService;
export default _default;
