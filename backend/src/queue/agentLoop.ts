import cron from 'node-cron';
import { queueEmailNow, TIER_DUNNING_TREES } from './dunningQueue';
import { queueSMSNow } from './smsQueue';
import { queueVoiceCall } from './voiceCallQueue';
import { hasRecentVoiceCall } from '../services/twilioService';
import { pool } from '../config/database';
import { logError, logInfo, logWarn } from '../utils/logger';
import { normalizePhone } from '../services/smsService';
import { scoreCustomerRisk } from '../services/riskScoringService';
// import { createPlanForInvoice } from '../services/paymentPlanService';  // ❌ DISABLED: PHASE 2 feature
import { logAgentDecision } from '../db/agentDecisions';
import { isRecentlyRejected } from '../db/rejectionTracking';
import { logDailyActionsAvailableNotification } from '../utils/notificationLogger';
import type { DunningEmailType } from '../types/email';

// SMS thresholds: send SMS when email alone isn't working
const SMS_MIN_EMAILS_SENT = 2;     // must have tried email at least twice
const SMS_MIN_DAYS_OVERDUE = 7;    // must be at least 7 days overdue

const LOG_MODULE = 'agentLoop';
const MAX_DUNNING_EMAILS = 5;
// const PAYMENT_PLAN_DAY_THRESHOLD = 15;  // ❌ DISABLED: PHASE 2 feature

// Decision tree: days overdue → email type (in order)
// Exported so invoiceController can compute nextScheduledDate without duplicating
export const DUNNING_DECISION_TREE: Array<{ dayOffset: number; emailType: DunningEmailType }> = [
  { dayOffset: 1,  emailType: 'dunning_1' },
  { dayOffset: 7,  emailType: 'dunning_2' },
  { dayOffset: 14, emailType: 'dunning_3' },
  { dayOffset: 30, emailType: 'dunning_4' },
  { dayOffset: 60, emailType: 'dunning_5' },
];

/**
 * Fetch all unpaid overdue invoices with their email and payment plan state.
 * Returns one row per invoice with aggregated email/plan data.
 */
async function getOverdueInvoicesForProcessing(): Promise<Array<{
  id: string;
  company_id: string;
  customer_id: string;
  amount: number;
  due_date: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  customer_phone_opt_in: boolean;
  company_name: string;
  customer_risk_score: number;
  risk_tier: number;
  dunning_emails_sent: number;
  email_types_sent: string[];
  has_active_plan: boolean;
  plan_offer_sent: boolean;
  dunning_paused_until: string | null;
  dunning_stopped: boolean;
  sms_count: number;
  company_pilot_mode: 'shadow' | 'auto' | 'paused' | null;
  dunning_tone: 'gentle' | 'standard' | 'aggressive' | null;
  pause_dunning_until: string | null;
  paused_customers: string[] | null;
  aggressive_enabled: boolean;
  payment_insights: { avg_emails_before_payment: number | null; reliability_pct: number | null; dso_trend: string | null } | null;
}>> {
  const result = await pool.query(`
    SELECT
      i.id,
      i.company_id,
      i.customer_id,
      i.amount::float AS amount,
      i.due_date,
      c.customer_risk_score,
      i.dunning_paused_until,
      COALESCE(i.dunning_stopped, false) AS dunning_stopped,
      COALESCE(i.sms_count, 0)::int AS sms_count,
      c.email           AS customer_email,
      c.company_name    AS customer_name,
      c.phone           AS customer_phone,
      COALESCE(c.phone_opt_in, false) AS customer_phone_opt_in,
      COALESCE(c.risk_tier, 2)::int AS risk_tier,
      co.name           AS company_name,
      COALESCE(co.pilot_mode, 'shadow') AS company_pilot_mode,
      COALESCE(co.dunning_tone, 'standard') AS dunning_tone,
      co.pause_dunning_until,
      co.paused_customers,
      COALESCE(co.aggressive_enabled, false) AS aggressive_enabled,
      c.payment_insights,
      COUNT(DISTINCT el.id) FILTER (
        WHERE el.email_type LIKE 'dunning_%' AND el.status NOT IN ('failed', 'skipped')
      )::int AS dunning_emails_sent,
      COALESCE(
        ARRAY_AGG(DISTINCT el.email_type) FILTER (WHERE el.email_type IS NOT NULL AND el.status NOT IN ('failed', 'skipped')),
        '{}'::text[]
      ) AS email_types_sent,
      false AS has_active_plan,  -- ❌ DISABLED: PHASE 2 feature
      (COUNT(DISTINCT el2.id) FILTER (WHERE el2.email_type = 'payment_plan_offer' AND el2.status NOT IN ('failed', 'skipped')) > 0) AS plan_offer_sent
    FROM invoices i
    JOIN customers c  ON i.customer_id = c.id
    JOIN companies co ON i.company_id  = co.id
    LEFT JOIN email_logs el  ON el.invoice_id = i.id
    LEFT JOIN email_logs el2 ON el2.invoice_id = i.id
    WHERE i.status NOT IN ('paid', 'uncollectable')
      AND i.due_date < NOW() + INTERVAL '7 days'
      AND c.email IS NOT NULL
      AND c.email != ''
      AND COALESCE(c.do_not_email, false) = false
    GROUP BY i.id, i.company_id, i.customer_id, i.amount, i.due_date, c.customer_risk_score,
             i.dunning_paused_until, i.dunning_stopped, i.sms_count,
             c.email, c.company_name, c.phone, c.phone_opt_in, c.risk_tier, co.name, co.pilot_mode,
             co.dunning_tone, co.pause_dunning_until, co.paused_customers, co.aggressive_enabled,
             c.payment_insights
    ORDER BY i.due_date ASC
  `);

  return result.rows.map(row => ({
    ...row,
    has_active_plan: row.has_active_plan === true || row.has_active_plan === 't',
    plan_offer_sent: row.plan_offer_sent === true || row.plan_offer_sent === 't',
    customer_phone_opt_in: row.customer_phone_opt_in === true || row.customer_phone_opt_in === 't',
  }));
}

/**
 * Core decision engine: scans all unpaid overdue invoices and queues the
 * appropriate next dunning email for each one.
 */
async function runDecisionEngine(): Promise<{
  total: number;
  emailsQueued: number;
  planOffersQueued: number;
  skipped: number;
}> {
  const method = 'runDecisionEngine';
  logInfo(LOG_MODULE, method, 'Agent decision engine starting');

  const allInvoices = await getOverdueInvoicesForProcessing();

  // Filter: Only process companies in 'auto' mode (not shadow/paused)
  // Also filter out demo company
  const demoCompanyId = await pool.query(
    `SELECT id FROM companies WHERE name = 'Acme SaaS (Demo)' LIMIT 1`
  );
  const demoCompId = demoCompanyId.rows[0]?.id;

  const invoices = allInvoices.filter(inv => {
    if (demoCompId && inv.company_id === demoCompId) return false;
    return true;
  });

  let skippedCount = 0;
  logInfo(LOG_MODULE, method, `Processing ${invoices.length} unpaid overdue invoices`);

  let emailsQueued = 0;
  let planOffersQueued = 0;

  for (const invoice of invoices) {
    try {
      const now = Date.now();
      const dueDate = new Date(invoice.due_date).getTime();
      const daysOverdue = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000));

      if (daysOverdue < 1) {
        skippedCount++;
        continue;
      }

      // P0: Skip paused pilot accounts
      if (invoice.company_pilot_mode === 'paused') {
        logInfo(LOG_MODULE, method, 'Company pilot paused — skipping invoice', {
          invoiceId: invoice.id,
          companyId: invoice.company_id,
        });
        skippedCount++;
        continue;
      }

      // ── Dunning control checks ──
      if (invoice.dunning_stopped) {
        logInfo(LOG_MODULE, method, 'Dunning stopped — skipping', { invoiceId: invoice.id });
        skippedCount++;
        continue;
      }

      if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
        logInfo(LOG_MODULE, method, 'Dunning paused — skipping', {
          invoiceId: invoice.id,
          pausedUntil: invoice.dunning_paused_until,
        });
        skippedCount++;
        continue;
      }

      if (!invoice.customer_email) {
        logWarn(LOG_MODULE, method, 'No customer email — skipping', { invoiceId: invoice.id });
        skippedCount++;
        continue;
      }

      // ── Phase 2: Company-level dunning controls ──
      if (invoice.pause_dunning_until && new Date(invoice.pause_dunning_until) > new Date()) {
        logInfo(LOG_MODULE, method, 'Company dunning paused globally — skipping', {
          invoiceId: invoice.id,
          pausedUntil: invoice.pause_dunning_until,
        });
        skippedCount++;
        continue;
      }

      if (invoice.paused_customers && invoice.paused_customers.includes(invoice.customer_id)) {
        logInfo(LOG_MODULE, method, 'Customer paused from dunning — skipping', {
          invoiceId: invoice.id,
          customerId: invoice.customer_id,
        });
        skippedCount++;
        continue;
      }

      const emailTypesSent = new Set<string>(invoice.email_types_sent || []);

      // ── Tier Calculation ──
      let tier = Math.min(4, Math.max(1, invoice.risk_tier || 2)) as 1 | 2 | 3 | 4;

      // ── Phase 2: Apply dunning tone overrides ──
      if (invoice.dunning_tone === 'gentle') {
        tier = 1;
      } else if (invoice.dunning_tone === 'aggressive' || invoice.aggressive_enabled) {
        tier = Math.max(tier, 3) as 1 | 2 | 3 | 4;
      }

      // ── Apply payment_insights tier adjustment ──
      const avgEmailsNeeded = invoice.payment_insights?.avg_emails_before_payment ?? null;
      if (avgEmailsNeeded !== null) {
        if (avgEmailsNeeded > 2.5 && tier < 3) {
          tier = Math.min(tier + 1, 4) as 1 | 2 | 3 | 4;
          logInfo(LOG_MODULE, method, 'Tier bumped (slow payer)', { invoiceId: invoice.id });
        } else if (avgEmailsNeeded <= 1.2 && tier > 1 && invoice.dunning_emails_sent === 0) {
          tier = Math.max(tier - 1, 1) as 1 | 2 | 3 | 4;
          logInfo(LOG_MODULE, method, 'Tier reduced (self-payer)', { invoiceId: invoice.id });
        }
      }

      // ── Send high-risk alert ──
      if (invoice.customer_risk_score >= 75 && daysOverdue >= 30) {
        try {
          const { slackNotificationService } = await import('../services/slackNotificationService');
          await slackNotificationService.notifyHighRisk({
            companyId: invoice.company_id,
            customerId: invoice.customer_id,
            customerName: invoice.customer_name,
            riskScore: invoice.customer_risk_score,
            daysOverdue,
            invoiceId: invoice.id,
          });
        } catch (err) {
          logWarn(LOG_MODULE, method, 'High-risk notification failed (non-blocking)', { error: String(err) });
        }
      }

      // ┌─────────────────────────────────────────────────────────────┐
      // │ UNIFIED PIPELINE: Email → Email → SMS → Voice (One at a time) │
      // └─────────────────────────────────────────────────────────────┘

      // ─── GATE 1: Check if anything is already pending for this invoice ───
      const hasPendingItem = await pool.query(
        `SELECT id, type FROM pilot_queued_emails
         WHERE invoice_id = $1 AND status = 'pending_approval'
         LIMIT 1`,
        [invoice.id]
      );

      if (hasPendingItem.rows.length > 0) {
        const pendingType = hasPendingItem.rows[0].type;
        logInfo(LOG_MODULE, method, 'Item already pending — skipping invoice (pipeline)', {
          invoiceId: invoice.id,
          pendingType,
        });
        skippedCount++;
        continue;
      }

      // ─── GATE 2: Get last SENT item (any type) from pipeline ───
      const lastSentResult = await pool.query(
        `SELECT sent_at, type FROM pilot_queued_emails
         WHERE invoice_id = $1 AND status = 'sent'
         ORDER BY sent_at DESC
         LIMIT 1`,
        [invoice.id]
      );

      const lastSentItem = lastSentResult.rows[0];
      const lastSentAtMs = lastSentItem ? new Date(lastSentItem.sent_at).getTime() : null;

      // ─── GATE 3: Calculate next eligible time (unified pipeline rule) ───
      const tierGapDays = [0, 7, 6, 5, 4][tier];
      let nextEligibleAtMs: number;

      if (!lastSentAtMs) {
        nextEligibleAtMs = now;
      } else {
        nextEligibleAtMs = lastSentAtMs + (tierGapDays * 24 * 60 * 60 * 1000);
      }

      const isTimeForNextItem = now >= nextEligibleAtMs;

      // ─── GATE 4: Determine what to queue next (Priority 1, 2, 3) ───
      const emailsSent = invoice.dunning_emails_sent;
      const smsSent = invoice.sms_count;

      let itemQueued = false;

      // Priority 1: Queue next EMAIL (if not all sent)
      if (isTimeForNextItem && emailsSent < MAX_DUNNING_EMAILS) {
        const emailSequence: DunningEmailType[] = ['dunning_1', 'dunning_2', 'dunning_3', 'dunning_4', 'dunning_5'];
        const nextEmailType = emailSequence[emailsSent];

        // Check rejection block
        const recentRejection = await isRecentlyRejected(invoice.id, nextEmailType);
        if (recentRejection) {
          logInfo(LOG_MODULE, method, 'Email rejected (7-day block) — skipping', {
            invoiceId: invoice.id,
            emailType: nextEmailType,
            expiresAt: recentRejection.expires_at,
          });
          skippedCount++;
        } else {
          await queueEmailNow({
            companyId: invoice.company_id,
            customerId: invoice.customer_id,
            invoiceId: invoice.id,
            recipientEmail: invoice.customer_email,
            customerName: invoice.customer_name,
            invoiceAmount: invoice.amount,
            dueDate: invoice.due_date,
            daysOverdue,
            emailType: nextEmailType,
            attemptNumber: emailsSent + 1,
            riskScore: invoice.customer_risk_score || undefined,
            pilotMode: invoice.company_pilot_mode as any,
          });
          emailsQueued++;
          itemQueued = true;
          logInfo(LOG_MODULE, method, 'Email queued (pipeline)', {
            invoiceId: invoice.id,
            emailType: nextEmailType,
            emailNumber: emailsSent + 1,
            lastSentAt: lastSentItem?.sent_at ? new Date(lastSentItem.sent_at).toISOString() : 'first',
            nextEligibleAtMs,
            tierGapDays,
          });
          // Log decision
          try {
            await logAgentDecision({
              companyId: invoice.company_id,
              invoiceId: invoice.id,
              customerId: invoice.customer_id,
              decisionType: 'email_queued',
              emailType: nextEmailType,
              pilotMode: invoice.company_pilot_mode || undefined,
              daysOverdue,
              riskScore: invoice.customer_risk_score || undefined,
              reason: `Dunning ${emailsSent + 1} (${tierGapDays}d gap from last sent)`,
            });
          } catch (_err) {
            // Swallow
          }
        }
      }
      // Priority 2: Queue SMS (INTELLIGENT based on customer payment history)
      else if (isTimeForNextItem && smsSent === 0) {
        // Get customer's historical email requirement (intelligence: use real data)
        const avgEmailsNeededForSMS = invoice.payment_insights?.avg_emails_before_payment ?? SMS_MIN_EMAILS_SENT;

        // Queue SMS only if we've sent enough emails for THIS customer's behavior
        const shouldQueueSMS = emailsSent >= Math.max(SMS_MIN_EMAILS_SENT, Math.ceil(avgEmailsNeededForSMS));

        if (shouldQueueSMS && emailsSent < MAX_DUNNING_EMAILS + 1) {
          // Check for hard bounces (indicates email channel is broken)
          let hasHardBounce = false;
          if (emailsSent > 0) {
            const bounceCheck = await pool.query(
              `SELECT COUNT(*) as bounce_count FROM email_logs
               WHERE invoice_id = $1 AND status = 'bounced'`,
              [invoice.id]
            );
            hasHardBounce = parseInt(bounceCheck.rows[0].bounce_count) > 0;
          }

          // SMS conditions: phone opted in, have number, time threshold met, engagement issue
          if (
            invoice.customer_phone_opt_in &&
            invoice.customer_phone &&
            (daysOverdue >= SMS_MIN_DAYS_OVERDUE || hasHardBounce)
          ) {
            const normalizedPhone = normalizePhone(invoice.customer_phone);
            if (normalizedPhone) {
              const recentRejection = await isRecentlyRejected(invoice.id, 'sms');
              if (recentRejection) {
                logInfo(LOG_MODULE, method, 'SMS rejected (7-day block)', {
                  invoiceId: invoice.id,
                  expiresAt: recentRejection.expires_at,
                });
              } else {
                await queueSMSNow({
                  companyId: invoice.company_id,
                  customerId: invoice.customer_id,
                  invoiceId: invoice.id,
                  phoneNumber: normalizedPhone,
                  customerName: invoice.customer_name,
                  companyName: invoice.company_name,
                  invoiceAmount: invoice.amount,
                  daysOverdue,
                });
                itemQueued = true;
                logInfo(LOG_MODULE, method, 'SMS queued (intelligent timing)', {
                  invoiceId: invoice.id,
                  emailsSent,
                  avgEmailsNeeded: Math.round(avgEmailsNeededForSMS * 100) / 100,
                  lastSentAt: lastSentItem?.sent_at ? new Date(lastSentItem.sent_at).toISOString() : 'none',
                  nextEligibleAtMs,
                  reason: hasHardBounce ? 'hard bounce detected' : `customer avg ${Math.round(avgEmailsNeededForSMS * 100) / 100} emails before payment`,
                });
                try {
                  await logAgentDecision({
                    companyId: invoice.company_id,
                    invoiceId: invoice.id,
                    customerId: invoice.customer_id,
                    decisionType: 'sms_queued',
                    pilotMode: invoice.company_pilot_mode || undefined,
                    daysOverdue,
                    riskScore: invoice.customer_risk_score || undefined,
                    reason: hasHardBounce ? 'Hard bounce → SMS escalation' : `SMS after ${emailsSent} emails (customer historically: ${Math.round(avgEmailsNeededForSMS * 100) / 100})`,
                  });
                } catch (_err) {
                  // Swallow
                }
              }
            }
          } else if (hasHardBounce && (!invoice.customer_phone || !invoice.customer_phone_opt_in)) {
            // ⚠️ HARD BOUNCE BUT NO SMS AVAILABLE → Mark as Unreachable
            logInfo(LOG_MODULE, method, 'Hard bounce + unreachable (no SMS)', {
              invoiceId: invoice.id,
              hasPhone: !!invoice.customer_phone,
              phoneOptIn: invoice.customer_phone_opt_in,
              reason: 'Email bounced, no SMS channel available',
            });
            try {
              await logAgentDecision({
                companyId: invoice.company_id,
                invoiceId: invoice.id,
                customerId: invoice.customer_id,
                decisionType: 'unreachable',
                pilotMode: invoice.company_pilot_mode || undefined,
                daysOverdue,
                riskScore: invoice.customer_risk_score || undefined,
                reason: 'Hard bounce (email invalid). No SMS phone number on file. Manual follow-up required.',
              });
            } catch (_err) {
              // Swallow
            }
            skippedCount++;
          }
        }
      }
      // Priority 3: Queue VOICE (if SMS done AND conditions met)
      else if (isTimeForNextItem && emailsSent >= MAX_DUNNING_EMAILS && smsSent > 0 && tier === 4 && daysOverdue >= 90) {
        const normalizedPhone = invoice.customer_phone ? normalizePhone(invoice.customer_phone) : null;
        if (normalizedPhone && !await hasRecentVoiceCall(invoice.id, 24)) {
          const recentRejection = await isRecentlyRejected(invoice.id, 'voice');
          if (recentRejection) {
            logInfo(LOG_MODULE, method, 'Voice rejected (7-day block)', {
              invoiceId: invoice.id,
              expiresAt: recentRejection.expires_at,
            });
          } else {
            try {
              const invResult = await pool.query('SELECT invoice_number FROM invoices WHERE id = $1', [invoice.id]);
              const invoiceNumber = invResult.rows[0]?.invoice_number || 'Unknown';

              await queueVoiceCall({
                invoiceId: invoice.id,
                companyId: invoice.company_id,
                customerId: invoice.customer_id,
                phone: normalizedPhone,
                amount: invoice.amount,
                invoiceNumber,
              });
              itemQueued = true;
              logInfo(LOG_MODULE, method, 'Voice queued (pipeline)', {
                invoiceId: invoice.id,
                daysOverdue,
                lastSentAt: lastSentItem?.sent_at ? new Date(lastSentItem.sent_at).toISOString() : 'none',
                nextEligibleAtMs,
              });
            } catch (err) {
              logWarn(LOG_MODULE, method, 'Voice queue failed (non-blocking)', {
                invoiceId: invoice.id,
                error: String(err),
              });
            }
          }
        }
      }
      // No item queued
      else if (!isTimeForNextItem) {
        const daysUntilEligible = Math.ceil((nextEligibleAtMs - now) / (24 * 60 * 60 * 1000));
        logInfo(LOG_MODULE, method, 'Item not yet eligible (waiting for gap)', {
          invoiceId: invoice.id,
          daysUntilEligible,
          lastSentAt: lastSentItem?.sent_at || 'none',
          nextEligibleAtMs,
        });
        skippedCount++;
      } else if (!itemQueued && emailsSent >= MAX_DUNNING_EMAILS && smsSent === 0) {
        logInfo(LOG_MODULE, method, 'SMS not eligible (conditions not met)', {
          invoiceId: invoice.id,
          emailsSent,
          daysOverdue,
          lastSentAt: lastSentItem?.sent_at ? new Date(lastSentItem.sent_at).toISOString() : 'none',
        });
        skippedCount++;
      } else {
        logInfo(LOG_MODULE, method, 'Pipeline complete (all items sent)', {
          invoiceId: invoice.id,
          emailsSent,
          smsSent,
          lastSentAt: lastSentItem?.sent_at ? new Date(lastSentItem.sent_at).toISOString() : 'none',
        });
        skippedCount++;
      }

      // ❌ DISABLED: PHASE 2 feature
      // // ── Auto-offer payment plan at day 15+ ──
      // if (
      //   daysOverdue >= PAYMENT_PLAN_DAY_THRESHOLD &&
      //   !invoice.has_active_plan &&
      //   !invoice.plan_offer_sent
      // ) { ... }

      // ✅ SMS and Voice now handled in unified pipeline above

      // ── Proactive risk email: send BEFORE invoice fails ──
      // Triggered when: score >= 60 AND invoice due within 7 days AND not yet overdue
      // AND no proactive_reminder email sent yet for this invoice
      if (daysOverdue <= 0) {
        const daysUntilDue = Math.abs(daysOverdue);
        if (daysUntilDue <= 7) {
          const emailTypesSentForRisk = new Set<string>(invoice.email_types_sent || []);
          if (!emailTypesSentForRisk.has('proactive_reminder')) {
            const { score } = await scoreCustomerRisk(invoice.company_id, invoice.customer_id);
            if (score >= 60) {
              await queueEmailNow({
                companyId: invoice.company_id,
                customerId: invoice.customer_id,
                invoiceId: invoice.id,
                recipientEmail: invoice.customer_email,
                customerName: invoice.customer_name || 'Valued Customer',
                invoiceAmount: Number(invoice.amount),
                dueDate: invoice.due_date,
                daysOverdue: 0,
                emailType: 'proactive_reminder' as DunningEmailType,
                attemptNumber: 1,
                riskScore: score,
              });
              emailsQueued++;
              logInfo(LOG_MODULE, method, 'Proactive risk email queued', {
                invoiceId: invoice.id,
                customerId: invoice.customer_id,
                riskScore: score,
                daysUntilDue,
              });
              // Log decision for learning system (fire-and-forget)
              try {
                await logAgentDecision({
                  companyId: invoice.company_id,
                  invoiceId: invoice.id,
                  customerId: invoice.customer_id,
                  decisionType: 'email_queued',
                  emailType: 'proactive_reminder',
                  pilotMode: invoice.company_pilot_mode || undefined,
                  daysOverdue: daysUntilDue,
                  riskScore: score,
                  reason: `Proactive reminder due to high risk score (${score})`,
                });
              } catch (_err) {
                // Swallow errors - non-critical
              }
            }
          }
        }
      }
    } catch (err) {
      logError(LOG_MODULE, method, 'Error processing invoice', err, { invoiceId: invoice.id });
    }
  }

  const result = { total: invoices.length, emailsQueued, planOffersQueued, skipped: skippedCount };
  logInfo(LOG_MODULE, method, 'Agent run complete', result);

  // Wire notification: if ≥3 emails pending approval, notify user
  if (invoices.length > 0) {
    try {
      const companyId = invoices[0].company_id;

      // Count pending approvals from database (not just queued this run)
      const pendingApprovalsResult = await pool.query(
        `SELECT COUNT(*) as count
         FROM pilot_queued_emails
         WHERE company_id = $1
           AND status = 'pending_approval'`,
        [companyId]
      );

      const pendingCount = parseInt(pendingApprovalsResult.rows[0]?.count || '0');

      if (pendingCount >= 3) {
        await logDailyActionsAvailableNotification(companyId, pendingCount);
      }
    } catch (notifyErr: unknown) {
      logWarn(LOG_MODULE, method, 'Failed to log pending approval notification (non-blocking)', { error: String(notifyErr) });
    }
  }

  return result;
}

export function startAgentLoop(): void {
  // Run once 60s after boot to let server fully settle
  setTimeout(() => {
    runDecisionEngine().catch(err =>
      logError(LOG_MODULE, 'startupRun', 'Startup agent run failed', err)
    );
  }, 60_000);

  // NOTE: DO NOT add cron.schedule here — scheduler.ts handles the 6h cron job
  // Double-scheduling caused duplicate emails. Scheduler is the single source of truth.

  logInfo(LOG_MODULE, 'startAgentLoop', 'Agent loop started (6h cron job managed by scheduler.ts, startup in 60s)');
}

export function stopAgentLoop(): void {
  // node-cron tasks stop automatically on process exit — nothing to clean up
}

/**
 * Run the decision engine synchronously and return results immediately.
 * Used by the manual trigger endpoint for real-time feedback.
 */
export async function runDecisionEngineNow(): Promise<{
  total: number;
  emailsQueued: number;
  planOffersQueued: number;
  skipped: number;
}> {
  logInfo(LOG_MODULE, 'runDecisionEngineNow', 'Manual synchronous agent run starting');
  return runDecisionEngine();
}

export interface DryRunPreviewItem {
  invoiceId: string;
  customerId: string;
  customerName: string;
  recipientEmail: string;
  amount: number;
  daysOverdue: number;
  emailType: DunningEmailType | 'payment_plan_offer';
  riskScore: number;
}

/**
 * Dry-run the decision engine — same logic as runDecisionEngine but NO emails queued.
 * Returns what WOULD happen if agent ran now. Safe to call anytime.
 * Optionally scoped to a single company (pass companyId).
 */
export async function runDecisionEngineDryRun(companyId?: string): Promise<{
  total: number;
  emailsWouldQueue: number;
  plansWouldOffer: number;
  skipped: number;
  estimatedRecoveryUsd: number;
  previews: DryRunPreviewItem[];
}> {
  const method = 'runDecisionEngineDryRun';
  logInfo(LOG_MODULE, method, 'Dry-run agent preview starting', { companyId });

  const allInvoices = await getOverdueInvoicesForProcessing();
  const invoices = companyId
    ? allInvoices.filter(i => i.company_id === companyId)
    : allInvoices;

  let emailsWouldQueue = 0;
  let plansWouldOffer = 0;
  let skipped = 0;
  let estimatedRecoveryUsd = 0;
  const previews: DryRunPreviewItem[] = [];

  for (const invoice of invoices) {
    const now = Date.now();
    const dueDate = new Date(invoice.due_date).getTime();
    const daysOverdue = Math.floor((now - dueDate) / (24 * 60 * 60 * 1000));

    if (daysOverdue < 1 || !invoice.customer_email) {
      skipped++;
      continue;
    }

    if (invoice.dunning_stopped) {
      skipped++;
      continue;
    }

    if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
      skipped++;
      continue;
    }

    const emailTypesSent = new Set<string>(invoice.email_types_sent || []);
    let nextStep: { dayOffset: number; emailType: DunningEmailType } | null = null;
    for (const step of DUNNING_DECISION_TREE) {
      if (daysOverdue >= step.dayOffset && !emailTypesSent.has(step.emailType)) {
        nextStep = step;
        break;
      }
    }

    if (nextStep && invoice.dunning_emails_sent < MAX_DUNNING_EMAILS) {
      emailsWouldQueue++;
      // Estimate 30% recovery probability per email (conservative)
      estimatedRecoveryUsd += Math.round(invoice.amount * 0.30);
      previews.push({
        invoiceId: invoice.id,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name,
        recipientEmail: invoice.customer_email,
        amount: invoice.amount,
        daysOverdue,
        emailType: nextStep.emailType,
        riskScore: invoice.customer_risk_score || 0,
      });
    } else {
      skipped++;
    }

    // ❌ DISABLED: PHASE 2 feature
    // if (
    //   daysOverdue >= PAYMENT_PLAN_DAY_THRESHOLD &&
    //   !invoice.has_active_plan &&
    //   !invoice.plan_offer_sent
    // ) {
    //   plansWouldOffer++;
    //   previews.push({...});
    // }
  }

  const result = { total: invoices.length, emailsWouldQueue, plansWouldOffer, skipped, estimatedRecoveryUsd, previews };
  logInfo(LOG_MODULE, method, 'Dry-run complete', { total: result.total, emailsWouldQueue, plansWouldOffer });
  return result;
}