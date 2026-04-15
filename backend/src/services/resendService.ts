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
    replyTo?: string;  // P0: reply-to header for dunning emails
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // DEV MODE: Don't call Resend API in development
      if (config.nodeEnv === 'development') {
        logInfo('resendService', 'sendEmail', 'DEV MODE: Skipping Resend API call', {
          to: params.to,
          subject: params.subject,
        });
        return {
          success: true,
          messageId: 'dev-mode-' + Date.now(),
        };
      }

      logInfo('resendService', 'sendEmail', `Sending to: ${params.to}`, {
        subject: params.subject,
        replyTo: params.replyTo,
      });

      const response = await resend.emails.send({
        from: config.resend.fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.bodyHtml,
        text: params.bodyText,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),  // P0: Conditionally add reply_to
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
      // DEV MODE: Don't call Resend API in development (use hardcoded OTP instead)
      if (config.nodeEnv === 'development') {
        logInfo('resendService', 'sendOTP', 'DEV MODE: OTP is 123456, skipping Resend API call', {
          email: params.email,
        });
        return {
          success: true,
          messageId: 'dev-mode-' + Date.now(),
        };
      }

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

  async sendDashboardWelcome(params: {
    email: string;
    firstName: string;
    companyName: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      if (config.nodeEnv === 'development') {
        logInfo('resendService', 'sendDashboardWelcome', 'DEV MODE: Skipping Resend API call', {
          email: params.email,
        });
        return {
          success: true,
          messageId: 'dev-mode-' + Date.now(),
        };
      }

      logInfo('resendService', 'sendDashboardWelcome', `Sending dashboard welcome to: ${params.email}`);

      const response = await resend.emails.send({
        from: config.resend.fromEmail,
        to: params.email,
        subject: '🎉 Your AR Recovery Agent is Ready to Go!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; }
              .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
              .header { text-align: center; margin-bottom: 40px; }
              .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #2563eb, #1e40af); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 24px; margin-bottom: 20px; }
              h1 { font-size: 28px; font-weight: 700; margin: 0 0 10px 0; color: #111827; }
              .subtitle { font-size: 16px; color: #6b7280; margin: 0; }
              .card { background: #f3f4f6; border-radius: 12px; padding: 24px; margin: 24px 0; border-left: 4px solid #2563eb; }
              .card-title { font-size: 16px; font-weight: 600; color: #1f2937; margin: 0 0 12px 0; }
              .card-text { font-size: 14px; color: #4b5563; margin: 0; }
              .steps { margin: 32px 0; }
              .step { display: flex; margin-bottom: 24px; align-items: flex-start; }
              .step-icon { font-size: 32px; margin-right: 16px; flex-shrink: 0; }
              .step-content { flex: 1; }
              .step-title { font-weight: 600; color: #1f2937; margin: 0 0 4px 0; }
              .step-desc { font-size: 14px; color: #6b7280; margin: 0; }
              .cta-button { display: inline-block; background: linear-gradient(135deg, #2563eb, #1e40af); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 24px 0; }
              .highlight { background: #fef3c7; padding: 16px; border-radius: 8px; margin: 24px 0; }
              .highlight-text { font-size: 16px; font-weight: 600; color: #92400e; margin: 0; }
              .footer { text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
              .emoji { font-size: 24px; margin-right: 8px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">R</div>
                <h1>Your AR Recovery Agent is Live! 🚀</h1>
                <p class="subtitle">Stripe connected. AI ready. Invoices recovered.</p>
              </div>

              <div class="card">
                <p class="card-text">Hi ${params.firstName},</p>
                <p class="card-text">
                  Your RecoverAI dashboard is now live and monitoring <strong>${params.companyName}'s</strong> overdue invoices.
                  The agent will automatically send intelligent dunning emails to recover stuck revenue.
                </p>
              </div>

              <div class="highlight">
                <p class="highlight-text">⚡ First emails go out in the next 6 hours</p>
              </div>

              <div class="steps">
                <div class="step">
                  <div class="step-icon">📊</div>
                  <div class="step-content">
                    <p class="step-title">Check Your Dashboard</p>
                    <p class="step-desc">See your AR at risk, eligible invoices, and recovery progress in real-time.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step-icon">🤖</div>
                  <div class="step-content">
                    <p class="step-title">Watch the Agent Work</p>
                    <p class="step-desc">Over the next 21 days, the AI will send personalized recovery emails automatically.</p>
                  </div>
                </div>
                <div class="step">
                  <div class="step-icon">💰</div>
                  <div class="step-content">
                    <p class="step-title">Track Real Results</p>
                    <p class="step-desc">Every payment detected, every email opened, every dollar recovered — all tracked live.</p>
                  </div>
                </div>
              </div>

              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" class="cta-button">View Your Dashboard</a>
              </div>

              <div class="card" style="border-left-color: #10b981; background: #f0fdf4;">
                <p class="card-title">💡 Pro Tip</p>
                <p class="card-text">
                  The agent learns from your customer base. The more overdue invoices it processes, the smarter it gets.
                  Sit back and watch the revenue recover automatically.
                </p>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
                Questions? Reply to this email anytime. We're here to help.
              </p>

              <div class="footer">
                <p>© 2026 RecoverAI. Recovering your working capital, autonomously.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Your RecoverAI Dashboard is Live!\n\nHi ${params.firstName},\n\nYour dashboard is now live and monitoring ${params.companyName}'s overdue invoices.\n\nFirst emails go out in the next 6 hours.\n\nView your dashboard: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard`,
      });

      if (response.error) {
        logError('resendService', 'sendDashboardWelcome', 'Send failed', response.error);
        return {
          success: false,
          error: response.error.message,
        };
      }

      logInfo('resendService', 'sendDashboardWelcome', '✅ Sent successfully', {
        messageId: response.data?.id,
      });

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (error) {
      logError('resendService', 'sendDashboardWelcome', 'Error', error);
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
