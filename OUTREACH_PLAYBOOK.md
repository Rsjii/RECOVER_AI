# RecoverAI — Outreach Playbook
**Based on 2,004 companies in `z_companies/number_3_final/companies_clean.csv`**
Last updated: 2026-03-19

---

## YOUR LEAD ASSET (DO NOT SKIP THIS SECTION)

| Metric | Count |
|--------|-------|
| Total companies | 2,004 |
| Has contact email | 1,459 |
| Has phone number | 747 |
| US-based | 1,682 |
| US + has email | 1,201 |
| **Best targets (US + Seed/Series A + 11-50 + email + High heat)** | **425** |

**You have 425 pre-qualified, high-heat US SaaS companies ready to email today. No LinkedIn Navigator. No list-building. Start outreach immediately.**

---

## STEP 1: FILTER TO TOP 100 (2 hours, Day 1)

Open `z_companies/number_3_final/companies_clean.csv` in Excel or Google Sheets.

Apply these filters in this order:

| Column | Filter | Why |
|--------|--------|-----|
| Headquarters Location | contains "United States" | TCPA + Stripe usage highest |
| Stage | = "Seed" OR "Series A" | Founder decides in 1 day |
| Number of Employees | = "11-50" | Has AR problem, no collections team |
| Contact Email | is not empty, not "—" | Ready to send now |
| Heat Score Tier | = "High" first, then "Medium" | Prioritize warmest leads |

**Sort by:** Heat Score (High → Medium → Low), then Growth Score (High → Low)

**Take top 100 rows → save as `z_companies/outreach_batch_1.csv`**

Expected: ~425 pass all filters → take top 100 by heat/growth score.

### Email address quality filter (CRITICAL)
Before sending, filter out bad email prefixes that won't reach founders:

**SEND TO:**
- `hello@` — usually founders/team
- `founders@` — directly founders
- `contact@` — often founders at early stage
- `team@` — usually founders
- `info@` — acceptable
- `hi@` — acceptable
- `name@company.com` (personal founder email from Hunter.io)

**SKIP (wrong person):**
- `support@` — customer support team
- `careers@` — HR
- `sales@` — AE team, not founder
- `marketing@` — wrong person
- `press@` / `media@` — PR team

---

## STEP 2: GET PERSONAL FOUNDER EMAILS WITH HUNTER.IO (Day 1–2)

The CSV has company emails (hello@, contact@) — NOT personal founder emails.
Personal emails get **3–5x higher reply rates** (8–12% vs 2–4%).

### Setup (30 min)
1. Buy Hunter.io Starter plan: **$49/month** → 500 searches
2. Go to hunter.io → Domain Search
3. For each company in your top 100: enter their domain, find `{firstname}@domain.com` format

### Process
The CSV has a `Founders` column with full names. Use it:

1. For company `Lyzr` → founders: `Anirudh Narayan, Jithin George, Siva S` → website: `lyzr.ai`
2. In Hunter.io: search `lyzr.ai` → find `anirudh@lyzr.ai` or `jithin@lyzr.ai`
3. Add to your outreach sheet with confidence score

### Parallel approach (Week 1)
- **Day 1:** Send Email 1 to top 30 `hello@`/`contact@`/`founders@` addresses — immediate start
- **Day 2:** Run top 50 through Hunter.io → send personal version to those found
- **Result:** 50–80 total sends by end of Week 1

### Top industries in your list (focus Hunter searches here)
1. Software / SaaS (282 companies) — best fit, uses Stripe
2. AI / ML (225 companies) — tech-savvy, will adopt quickly
3. FinTech (65 companies) — highest AR pain, understands collections
4. Cyber Security (29 companies) — B2B, invoice-heavy

---

## STEP 3: YOUR 3-EMAIL SEQUENCE

### Email 1 — Send Monday 9AM (or Tuesday–Thursday morning)

**For company emails (hello@, contact@):**
```
Subject: [Company], how much MRR sits unpaid right now?

Hi [Company] team,

Quick question: what % of your MRR sits in unpaid customer invoices?

For most B2B SaaS at your stage, it's 5-10% of revenue — real money sitting there uncollected.

Built RecoverAI — AI-powered dunning that recovers unpaid invoices automatically. Works with Stripe (30-min setup). Most companies recover $5-10k in their first month.

Worth 15 minutes to see if it fits?
[Calendly link]

— Rudraksh
P.S. First month completely free to test with your actual invoices.
```

**For personal founder emails (from Hunter.io):**
```
Subject: [First name], $X sitting unpaid?

Hi [First name],

Quick question: right now, how much revenue sits unpaid in customer invoices at [Company]?

For most B2B SaaS at your stage (Series A, 11-50 people), it's 5-10% of MRR. That's literally money you've already earned.

Built RecoverAI — AI dunning that automates collections end-to-end. Stripe integration, 30-min setup. Most founders recover $5-10k first month.

Worth 15 mins?
[Calendly link]

— Rudraksh (ex-Zupee, JEE 99.8%)
P.S. First month free — you keep the recovered cash, I take nothing.
```

---

### Email 2 — Send Day 5–7 (no reply to Email 1)

```
Subject: One more thing about [Company]'s AR

Hi [Name / team],

Didn't hear back — inbox chaos, totally understand.

Quick reality check: most founders lose $10-20k/year to unpaid invoices just sitting there. It's not a priority until it becomes one.

If AR is relevant right now, let's talk.
If not, no worries — I'll stop emailing.

[Calendly link]
— Rudraksh
```

---

### Email 3 — Day 14 (final)

```
Subject: Last attempt, [First name / Company]

[Name / team],

Last email from me (promise).

Most SaaS at your stage don't think AR is a problem until they actually look at the numbers.

5 minutes to look at your numbers with me?

[Calendly link]
— Rudraksh
```

---

## STEP 4: TRACKING SPREADSHEET

Create a Google Sheet with these columns:

| Column | What to track |
|--------|---------------|
| Organization Name | From CSV |
| Contact Email | The actual email you're sending to |
| Founder Name | From Founders column or Hunter.io |
| Stage | From CSV |
| Employees | From CSV |
| Heat Score | High/Medium/Low |
| Email 1 Sent | Date sent |
| Email 1 Opened | Y/N (via tracking) |
| Email 2 Sent | Date sent |
| Email 3 Sent | Date sent |
| Replied | Y/N |
| Reply Type | Interested / Not now / Unsubscribe |
| Demo Booked | Date |
| Demo Completed | Y/N |
| Trial Started | Date |
| Paying | Date + amount |
| Notes | Free text |

**Email tracking:** Use Mailtrack (free) or HubSpot free tier to see who opened.
**Calendly:** Set 15-min demo slot. Use this link in every email.

---

## STEP 5: DEMO SCRIPT (15 minutes)

### Minute 0–2: Listen first
```
"Thanks for taking the time. Quick question before I show anything:
Right now, how much revenue sits unpaid in invoices?"

[STOP. Listen. Don't interrupt. They tell you the pain.]
```

### Minute 2–5: Show the product
```
"Let me show you RecoverAI on a company similar to yours.

[Screen share]
- These are invoices synced from Stripe — all unpaid, by days overdue
- This is an AI-generated dunning email — unique per customer, their name, their amount
- This is the payment plan it proposes automatically at day 15
- Zero human approval needed — it runs itself"
```

### Minute 5–8: Show ROI
```
"For a company like [Company] with roughly [estimate]k unpaid,
we typically recover 5-10% in the first month.

That's [amount]k, minus our small fee.
Break even in 30 days, profitable from month 2."
```

### Minute 8–12: Close for free trial
```
"Interested in testing free for a month?
You connect Stripe, I set it up personally, you see real results
with your own invoices. No card needed to start."
```

### Minute 12–15: Next steps
```
"Perfect. I'll send the signup link right now.
Takes 5 minutes to connect Stripe. I'll follow up tomorrow to help with setup."
```

---

## STEP 6: HANDLING OBJECTIONS

**"You have no customers yet?"**
```
"You're getting founder pricing. I personally onboard you and make sure it works.
$499/month later becomes $2k+ as we grow.
You're early — that's the advantage here, not a risk."
```

**"Why should I trust you?"**
```
"Fair question. ex-Zupee (Series B, India's largest real-money gaming), JEE 99.8th percentile.
I build things that actually work. That's why the first month is free — you see results before paying anything."
```

**"We handle this manually"**
```
"How many hours a week? Who's doing it?
What if it ran itself, with better personalization than any human, for zero hours of your time?
That's what this does."
```

**"We're too early / don't have AR issues yet"**
```
"When you do have AR issues, you'll be glad you set this up.
And it's free month 1 — there's no downside to having it ready."
```

**"We use [Competitor X]"**
```
"What do you like about it? [Listen]
The key difference: our emails are AI-generated per customer, not templated.
They convert 2-3x better. Worth testing side-by-side?"
```

---

## WEEK-BY-WEEK EXECUTION PLAN

### Week 1 (Start NOW)
- **Day 1 (2 hours):** Filter CSV → top 100 in `outreach_batch_1.csv`
- **Day 1 (1 hour):** Set up tracking spreadsheet + Calendly
- **Day 1 (30 min):** Buy Hunter.io Starter ($49)
- **Day 2:** Send Email 1 to top 30 `hello@`/`contact@`/`founders@` companies
- **Day 2–3:** Run top 50 through Hunter.io → get personal emails
- **Day 3:** Send Email 1 personal version to Hunter.io results
- **Target:** 50–80 emails sent by Friday

### Week 2
- **Monday:** Send Email 2 to all non-responders from Week 1
- **Monday–Wednesday:** Send Email 1 to next batch of 50 (from `outreach_batch_1.csv` rows 51–100)
- **Target:** 8–12 replies total (8–12% personal, 2–4% company emails)

### Week 3
- **Monday:** Send Email 3 (final) to original batch non-responders
- **Wednesday:** Send Email 2 to new batch non-responders
- **Friday:** Book demos from replies
- **Target:** 2–4 demos booked

### Week 4
- Run demos using script above
- Close 1–2 to free trial
- **Target:** 1 customer on free trial

### Week 5
- Daily check-ins with Customer 1
- "Invoices synced — X found. First emails queued for tomorrow."
- "Day 3: First dunning emails sent."
- Send Email 1 to Batch 2 (next 100 from CSV)
- **Target:** Customer 1 seeing recovery results

### Week 6
- Offer SMS upsell to Customer 1 ($249/month)
- "We can add SMS follow-up to 2x your recovery rate. Add it?"
- **Target:** First $249 revenue

### Week 7–8
- Day 30: conversion email to Customer 1 → $499/month
- Round 2 outreach to 100 new companies WITH social proof
- **Subject for Round 2:** `"Already working with [Company name]"`
- **Target:** 3–5 paying customers, $3–5k MRR

---

## ROUND 2 EMAIL (Week 7–8, with proof)

```
Subject: Already working with [Customer company name]

Hi [Name],

Working with a few SaaS companies on AR recovery.
[Customer name] recovered $X in their first month — zero manual work.

Worth exploring for [Company]?

[Calendly link]
— Rudraksh
```

---

## DAY 30 CONVERSION EMAIL (send to free trial customers)

```
Subject: Your 30-day results from RecoverAI

[Name], 30 days is up. Here's what happened:

Invoices processed: X
Dunning emails sent: Y
Amount recovered: $Z
Hours saved: [estimate based on email count]

Ready to continue at $499/month + 5% of what we recover?

[YES – keep going]   [PAUSE]   [CANCEL]

— Rudraksh
P.S. The $5% recovery fee = only charged on money we actually collect for you. Zero risk.
```

---

## TESTIMONIAL REQUEST (after first successful month)

```
[Name], thrilled the first month worked out.

Quick ask: would you share one sentence about your results for our site?
Something like "Recovered $12k in 30 days, completely automated."

You'd get a backlink from RecoverAI's site to yours.
Happy to write it for you based on your numbers if easier — just confirm?
```

---

## OUTREACH BATCHING MATH

```
2,004 total companies
÷ 100 per batch
= 20 batches = 6+ months of outreach runway

Week 1:  Batch 1  (rows 1-100)   → ~7-10 replies → 2-3 demos
Week 3:  Batch 2  (rows 101-200) → ~7-10 replies
Week 5:  Batch 3  (rows 201-300) → now with proof, higher conversion
...
Month 4: Batch 8  (rows 701-800) → 15% reply rate with case studies
```

**You will never run out of leads. Focus on quality execution of each batch, not rushing through them all.**

---

## TOOLS NEEDED

| Tool | Cost | Purpose |
|------|------|---------|
| Hunter.io Starter | $49/month | Personal founder emails (500 searches) |
| Mailtrack | Free | Email open tracking in Gmail |
| Google Sheets | Free | Outreach CRM + tracking |
| Calendly | Free | Demo booking link |
| **Total** | **$49/month** | All you need to start |

No LinkedIn Navigator needed — the list is already built.

---

## SUCCESS METRICS

| Metric | Week 1 | Week 2 | Week 4 | Week 8 | Month 6 |
|--------|--------|--------|--------|--------|---------|
| Emails sent | 50–80 | 150–200 | 350+ | 700+ | 1,500+ |
| Reply rate (personal) | 8–12% | 8–12% | 10–15% | 12–18% | 15–20% |
| Reply rate (company email) | 2–4% | 2–4% | 3–5% | 4–6% | — |
| Demos booked | 0–1 | 3–5 | 8–10 | 20+ | 50+ |
| Free trials | 0 | 0–1 | 1–2 | 3–5 | 10–15 |
| Paying customers | 0 | 0 | 0–1 | 3–5 | 10–15 |
| MRR | $0 | $0 | $0–$499 | $3k–5k | $13k–15k |
