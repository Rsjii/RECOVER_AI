const fs = require('fs');
const path = require('path');

// Read CSV file
const csvPath = 'companies_B2B.csv';
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

// Parse CSV
const header = lines[0];
const companies = [];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  // Simple CSV parser for quoted fields
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

// Scoring function
function scoreCompany(company) {
  let score = 0;
  const text = `${company.description} ${company.categories}`.toLowerCase();

  // Invoice/Payment keywords (+25)
  if (['invoice', 'payment', 'receivable', 'ar ', 'accounts receivable', 'charge', 'billing platform', 'payment processing', 'transaction'].some(kw => text.includes(kw))) {
    score += 25;
  }
  // Billing/Subscription (+20)
  else if (['billing', 'subscription', 'recurring'].some(kw => text.includes(kw))) {
    score += 20;
  }
  // Fintech/Finance (+18)
  else if (['fintech', 'finance', 'financial', 'banking', 'credit', 'loan'].some(kw => text.includes(kw))) {
    score += 18;
  }
  // Accounting (+15)
  else if (['accounting', 'erp', 'bookkeeping', 'ledger'].some(kw => text.includes(kw))) {
    score += 15;
  }
  // SaaS/Platform (+10)
  else if (['saas', 'platform', 'software', 'api'].some(kw => text.includes(kw))) {
    score += 10;
  }
  // Stage & Location bonus (+3 to +5)
  else {
    const year = parseInt(company.season.match(/\d{4}/)?.[0] || '0');
    const isUSA = company.location.includes('USA');
    const isBigTech = company.location.includes('San Francisco') || company.location.includes('New York') || company.location.includes('Palo Alto');

    if (year >= 2017 && year <= 2023) {
      score += isBigTech ? 5 : (isUSA ? 3 : 1);
    } else {
      score += 1;
    }
  }

  return score;
}

// Score all companies and sort
const scoredCompanies = companies
  .map(company => ({
    ...company,
    score: scoreCompany(company)
  }))
  .sort((a, b) => b.score - a.score);

console.log(`✓ Scored all ${scoredCompanies.length} companies`);

// Generate CSV with scores
let csvOutput = `"Company Name","Location","Description","Season","Type","Categories","Score"\n`;

scoredCompanies.forEach(company => {
  const name = company.name.replace(/"/g, '""');
  const location = company.location.replace(/"/g, '""');
  const desc = company.description.replace(/"/g, '""');
  const season = company.season.replace(/"/g, '""');
  const type = company.type.replace(/"/g, '""');
  const cats = company.categories.replace(/"/g, '""');

  csvOutput += `"${name}","${location}","${desc}","${season}","${type}","${cats}",${company.score}\n`;
});

fs.writeFileSync('companies_scored.csv', csvOutput);

console.log(`\n✅ Created companies_scored.csv with all ${scoredCompanies.length} companies + scores`);
console.log('\n📊 Score Distribution:');
const distribution = {};
scoredCompanies.forEach(c => {
  distribution[c.score] = (distribution[c.score] || 0) + 1;
});
Object.keys(distribution).sort((a, b) => b - a).forEach(score => {
  console.log(`   Score ${score}: ${distribution[score]} companies`);
});
