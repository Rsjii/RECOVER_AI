const fs = require('fs');
const path = require('path');

// Read CSV file
const csvPath = '/c/dev/AGENTIC_AR/companies_B2B.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

// Parse CSV (skip header)
const companies = [];
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  // Simple CSV parser (handles quoted fields)
  const matches = lines[i].match(/"([^"]*)"/g);
  if (matches && matches.length >= 6) {
    const company = {
      name: matches[0].slice(1, -1),
      location: matches[1].slice(1, -1),
      description: matches[2].slice(1, -1),
      season: matches[3].slice(1, -1),
      type: matches[4].slice(1, -1),
      categories: matches[5].slice(1, -1)
    };
    companies.push(company);
  }
}

console.log(`✓ Parsed ${companies.length} companies`);

// Scoring function for B2B AR Collections
function scoreCompany(company) {
  let score = 0;
  let reasons = [];

  const text = `${company.description} ${company.categories}`.toLowerCase();

  // TIER 1: Invoice/Payment keywords (+25 pts) - HIGHEST PRIORITY
  const invoiceKeywords = ['invoice', 'payment', 'receivable', 'ar ', 'accounts receivable', 'charge', 'billing platform', 'payment processing', 'payment gateway', 'transaction'];
  const hasInvoice = invoiceKeywords.some(kw => text.includes(kw));
  if (hasInvoice) {
    score += 25;
    reasons.push('Invoice/Payment keywords (TIER 1: +25)');
  }

  // TIER 2: Billing/Subscription (+20 pts)
  const billingKeywords = ['billing', 'subscription', 'recurring', 'subscription management', 'saas billing', 'billing engine'];
  const hasBilling = billingKeywords.some(kw => text.includes(kw));
  if (hasBilling && !hasInvoice) {
    score += 20;
    reasons.push('Billing/Subscription (TIER 2: +20)');
  }

  // TIER 3: Fintech/Finance (+18 pts)
  const fintechKeywords = ['fintech', 'finance', 'financial', 'banking', 'bank', 'credit', 'loan', 'lending', 'insurance'];
  const hasFintech = fintechKeywords.some(kw => text.includes(kw));
  if (hasFintech && !hasInvoice && !hasBilling) {
    score += 18;
    reasons.push('Fintech/Finance (TIER 3: +18)');
  }

  // TIER 4: Accounting/ERP (+15 pts)
  const accountingKeywords = ['accounting', 'accounting software', 'erp', 'bookkeeping', 'ledger', 'expense', 'finance management'];
  const hasAccounting = accountingKeywords.some(kw => text.includes(kw));
  if (hasAccounting && !hasInvoice && !hasBilling && !hasFintech) {
    score += 15;
    reasons.push('Accounting/ERP (TIER 4: +15)');
  }

  // TIER 5: SaaS/Platform/General B2B Software (+10 pts)
  const saasKeywords = ['saas', 'platform', 'software', 'api', 'integration'];
  const hasSaas = saasKeywords.some(kw => text.includes(kw));
  if (hasSaas && !hasInvoice && !hasBilling && !hasFintech && !hasAccounting) {
    score += 10;
    reasons.push('SaaS/Platform (TIER 5: +10)');
  }

  // TIER 6: Stage & Location bonus (+5 to +3 pts)
  const seasonYear = parseInt(company.season.match(/\d{4}/)?.[0] || '0');
  const isUSA = company.location.includes('USA');
  const isBigTech = company.location.includes('San Francisco') || company.location.includes('New York') || company.location.includes('Palo Alto');

  if (seasonYear >= 2017 && seasonYear <= 2023) {
    if (isBigTech) {
      score += 5;
      reasons.push('Timing (2017-2023) + Top-tier location (+5)');
    } else if (isUSA) {
      score += 3;
      reasons.push('Timing (2017-2023) + USA location (+3)');
    }
  }

  return { score, reasons };
}

// Score all companies
const scoredCompanies = companies
  .map(company => {
    const { score, reasons } = scoreCompany(company);
    const year = company.season.match(/\d{4}/)?.[0] || 'Unknown';
    return {
      ...company,
      score,
      reasons,
      year
    };
  })
  .filter(c => c.score >= 5)
  .sort((a, b) => b.score - a.score)
  .slice(0, 100);

console.log(`✓ Found ${scoredCompanies.length} qualifying companies (score >= 5)`);

// Generate markdown
const tierBreakdown = {
  HOT: scoredCompanies.filter(c => c.score >= 20).length,
  WARM: scoredCompanies.filter(c => c.score >= 15 && c.score < 20).length,
  COOL: scoredCompanies.filter(c => c.score < 15).length
};

let markdown = `# TOP 100 Companies for RecoverAI B2B AR Collections

## Overview
RecoverAI's dunning and accounts receivable collections product targets B2B SaaS companies that already handle invoicing, payments, and billing. These companies have:
- Existing customer invoice workflows
- Payment processing infrastructure
- Cash flow management challenges
- Subscription/recurring billing models

**Total qualifying companies (score ≥ 5): ${scoredCompanies.length}**

### Tier Breakdown
- 🔥 **HOT** (Score ≥20): ${tierBreakdown.HOT} companies - Perfect fit, high priority
- 🔶 **WARM** (Score 15-19): ${tierBreakdown.WARM} companies - Strong fit, moderate priority
- ❄️ **COOL** (Score 5-14): ${tierBreakdown.COOL} companies - Good fit, lower priority

---

## Filtering Strategy Explained

### Why These Companies?
B2B AR Collections software helps companies recover unpaid invoices through automated dunning workflows. We target companies that:

1. **Already handle invoices/payments** - They understand the pain point
2. **Have billing/subscription models** - Recurring revenue = recurring collections
3. **Are venture-backed SaaS** - Have funding to invest in tools
4. **Are in growth stage** - 2017+ (post-scaling era)

### 6-Tier Scoring System

**TIER 1: Invoice/Payment Keywords (+25 pts)**
- Keywords: invoice, payment, receivable, AR, accounts receivable, charge, billing platform, payment processing
- Why: These companies DIRECTLY work with payments/invoices = highest relevance
- Examples: Stripe, Square, Payment processors

**TIER 2: Billing/Subscription Management (+20 pts)**
- Keywords: billing, subscription, recurring, subscription management, SaaS billing
- Why: They manage recurring/subscription revenue = perfect dunning fit
- Examples: Zuora, Aria Systems, Subscription billing platforms

**TIER 3: Fintech/Finance (+18 pts)**
- Keywords: fintech, finance, financial, banking, credit, loan, lending, insurance
- Why: Finance-focused companies understand collections workflows
- Examples: Fintech platforms, lending platforms, financial software

**TIER 4: Accounting/ERP (+15 pts)**
- Keywords: accounting, accounting software, ERP, bookkeeping, ledger, expense
- Why: Accounting software handles invoice management naturally
- Examples: FreshBooks, QuickBooks alternatives

**TIER 5: SaaS/Platform/B2B Software (+10 pts)**
- Keywords: SaaS, platform, software, API, integration
- Why: General B2B software companies operate on invoice-based models
- Examples: General B2B SaaS platforms

**TIER 6: Stage & Location Bonus (+5 to +3 pts)**
- Timing: Founded 2017-2023 (post-scale SaaS era)
- Location: +5 (SF/NYC/Palo Alto), +3 (other USA), +0 (outside USA)
- Why: Newer companies have more aggressive growth; USA-based easier to sell to

---

## Top 100 Companies

`;

// Add companies
scoredCompanies.forEach((company, idx) => {
  const tier = company.score >= 20 ? '🔥 HOT' : (company.score >= 15 ? '🔶 WARM' : '❄️ COOL');
  markdown += `### ${idx + 1}. ${company.name}
**Score: ${company.score}/50 | Tier: ${tier}**
- **Location:** ${company.location}
- **Category:** ${company.categories}
- **Year:** ${company.year}
- **Description:** ${company.description}
- **Scoring:** ${company.reasons.join(' + ')}

`;
});

// Write output
const outputPath = '/c/dev/AGENTIC_AR/TOP_100_COMPANIES.md';
fs.writeFileSync(outputPath, markdown);
console.log(`\n✅ Written ${scoredCompanies.length} companies to TOP_100_COMPANIES.md`);
console.log(`\n📊 Tier Breakdown:`);
console.log(`   🔥 HOT:  ${tierBreakdown.HOT} companies`);
console.log(`   🔶 WARM: ${tierBreakdown.WARM} companies`);
console.log(`   ❄️ COOL: ${tierBreakdown.COOL} companies`);
