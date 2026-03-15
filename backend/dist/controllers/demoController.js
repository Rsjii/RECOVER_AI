"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.demoPreview = exports.demoLogin = void 0;
const database_1 = require("../config/database");
const authService_1 = require("../services/authService");
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const agentLoop_1 = require("../queue/agentLoop");
const LOG_MODULE = 'demoController';
const DEMO_EMAIL = 'demo@recoverai.com';
const DEMO_PASSWORD = 'Demo1234!';
const DEMO_COMPANY = 'Acme SaaS (Demo)';
// Set cookies identical to auth controller
const setCookies = (res, accessToken, refreshToken) => {
    res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: env_1.config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: env_1.config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth/refresh',
    });
};
/**
 * POST /api/demo/login
 * Creates demo company + seeds realistic data + logs in as demo user.
 * Safe to call multiple times — resets data on each call.
 */
const demoLogin = async (req, res) => {
    const handler = 'demoLogin';
    const client = await database_1.pool.connect();
    try {
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Demo login requested');
        // ---- 1. Ensure demo user exists (signup or login) ----
        let authResult;
        try {
            authResult = await authService_1.authService.signup({
                companyName: DEMO_COMPANY,
                email: DEMO_EMAIL,
                password: DEMO_PASSWORD,
                firstName: 'Demo',
                lastName: 'User',
            });
        }
        catch {
            // Already exists — just login
            authResult = await authService_1.authService.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
        }
        const companyId = authResult.company.id;
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Demo company resolved', { companyId });
        // ---- 2. Reset existing demo data ----
        await client.query('BEGIN');
        await client.query(`DELETE FROM email_logs   WHERE company_id = $1`, [companyId]);
        await client.query(`DELETE FROM payments     WHERE company_id = $1`, [companyId]);
        await client.query(`DELETE FROM payment_plans WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)`, [companyId]);
        await client.query(`DELETE FROM invoices     WHERE company_id = $1`, [companyId]);
        await client.query(`DELETE FROM customers    WHERE company_id = $1`, [companyId]);
        await client.query('COMMIT');
        // ---- 3. Seed customers ----
        const now = Date.now();
        const d = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString();
        const customers = [
            { name: 'Sarah Chen', email: 'sarah.chen@nexflow.io', company: 'Nexflow Inc', industry: 'SaaS', history: { on_time_rate: 92, avg_days_late: 2, total_invoices: 18, total_paid: 41200 } },
            { name: 'Mike Johnson', email: 'mike@buildright.com', company: 'BuildRight LLC', industry: 'Construction', history: { on_time_rate: 65, avg_days_late: 12, total_invoices: 9, total_paid: 18900 } },
            { name: 'David Park', email: 'david@techwave.co', company: 'TechWave Co', industry: 'SaaS', history: { on_time_rate: 40, avg_days_late: 28, total_invoices: 6, total_paid: 9500 } },
            { name: 'Priya Mehta', email: 'priya@healthsync.io', company: 'HealthSync', industry: 'HealthTech', history: { on_time_rate: 80, avg_days_late: 5, total_invoices: 4, total_paid: 8400 } },
            { name: 'Jason Torres', email: 'jason.torres@cloudgate.com', company: 'CloudGate Inc', industry: 'Cloud', history: { on_time_rate: 55, avg_days_late: 22, total_invoices: 12, total_paid: 31000 } },
            { name: 'Emma Williams', email: 'emma@datacore.ai', company: 'DataCore AI', industry: 'Analytics', history: { on_time_rate: 75, avg_days_late: 8, total_invoices: 7, total_paid: 15600 } },
            { name: 'Ryan Lee', email: 'ryan@swiftly.app', company: 'Swiftly Inc', industry: 'Logistics', history: { on_time_rate: 88, avg_days_late: 3, total_invoices: 5, total_paid: 6200 } },
            { name: 'Nina Patel', email: 'nina@devfirst.io', company: 'DevFirst', industry: 'DevTools', history: { on_time_rate: 30, avg_days_late: 45, total_invoices: 3, total_paid: 4500 } },
        ];
        await client.query('BEGIN');
        const custRows = [];
        for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            const r = await client.query(`INSERT INTO customers (company_id, name, email, company_name, industry, payment_history, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [companyId, c.name, c.email, c.company, c.industry, JSON.stringify(c.history), d(90 - i * 5)]);
            custRows.push({ id: r.rows[0].id, idx: i });
        }
        const invSpecs = [
            // PAID (recovered by agent)
            [0, 5200, 90, 60, 'paid', 15, 'stripe'],
            [0, 3800, 60, 30, 'paid', 10, 'stripe'],
            [1, 8500, 75, 45, 'paid', 55, 'quickbooks'],
            [2, 6200, 80, 50, 'paid', 72, 'manual'],
            [3, 4100, 50, 20, 'paid', 20, 'stripe'],
            [4, 9800, 85, 55, 'paid', 60, 'stripe'],
            [5, 4400, 45, 15, 'paid', 25, 'manual'],
            [6, 3200, 40, 10, 'paid', 18, 'stripe'],
            // IN PAYMENT PLAN (arranged)
            [2, 14500, 95, 65, 'arranged', 88, 'stripe'],
            [4, 22000, 100, 70, 'arranged', 91, 'quickbooks'],
            [7, 8600, 70, 40, 'arranged', 85, 'manual'],
            [1, 6300, 60, 30, 'arranged', 78, 'stripe'],
            // OVERDUE — agent in progress
            [2, 9100, 55, 25, 'unpaid', 92, 'stripe'],
            [4, 18000, 50, 20, 'unpaid', 87, 'quickbooks'],
            [7, 11200, 65, 35, 'unpaid', 95, 'manual'],
            [1, 4500, 30, 10, 'unpaid', 62, 'stripe'],
            [5, 7800, 45, 15, 'unpaid', 70, 'stripe'],
            [3, 2900, 20, 5, 'unpaid', 35, 'manual'],
            [0, 6100, 25, 8, 'unpaid', 42, 'stripe'],
            [6, 1800, 15, 2, 'unpaid', 22, 'stripe'],
            // FRESH (just created, agent not yet reached)
            [0, 3500, 5, 25, 'unpaid', 5, 'stripe'],
            [3, 5600, 3, 27, 'unpaid', 8, 'stripe'],
            [5, 4200, 4, 26, 'unpaid', 6, 'manual'],
            [6, 2100, 2, 28, 'unpaid', 3, 'stripe'],
        ];
        const invRows = [];
        for (const [ci, amount, daysIssued, daysDue, status, risk, src] of invSpecs) {
            const custId = custRows[ci].id;
            const issuedDate = d(daysIssued);
            const dueDate = d(daysDue);
            const srcId = `demo-${src}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const r = await client.query(`INSERT INTO invoices (company_id, customer_id, amount, currency, due_date, issued_date, status, risk_score, source, source_id, created_at)
         VALUES ($1,$2,$3,'USD',$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [companyId, custId, amount, dueDate, issuedDate, status, risk, src, srcId, issuedDate]);
            invRows.push({ id: r.rows[0].id, custIdx: ci, amount, status, daysAgoDue: daysDue });
        }
        // ---- 5. Seed payments for paid invoices ----
        const paidInvs = invRows.filter(i => i.status === 'paid');
        for (const inv of paidInvs) {
            const paidAt = d(Math.max(0, inv.daysAgoDue - Math.floor(Math.random() * 8)));
            await client.query(`INSERT INTO payments (invoice_id, company_id, amount, currency, payment_method, paid_at, stripe_charge_id, status)
         VALUES ($1,$2,$3,'USD','stripe',$4,$5,'succeeded')`, [inv.id, companyId, inv.amount, paidAt, `ch_demo_${inv.id.slice(0, 8)}`]);
        }
        // ---- 6. Seed payment plans for arranged invoices ----
        const arrangedInvs = invRows.filter(i => i.status === 'arranged');
        for (const inv of arrangedInvs) {
            const installAmt = (inv.amount / 3).toFixed(2);
            const installments = [
                { amount: parseFloat(installAmt), due_date: d(inv.daysAgoDue - 5), paid: true, stripe_payment_intent_id: `pi_demo_1_${inv.id.slice(0, 6)}` },
                { amount: parseFloat(installAmt), due_date: d(inv.daysAgoDue - 35), paid: false, stripe_payment_intent_id: null },
                { amount: inv.amount - 2 * parseFloat(installAmt), due_date: d(inv.daysAgoDue - 65), paid: false, stripe_payment_intent_id: null },
            ];
            await client.query(`INSERT INTO payment_plans (invoice_id, status, installments, total_amount)
         VALUES ($1,'active',$2,$3)`, [inv.id, JSON.stringify(installments), inv.amount]);
            // First installment payment recorded
            await client.query(`INSERT INTO payments (invoice_id, company_id, amount, currency, payment_method, paid_at, status)
         VALUES ($1,$2,$3,'USD','stripe',$4,'succeeded')`, [inv.id, companyId, parseFloat(installAmt), d(inv.daysAgoDue - 5)]);
        }
        // ---- 7. Seed email logs ----
        const emailSubjects = {
            dunning_1: ['Quick reminder: Invoice #{n} is due', 'Friendly reminder about your balance', 'Invoice #{n} — due today'],
            dunning_2: ['Following up on overdue invoice #{n}', 'Invoice #{n} is now past due', 'Action needed: Invoice #{n}'],
            dunning_3: ['Payment arrangement available for Invoice #{n}', 'Let\'s resolve Invoice #{n} together', 'Flexible payment options for your balance'],
            dunning_4: ['Final notice: Invoice #{n}', 'Urgent: Invoice #{n} requires immediate attention', 'Invoice #{n} — 60+ days overdue'],
            dunning_5: ['Last attempt before escalation — Invoice #{n}', 'Critical: Invoice #{n}', 'Invoice #{n} — Final escalation notice'],
        };
        // Send emails for all non-fresh invoices
        const emailableInvs = invRows.filter(i => i.daysAgoDue > 5);
        let emailN = 1000;
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
                await client.query(`INSERT INTO email_logs (invoice_id, company_id, email_type, recipient_email, subject, body, sent_at, opened_at, clicked_at, status, sendgrid_message_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
                    inv.id, companyId, emailType, cust.email, subject,
                    `Dear ${cust.name},\n\nThis is a reminder regarding your outstanding invoice of $${inv.amount.toLocaleString()}.\n\nPlease arrange payment at your earliest convenience.\n\nBest regards,\nRecoverAI`,
                    sentAt, openedAt, clickedAt, status,
                    `msg_demo_${inv.id.slice(0, 8)}_${t}`,
                ]);
            }
        }
        await client.query('COMMIT');
        // ---- 8. Seed recovery_timeline (30 days) ----
        await client.query(`DELETE FROM recovery_timeline WHERE company_id = $1`, [companyId]);
        for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
            const periodDate = new Date(now - dayOffset * 86400000).toISOString().slice(0, 10);
            const progress = (29 - dayOffset) / 29;
            // Simulate realistic growth: start slow, improve over 30 days
            const amountRecovered = Math.round(34200 * progress * (0.8 + Math.random() * 0.4));
            const invoicesRecovered = Math.round(8 * progress);
            const emailsSent = Math.round(3 + progress * 5);
            const emailsOpened = Math.round(emailsSent * (0.5 + Math.random() * 0.2));
            await client.query(`INSERT INTO recovery_timeline (
           company_id, period_date, period_type,
           invoices_created, invoices_recovered,
           amount_created, amount_recovered,
           emails_sent, emails_opened, emails_clicked,
           avg_days_to_collect
         ) VALUES ($1, $2, 'daily', $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (company_id, period_date, period_type) DO UPDATE SET
           invoices_recovered = EXCLUDED.invoices_recovered,
           amount_recovered   = EXCLUDED.amount_recovered,
           emails_sent        = EXCLUDED.emails_sent,
           emails_opened      = EXCLUDED.emails_opened`, [companyId, periodDate, invRows.length, invoicesRecovered, 87400, amountRecovered,
                emailsSent, emailsOpened, Math.round(emailsOpened * 0.4), 42]);
        }
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Demo data seeded', {
            customers: customers.length,
            invoices: invRows.length,
            paid: paidInvs.length,
            arranged: arrangedInvs.length,
            timelineDays: 30,
        });
        // ---- 8. Log in and return cookies ----
        const loginResult = await authService_1.authService.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
        setCookies(res, loginResult.tokens.accessToken, loginResult.tokens.refreshToken);
        res.status(200).json({
            message: 'Demo account ready',
            user: loginResult.user,
            company: loginResult.company,
            isDemo: true,
        });
    }
    catch (error) {
        try {
            await client.query('ROLLBACK');
        }
        catch { }
        (0, logger_1.logError)(LOG_MODULE, handler, 'Demo setup failed', error);
        const msg = error instanceof Error ? error.message : 'Demo setup failed';
        res.status(500).json({ error: msg });
    }
    finally {
        client.release();
    }
};
exports.demoLogin = demoLogin;
/**
 * POST /api/demo/preview
 * Dry-run the agent on demo data — returns what WOULD happen (no emails sent).
 * Call after /api/demo/login to get safe preview for prospects.
 */
const demoPreview = async (req, res) => {
    const handler = 'demoPreview';
    try {
        (0, logger_1.logInfo)(LOG_MODULE, handler, 'Demo preview requested');
        // Get demo company id from DB
        const companyRes = await database_1.pool.query(`SELECT c.id FROM companies c
       JOIN users u ON u.company_id = c.id
       WHERE u.email = $1 LIMIT 1`, [DEMO_EMAIL]);
        if (!companyRes.rows.length) {
            res.status(404).json({ error: 'Demo company not found — call /api/demo/login first' });
            return;
        }
        const companyId = companyRes.rows[0].id;
        const preview = await (0, agentLoop_1.runDecisionEngineDryRun)(companyId);
        res.status(200).json({
            message: 'Demo agent preview complete',
            ...preview,
            note: 'No emails were sent. These are what the agent would send if approved.',
        });
    }
    catch (error) {
        (0, logger_1.logError)(LOG_MODULE, handler, 'Demo preview failed', error);
        const msg = error instanceof Error ? error.message : 'Demo preview failed';
        res.status(500).json({ error: msg });
    }
};
exports.demoPreview = demoPreview;
