# Schema Migration: company_name Field

## Change Summary
- **OLD**: `name VARCHAR NOT NULL` (company name), `company_name VARCHAR` (optional)
- **NEW**: `company_name VARCHAR NOT NULL` (company name), `name VARCHAR` (optional, contact person)

## For Fresh Databases
✅ **NO ACTION NEEDED** - schema.sql creates the correct schema automatically

## For Existing Databases with Customer Data
⚠️ **MIGRATION REQUIRED** - If you have existing customers in your database:

### Step 1: Backup (CRITICAL!)
```sql
CREATE TABLE customers_backup AS SELECT * FROM customers;
```

### Step 2: Migrate Data (Run Once)
```sql
-- Move company names from 'name' to 'company_name'
UPDATE customers 
SET company_name = COALESCE(company_name, name)
WHERE company_name IS NULL OR company_name = '';

-- Clear out the name field (contact person name is optional)
-- This step is optional - you can keep the old names here if they were contact names
-- UPDATE customers SET name = NULL;
```

### Step 3: Verify
```sql
-- Check that all customers have company_name
SELECT COUNT(*) as customers_missing_company_name 
FROM customers 
WHERE company_name IS NULL OR company_name = '';
-- Should return 0
```

### Step 4: Test Application
- Upload new CSV invoices
- Sync Stripe/QB again
- Verify customers are created with correct company_name

## Timeline
- **Date Applied**: 2026-04-17
- **Deployed To**: production
- **Status**: Ready for migration on next maintenance window
