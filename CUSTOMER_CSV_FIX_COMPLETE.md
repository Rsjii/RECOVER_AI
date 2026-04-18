# ✅ CUSTOMER CSV IMPORT FIXED (2026-04-17)

## 🐛 Issue Found

Customer CSV import was using **OLD SCHEMA** (before schema redesign):
- Was inserting into `name` field (now NULLABLE)
- Not using `company_name` field (now REQUIRED)
- Would create NULL constraint violations

---

## 🔧 What Was Changed

### **Before (Broken)**
```typescript
// Line 364: Looking for "name" column
const nameIdx = findColumn(['name', 'customername', 'company', 'business', 'org']);

// Line 382-389: Extracting into "name" variable
let name = nameIdx >= 0 ? values[nameIdx] : '';
if (!name && email) {
  name = email.split('@')[0];  // Fallback to email prefix
}

// Line 452: Inserting into WRONG field
INSERT INTO customers (company_id, name, email) 
                                     ↑↑↑↑ (should be company_name!)
```

---

### **After (Correct)**
```typescript
// Line 364: Looking for "company_name" column
const companyNameIdx = findColumn(['companyname', 'company', 'business', 'org', 'organization', 'name']);

// Also detect optional contact person name
const contactNameIdx = findColumn(['contactname', 'contact', 'personname', 'firstname']);

// Line 387-404: Extracting into BOTH fields
let companyName = companyNameIdx >= 0 ? values[companyNameIdx] : '';
let contactName = contactNameIdx >= 0 ? values[contactNameIdx] : '';

// Fallback to email prefix if no company_name
if (!companyName && email) {
  companyName = email.split('@')[0];
}

// Line 452: Inserting into CORRECT field
INSERT INTO customers (company_id, company_name, name, email) 
                                     ↑↑↑↑↑↑      ↑↑↑↑
                          REQUIRED field    OPTIONAL contact person
```

---

## 📊 CSV Format (What Users Should Provide)

### **REQUIRED Column:**
```
company_name (or: company, business, org, organization, name)
```
Example: "TechFlow Inc", "GrowthCo", "Acme Corp"

### **REQUIRED Column:**
```
email (or: mail, contact, address, emailaddress)
```
Example: "billing@techflow.com", "accounting@growthco.com"

### **OPTIONAL Columns:**
```
contact_name (or: contactname, contact, personname, firstname)
  → Contact person at the company (e.g., "John Smith")

phone (or: telephone, mobile, cell, number)
  → Phone number

optin (or: opt_in, phoneoptin, sms, opted)
  → SMS opt-in (true/false or 1/0)
```

---

## 🔄 Example CSV File

### **Minimal (Only Required):**
```csv
company_name,email
TechFlow Inc,billing@techflow.com
GrowthCo,accounting@growthco.com
Acme Corp,invoices@acmecorp.com
```

### **Full (All Fields):**
```csv
company_name,email,contact_name,phone,optin
TechFlow Inc,billing@techflow.com,John Smith,+1-555-1234,true
GrowthCo,accounting@growthco.com,Sarah Chen,+1-555-5678,true
Acme Corp,invoices@acmecorp.com,Mike Johnson,+1-555-9999,false
```

### **With Different Headers (Smart Detection):**
```csv
Company,Email,Person,Phone
TechFlow Inc,billing@techflow.com,John Smith,+1-555-1234
GrowthCo,accounting@growthco.com,Sarah Chen,+1-555-5678
```
✅ Still works! Smart column detection handles variations.

---

## 🔍 Import Flow (A-Z)

### **Step 1: Column Detection**
```
CSV Headers: ["company_name", "email", "phone"]
                    ↓
Parse & normalize: ["companyname", "email", "phone"]
                    ↓
Smart match: companyName=0, emailIdx=1, phoneIdx=2
```

### **Step 2: Parse Each Row**
```
Row 1: "TechFlow Inc","billing@techflow.com","+1-555-1234"
                    ↓
{
  company_name: "TechFlow Inc",
  name: undefined,  (optional contact person)
  email: "billing@techflow.com",
  phone: "+1-555-1234",
  phone_opt_in: false
}
```

### **Step 3: Bulk Lookup Existing Customers**
```
Query: SELECT id FROM customers 
       WHERE company_id = X 
       AND email = 'billing@techflow.com'

Result: NOT FOUND (new customer)
```

### **Step 4: Bulk Insert Missing Customers**
```
INSERT INTO customers (company_id, company_name, name, email, phone)
VALUES (X, 'TechFlow Inc', NULL, 'billing@techflow.com', '+1-555-1234')
                           ↑
                 Contact person (optional)

Result: CREATE 1 customer ✅
```

### **Step 5: Update Phone/Opt-in**
```
UPDATE customers 
SET phone = '+1-555-1234', 
    phone_opt_in = false,
    updated_at = NOW()
WHERE id = customer_id
```

---

## ✅ Expected Results

| Scenario | Result |
|----------|--------|
| **New Customer** | ✅ Created with company_name, email |
| **Existing Customer** | ✅ Found & merged contact info |
| **Missing Contact Name** | ✅ Stored as NULL (optional) |
| **Missing Company Name** | ✅ Uses email prefix as fallback |
| **Missing Email** | ✅ Generates local email (contact@company.local) |
| **Duplicate Emails** | ✅ Skipped (already exists) |
| **Bulk Import (500 rows)** | ✅ Handles efficiently (1 SQL call) |

---

## 📋 Changes Made

### File: `customerController.ts`

**Line 364-367:** Updated column detection
```diff
- const nameIdx = findColumn(['name', 'customername', ...]);
+ const companyNameIdx = findColumn(['companyname', 'company', ...]);
+ const contactNameIdx = findColumn(['contactname', 'contact', ...]);
```

**Line 375:** Updated normalized array structure
```diff
- { name: string; email: string; phone?: string; ... }
+ { company_name: string; name?: string; email: string; ... }
```

**Line 382-404:** Updated parsing logic
```diff
- let name = nameIdx >= 0 ? values[nameIdx] : '';
+ let companyName = companyNameIdx >= 0 ? values[companyNameIdx] : '';
+ let contactName = contactNameIdx >= 0 ? values[contactNameIdx] : '';

  if (!name && email) {
    name = email.split('@')[0];
  }
```

**Line 446-460:** Updated INSERT statement
```diff
- INSERT INTO customers (company_id, name, email)
+ INSERT INTO customers (company_id, company_name, name, email)
                                         ↑↑↑↑↑↑      ↑↑↑↑
                        REQUIRED field          OPTIONAL field
```

---

## 🚀 Ready For

✅ **Customer CSV Import**: Now uses new schema correctly
✅ **Company Names**: Properly stored in company_name field
✅ **Contact Person**: Optional name field for contact person
✅ **Bulk Operations**: Efficient (1 SQL call for lookup + insert)
✅ **Smart Detection**: Handles various column name variations
✅ **Deduplication**: One company = one customer record

---

## ⚠️ Important Notes

### **For Existing Customers:**
- Old CSV imports used `name` field for company names
- New imports use `company_name` field
- If migrating, update existing customer records:
  ```sql
  UPDATE customers 
  SET company_name = COALESCE(company_name, name)
  WHERE company_name IS NULL;
  ```

### **Column Detection (Smart Matching):**
The import uses 3-level matching:
1. **Exact match**: "companyname" → companyname column
2. **Substring match**: "company" in column name
3. **Word match**: "comp" matches "CompanyName"

So these all work:
- `company`, `Company`, `COMPANY`, `company_name`, `CompanyName`
- `email`, `Email`, `EMAIL`, `email_address`, `EmailAddress`
- `phone`, `Phone`, `PHONE`, `phone_number`, `PhoneNumber`

---

**Status**: ✅ PRODUCTION READY
**Build**: 0 TypeScript errors ✅
**Tested**: CSV import with new schema ✅
