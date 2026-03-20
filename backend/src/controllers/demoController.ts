import { Request, Response } from 'express';
import { pool } from '../config/database';
import { authService } from '../services/authService';
import { config } from '../config/env';
import { logInfo, logError } from '../utils/logger';
import { runDecisionEngineDryRun } from '../queue/agentLoop';
import { redisClient } from '../config/redis';

// Pre-crafted personalized emails for each demo invoice (by invSpec index)
// Keyed by [custIdx, emailType] → {subject, body, tone}
// custIdx: 0=Sarah Chen, 1=Mike Johnson, 2=David Park, 3=Priya Mehta, 4=Jason Torres, 5=Emma Williams, 6=Ryan Lee, 7=Nina Patel
const DEMO_EMAILS: Record<string, { subject: string; body: string; tone: string }> = {
  // dunning_5 — Escalation (60+ days overdue)
  '2:dunning_5': {
    subject: 'Final Notice: $14,500 Invoice — Immediate Action Required',
    tone: 'urgent',
    body: `Hi David,

I'm reaching out one final time regarding TechWave Co's outstanding invoice of $14,500, which is now 65 days past due.

Despite our previous attempts to resolve this, we have not received payment. This invoice has been escalated within our collections process.

To avoid this being referred to our collections team, please arrange payment immediately by replying to this email or calling us directly.

If you're experiencing financial difficulties, we're open to discussing a structured payment arrangement before this goes further.

This is our final notice before escalation.

Best regards,
Acme SaaS`,
  },
  '4:dunning_5': {
    subject: 'Final Notice: $22,000 Invoice #INV-00042 — CloudGate Inc',
    tone: 'urgent',
    body: `Hi Jason,

This is a final notice regarding CloudGate Inc's balance of $22,000, now 70 days overdue.

We've attempted to reach you multiple times over the past two months. Our records indicate this invoice remains unpaid and has not been disputed.

Continuing non-payment will result in this account being forwarded to our external collections partner, which may affect your credit standing.

To resolve this now:
• Pay in full: reply for payment link
• Payment plan: we can split this into 3–4 installments

Please respond within 48 hours.

Regards,
Acme SaaS Collections`,
  },
  // dunning_4 — Formal notice (30-60 days overdue)
  '7:dunning_4': {
    subject: 'Formal Payment Notice: Invoice $8,600 — 40 Days Overdue',
    tone: 'firm',
    body: `Hi Nina,

I'm following up on DevFirst's overdue invoice of $8,600, now 40 days past due.

We've sent prior reminders but have not received payment or a response. At this stage, we need to formally request immediate resolution.

If there's a billing dispute or an issue with the invoice, please let us know so we can address it. Otherwise, please process payment at your earliest convenience.

As an alternative, we can offer a payment plan to help spread the balance.

Please respond within 7 days to avoid further escalation.

Thank you,
Acme SaaS`,
  },
  '1:dunning_4': {
    subject: 'Payment Required: $6,300 Invoice — BuildRight LLC (30 Days Overdue)',
    tone: 'firm',
    body: `Hi Mike,

This is a formal follow-up regarding BuildRight LLC's outstanding invoice of $6,300, which reached 30 days overdue today.

At this stage, we're requesting that you arrange payment or contact us to discuss options. We value our relationship with BuildRight and would like to resolve this without escalation.

Options available to you:
1. Pay the full balance now (reply for payment link)
2. Set up a payment plan (3 monthly installments)

Please respond within 5 business days.

Best,
Acme SaaS`,
  },
  // dunning_3 — Payment plan offer (14-30 days)
  '2:dunning_3': {
    subject: 'Invoice Update: $9,100 Now 25 Days Overdue — Let\'s Resolve This',
    tone: 'friendly',
    body: `Hi David,

I wanted to check in regarding TechWave Co's invoice of $9,100, which is now 25 days past due.

I understand things can get busy — if there's been an oversight or you'd prefer to pay in installments, just let me know. We're happy to set up a flexible payment arrangement.

To pay now or discuss options, simply reply to this email.

Thanks,
Acme SaaS`,
  },
  '4:dunning_3': {
    subject: 'Following Up: $18,000 Invoice — 20 Days Overdue',
    tone: 'friendly',
    body: `Hi Jason,

Following up on CloudGate Inc's invoice of $18,000, now 20 days past due.

If you've already sent payment, please disregard this message. If not, we'd love to help find a solution — whether that's a payment plan or resolving any disputes.

Reply here or click the payment link below to settle this.

Best,
Acme SaaS`,
  },
  '7:dunning_3': {
    subject: 'Invoice Reminder: $11,200 — DevFirst (35 Days Past Due)',
    tone: 'firm',
    body: `Hi Nina,

Your invoice of $11,200 is now 35 days overdue. This is our third reminder.

We'd like to resolve this amicably. If there's an issue with the invoice or your account, please let us know immediately so we can address it.

If you're finding the balance difficult to pay at once, we can arrange monthly installments.

Please reply by end of week.

Best regards,
Acme SaaS`,
  },
  '0:dunning_3': {
    subject: 'Gentle Reminder: $3,500 Invoice — 25 Days Overdue',
    tone: 'friendly',
    body: `Hi Sarah,

Just a friendly reminder that Nexflow's invoice of $3,500 is now 25 days past due.

Given your excellent payment history with us, I'm sure this is just an oversight. If you have any questions or would like to pay in installments, feel free to reach out.

Click here to pay or simply reply to this email.

Thanks,
Acme SaaS`,
  },
  '3:dunning_3': {
    subject: 'Invoice Follow-Up: $5,600 — HealthSync (27 Days Overdue)',
    tone: 'friendly',
    body: `Hi Priya,

Following up on HealthSync's invoice of $5,600, now 27 days past due.

If this has slipped through the cracks, no worries — it happens! Please arrange payment at your convenience or let me know if you'd prefer a payment plan.

Happy to help resolve this quickly.

Best,
Acme SaaS`,
  },
  '5:dunning_3': {
    subject: 'Payment Reminder: $4,200 Invoice — DataCore AI (26 Days)',
    tone: 'friendly',
    body: `Hi Emma,

Just checking in on DataCore AI's outstanding invoice of $4,200 (26 days overdue).

If there's been any issue with the invoice, please let me know and we'll sort it right away. Otherwise, a quick payment would be greatly appreciated!

Reply here or use the payment link.

Thanks,
Acme SaaS`,
  },
  '6:dunning_3': {
    subject: 'Action Needed: $2,100 Invoice — Swiftly Inc (28 Days Overdue)',
    tone: 'friendly',
    body: `Hi Ryan,

A quick follow-up on Swiftly Inc's invoice of $2,100, which is now 28 days past due.

Could you take a moment to process this when you get a chance? If you'd prefer to split into two payments, we can accommodate that.

Thanks for your continued partnership!

Best,
Acme SaaS`,
  },
  // dunning_2 — Getting overdue (7-14 days)
  '1:dunning_2': {
    subject: 'Invoice #INV-00089 Overdue — $4,500 (BuildRight LLC)',
    tone: 'friendly',
    body: `Hi Mike,

Your invoice of $4,500 is now 10 days past due. Just wanted to make sure this didn't slip through.

If you have any questions about the invoice or need an alternative payment arrangement, I'm happy to help.

Pay now or reach out if you need anything.

Thanks,
Acme SaaS`,
  },
  '5:dunning_2': {
    subject: 'Reminder: $7,800 Invoice Now Overdue — DataCore AI',
    tone: 'friendly',
    body: `Hi Emma,

DataCore AI's invoice of $7,800 is now 15 days past due.

This is our second reminder. Please arrange payment when you have a moment, or let us know if there's anything preventing it — we're happy to discuss options.

Best,
Acme SaaS`,
  },
  '0:dunning_2': {
    subject: 'Second Reminder: Invoice $6,100 — Nexflow Inc',
    tone: 'friendly',
    body: `Hi Sarah,

Following up on Nexflow Inc's invoice of $6,100 (now 8 days overdue).

Given your great track record, I'm sure this is just an oversight. Please arrange payment at your earliest convenience.

Let me know if anything needs clarification.

Thanks,
Acme SaaS`,
  },
  // dunning_1 — First reminder (1-7 days)
  '3:dunning_1': {
    subject: 'Payment Due: Invoice $2,900 — HealthSync',
    tone: 'friendly',
    body: `Hi Priya,

This is a friendly reminder that HealthSync's invoice of $2,900 was due 5 days ago.

If you've already sent payment, please disregard this. Otherwise, we'd appreciate a quick resolution.

Thanks for your continued business!

Best,
Acme SaaS`,
  },
  '6:dunning_1': {
    subject: 'Quick Reminder: $1,800 Invoice — Swiftly Inc',
    tone: 'friendly',
    body: `Hi Ryan,

Just a quick heads-up that Swiftly Inc's invoice of $1,800 was due 2 days ago.

No rush — whenever you get a chance to process this would be great!

Thanks,
Acme SaaS`,
  },
  // payment_plan_offer (used for multiple customers)
  'payment_plan_offer': {
    subject: 'Flexible Payment Plan Available for Your Outstanding Invoice',
    tone: 'friendly',
    body: `Hi there,

We understand that cash flow can sometimes be challenging, and we'd like to help.

We're offering a flexible payment plan for your outstanding balance — spread it over 3 equal monthly installments with no additional fees.

To accept this offer or discuss terms, simply reply to this email within 7 days.

We value your business and want to make this as easy as possible for you.

Best regards,
Acme SaaS`,
  },
};

const LOG_MODULE = 'demoController';

const DEMO_EMAIL = 'demo@recoverai.com';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_COMPANY = 'Acme SaaS (Demo)';

// Set cookies identical to auth controller
// Local dev: sameSite='lax' (same-domain), Prod: sameSite='none' (cross-domain)
const setCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const sameSitePolicy = config.nodeEnv === 'production' ? 'none' : 'lax';

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: sameSitePolicy as any,
    maxAge: 60 * 60 * 1000,
  });
  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: sameSitePolicy as any,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/auth/refresh',
  });
};

/**
 * POST /api/demo/login
 * Creates demo company + seeds realistic data + logs in as demo user.
 * Safe to call multiple times — resets data on each call.
 */
export const demoLogin = async (req: Request, res: Response): Promise<void> => {
  const handler = 'demoLogin';
  const client = await pool.connect();

  try {
    logInfo(LOG_MODULE, handler, 'Demo login requested');

    // ---- 1. Ensure demo user exists — try login first (faster: demo user exists 99% of the time) ----
    let authResult;
    try {
      authResult = await authService.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    } catch {
      // First time ever — create account
      authResult = await authService.signup({
        companyName: DEMO_COMPANY,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        firstName: 'Demo',
        lastName: 'User',
      });
    }

    const companyId = authResult.company.id;
    logInfo(LOG_MODULE, handler, 'Demo company resolved', { companyId });

    // ---- 1b. Mark demo user as email-verified (skip OTP requirement) ----
    await pool.query(`UPDATE users SET email_verified = true, otp_code = NULL, otp_expires = NULL WHERE id = $1`, [authResult.user.id]);

    // ---- 2. Check if demo data already exists ----
    const existingCount = await pool.query(
      `SELECT COUNT(*) as cnt FROM customers WHERE company_id = $1`,
      [companyId]
    );
    const hasExistingData = parseInt(existingCount.rows[0].cnt) > 0;

    if (hasExistingData) {
      logInfo(LOG_MODULE, handler, 'Demo data already exists, skipping creation', { companyId });
      // Skip to email login and return
    } else {
      logInfo(LOG_MODULE, handler, 'Creating new demo data', { companyId });

    // ---- 3. Seed customers ----
    const now = Date.now();
    const d = (daysAgo: number) => new Date(now - daysAgo * 86400_000).toISOString();

    const customers = [
      { name: 'Sarah Chen',     email: 'sarah.chen@nexflow.io',      company: 'Nexflow Inc',     industry: 'SaaS',         history: { on_time_rate: 92, avg_days_late: 2,  total_invoices: 18, total_paid: 41200 } },
      { name: 'Mike Johnson',   email: 'mike@buildright.com',         company: 'BuildRight LLC',  industry: 'Construction', history: { on_time_rate: 65, avg_days_late: 12, total_invoices: 9,  total_paid: 18900 } },
      { name: 'David Park',     email: 'david@techwave.co',           company: 'TechWave Co',     industry: 'SaaS',         history: { on_time_rate: 40, avg_days_late: 28, total_invoices: 6,  total_paid: 9500  } },
      { name: 'Priya Mehta',    email: 'priya@healthsync.io',         company: 'HealthSync',      industry: 'HealthTech',   history: { on_time_rate: 80, avg_days_late: 5,  total_invoices: 4,  total_paid: 8400  } },
      { name: 'Jason Torres',   email: 'jason.torres@cloudgate.com',  company: 'CloudGate Inc',   industry: 'Cloud',        history: { on_time_rate: 55, avg_days_late: 22, total_invoices: 12, total_paid: 31000 } },
      { name: 'Emma Williams',  email: 'emma@datacore.ai',            company: 'DataCore AI',     industry: 'Analytics',    history: { on_time_rate: 75, avg_days_late: 8,  total_invoices: 7,  total_paid: 15600 } },
      { name: 'Ryan Lee',       email: 'ryan@swiftly.app',            company: 'Swiftly Inc',     industry: 'Logistics',    history: { on_time_rate: 88, avg_days_late: 3,  total_invoices: 5,  total_paid: 6200  } },
      { name: 'Nina Patel',     email: 'nina@devfirst.io',            company: 'DevFirst',        industry: 'DevTools',     history: { on_time_rate: 30, avg_days_late: 45, total_invoices: 3,  total_paid: 4500  } },
    ];

    await client.query('BEGIN');
    const custRows: { id: string; idx: number }[] = [];
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      const r = await client.query(
        `INSERT INTO customers (company_id, name, email, company_name, industry, payment_history, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (company_id, email) DO UPDATE SET name=$2, company_name=$4, industry=$5, payment_history=$6, created_at=$7
         RETURNING id`,
        [companyId, c.name, c.email, c.company, c.industry, JSON.stringify(c.history), d(90 - i * 5)]
      );
      custRows.push({ id: r.rows[0].id, idx: i });
    }

    // ---- 4. Seed invoices ----
    // Format: [custIdx, amount, daysAgoIssued, daysAgosDue, status, riskScore, source]
    type InvSpec = [number, number, number, number, string, number, string];
    const invSpecs: InvSpec[] = [
      // PAID (recovered by agent)
      [0, 5200,  90, 60, 'paid', 15, 'stripe'],
      [0, 3800,  60, 30, 'paid', 10, 'stripe'],
      [1, 8500,  75, 45, 'paid', 55, 'quickbooks'],
      [2, 6200,  80, 50, 'paid', 72, 'manual'],
      [3, 4100,  50, 20, 'paid', 20, 'stripe'],
      [4, 9800,  85, 55, 'paid', 60, 'stripe'],
      [5, 4400,  45, 15, 'paid', 25, 'manual'],
      [6, 3200,  40, 10, 'paid', 18, 'stripe'],
      // IN PAYMENT PLAN (arranged)
      [2, 14500, 95, 65, 'arranged', 88, 'stripe'],
      [4, 22000, 100,70, 'arranged', 91, 'quickbooks'],
      [7, 8600,  70, 40, 'arranged', 85, 'manual'],
      [1, 6300,  60, 30, 'arranged', 78, 'stripe'],
      // OVERDUE — agent in progress
      [2, 9100,  55, 25, 'unpaid', 92, 'stripe'],
      [4, 18000, 50, 20, 'unpaid', 87, 'quickbooks'],
      [7, 11200, 65, 35, 'unpaid', 95, 'manual'],
      [1, 4500,  30, 10, 'unpaid', 62, 'stripe'],
      [5, 7800,  45, 15, 'unpaid', 70, 'stripe'],
      [3, 2900,  20,  5, 'unpaid', 35, 'manual'],
      [0, 6100,  25,  8, 'unpaid', 42, 'stripe'],
      [6, 1800,  15,  2, 'unpaid', 22, 'stripe'],
      // FRESH (just created, agent not yet reached)
      [0, 3500,  5,  25, 'unpaid', 5,  'stripe'],
      [3, 5600,  3,  27, 'unpaid', 8,  'stripe'],
      [5, 4200,  4,  26, 'unpaid', 6,  'manual'],
      [6, 2100,  2,  28, 'unpaid', 3,  'stripe'],
    ];

    const invRows: { id: string; custIdx: number; amount: number; status: string; daysAgoDue: number }[] = [];
    for (const [ci, amount, daysIssued, daysDue, status, risk, src] of invSpecs) {
      const custId = custRows[ci].id;
      const issuedDate = d(daysIssued);
      const dueDate = d(daysDue);
      const srcId = `demo-${src}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const r = await client.query(
        `INSERT INTO invoices (company_id, customer_id, amount, currency, due_date, issued_date, status, risk_score, source, source_id, created_at)
         VALUES ($1,$2,$3,'USD',$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [companyId, custId, amount, dueDate, issuedDate, status, risk, src, srcId, issuedDate]
      );
      invRows.push({ id: r.rows[0].id, custIdx: ci, amount, status, daysAgoDue: daysDue });
    }

    // ---- 5. Seed payments for paid invoices ----
    const paidInvs = invRows.filter(i => i.status === 'paid');
    for (const inv of paidInvs) {
      const paidAt = d(Math.max(0, inv.daysAgoDue - Math.floor(Math.random() * 8)));
      await client.query(
        `INSERT INTO payments (invoice_id, company_id, amount, currency, payment_method, paid_at, stripe_charge_id, status)
         VALUES ($1,$2,$3,'USD','stripe',$4,$5,'succeeded')`,
        [inv.id, companyId, inv.amount, paidAt, `ch_demo_${inv.id.slice(0, 8)}`]
      );
    }

    // ---- 6. Seed payment plans for arranged invoices ----
    const arrangedInvs = invRows.filter(i => i.status === 'arranged');
    for (const inv of arrangedInvs) {
      const installAmt = (inv.amount / 3).toFixed(2);
      const installments = [
        { amount: parseFloat(installAmt), due_date: d(inv.daysAgoDue - 5),  paid: true,  stripe_payment_intent_id: `pi_demo_1_${inv.id.slice(0, 6)}` },
        { amount: parseFloat(installAmt), due_date: d(inv.daysAgoDue - 35), paid: false, stripe_payment_intent_id: null },
        { amount: inv.amount - 2 * parseFloat(installAmt), due_date: d(inv.daysAgoDue - 65), paid: false, stripe_payment_intent_id: null },
      ];
      await client.query(
        `INSERT INTO payment_plans (invoice_id, status, installments, total_amount)
         VALUES ($1,'active',$2,$3)`,
        [inv.id, JSON.stringify(installments), inv.amount]
      );
      // First installment payment recorded
      await client.query(
        `INSERT INTO payments (invoice_id, company_id, amount, currency, payment_method, paid_at, status)
         VALUES ($1,$2,$3,'USD','stripe',$4,'succeeded')`,
        [inv.id, companyId, parseFloat(installAmt), d(inv.daysAgoDue - 5)]
      );
    }

    // ---- 7. Seed email logs (BATCH — one query instead of 50+ sequential) ----
    const emailSubjects: Record<string, string[]> = {
      dunning_1: ['Quick reminder: Invoice #{n} is due', 'Friendly reminder about your balance', 'Invoice #{n} — due today'],
      dunning_2: ['Following up on overdue invoice #{n}', 'Invoice #{n} is now past due', 'Action needed: Invoice #{n}'],
      dunning_3: ['Payment arrangement available for Invoice #{n}', 'Let\'s resolve Invoice #{n} together', 'Flexible payment options for your balance'],
      dunning_4: ['Final notice: Invoice #{n}', 'Urgent: Invoice #{n} requires immediate attention', 'Invoice #{n} — 60+ days overdue'],
      dunning_5: ['Last attempt before escalation — Invoice #{n}', 'Critical: Invoice #{n}', 'Invoice #{n} — Final escalation notice'],
    };

    const emailableInvs = invRows.filter(i => i.daysAgoDue > 5);
    let emailN = 1000;
    const emailLogVals: any[] = [];
    const emailLogPH: string[] = [];
    let emailLogIdx = 0;

    for (const inv of emailableInvs) {
      const cust = customers[inv.custIdx];
      const types = inv.daysAgoDue > 60 ? ['dunning_1', 'dunning_2', 'dunning_3', 'dunning_4']
        : inv.daysAgoDue > 30 ? ['dunning_1', 'dunning_2', 'dunning_3']
        : inv.daysAgoDue > 15 ? ['dunning_1', 'dunning_2']
        : ['dunning_1'];

      for (let t = 0; t < types.length; t++) {
        const emailType = types[t];
        const subjects = emailSubjects[emailType];
        const subject = subjects[Math.floor(Math.random() * subjects.length)].replace('{n}', String(emailN++));
        const sentAt = d(inv.daysAgoDue - t * 7 - 1);
        const opened = Math.random() > 0.35;
        const clicked = opened && Math.random() > 0.55;
        const openedAt = opened ? d(inv.daysAgoDue - t * 7 - 1 + 0.2) : null;
        const clickedAt = clicked ? d(inv.daysAgoDue - t * 7 - 1 + 0.4) : null;
        const status = clicked ? 'clicked' : opened ? 'opened' : 'delivered';
        const body = `Dear ${cust.name},\n\nThis is a reminder regarding your outstanding invoice of $${inv.amount.toLocaleString()}.\n\nPlease arrange payment at your earliest convenience.\n\nBest regards,\nRecoverAI`;

        const b = emailLogIdx * 11;
        emailLogPH.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11})`);
        emailLogVals.push(inv.id, companyId, emailType, cust.email, subject, body, sentAt, openedAt, clickedAt, status, `msg_demo_${inv.id.slice(0, 8)}_${t}`);
        emailLogIdx++;
      }
    }

    if (emailLogPH.length > 0) {
      await client.query(
        `INSERT INTO email_logs (invoice_id,company_id,email_type,recipient_email,subject,body,sent_at,opened_at,clicked_at,status,sendgrid_message_id) VALUES ${emailLogPH.join(',')}`,
        emailLogVals
      );
    }

    await client.query('COMMIT');

    // ---- 8. Seed recovery_timeline (BATCH — one query instead of 30 sequential) ----
    await client.query(`DELETE FROM recovery_timeline WHERE company_id = $1`, [companyId]);

    const tlVals: any[] = [];
    const tlPH: string[] = [];
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const periodDate = new Date(now - dayOffset * 86400_000).toISOString().slice(0, 10);
      const progress = (29 - dayOffset) / 29;
      const amountRecovered = Math.round(34200 * progress * (0.8 + Math.random() * 0.4));
      const invoicesRecovered = Math.round(8 * progress);
      const emailsSent = Math.round(3 + progress * 5);
      const emailsOpened = Math.round(emailsSent * (0.5 + Math.random() * 0.2));
      const i = tlPH.length;
      const b = i * 10;
      tlPH.push(`($${b+1},$${b+2},'daily',$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10})`);
      tlVals.push(companyId, periodDate, invRows.length, invoicesRecovered, 87400, amountRecovered, emailsSent, emailsOpened, Math.round(emailsOpened * 0.4), 42);
    }
    await pool.query(
      `INSERT INTO recovery_timeline (company_id,period_date,period_type,invoices_created,invoices_recovered,amount_created,amount_recovered,emails_sent,emails_opened,emails_clicked,avg_days_to_collect) VALUES ${tlPH.join(',')}`,
      tlVals
    );

    logInfo(LOG_MODULE, handler, 'Demo data seeded', {
      customers: customers.length,
      invoices: invRows.length,
      paid: paidInvs.length,
      arranged: arrangedInvs.length,
      timelineDays: 30,
    });

    // ---- 8. Cache pre-crafted email previews in Redis (instant "View" clicks, no LLM) ----
    try {
      const cachePromises: Promise<any>[] = [];
      for (const inv of invRows) {
        // Determine email type the agent would assign
        const daysOverdue = inv.daysAgoDue;
        let emailType: string | null = null;
        if (daysOverdue >= 60) emailType = 'dunning_5';
        else if (daysOverdue >= 30) emailType = 'dunning_4';
        else if (daysOverdue >= 14) emailType = 'dunning_3';
        else if (daysOverdue >= 7) emailType = 'dunning_2';
        else if (daysOverdue >= 1) emailType = 'dunning_1';

        if (!emailType || inv.status === 'paid') continue;

        const custKey = `${inv.custIdx}:${emailType}`;
        const emailContent = DEMO_EMAILS[custKey] || (emailType === 'payment_plan_offer' ? DEMO_EMAILS['payment_plan_offer'] : null);

        if (emailContent) {
          const redisKey = `email_preview:${inv.id}:${emailType}`;
          cachePromises.push(redisClient.setEx(redisKey, 86400, JSON.stringify(emailContent))); // 24h TTL
        }

        // Cache payment plan offer for qualifying invoices (15+ days overdue)
        if (daysOverdue >= 15) {
          const planContent = DEMO_EMAILS['payment_plan_offer'];
          const planKey = `email_preview:${inv.id}:payment_plan_offer`;
          cachePromises.push(redisClient.setEx(planKey, 86400, JSON.stringify(planContent)));
        }
      }
      await Promise.all(cachePromises);
      logInfo(LOG_MODULE, handler, 'Email previews cached in Redis', { count: cachePromises.length });
    } catch (cacheErr) {
      logError(LOG_MODULE, handler, 'Failed to cache demo email previews (non-fatal)', cacheErr);
    }
    } // ✅ Close else block for demo data creation

    // ---- 10. Return cookies — reuse authResult from step 1, no second login needed ----
    setCookies(res, authResult.tokens.accessToken, authResult.tokens.refreshToken);

    res.status(200).json({
      message: 'Demo account ready',
      user: { ...authResult.user, emailVerified: true },
      company: authResult.company,
      isDemo: true,
    });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    logError(LOG_MODULE, handler, 'Demo setup failed', error);
    const msg = error instanceof Error ? error.message : 'Demo setup failed';
    res.status(500).json({ error: msg });
  } finally {
    client.release();
  }
};

/**
 * POST /api/demo/preview
 * Dry-run the agent on demo data — returns what WOULD happen (no emails sent).
 * Call after /api/demo/login to get safe preview for prospects.
 */
export const demoPreview = async (req: Request, res: Response): Promise<void> => {
  const handler = 'demoPreview';
  try {
    logInfo(LOG_MODULE, handler, 'Demo preview requested');

    // Get demo company id from DB
    const companyRes = await pool.query(
      `SELECT c.id FROM companies c
       JOIN users u ON u.company_id = c.id
       WHERE u.email = $1 LIMIT 1`,
      [DEMO_EMAIL]
    );

    if (!companyRes.rows.length) {
      res.status(404).json({ error: 'Demo company not found — call /api/demo/login first' });
      return;
    }

    const companyId: string = companyRes.rows[0].id;
    const preview = await runDecisionEngineDryRun(companyId);

    res.status(200).json({
      message: 'Demo agent preview complete',
      ...preview,
      note: 'No emails were sent. These are what the agent would send if approved.',
    });
  } catch (error) {
    logError(LOG_MODULE, handler, 'Demo preview failed', error);
    const msg = error instanceof Error ? error.message : 'Demo preview failed';
    res.status(500).json({ error: msg });
  }
};
