/**
 * Payment plan acceptance email template
 */

interface PaymentPlanEmailParams {
  customerName: string;
  invoiceNumber: string;
  originalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  firstPaymentDue: string;
  planAcceptanceLink: string;
  companyName: string;
}

export function generatePaymentPlanEmailHTML(params: PaymentPlanEmailParams): string {
  const {
    customerName,
    invoiceNumber,
    originalAmount,
    installmentCount,
    installmentAmount,
    firstPaymentDue,
    planAcceptanceLink,
    companyName
  } = params;

  const firstPaymentDate = new Date(firstPaymentDue).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Plan Offer - ${invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .plan-details { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; border-radius: 4px; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .detail-label { font-weight: 600; color: #666; }
    .detail-value { color: #333; }
    .cta-button { display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; text-align: center; }
    .cta-button:hover { background: #5568d3; }
    .terms { font-size: 12px; color: #999; margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; }
    .footer { text-align: center; font-size: 12px; color: #999; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Plan Offer</h1>
      <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">We've created a flexible payment option for you</p>
    </div>

    <div class="content">
      <p>Hi <strong>${customerName}</strong>,</p>

      <p>Thank you for your business. We understand that paying the full amount immediately might be challenging, so we're offering you a flexible payment plan for invoice <strong>#${invoiceNumber}</strong>.</p>

      <div class="plan-details">
        <div class="detail-row">
          <span class="detail-label">Invoice Amount:</span>
          <span class="detail-value">$${originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Number of Payments:</span>
          <span class="detail-value">${installmentCount} monthly installments</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Monthly Payment:</span>
          <span class="detail-value"><strong>$${installmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
        </div>
        <div class="detail-row">
          <span class="detail-label">First Payment Due:</span>
          <span class="detail-value">${firstPaymentDate}</span>
        </div>
      </div>

      <p><strong>How it works:</strong></p>
      <ul>
        <li>Automatic monthly payments on the due date</li>
        <li>No interest or hidden fees</li>
        <li>Easy to manage in your account</li>
        <li>Can update payment method anytime</li>
      </ul>

      <center>
        <a href="${planAcceptanceLink}" class="cta-button">Accept Payment Plan</a>
      </center>

      <p style="margin-top: 20px;">This offer expires in 7 days. If you have any questions about this payment plan, please reply to this email or contact our team.</p>

      <div class="terms">
        <p><strong>Payment Terms:</strong></p>
        <p>By accepting this payment plan, you agree to automatic monthly charges on the dates specified above. If a payment fails, we'll attempt to process it again within 3 days. If it fails after 3 attempts, the full remaining balance may become due immediately.</p>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 10px 0;">© ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
      <p style="margin: 10px 0;"><a href="{UNSUBSCRIBE_LINK}" style="color: #999; text-decoration: none;">Unsubscribe from payment emails</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

export function generatePaymentPlanEmailText(params: PaymentPlanEmailParams): string {
  const {
    customerName,
    invoiceNumber,
    originalAmount,
    installmentCount,
    installmentAmount,
    firstPaymentDue,
    planAcceptanceLink,
    companyName
  } = params;

  const firstPaymentDate = new Date(firstPaymentDue).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
Payment Plan Offer

Hi ${customerName},

Thank you for your business. We understand that paying the full amount immediately might be challenging, so we're offering you a flexible payment plan for invoice #${invoiceNumber}.

PLAN DETAILS
============
Invoice Amount:     $${originalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Number of Payments: ${installmentCount} monthly installments
Monthly Payment:    $${installmentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
First Payment Due:  ${firstPaymentDate}

HOW IT WORKS
============
- Automatic monthly payments on the due date
- No interest or hidden fees
- Easy to manage in your account
- Can update payment method anytime

To accept this payment plan, click the link below:
${planAcceptanceLink}

This offer expires in 7 days. If you have any questions about this payment plan, please reply to this email or contact our team.

PAYMENT TERMS
=============
By accepting this payment plan, you agree to automatic monthly charges on the dates specified above. If a payment fails, we'll attempt to process it again within 3 days. If it fails after 3 attempts, the full remaining balance may become due immediately.

© ${new Date().getFullYear()} ${companyName}. All rights reserved.
  `;
}
