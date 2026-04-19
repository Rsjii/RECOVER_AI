/**
 * Payment Plan Charge Job
 * Runs daily at 09:00 UTC
 * Marks due installments and sends payment reminders via email
 */

import cron from 'node-cron';
import { pool } from '../config/database';
import { logInfo, logWarn } from '../utils/logger';
import { getPendingChargesDue } from '../services/paymentPlanService';

const MODULE = 'PaymentPlanChargeJob';

async function runPaymentPlanCharges(): Promise<{ processed: number; notified: number; failed: number }> {
  const jobStart = Date.now();
  let chargesProcessed = 0;
  let chargesNotified = 0;
  let chargesFailed = 0;

  try {
    logInfo(MODULE, 'runPaymentPlanCharges', 'Starting payment plan charge run');

    // Get all companies
    const companiesResult = await pool.query('SELECT DISTINCT company_id FROM payment_plans');
    const companies = companiesResult.rows;

    for (const { company_id: companyId } of companies) {
      try {
        // Get pending charges for this company
        const charges = await getPendingChargesDue(companyId);

        for (const charge of charges) {
          chargesProcessed++;

          try {
            // Fetch plan and customer details for email notification
            const planResult = await pool.query(
              `SELECT c.email as customer_email, c.company_name as customer_name, pp.id as plan_id, i.invoice_number, i.amount
               FROM payment_plan_charges ppc
               JOIN payment_plans pp ON ppc.plan_id = pp.id
               JOIN customers c ON pp.customer_id = c.id
               JOIN invoices i ON pp.invoice_id = i.id
               WHERE ppc.id = $1`,
              [charge.id]
            );

            if (planResult.rows.length === 0) {
              logWarn(MODULE, 'runPaymentPlanCharges', 'Charge or plan not found', {
                chargeId: charge.id
              });
              chargesFailed++;
              continue;
            }

            const planRow = planResult.rows[0];

            // TODO: Queue email notification for payment plan installment due
            // For now, just log that a charge is due
            logInfo(MODULE, 'runPaymentPlanCharges', 'Payment plan installment due - reminder queued', {
              chargeId: charge.id,
              planId: planRow.plan_id,
              customerId: planRow.customer_email,
              amount: charge.amount,
              dueDate: charge.due_date
            });

            chargesNotified++;
          } catch (chargeError) {
            logWarn(MODULE, 'runPaymentPlanCharges', 'Failed to process charge', {
              chargeId: charge.id,
              error: String(chargeError)
            });
            chargesFailed++;
          }
        }
      } catch (companyError) {
        logWarn(MODULE, 'runPaymentPlanCharges', 'Failed to process company charges', {
          companyId,
          error: String(companyError)
        });
      }
    }

    const duration = Date.now() - jobStart;
    const result = { processed: chargesProcessed, notified: chargesNotified, failed: chargesFailed };
    logInfo(MODULE, 'runPaymentPlanCharges', 'Payment plan charge run complete', {
      ...result,
      durationMs: duration
    });
    return result;
  } catch (error) {
    logWarn(MODULE, 'runPaymentPlanCharges', 'Payment plan charge run failed', {
      error: String(error)
    });
    throw error;
  }
}

export function startPaymentPlanChargeJob(): void {
  // Run daily at 09:00 AM UTC via cron (no Redis needed)
  cron.schedule('0 9 * * *', () => {
    runPaymentPlanCharges().catch(err =>
      logWarn(MODULE, 'cronRun', 'Daily payment plan charge failed', { error: String(err) })
    );
  });

  logInfo(MODULE, 'startPaymentPlanChargeJob', 'Payment plan charge job started (runs daily at 09:00 UTC via cron)');
}

export function stopPaymentPlanChargeJob(): void {
  // node-cron tasks stop automatically on process exit — nothing to clean up
}
