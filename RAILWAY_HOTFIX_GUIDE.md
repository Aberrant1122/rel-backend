# Railway Deployment Hotfix Guide

## Issues Fixed
1. **Migration 009 failing** - Duplicate `google_email` column error
2. **User creation failing** - Role column doesn't support 'employee' value

## Quick Fix (Recommended)

### Option 1: Run Hotfix Script
```bash
# In your Railway deployment or local environment connected to Railway DB
node scripts/railway-hotfix.js
```

This script will:
- Mark the problematic migration as completed
- Add the missing column only if it doesn't exist
- Fix the role ENUM to support 'employee'

### Option 2: Manual Database Fix
If you have direct database access:

```sql
-- Mark migration as completed
INSERT IGNORE INTO migrations (filename, executed_at) 
VALUES ('009_add_google_email_column.sql', NOW());

-- Fix role column
ALTER TABLE users MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee';

-- Add google_email column if missing
ALTER TABLE google_oauth_tokens ADD COLUMN IF NOT EXISTS google_email VARCHAR(255) NOT NULL DEFAULT '' AFTER user_id;
ALTER TABLE google_oauth_tokens ADD INDEX IF NOT EXISTS idx_google_email (google_email);
```

## Deployment Steps

1. **Deploy the hotfix files** to Railway
2. **Run the hotfix script** via Railway console or redeploy
3. **Restart your Railway service**

## Verification

After applying the fix, check:
- ✅ Server starts without migration errors
- ✅ User creation works with 'employee' role
- ✅ Google OAuth integration functions properly

## Prevention

The hotfix migration (012) includes conditional logic to prevent future duplicate column errors.

## Files Added/Modified
- `migrations/012_hotfix_duplicate_column_and_roles.sql` - Smart migration with existence checks
- `scripts/railway-hotfix.js` - Automated fix script
- `scripts/railway-start.js` - Improved error handling