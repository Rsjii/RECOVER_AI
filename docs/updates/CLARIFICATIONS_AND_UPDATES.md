# RecoverAI - Critical Clarifications & Updates

**Updated:** 2026-03-04
**Status:** Ready for Final Approval

---

## 1️⃣ COMPANIES VS CUSTOMERS TABLE - COMPLETE EXPLANATION

### Database Relationship (Fixed Structure)

```sql
-- COMPANIES TABLE (your SaaS customers who use RecoverAI)
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  name VARCHAR,                    -- "Acme Corp" (the founder's company)
  email VARCHAR UNIQUE,            -- "billing@acmecorp.com" (founder's email)
  owner_id UUID,                   -- References users.id (founder who owns this)
  stripe_api_key_encrypted TEXT,   -- Their Stripe account (encrypted)
  quickbooks_realm_id VARCHAR,     -- Their QB account
  created_at TIMESTAMPTZ
);

-- CUSTOMERS TABLE (their SaaS customers who owe them money)
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),  -- Foreign key to companies
  name VARCHAR,                    -- "TechStartup Inc"
  email VARCHAR,                   -- "finance@techstartup.com"
  company_name VARCHAR,            -- Their company name
  payment_history JSONB,           -- How they pay (on time, late, etc.)
  industry VARCHAR,                -- "SaaS", "E-commerce", etc.
  created_at TIMESTAMPTZ
);
```

### Real Example to Understand:

```
┌─────────────────────────────────────────────────────────────┐
│  RECOVERAI (Your Company) - Hosting this app                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  COMPANY #1: "Acme Corp" (Founded by John Smith)            │
│  - Founder email: john@acmecorp.com                         │
│  - Stripe API Key: sk_test_xxxxx (Acme's Stripe account)    │
│  - QB Realm ID: xxxxx (Acme's QuickBooks)                   │
│                                                              │
│  This COMPANY has CUSTOMERS who owe them money:             │
│  ├─ CUSTOMER A: "TechStartup Inc"                           │
│  │  └─ Invoice #1: $5,000 (30 days overdue)                 │
│  │  └─ Invoice #2: $3,000 (10 days overdue)                 │
│  │                                                           │
│  ├─ CUSTOMER B: "SaaS Unicorn"                              │
│  │  └─ Invoice #1: $12,000 (60 days overdue)                │
│  │  └─ Invoice #2: $8,000 (paid)                            │
│  │                                                           │
│  └─ CUSTOMER C: "Bootstrap Startup"                         │
│     └─ Invoice #1: $2,000 (5 days overdue)                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  COMPANY #2: "SaaSify Platform" (Founded by Jane Doe)       │
│  - Founder email: jane@saasify.com                          │
│  - Stripe API Key: sk_test_yyyyy (Saasify's Stripe account) │
│  - QB Realm ID: yyyyy (Saasify's QuickBooks)                │
│                                                              │
│  This COMPANY has CUSTOMERS who owe them money:             │
│  ├─ CUSTOMER A: "Enterprise Corp"                           │
│  │  └─ Invoice #1: $50,000 (90 days overdue)                │
│  │                                                           │
│  └─ CUSTOMER B: "Mid-Market Inc"                            │
│     └─ Invoice #1: $25,000 (45 days overdue)                │
└─────────────────────────────────────────────────────────────┘
```

### Why This Structure?

```
RecoverAI needs to:
1. Manage MULTIPLE companies (each founder signs up separately)
2. For EACH company, manage their unpaid invoices
3. For EACH invoice, know who the CUSTOMER is (who owes money)
4. For EACH customer, track their payment history

Companies table = "Who uses RecoverAI?"
Customers table = "Who owes money TO the company using RecoverAI?"
Invoices table = "What money is owed? By whom? How much?"
```

### Data Isolation (Important!)

```typescript
// When John (Acme Corp) logs in, ONLY show his data:
GET /api/invoices
  WHERE company_id = john.company_id  // Only Acme's invoices

// When Jane (Saasify) logs in, ONLY show her data:
GET /api/invoices
  WHERE company_id = jane.company_id  // Only Saasify's invoices

// This prevents data leakage: John shouldn't see Jane's customer data
```

---

## 2️⃣ THEME CHANGE: WHITE/LIGHT MODERN THEME (NEW)

### ❌ WHAT WE'RE REPLACING (Dark Theme)
```
OLD - Very Dark (looked like DevTools)
Background: #060910 (too dark, depressing)
Cards: #0d1424 (very dark)
Text: #e0e7ff (hard to read in some contexts)
```

### ✅ NEW - Modern Light Theme (SaaS Standard 2026)

```typescript
// tailwind.config.ts - UPDATED

export default {
  theme: {
    extend: {
      colors: {
        // Neutral palette (white-based)
        neutral: {
          50: '#fafafa',    // Background
          100: '#f5f5f5',   // Light backgrounds
          200: '#eeeeee',   // Hover states
          300: '#e0e0e0',   // Borders
          400: '#bdbdbd',   // Disabled
          500: '#9e9e9e',   // Secondary text
          600: '#757575',   // Secondary text darker
          700: '#616161',   // Primary text
          800: '#424242',   // Strong text
          900: '#212121',   // Headings
        },

        // Brand - Blue (Modern SaaS style)
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',    // Primary brand (vibrant blue)
          600: '#2563eb',    // Hover
          700: '#1d4ed8',    // Active
          800: '#1e40af',
          900: '#1e3a8a',
        },

        // Background
        surface: {
          DEFAULT: '#ffffff',           // Main background
          card: '#f9fafb',              // Card background (light gray)
          hover: '#f3f4f6',             // Hover states
          border: '#e5e7eb',            // Border color
          'border-focus': '#d1d5db',    // Focus border
        },

        // Risk Levels (High Contrast)
        risk: {
          critical: '#dc2626',  // Red-600 (90-100) - URGENT
          high: '#ea580c',      // Orange-600 (60-89) - HIGH
          medium: '#ca8a04',    // Amber-600 (30-59) - MEDIUM
          low: '#16a34a',       // Green-600 (0-29) - LOW
        },

        // Semantic colors
        success: '#10b981',   // Green
        warning: '#f59e0b',   // Amber
        error: '#ef4444',     // Red
        info: '#3b82f6',      // Blue
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },

      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        'gradient-light': 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
      },
    },
  },
};
```

### Visual Comparison

```
DARK THEME (OLD - REJECTED)
┌─────────────────────────────┐
│ #060910 (very dark bg)      │
│ ┌───────────────────────────┐
│ │ #0d1424 (dark card)       │
│ │ Text: #e0e7ff (light)     │
│ │                           │
│ │ 🔴 Risk: #ef4444          │
│ │ 🟠 Risk: #f97316          │
│ └───────────────────────────┘
│ Problem: Looks like IDE/DevTools, not modern SaaS
│ Problem: Can cause eye strain
└─────────────────────────────┘

LIGHT THEME (NEW - MODERN 2026)
┌─────────────────────────────┐
│ #ffffff (clean white bg)    │
│ ┌───────────────────────────┐
│ │ #f9fafb (light gray card) │
│ │ Text: #212121 (dark)      │
│ │                           │
│ │ 🔴 Risk: #dc2626 (red)    │
│ │ 🟠 Risk: #ea580c (orange) │
│ └───────────────────────────┘
│ Pro: Professional SaaS look (like Stripe, Slack dashboards)
│ Pro: Better readability
│ Pro: Looks modern in 2026
└─────────────────────────────┘
```

### ✨ DUAL THEME SUPPORT (Light + Dark Toggle)

```typescript
// contexts/ThemeContext.tsx
export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light'); // Default: light

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={theme === 'dark' ? 'dark' : ''}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

// components/ui/ThemeToggle.tsx
export function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);

  return (
    <button
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

### Tailwind Dark Mode Config

```typescript
// tailwind.config.ts
export default {
  darkMode: 'class', // Toggle dark mode via .dark class

  theme: {
    extend: {
      colors: {
        neutral: { /* light colors */ },
        // Tailwind automatically inverts for dark mode
      },
    },
  },
};
```

### Color Usage in Components

```tsx
// Example component (works in both light + dark)
<div className="bg-surface-DEFAULT dark:bg-neutral-900">
  <h2 className="text-neutral-900 dark:text-white">Invoices</h2>

  <div className="bg-surface-card dark:bg-neutral-800 border border-surface-border dark:border-neutral-700">
    <table>
      <tr>
        <td>Customer</td>
        <td>Amount</td>
        <td>Risk Score</td>
      </tr>
      <tr>
        <td>Acme Corp</td>
        <td>$5,000</td>
        <td>
          {/* Risk badge - color-coded */}
          <span className={
            risk_score > 80 ? 'bg-risk-critical text-white' :
            risk_score > 60 ? 'bg-risk-high text-white' :
            risk_score > 30 ? 'bg-risk-medium text-white' :
            'bg-risk-low text-white'
          }>
            {risk_score}
          </span>
        </td>
      </tr>
    </table>
  </div>
</div>
```

---

## 3️⃣ PREDEFINED FRONTEND COMPONENTS (Toast, Modal, Popups)

### Architecture: Centralized Notification System

```typescript
// contexts/NotificationContext.tsx
export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number; // Auto-dismiss after ms (default 5000)
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const NotificationContext = createContext<{
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
} | null>(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);

    // Auto-dismiss
    if (notification.duration !== 0) {
      setTimeout(() => removeNotification(id), notification.duration || 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}
```

### Toast Component (Auto-dismissing)

```tsx
// components/ui/Toast.tsx
export function Toast({ notification, onClose }: Props) {
  const bgColor = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
  };

  const iconColor = {
    success: 'text-green-600',
    error: 'text-red-600',
    warning: 'text-amber-600',
    info: 'text-blue-600',
  };

  return (
    <div className={`border rounded-lg p-4 ${bgColor[notification.type]}`}>
      <div className="flex gap-3">
        <span className={`text-xl ${iconColor[notification.type]}`}>
          {notification.type === 'success' && '✓'}
          {notification.type === 'error' && '✕'}
          {notification.type === 'warning' && '⚠'}
          {notification.type === 'info' && 'ℹ'}
        </span>
        <div className="flex-1">
          <h4 className="font-semibold text-neutral-900">{notification.title}</h4>
          <p className="text-sm text-neutral-600">{notification.message}</p>
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
          ✕
        </button>
      </div>
    </div>
  );
}

// Notification Container (renders all toasts)
export function NotificationContainer() {
  const { notifications, removeNotification } = useContext(NotificationContext);

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-md">
      {notifications.map(notification => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}
```

### Modal Component (Reusable)

```tsx
// components/ui/Modal.tsx
export function Modal({ isOpen, title, children, onClose, actions }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="border-b border-neutral-200 p-6 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {actions && (
          <div className="border-t border-neutral-200 p-6 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-300 hover:bg-neutral-50"
            >
              Cancel
            </button>
            {actions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className={`px-4 py-2 rounded-lg text-white font-medium ${
                  action.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Dropdown / Popover Component

```tsx
// components/ui/Popover.tsx
export function Popover({ trigger, children, position = 'bottom-right' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </button>

      {isOpen && (
        <div className={`absolute ${position} mt-2 bg-white border border-neutral-200 rounded-lg shadow-lg z-40`}>
          {children}
        </div>
      )}
    </div>
  );
}
```

### Usage Examples

```tsx
// In any component:
import { useNotification } from '@/hooks/useNotification';

export function InvoiceList() {
  const { addNotification } = useNotification();

  const handleSync = async () => {
    try {
      await syncInvoices();
      addNotification({
        type: 'success',
        title: 'Success!',
        message: 'Synced 50 invoices',
        duration: 5000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to sync invoices. Try again.',
        duration: 0, // Don't auto-dismiss
        action: {
          label: 'Retry',
          onClick: handleSync,
        },
      });
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>Add Invoice</button>

      <Modal
        isOpen={isModalOpen}
        title="Add Manual Invoice"
        onClose={() => setIsModalOpen(false)}
        actions={[
          { label: 'Create', variant: 'primary', onClick: handleCreate },
        ]}
      >
        <InvoiceForm />
      </Modal>
    </>
  );
}
```

---

## 4️⃣ TIMEZONE HANDLING (Complete Strategy)

### Storage Strategy: Always Store UTC

```typescript
// RULE: Store ALL timestamps in UTC in database
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  due_date TIMESTAMPTZ,      // Always UTC in DB
  created_at TIMESTAMPTZ,    // Always UTC in DB
  updated_at TIMESTAMPTZ,    // Always UTC in DB
  company_id UUID REFERENCES companies(id)
);

// Companies table stores timezone preference
CREATE TABLE companies (
  id UUID PRIMARY KEY,
  timezone VARCHAR DEFAULT 'UTC',  // "America/New_York", "Europe/London", etc.
  // ... other fields
);
```

### Backend: Utility Functions

```typescript
// lib/timezone.ts
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';
import { format, parse } from 'date-fns';

/**
 * Convert UTC datetime to company's timezone
 */
export function convertUTCToCompanyTime(
  utcDate: Date,
  timezone: string
): Date {
  return utcToZonedTime(utcDate, timezone);
}

/**
 * Convert company's local time to UTC
 */
export function convertCompanyTimeToUTC(
  localDate: Date,
  timezone: string
): Date {
  return zonedTimeToUtc(localDate, timezone);
}

/**
 * Format date for display in company's timezone
 */
export function formatDateInTimezone(
  utcDate: Date,
  timezone: string,
  format_str: string = 'MMM dd, yyyy hh:mm a zzz'
): string {
  const zonedDate = convertUTCToCompanyTime(utcDate, timezone);
  return format(zonedDate, format_str);
}

/**
 * Parse date string in company's timezone and convert to UTC
 */
export function parseAndConvertToUTC(
  dateString: string,
  timezone: string,
  format_str: string = 'MMM dd, yyyy hh:mm a'
): Date {
  const localDate = parse(dateString, format_str, new Date());
  return convertCompanyTimeToUTC(localDate, timezone);
}
```

### API Response: Always Include Timezone Info

```typescript
// Backend - GET /api/invoices
{
  "data": [
    {
      "id": "inv-001",
      "amount": 5000,
      "due_date": "2026-03-15T23:59:59Z",  // UTC
      "created_at": "2026-03-04T10:30:00Z", // UTC
      "company_timezone": "America/New_York"
    }
  ],
  "company_timezone": "America/New_York"
}
```

### Frontend: Display in Company's Timezone

```tsx
// hooks/useDateFormatter.ts
import { useAuth } from './useAuth';

export function useDateFormatter() {
  const { company } = useAuth();

  return {
    formatDueDate: (utcDate: string) => {
      return formatDateInTimezone(
        new Date(utcDate),
        company.timezone,
        'MMM dd, yyyy'
      );
    },

    formatDateTime: (utcDate: string) => {
      return formatDateInTimezone(
        new Date(utcDate),
        company.timezone,
        'MMM dd, yyyy hh:mm a'
      );
    },
  };
}

// components/InvoiceRow.tsx
export function InvoiceRow({ invoice }) {
  const { formatDueDate, formatDateTime } = useDateFormatter();

  return (
    <tr>
      <td>{invoice.customer}</td>
      <td>{invoice.amount}</td>
      <td className="text-sm text-neutral-600">
        {formatDueDate(invoice.due_date)} {/* Shows in company's timezone */}
      </td>
    </tr>
  );
}
```

### Company Settings: Timezone Selection

```tsx
// pages/Settings.tsx
export function Settings() {
  const { company, updateCompany } = useAuth();

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Singapore',
    'Australia/Sydney',
    // ... full list
  ];

  return (
    <div>
      <label>Company Timezone</label>
      <select
        value={company.timezone}
        onChange={(e) => updateCompany({ timezone: e.target.value })}
      >
        {timezones.map(tz => (
          <option key={tz} value={tz}>{tz}</option>
        ))}
      </select>
    </div>
  );
}
```

### Email Scheduling: Smart Timing

```typescript
// services/emailAgentService.ts
async function shouldSendEmail(
  invoice: Invoice,
  customer: Customer,
  timezone: string
): Promise<boolean> {
  // Get current time in customer's timezone (if available)
  // Otherwise use company's timezone
  const currentTimeInTz = convertUTCToCompanyTime(new Date(), timezone);
  const hour = currentTimeInTz.getHours();

  // Don't send emails outside business hours (9 AM - 6 PM)
  if (hour < 9 || hour > 18) {
    // Queue for next morning at 9 AM in their timezone
    const nextMorning = new Date(currentTimeInTz);
    nextMorning.setHours(9, 0, 0, 0);
    nextMorning.setDate(nextMorning.getDate() + 1);

    // Convert back to UTC for Bull job
    const nextMorningUTC = convertCompanyTimeToUTC(nextMorning, timezone);

    await emailQueue.add(
      { invoiceId: invoice.id },
      { delay: nextMorningUTC.getTime() - Date.now() }
    );
    return false;
  }

  return true;
}
```

---

## 5️⃣ RATE LIMITS + API COSTS (Financial Impact)

### Rate Limiting Strategy (Protection)

```typescript
// middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// Limiter 1: Authentication (very strict)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 min
  message: 'Too many login attempts, try again in 15 minutes',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req) => req.body.email, // Limit per email
});

// Limiter 2: General API (moderate)
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests, please slow down',
  skip: (req) => req.user?.role === 'admin', // Admins not limited
});

// Limiter 3: Integration webhooks (generous)
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // High limit for webhooks
});

// Limiter 4: Search/Heavy queries (strict)
export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 searches per minute
});

// Usage in routes:
app.post('/api/auth/login', authLimiter, loginHandler);
app.get('/api/invoices', apiLimiter, getInvoicesHandler);
app.post('/webhooks/stripe', webhookLimiter, stripeWebhookHandler);
```

### Return Rate Limit Info in Response Headers

```typescript
// Clients can see remaining requests:
// X-RateLimit-Limit: 100
// X-RateLimit-Remaining: 95
// X-RateLimit-Reset: 1678899300

// Client-side: Check before making request
function canMakeRequest() {
  const remaining = parseInt(
    document.headers['X-RateLimit-Remaining'] || '1'
  );
  return remaining > 0;
}
```

### API Cost Calculation (Monthly Budget)

```
COST BREAKDOWN FOR 10 CUSTOMERS:

1. CLAUDE API (Email generation + Risk scoring)
   ├─ Risk scoring: 1000 invoices × 2 calls/month = 2000 calls
   │   @ $0.003/1K input tokens × 500 tokens avg = $3/month
   │
   ├─ Email generation: 5000 emails/month
   │   @ $0.003/1K tokens × 300 tokens avg = $4.50/month
   │
   ├─ Payment plan terms: 500 offers/month
   │   @ $0.003/1K tokens × 200 tokens avg = $0.30/month
   │
   └─ SUBTOTAL: ~$8/month ✅ (very cheap)

2. STRIPE API (Invoicing + Payment Plans)
   ├─ Invoice sync: FREE (Stripe API)
   ├─ Payment webhook: FREE
   ├─ Payment processing: 2.9% + $0.30 per transaction
   │   Example: $50k recovered × 2.9% + 30 txns × $0.30
   │   = $1,450 + $9 = $1,459/month
   │
   └─ SUBTOTAL: ~$1,450/month (pay from recovery)

3. SENDGRID API (Email sending)
   ├─ Free tier: 100 emails/day (300/month)
   ├─ Paid: $9.95 (24k emails/month)
   │   For 5000 emails/month → need paid plan
   │
   └─ SUBTOTAL: $10/month ✅

4. INFRASTRUCTURE (Railway/Render)
   ├─ Backend: $50-100/month
   ├─ PostgreSQL: $15-30/month
   ├─ Redis: $10-20/month
   │
   └─ SUBTOTAL: $75-150/month

5. DOMAIN + SSL
   ├─ Domain (Route 53): $12/year = $1/month
   ├─ SSL (Let's Encrypt): FREE
   │
   └─ SUBTOTAL: $1/month ✅

TOTAL MONTHLY COST (Excluding Stripe processing):
└─ $8 (Claude) + $10 (SendGrid) + $100 (Infrastructure) + $1 (Domain)
   = ~$120/month

TOTAL WITH STRIPE (assume $50k recovery):
└─ $120 + $1,450 (Stripe) = $1,570/month
└─ Revenue from this customer: $2.5k + 1% of $50k = $3k
└─ PROFIT: $3k - $1.57k = $1.43k ✅ (48% margin)

SCALING TO 20 CUSTOMERS:
├─ Claude: $16/month (scales ~2x)
├─ SendGrid: $25/month (increases with volume)
├─ Infrastructure: $200/month (more app servers)
├─ Stripe: ~$3k/month (assume $100k recovery)
│
└─ TOTAL: ~$3,240/month
└─ Revenue: 20 customers × $3k avg = $60k
└─ PROFIT: $60k - $3.24k = $56.76k ✅ (95% margin)
```

### Cost Tracking in Backend

```typescript
// services/costTrackingService.ts
CREATE TABLE api_usage_tracking (
  id UUID PRIMARY KEY,
  company_id UUID REFERENCES companies(id),
  service VARCHAR,  -- 'claude', 'stripe', 'sendgrid', 'infrastructure'
  usage_count INT,
  cost_usd DECIMAL(10, 4),
  period DATE,  -- YYYY-MM
  created_at TIMESTAMPTZ
);

export async function trackAPICost(
  company_id: string,
  service: 'claude' | 'stripe' | 'sendgrid',
  usage: number,
  costUSD: number
) {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM

  await db.query(
    `INSERT INTO api_usage_tracking
     (company_id, service, usage_count, cost_usd, period)
     VALUES ($1, $2, $3, $4, $5)`,
    [company_id, service, usage, costUSD, period]
  );
}

// Dashboard endpoint for cost visibility
app.get('/api/admin/costs', async (req, res) => {
  const costs = await db.query(
    `SELECT
      service,
      SUM(usage_count) as total_usage,
      SUM(cost_usd) as total_cost,
      period
    FROM api_usage_tracking
    WHERE company_id = $1
    GROUP BY service, period
    ORDER BY period DESC`,
    [req.user.company_id]
  );

  res.json(costs);
});
```

---

## 6️⃣ MULTI-CURRENCY SUPPORT

### Database Schema (Multi-Currency)

```sql
-- Invoices with currency field
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  amount DECIMAL(12, 2),
  currency VARCHAR(3) DEFAULT 'USD',  -- "USD", "EUR", "GBP", etc.
  created_at TIMESTAMPTZ
);

-- Exchange rates (update daily)
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY,
  from_currency VARCHAR(3),
  to_currency VARCHAR(3),
  rate DECIMAL(10, 6),
  updated_at TIMESTAMPTZ,
  UNIQUE(from_currency, to_currency)
);
```

### Currency Conversion Service

```typescript
// services/currencyService.ts
import axios from 'axios';

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  updatedAt: Date;
}

export class CurrencyService {
  private cache: Map<string, ExchangeRate> = new Map();

  // Fetch live rates from API (or cache)
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const cacheKey = `${fromCurrency}_${toCurrency}`;

    // Check if in cache and not stale (> 24h)
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.updatedAt.getTime() < 24 * 60 * 60 * 1000) {
      return cached.rate;
    }

    // Fetch from API (example: exchangerate-api.com)
    const response = await axios.get(
      `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
    );

    const rate = response.data.rates[toCurrency];

    // Cache it
    this.cache.set(cacheKey, {
      from: fromCurrency,
      to: toCurrency,
      rate,
      updatedAt: new Date(),
    });

    return rate;
  }

  // Convert amount from one currency to another
  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string
  ): Promise<number> {
    const rate = await this.getExchangeRate(fromCurrency, toCurrency);
    return amount * rate;
  }

  // Format amount with currency symbol
  formatCurrency(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    });
    return formatter.format(amount);
  }
}
```

### Usage in API Endpoints

```typescript
// GET /api/invoices (with currency conversion)
app.get('/api/invoices', async (req, res) => {
  const invoices = await db.query(
    'SELECT * FROM invoices WHERE company_id = $1',
    [req.user.company_id]
  );

  // Get company's base currency (preference)
  const company = await db.query(
    'SELECT preferred_currency FROM companies WHERE id = $1',
    [req.user.company_id]
  );

  const baseCurrency = company.rows[0]?.preferred_currency || 'USD';
  const currencyService = new CurrencyService();

  // Convert all amounts to company's base currency
  const convertedInvoices = await Promise.all(
    invoices.rows.map(async (invoice) => ({
      ...invoice,
      amount_in_base_currency: await currencyService.convertAmount(
        invoice.amount,
        invoice.currency,
        baseCurrency
      ),
      amount_display: `${invoice.currency} ${invoice.amount}`,
    }))
  );

  // Also return totals in base currency
  const totalAR = convertedInvoices.reduce(
    (sum, inv) => sum + inv.amount_in_base_currency,
    0
  );

  res.json({
    invoices: convertedInvoices,
    summary: {
      total_ar: totalAR,
      base_currency: baseCurrency,
      exchange_rates: await currencyService.getAllRates(),
    },
  });
});
```

### Frontend: Multi-Currency Display

```tsx
// hooks/useCurrency.ts
export function useCurrency() {
  const { company } = useAuth();
  const [rates, setRates] = useState({});

  useEffect(() => {
    // Load exchange rates from API
    fetch('/api/exchange-rates').then(r => r.json()).then(setRates);
  }, []);

  return {
    baseCurrency: company.preferred_currency || 'USD',
    formatCurrency: (amount: number, currency: string) => {
      if (currency === company.preferred_currency) {
        return `${currency} ${amount.toFixed(2)}`;
      }
      const rate = rates[`${currency}_${company.preferred_currency}`] || 1;
      return `${company.preferred_currency} ${(amount * rate).toFixed(2)}`;
    },
  };
}

// components/InvoiceRow.tsx
export function InvoiceRow({ invoice }) {
  const { formatCurrency } = useCurrency();

  return (
    <tr>
      <td>{invoice.customer}</td>
      <td className="text-right">
        {formatCurrency(invoice.amount, invoice.currency)}
      </td>
    </tr>
  );
}
```

### Company Settings: Currency Preference

```tsx
// pages/Settings.tsx
export function Settings() {
  const { company, updateCompany } = useAuth();

  const currencies = [
    { code: 'USD', name: 'US Dollar ($)' },
    { code: 'EUR', name: 'Euro (€)' },
    { code: 'GBP', name: 'British Pound (£)' },
    { code: 'INR', name: 'Indian Rupee (₹)' },
    { code: 'AUD', name: 'Australian Dollar (A$)' },
    // ... more currencies
  ];

  return (
    <div>
      <label>Preferred Currency (for reports & dashboard)</label>
      <select
        value={company.preferred_currency || 'USD'}
        onChange={(e) => updateCompany({ preferred_currency: e.target.value })}
      >
        {currencies.map(c => (
          <option key={c.code} value={c.code}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
```

---

## 7️⃣ STATE PERSISTENCE & OAUTH STRATEGY

### Auth Flow: OAuth + Session Tokens

```typescript
// Strategy: OAuth for login, JWT for session

// Step 1: User clicks "Login with Google"
// Step 2: Google OAuth callback → Get user info
// Step 3: Create/update user in DB
// Step 4: Issue JWT token → Store in localStorage
// Step 5: Refresh token (silent) when expired

// services/authService.ts
export class AuthService {
  // OAuth step 1: Redirect to provider
  getOAuthURL(provider: 'google' | 'github'): string {
    const params = new URLSearchParams({
      client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`],
      redirect_uri: `${process.env.FRONTEND_URL}/auth/callback/${provider}`,
      response_type: 'code',
      scope: 'profile email',
      state: generateRandomString(), // CSRF protection
    });
    return `https://${provider}.com/oauth/authorize?${params}`;
  }

  // OAuth step 2: Handle callback
  async handleOAuthCallback(
    provider: string,
    code: string,
    state: string
  ): Promise<{ accessToken: string; refreshToken: string; user: User }> {
    // Verify state (CSRF protection)
    const storedState = sessionStorage.getItem('oauth_state');
    if (state !== storedState) {
      throw new Error('Invalid state parameter');
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      `https://${provider}.com/oauth/token`,
      {
        client_id: process.env[`${provider.toUpperCase()}_CLIENT_ID`],
        client_secret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`],
        code,
        redirect_uri: `${process.env.FRONTEND_URL}/auth/callback/${provider}`,
      }
    );

    const oauthToken = tokenResponse.data.access_token;

    // Get user info
    const userInfo = await axios.get(
      `https://${provider}.com/oauth/userinfo`,
      { headers: { Authorization: `Bearer ${oauthToken}` } }
    );

    // Step 3: Create/update user in our DB
    const response = await axios.post('/api/auth/oauth-callback', {
      provider,
      user_id: userInfo.sub,
      email: userInfo.email,
      name: userInfo.name,
      avatar: userInfo.picture,
    });

    // Step 4: Get JWT token from backend
    return {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      user: response.data.user,
    };
  }
}
```

### Secure Token Storage

```typescript
// NO: Don't use localStorage for sensitive tokens (XSS vulnerable)
// localStorage.setItem('token', jwt); // ❌ BAD

// YES: Use httpOnly cookies (protected from XSS)
// Backend sets: Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict
// Frontend doesn't need to store anything manually ✅ GOOD

// hooks/useAuth.ts - AuthContext
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: Try to restore session
  useEffect(() => {
    (async () => {
      try {
        // Backend returns user if valid httpOnly cookie exists
        const response = await fetch('/api/auth/me', {
          credentials: 'include', // Include cookies
        });
        if (response.ok) {
          setUser(await response.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Login with OAuth
  const login = async (provider: 'google' | 'github') => {
    const url = authService.getOAuthURL(provider);
    window.location.href = url; // Redirect to OAuth
  };

  // Logout
  const logout = async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Backend: JWT + Refresh Token

```typescript
// Backend: Issue JWT (short-lived) + Refresh Token (long-lived)

app.post('/api/auth/oauth-callback', async (req, res) => {
  // ... validate OAuth code ...

  // Create or update user
  let user = await db.query(
    'SELECT * FROM users WHERE github_id = $1',
    [userData.id]
  );

  if (!user.rows.length) {
    user = await db.query(
      'INSERT INTO users (github_id, email, name) VALUES ($1, $2, $3) RETURNING *',
      [userData.id, userData.email, userData.name]
    );
  }

  // Issue tokens
  const accessToken = jwt.sign(
    { user_id: user.rows[0].id, org_id: user.rows[0].org_id },
    process.env.JWT_SECRET,
    { expiresIn: '1h' } // Short-lived
  );

  const refreshToken = jwt.sign(
    { user_id: user.rows[0].id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' } // Long-lived
  );

  // Set httpOnly cookie
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: true, // HTTPS only
    sameSite: 'strict',
    maxAge: 1 * 60 * 60 * 1000, // 1 hour
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({
    user: user.rows[0],
    success: true
  });
});

// Refresh token endpoint
app.post('/api/auth/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  try {
    const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const newAccessToken = jwt.sign(
      { user_id: payload.user_id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 1 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### Frontend: Automatic Token Refresh

```typescript
// lib/axios.ts - Configure axios to refresh on 401
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  withCredentials: true, // Include cookies
});

// Intercept 401 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        // Try to refresh token
        await axios.post('/api/auth/refresh', {}, {
          withCredentials: true,
        });

        // Retry original request
        return api.request(error.config);
      } catch {
        // Refresh failed, redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### State Persistence: Redux Persist (Optional)

```typescript
// If using Redux:
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'preferences'], // Only persist these
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

const store = configureStore({
  reducer: persistedReducer,
});

export const persistor = persistStore(store);
```

---

## 8️⃣ SECURITY COMPLIANCE & MEASURES

### 🔐 OWASP Top 10 Checklist

| # | Vulnerability | Mitigation | Status |
|---|---|---|---|
| 1 | **Broken Authentication** | JWT + OAuth + httpOnly cookies + 2FA ready | ✅ |
| 2 | **Broken Access Control** | Role-based access (admin/reviewer/developer) | ✅ |
| 3 | **Injection** | Parameterized queries (pg client) | ✅ |
| 4 | **Insecure Design** | Secure by design (encryption, least privilege) | ✅ |
| 5 | **Broken Cryptography** | Encrypt sensitive data at rest (api keys) | ✅ |
| 6 | **Exposed Sensitive Data** | PII handling, rate limiting, audit logs | ✅ |
| 7 | **XML External Entities (XXE)** | No XML parsing needed | N/A |
| 8 | **Broken Access Control** | CORS properly configured | ✅ |
| 9 | **Using Components with Known Vulnerabilities** | Keep deps updated (Snyk/Dependabot) | ✅ |
| 10 | **Insufficient Logging** | Comprehensive audit trails | ✅ |

### 🔒 Data Encryption

```typescript
// services/encryptionService.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Must be 32 bytes

export class EncryptionService {
  // Encrypt sensitive data (API keys, tokens)
  static encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  // Decrypt
  static decrypt(ciphertext: string): string {
    const [iv, authTag, encrypted] = ciphertext.split(':');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

// Usage
const encryptedKey = EncryptionService.encrypt(stripeApiKey);
// Store in DB: db.query('UPDATE companies SET stripe_api_key_encrypted = $1', [encryptedKey]);

// Retrieve
const decryptedKey = EncryptionService.decrypt(company.stripe_api_key_encrypted);
```

### 🔑 Secrets Management

```bash
# .env.example (commit to git - NO SECRETS)
ENCRYPTION_KEY=<generate-with-openssl>
JWT_SECRET=<generate-random>
REFRESH_TOKEN_SECRET=<generate-random>
DATABASE_URL=postgresql://user:pass@localhost/db
REDIS_URL=redis://localhost:6379
STRIPE_API_KEY=<ask-during-setup>
SENDGRID_API_KEY=<ask-during-setup>
ANTHROPIC_API_KEY=<ask-during-setup>

# Generate secrets
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY

# Load from environment (never hardcode)
const JWT_SECRET = process.env.JWT_SECRET;
```

### 🛡️ CORS Configuration

```typescript
// Security: Only allow frontend domain
app.use(cors({
  origin: process.env.FRONTEND_URL, // "https://app.recoverai.com"
  credentials: true, // Allow cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours
}));
```

### 🚨 Audit Logging (Compliance)

```sql
-- Track all sensitive operations
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50),  -- 'login', 'invoice_created', 'payment_updated', 'export_data'
  resource_type VARCHAR(50),  -- 'invoice', 'customer', 'settings'
  resource_id VARCHAR(100),
  changes JSONB,  -- What changed (old → new)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_company_time ON audit_logs(company_id, created_at DESC);
```

```typescript
// Log sensitive actions
async function logAuditTrail(
  companyId: string,
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  changes: any,
  req: Request
) {
  await db.query(
    `INSERT INTO audit_logs
     (company_id, user_id, action, resource_type, resource_id, changes, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      companyId,
      userId,
      action,
      resourceType,
      resourceId,
      JSON.stringify(changes),
      req.ip,
      req.get('user-agent'),
    ]
  );
}

// Example usage
app.post('/api/integrations/stripe/connect', async (req, res) => {
  // ... validate ...

  await logAuditTrail(
    req.user.company_id,
    req.user.id,
    'stripe_connected',
    'integration',
    `stripe_${req.user.company_id}`,
    { connected_at: new Date() },
    req
  );

  res.json({ success: true });
});
```

### 🔍 Rate Limiting + DDoS Protection

```typescript
// Already covered in section 5️⃣
// Add Cloudflare or AWS Shield for DDoS at edge
```

### ✅ Compliance Checklist

- [ ] GDPR: Data export, deletion, consent tracking
- [ ] SOC 2: Security controls, audit logs, encryption
- [ ] PCI DSS: Don't store credit cards (use Stripe)
- [ ] CCPA: Privacy policy, data rights
- [ ] HIPAA: If handling health data (not applicable)

```sql
-- GDPR: Right to be forgotten
async function deleteCompanyData(companyId: string) {
  // Delete in order (foreign key constraints)
  await db.query('DELETE FROM email_logs WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [companyId]);
  await db.query('DELETE FROM payments WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [companyId]);
  await db.query('DELETE FROM payment_plans WHERE invoice_id IN (SELECT id FROM invoices WHERE company_id = $1)', [companyId]);
  await db.query('DELETE FROM invoices WHERE company_id = $1', [companyId]);
  await db.query('DELETE FROM customers WHERE company_id = $1', [companyId]);
  await db.query('DELETE FROM companies WHERE id = $1', [companyId]);

  // Log deletion
  await logAuditTrail(companyId, null, 'company_deleted', 'company', companyId, {}, null);
}
```

---

## SUMMARY OF CHANGES

### 1. Companies vs Customers ✅
- **Companies** = Your customers using RecoverAI
- **Customers** = Their customers who owe them money
- Proper data isolation per company

### 2. Theme: Light Modern + Dark Toggle ✅
- Default: White/Light theme (modern SaaS style)
- Optional: Dark mode toggle
- Risk colors: High contrast against both themes

### 3. Predefined Components ✅
- Toast system (NotificationContext)
- Modal reusable component
- Popover/Dropdown component
- All follow modern UI patterns

### 4. Timezone Handling ✅
- Store ALL dates as UTC in DB
- Display in company's timezone
- Smart email timing (business hours only)
- Configurable in settings

### 5. Rate Limits + API Costs ✅
- Rate limiting by endpoint type
- Cost tracking: ~$120/month base (scales linearly)
- Claude API: Very cheap (~$8/month for 10 customers)
- Stripe processing: Pay from recovery

### 6. Multi-Currency ✅
- Store currency with each invoice
- Exchange rates updated daily
- Display in company's preferred currency
- Automatic conversion in dashboards

### 7. State Persistence + OAuth ✅
- OAuth 2.0 for login (Google/GitHub/etc)
- httpOnly cookies for tokens (XSS protection)
- Auto-refresh on 401
- Redux persist (optional)

### 8. Security & Compliance ✅
- OWASP Top 10 checklist ✅
- Encryption at rest (AES-256-GCM)
- Audit logging for compliance
- GDPR right to be forgotten
- Rate limiting + DDoS ready

---

## NEXT: Update IMPLEMENTATION_PLAN.md

I'll now update the main implementation plan with all these 8 clarifications integrated. The changes affect:

1. Database schema (companies/customers explanation)
2. Frontend component architecture (theme toggle, predefined components)
3. Backend services (timezone, currency, encryption)
4. Configuration (environment variables, costs)
5. Deployment (security hardening)

**Ready to proceed with updated plan?**
