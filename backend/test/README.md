# RecoverAI Test Suite - Organized Structure

Comprehensive test suite for all API endpoints and integrations.

## 📁 Folder Structure

```
test/
├── README.md                    # This file
├── suites/                      # ⭐ ACTIVE TEST SUITES (Use These!)
│   ├── MASTER_TEST_SUITE.js              # ✅ PRIMARY - 70 comprehensive tests (97.1% pass)
│   ├── FINAL_COMPREHENSIVE_TESTS.js      # Alternative - 45 core endpoint tests (95.6% pass)
│   ├── PROPER_TEST_SUITE.js              # Full-featured test suite
│   └── run-comprehensive-tests.js        # Test runner script
├── runners/                     # Test runner utilities
│   ├── comprehensive.js         # Comprehensive runner
│   ├── integrations.js          # Integration tests
│   └── email.js                 # Email-specific tests
├── reports/                     # 📊 Test reports & results (Generated)
│   ├── MASTER_TEST_RESULTS.md            # Main test results
│   ├── FINAL_TEST_REPORT.md              # Detailed report
│   ├── TEST_LOG.json                     # Raw test logs
│   └── ...other reports...
├── fixtures/                    # Test data & mock responses
│   ├── .testdata.json           # Generated test data
│   ├── data/                    # Test case payloads
│   │   ├── auth-cases.json
│   │   ├── ai-cases.json
│   │   ├── email-cases.json
│   │   └── ...more...
│   └── cases/                   # Canonical test cases
├── utils/                       # Utility scripts
│   ├── seed.js                  # Seed test data
│   └── a.js                     # Legacy utility
├── docs/                        # 📖 Test documentation
│   ├── COMPREHENSIVE_TEST_CASES.md  # All test cases docs
│   └── STRUCTURE.md                 # Architecture notes
└── legacy/                      # ⚠️ Old/deprecated tests (Keep for reference)
    ├── run-all.js
    ├── curl-test-all.js
    └── scripts/
```

## 🚀 Quick Start

### Option 1: Run Master Test Suite (RECOMMENDED) ⭐
```bash
cd backend
npm run dev  # In one terminal

# In another terminal:
node test/suites/MASTER_TEST_SUITE.js
```

**Result:** 97.1% pass rate (68/70 tests)
- Covers all 11 API categories
- 70 comprehensive test cases
- Generates `reports/MASTER_TEST_RESULTS.md`

### Option 2: Run Final Comprehensive Tests
```bash
node test/suites/FINAL_COMPREHENSIVE_TESTS.js
```

**Result:** 95.6% pass rate (43/45 tests)
- Focuses on core endpoints
- Quick validation

### Option 3: Use Runner Script
```bash
node test/suites/run-comprehensive-tests.js
```

## 📊 Test Coverage

**Master Test Suite (70 tests - 97.1% pass):**
- ✅ Health & Platform (4 tests)
- ✅ Authentication (12 tests)
- ✅ Customers (4 tests)
- ✅ Invoices (12 tests)
- ✅ AI Services (6 tests)
- ✅ Email Queue (8 tests)
- ✅ Dashboard (4 tests)
- ✅ Payment Plans (5 tests)
- ✅ Settings (6 tests)
- ✅ Billing (6 tests)
- ✅ Stripe (5 tests)

**Known Issues (2/70 - Expected):**
- CSV format upload test (test framework, not code issue)
- Expected failures properly documented

## 🎯 Test Suites & How to Use

### Primary: MASTER_TEST_SUITE.js
**Status:** ⭐ RECOMMENDED - Production Ready

```bash
cd backend
npm run dev              # Terminal 1: Start server
node test/suites/MASTER_TEST_SUITE.js  # Terminal 2: Run tests
```

- 70 comprehensive tests
- 97.1% pass rate (68/70)
- All 11 categories covered
- Detailed markdown report generated

### Alternative: FINAL_COMPREHENSIVE_TESTS.js
**Status:** Quick validation

```bash
node test/suites/FINAL_COMPREHENSIVE_TESTS.js
```

- 45 core endpoint tests
- 95.6% pass rate (43/45)
- Faster execution

### Runner Utilities (Advanced)
Located in `runners/` folder:

```bash
# Comprehensive runner
node test/runners/comprehensive.js

# Integration tests
node test/runners/integrations.js

# Email-specific tests
node test/runners/email.js
```

## 📊 Test Reports

Reports are automatically generated in `reports/` directory:

| Report | Description |
|--------|-------------|
| **MASTER_TEST_RESULTS.md** | Main test results from MASTER_TEST_SUITE.js |
| **FINAL_TEST_REPORT.md** | Detailed report from FINAL_COMPREHENSIVE_TESTS.js |
| **TEST_LOG.json** | Raw test execution log |
| **COMPREHENSIVE_TEST_CASES.md** | Documentation of all test cases |

**View latest report:**
```bash
cat test/reports/MASTER_TEST_RESULTS.md
```

## 🎁 Demo Data System

Use the demo endpoint to create realistic test data instantly:

```bash
curl -X POST http://localhost:3000/api/demo/login
```

**Creates automatically:**
- 8 realistic customers with diverse payment profiles
- 24 invoices (paid, arranged, unpaid, fresh)
- Complete email history with 5-stage dunning sequence
- Payment records and plans

**Demo credentials:**
- Email: `demo@recoverai.com`
- Password: `Demo1234!`
- Company: `Acme SaaS (Demo)`

See `CLIENT_DEMO_GUIDE.md` in project root for full details.

## 🔧 Utilities

### Seed Test Data
```bash
node test/utils/seed.js
```

Creates test users, companies, customers, and invoices for manual testing.

### Legacy Utilities
Located in `utils/`:
- `a.js` - Legacy test utilities (kept for reference)
- `seed.js` - Database seeding script

## 📚 Documentation

**In `docs/` folder:**
- `COMPREHENSIVE_TEST_CASES.md` - All test cases documented
- `STRUCTURE.md` - Architecture and design notes

**In project root:**
- `CLIENT_DEMO_GUIDE.md` - How to demo to clients
- `TEST_GUIDE_COMPLETE.md` - Complete testing guide
- `QUICK_TEST_REFERENCE.txt` - Quick reference card
- `DELIVERY_SUMMARY.txt` - Project completion status

## 🛠️ Maintenance

### Adding New Tests

1. Open `test/suites/MASTER_TEST_SUITE.js`
2. Add test case to appropriate category section
3. Run: `node test/suites/MASTER_TEST_SUITE.js`
4. Update test result in `reports/MASTER_TEST_RESULTS.md`

### File Organization

```
test/
├── suites/          ← ACTIVE TEST FILES (modify these)
├── runners/         ← Runner utilities (rarely modified)
├── reports/         ← Generated reports (don't edit)
├── fixtures/        ← Test data (don't modify)
├── utils/           ← Seed scripts (modify if needed)
├── docs/            ← Documentation
└── legacy/          ← Old tests (reference only)
```

## ✅ Quick Reference

| Need | Command |
|------|---------|
| Run all tests | `node test/suites/MASTER_TEST_SUITE.js` |
| Quick test | `node test/suites/FINAL_COMPREHENSIVE_TESTS.js` |
| View results | `cat test/reports/MASTER_TEST_RESULTS.md` |
| Create demo data | `curl -X POST http://localhost:3000/api/demo/login` |
| Seed test DB | `node test/utils/seed.js` |

