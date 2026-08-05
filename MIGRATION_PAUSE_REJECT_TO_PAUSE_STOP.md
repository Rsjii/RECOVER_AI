---
name: Migration Guide - Pause/Reject to Pause/Stop Model
type: reference
---

# MIGRATION: Current "Rejected" → New "Paused" Model

## Current State (What Exists)

### Database Schema
```sql
-- INVOICES TABLE (already has these fields!)
dunning_paused_until TIMESTAMPTZ DEFAULT NULL   -- Line 218, schema.sql
dunning_stopped BOOLEAN NOT NULL DEFAULT FALSE  -- Line 219, schema.sql

-- REJECTION TRACKING TABLE (separate, for bounced emails)
CREATE TABLE rejection_tracking (
  id UUID PRIMARY KEY,
  company_id UUID,
  invoice_id UUID,
  email_type VARCHAR(50),      -- Specific: dunning_1, dunning_2, sms, etc.
  rejected_by VARCHAR,
  reason TEXT,
  rejected_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ       -- Auto-expires after 7 days
);
```

### Current "Rejected" Activity Tab
```typescript
// ActivityModal.tsx line 219
state === 'rejected' && (
  <p>⚠️ Rejected (Blocked for 7 days)</p>
  <p>Will auto re-queue: {formatDate(addDays(...)}</p>
)

// This shows per-email-type rejections
// From rejection_tracking table
```

### Current Rejection Functions
```typescript
// rejectionTracking.ts
insertRejectionTracking()      // Block email_type for 7 days
isRecentlyRejected()           // Check if email_type blocked
getActiveRejections()          // Get all blocked email types
cleanupExpiredRejections()     // Auto-cleanup after 7 days
```

---

## Problem with Current Model

```
Current:
├─ rejection_tracking = Per email type (dunning_2, sms, etc)
│  └─ Auto-expires 7 days
│  └─ Used: Bounced emails, hard/soft declines
│
├─ Activity shows "Rejected" tab
│  └─ Lists all rejected email types
│  └─ Shows "will auto re-queue in 7 days"
│
└─ MISSING: User-level pause (entire invoice)
   └─ dunning_paused_until exists in schema but not UI
   └─ dunning_stopped exists in schema but not UI
```

**Result:** Can't pause invoice for negotiation (user need).

---

## New Model (Target)

```
New:
├─ rejection_tracking = KEEP (system-level, bounced emails)
│  └─ Hidden from user view
│  └─ Auto-managed by system
│
├─ dunning_paused_until = NEW UI (user-level pause)
│  └─ User clicks [⏸️ Pause Until May 1]
│  └─ Agent skips invoice until date
│  └─ Shows in Activity "Paused" tab
│
├─ dunning_stopped = NEW UI (permanent stop)
│  └─ User clicks [🛑 Stop Dunning]
│  └─ Agent never touches
│  └─ Never auto-resumes
│
└─ Activity tabs:
   ├─ Pending (shadow mode emails)
   ├─ Sent (delivered emails/SMS)
   ├─ Paused (invoices with pause date) ← REPLACES "Rejected"
   └─ Stopped (permanently stopped invoices) ← NEW
```

---

## Step 1: Database (No Changes Needed!)

Fields already exist:
```sql
-- In invoices table:
dunning_paused_until TIMESTAMPTZ     ✅ Already exists
dunning_stopped BOOLEAN               ✅ Already exists

-- Keep rejection_tracking as-is (for system use)
rejection_tracking                    ✅ Keep for bounces
```

**Action:** Zero migration. Fields exist, just activate UI.

---

## Step 2: Backend API Endpoints (NEW)

### Endpoint 1: Pause Invoice

```typescript
// File: backend/src/routes/invoices.ts

PATCH /api/invoices/{id}/dunning-pause

Request:
{
  "pauseUntil": "2026-05-01",
  "reason": "Customer negotiating"
}

Response:
{
  "status": "paused",
  "pauseUntil": "2026-05-01",
  "reason": "Customer negotiating"
}

Code:
export const pauseDunning = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { pauseUntil, reason } = req.body;
  const companyId = (req as any).companyId;

  const result = await pool.query(
    `UPDATE invoices
     SET dunning_paused_until = $1, updated_at = NOW()
     WHERE id = $2 AND company_id = $3
     RETURNING dunning_paused_until, dunning_stopped`,
    [new Date(pauseUntil), id, companyId]
  );

  if (!result.rows[0]) {
    return sendErrorResponse(res, 404, 'Invoice not found');
  }

  // Log to activity
  await logActivity({
    companyId,
    invoiceId: id,
    type: 'pause',
    status: 'paused',
    pauseUntil,
    reason
  });

  res.status(200).json({
    message: 'Dunning paused',
    data: { pauseUntil, reason }
  });
};
```

### Endpoint 2: Stop Dunning

```typescript
PATCH /api/invoices/{id}/dunning-stop

Request:
{
  "reason": "Customer bankruptcy"
}

Response:
{
  "status": "stopped",
  "reason": "Customer bankruptcy"
}

Code:
export const stopDunning = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const companyId = (req as any).companyId;

  const result = await pool.query(
    `UPDATE invoices
     SET dunning_stopped = true, updated_at = NOW()
     WHERE id = $2 AND company_id = $3
     RETURNING dunning_stopped`,
    [id, companyId]
  );

  if (!result.rows[0]) {
    return sendErrorResponse(res, 404, 'Invoice not found');
  }

  await logActivity({
    companyId,
    invoiceId: id,
    type: 'stop',
    status: 'stopped',
    reason
  });

  res.status(200).json({
    message: 'Dunning stopped permanently',
    data: { reason }
  });
};
```

### Endpoint 3: Resume Dunning

```typescript
PATCH /api/invoices/{id}/dunning-resume

Code:
export const resumeDunning = async (req: Request, res: Response) => {
  const { id } = req.params;
  const companyId = (req as any).companyId;

  const result = await pool.query(
    `UPDATE invoices
     SET dunning_paused_until = NULL, updated_at = NOW()
     WHERE id = $1 AND company_id = $2 AND dunning_stopped = false
     RETURNING dunning_paused_until`,
    [id, companyId]
  );

  if (!result.rows[0]) {
    return sendErrorResponse(res, 404, 'Cannot resume stopped dunning');
  }

  await logActivity({
    companyId,
    invoiceId: id,
    type: 'resume',
    status: 'active'
  });

  res.status(200).json({
    message: 'Dunning resumed',
    data: {}
  });
};
```

---

## Step 3: Backend Agent Loop (Update Check)

### Current Agent Logic
```typescript
// agentLoop.ts around line 178-191
if (invoice.dunning_stopped) {
  logInfo(MODULE, 'Dunning stopped — skipping', { invoiceId: invoice.id });
  skippedCount++;
  continue;
}

if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
  logInfo(MODULE, 'Dunning paused — skipping', { 
    invoiceId: invoice.id,
    pausedUntil: invoice.dunning_paused_until,
  });
  skippedCount++;
  continue;
}
```

**Status:** ✅ Already implemented! No changes needed.

---

## Step 4: Backend sendEmailNow (Update Checks)

### Current Code
```typescript
// emailController.ts lines 111-168

// MISSING: Check pause/stop before sending
```

### New Code
```typescript
export const sendEmailNow = async (req: Request, res: Response) => {
  const { invoiceId, emailType } = req.body;
  const companyId = (req as any).companyId;

  const invoice = await findInvoiceById(invoiceId, companyId);

  // ✅ NEW CHECKS
  if (invoice.dunning_stopped) {
    return sendErrorResponse(res, 400, 'Dunning stopped permanently');
  }

  if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
    return sendErrorResponse(res, 400, 
      `Dunning paused until ${invoice.dunning_paused_until}`
    );
  }

  // ... rest of validation (4-day rate limit, rejection block, etc)
  
  // Queue email
};
```

---

## Step 5: Frontend Activity Modal (MAJOR CHANGE)

### Current Activity States
```typescript
state: 'pending' | 'rejected' | 'sent'

// 'rejected' tab shows rejection_tracking
// Shows "Blocked for 7 days" and "Will auto re-queue"
```

### New Activity States
```typescript
state: 'pending' | 'sent' | 'paused' | 'stopped'

// 'pending' = Shadow mode pending approval
// 'sent' = Delivered email/SMS
// 'paused' = Invoice paused for negotiation ← NEW
// 'stopped' = Invoice stopped permanently ← NEW
// 'rejected' = REMOVED (rejection_tracking hidden from user)
```

### Activity Modal Changes

**Remove:**
```typescript
// DELETE: rejected state UI (lines 218-270)
{state === 'rejected' && (
  <p>⚠️ Rejected (Blocked for 7 days)</p>
  ...
)}
```

**Add:**
```typescript
{/* PAUSED STATE */}
{state === 'paused' && (
  <>
    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
        ⏸️ Paused Until {formatDate(item.paused_until)}
      </p>
      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
        Reason: {item.pause_reason || 'No reason provided'}
      </p>
    </div>
    
    <div className="flex gap-2 pt-4">
      <Button variant="primary" onClick={handleResume}>
        ▶️ Resume Now
      </Button>
    </div>
  </>
)}

{/* STOPPED STATE */}
{state === 'stopped' && (
  <>
    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
      <p className="text-sm font-medium text-red-900 dark:text-red-200">
        🛑 Stopped Permanently
      </p>
      <p className="text-xs text-red-700 dark:text-red-300 mt-1">
        Reason: {item.stop_reason || 'No reason provided'}
      </p>
    </div>
    
    <div className="text-xs text-gray-500">
      This invoice can no longer receive dunning communications.
    </div>
  </>
)}
```

---

## Step 6: Frontend Invoice Detail (NEW)

### Add Dunning Controls Section

```typescript
// File: frontend/src/components/invoices/InvoiceDunningControls.tsx (NEW)

interface Props {
  invoice: Invoice;
  onPause: (date: string, reason: string) => Promise<void>;
  onStop: (reason: string) => Promise<void>;
  onResume: () => Promise<void>;
  loading?: boolean;
}

export const InvoiceDunningControls: React.FC<Props> = ({
  invoice,
  onPause,
  onStop,
  onResume,
  loading
}) => {
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseDate, setPauseDate] = useState('');

  if (invoice.dunning_stopped) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 p-4 rounded-lg">
        <p className="text-sm font-semibold text-red-900 dark:text-red-200">
          🛑 Dunning Stopped Permanently
        </p>
        <p className="text-xs text-red-800 dark:text-red-300 mt-1">
          This invoice will not receive any dunning communications.
        </p>
      </div>
    );
  }

  if (invoice.dunning_paused_until && new Date(invoice.dunning_paused_until) > new Date()) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 p-4 rounded-lg">
        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
          ⏸️ Paused Until {formatDate(invoice.dunning_paused_until)}
        </p>
        <button
          onClick={() => onResume()}
          disabled={loading}
          className="mt-3 px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          ▶️ Resume Now
        </button>
      </div>
    );
  }

  // ACTIVE: Show pause/stop buttons
  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowPauseModal(true)}
        disabled={loading}
        className="w-full px-4 py-2 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 text-sm"
      >
        ⏸️ Pause Dunning
      </button>
      
      <button
        onClick={() => onStop('Stopped by user')}
        disabled={loading}
        className="w-full px-4 py-2 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 text-sm"
      >
        🛑 Stop Dunning Permanently
      </button>

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Pause Dunning</h3>
            <input
              type="date"
              value={pauseDate}
              onChange={(e) => setPauseDate(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowPauseModal(false)}
                className="flex-1 px-3 py-2 rounded bg-gray-200 text-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onPause(pauseDate, 'Paused from invoice detail');
                  setShowPauseModal(false);
                }}
                disabled={loading || !pauseDate}
                className="flex-1 px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Pause
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

### Add to InvoiceDetail Page

```typescript
// InvoiceDetail.tsx

return (
  <>
    {/* Existing components */}
    
    {/* NEW: Dunning Controls */}
    <InvoiceDunningControls
      invoice={invoice}
      onPause={handlePauseDunning}
      onStop={handleStopDunning}
      onResume={handleResumeDunning}
      loading={loading}
    />
    
    {/* Rest of page */}
  </>
);
```

---

## Step 7: Activity Endpoint (GET Filter)

### Get Paused Invoices

```typescript
// GET /api/activity/paused?companyId=xxx

export const getPausedInvoices = async (req: Request, res: Response) => {
  const companyId = (req as any).companyId;

  const result = await pool.query(
    `SELECT 
       i.id, i.customer_id, c.company_name, i.amount, 
       i.dunning_paused_until,
       (SELECT reason FROM activity_log 
        WHERE invoice_id = i.id AND type = 'pause' 
        ORDER BY created_at DESC LIMIT 1) AS pause_reason
     FROM invoices i
     JOIN customers c ON i.customer_id = c.id
     WHERE i.company_id = $1 
       AND i.dunning_paused_until IS NOT NULL
       AND i.dunning_paused_until > NOW()
     ORDER BY i.dunning_paused_until ASC`,
    [companyId]
  );

  res.status(200).json({
    data: result.rows,
    total: result.rowCount
  });
};
```

---

## Migration Checklist

### Backend (2-3 hours)
- [ ] Add 3 endpoints: pause, stop, resume (Step 2)
- [ ] Update sendEmailNow to check pause/stop (Step 4)
- [ ] Add pause/stopped to activity_log schema
- [ ] Get paused invoices endpoint (Step 7)
- [ ] Test pause/stop/resume logic

### Frontend (1-2 hours)
- [ ] Create InvoiceDunningControls component (Step 6)
- [ ] Add to InvoiceDetail page
- [ ] Update ActivityModal to show paused/stopped (Step 5)
- [ ] Remove 'rejected' state from ActivityModal
- [ ] Add pause date picker modal
- [ ] Test UI interactions

### Data Migration (1 hour)
- [ ] No schema changes needed (fields exist!)
- [ ] Set all existing rejections to hidden (system-level)
- [ ] No data cleanup required

---

## What Happens to rejection_tracking?

### Current Use
```
rejection_tracking = Per-email-type blocking
├─ Used by: isRecentlyRejected() in agentLoop
├─ Blocks: Specific email types (dunning_2, sms, etc)
├─ Duration: Fixed 7 days, auto-expires
├─ Trigger: System (bounced emails, hard/soft declines)
```

### After Migration
```
rejection_tracking = KEEP, but HIDE from users
├─ Still used by: agentLoop and sendEmailNow
├─ Still blocks: Per-email-type (system-level)
├─ Still 7 days auto-expire
├─ Still system-triggered (bounces)
│
└─ User doesn't see it
   └─ Only show pause/stop (user-level)
```

**Action:** Keep table, just hide from Activity tab UI.

---

## Summary: What Changes

| Component | Current | New | Time |
|-----------|---------|-----|------|
| **Schema** | Has pause/stop fields | ✅ No change | 0 min |
| **Agent Loop** | Checks pause/stop | ✅ Already done | 0 min |
| **API Endpoints** | Only manual send | Add pause/stop/resume | 30 min |
| **sendEmailNow** | No pause/stop check | Add checks | 10 min |
| **Activity Modal** | Shows 'rejected' tab | Show 'paused'/'stopped' | 20 min |
| **Invoice Detail** | No controls | Add pause/stop buttons | 30 min |
| **Activity Endpoint** | None for paused | Add getPausedInvoices | 10 min |

**Total: ~3 hours implementation**

---

## Rejection Tracking: Before & After

### BEFORE (Current)
```
Activity Tab: "Rejected"
├─ Shows all per-email-type rejections
├─ "dunning_2 rejected, will re-queue in 7 days"
├─ User sees technical details
└─ Confusing (looks like user control)

Problem: Doesn't show user-level pause options
```

### AFTER (New)
```
Activity Tabs:
├─ "Pending" → Shadow mode waiting approval
├─ "Sent" → Delivered emails/SMS  
├─ "Paused" → User paused invoices ← REPLACES "Rejected"
└─ "Stopped" → Permanently stopped ← NEW

rejection_tracking:
├─ Still exists (system use)
├─ Still blocks bounced emails
├─ But hidden from user view
└─ Auto-expires 7 days

Result: Clean UX, user controls pause/stop
```

---

## Final Notes

✅ **Easy migration** because:
- Fields already in schema
- Agent loop already checks them
- Just adding UI + API endpoints

✅ **No data loss**
- rejection_tracking remains (system use)
- No deletion, no migration scripts needed

✅ **Clean UX**
- User sees: pause (temporary), stop (permanent)
- User doesn't see: per-email-type technical rejections

✅ **Respects industry standards**
- NetSuite model (pause per invoice)
- ChargeBee model (pause + stop)