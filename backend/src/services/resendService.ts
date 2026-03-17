import { Resend } from 'resend';
import { logInfo, logError } from '../utils/logger';
import { config } from '../config/env';
import { upsertApiUsage } from '../db/apiUsage';

const resend = new Resend(config.resend.apiKey);

export class ResendService {
  async sendEmail(params: {
    to: string;
    subject: string;
    bodyText: string;
    bodyHtml: string;
    companyId?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      logInfo('resendService', 'sendEmail', `Sending to: ${params.to}`, {
        subject: params.subject,
      });

      const response = await resend.emails.send({
        from: config.resend.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.bodyHtml,
        text: params.bodyText,
      });

      if (response.error) {
        logError('resendService', 'sendEmail', 'Send failed', response.error);
        return {
          success: false,
          error: response.error.message,
        };
      }

      logInfo('resendService', 'sendEmail', '✅ Sent successfully', {
        messageId: response.data?.id,
      });

      if (params.companyId) {
        upsertApiUsage({ companyId: params.companyId, service: 'resend', usageCount: 1, costUsd: 0.001, period: new Date() })
          .catch(err => logError('resendService', 'sendEmail', 'Failed to track Resend usage', err));
      }

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      logError('resendService', 'sendEmail', 'Error', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async sendOTP(params: {
    email: string;
    code: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      logInfo('resendService', 'sendOTP', `Sending OTP to: ${params.email}`);

      const response = await resend.emails.send({
        from: config.resend.fromEmail,
        to: params.email,
        subject: 'Your RecoverAI verification code',
        html: `<p>Your 6-digit verification code is: <strong>${params.code}</strong></p><p>Valid for 15 minutes.</p>`,
        text: `Your verification code is: ${params.code} (valid for 15 minutes)`,
      });

      if (response.error) {
        logError('resendService', 'sendOTP', 'Send failed', response.error);
        return {
          success: false,
          error: response.error.message,
        };
      }

      logInfo('resendService', 'sendOTP', '✅ Sent successfully', {
        messageId: response.data?.id,
      });

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      logError('resendService', 'sendOTP', 'Error', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async handleWebhookEvent(body: any): Promise<void> {
    try {
      const { type, data } = body;
      logInfo('resendService', 'webhook', `Event: ${type}`, {
        emailId: data?.id,
      });
      // Webhook tracking can be added here if needed
    } catch (error) {
      logError('resendService', 'webhook', 'Error handling webhook', error);
    }
  }
}

export default new ResendService();
