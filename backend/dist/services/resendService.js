"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendService = void 0;
const resend_1 = require("resend");
const logger_1 = require("../utils/logger");
const env_1 = require("../config/env");
const resend = new resend_1.Resend(env_1.config.resend.apiKey);
class ResendService {
    async sendEmail(params) {
        try {
            (0, logger_1.logInfo)('resendService', 'sendEmail', `Sending to: ${params.to}`, {
                subject: params.subject,
            });
            const response = await resend.emails.send({
                from: env_1.config.resend.fromEmail,
                to: params.to,
                subject: params.subject,
                html: params.bodyHtml,
                text: params.bodyText,
            });
            if (response.error) {
                (0, logger_1.logError)('resendService', 'sendEmail', 'Send failed', response.error);
                return {
                    success: false,
                    error: response.error.message,
                };
            }
            (0, logger_1.logInfo)('resendService', 'sendEmail', '✅ Sent successfully', {
                messageId: response.data?.id,
            });
            return {
                success: true,
                messageId: response.data?.id,
            };
        }
        catch (error) {
            (0, logger_1.logError)('resendService', 'sendEmail', 'Error', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }
    async handleWebhookEvent(body) {
        try {
            const { type, data } = body;
            (0, logger_1.logInfo)('resendService', 'webhook', `Event: ${type}`, {
                emailId: data?.id,
            });
            // Webhook tracking can be added here if needed
        }
        catch (error) {
            (0, logger_1.logError)('resendService', 'webhook', 'Error handling webhook', error);
        }
    }
}
exports.ResendService = ResendService;
exports.default = new ResendService();
