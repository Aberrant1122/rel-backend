# Railway Deployment Hotfix Guide

## Issues Fixed
1. **Migration 009 failing** - Duplicate `google_email` column error
2. **User creation failing** - Role column doesn't support 'employee' value

## Immediate Fix (Choose One)

### Option 1: Quick Fix via Railway Console
```bash
# Run this in Railway console or redeploy with these commands
npm run skip-migration-009
npm run emergency-role-fix
```

### Option 2: Single Command Fix
```bash
npm run hotfix
```

### Option 3: Manual Database Fix
If you have direct database access:

```sql
-- Skip problematic migration
INSERT IGNORE INTO schema_migrations (filename, executed_at) 
VALUES ('009_add_google_email_column.sql', NOW());

-- Fix role column
ALTER TABLE users MODIFY COLUMN role ENUM('user', 'employee', 'admin') DEFAULT 'employee';

-- Add google_email column if missing
ALTER TABLE google_oauth_tokens ADD COLUMN IF NOT EXISTS google_email VARCHAR(255) NOT NULL DEFAULT '' AFTER user_id;
ALTER TABLE google_oauth_tokens ADD INDEX IF NOT EXISTS idx_google_email (google_email);
```

## What the Fix Does

1. **Marks migration 009 as completed** - Prevents it from running again
2. **Fixes role column** - Adds 'employee' to ENUM values
3. **Adds missing column safely** - Only if it doesn't already exist
4. **Updates startup script** - Includes emergency role fix on every startup

## Verification

After applying the fix, check:
- ✅ Server starts without migration errors
- ✅ User creation works with 'employee' role
- ✅ No more "Data truncated for column 'role'" errors

## Files Added/Modified
- `migrations/012_hotfix_duplicate_column_and_roles.sql` - Smart migration with existence checks
- `scripts/railway-hotfix.js` - Automated fix script
- `scripts/emergency-role-fix.js` - Role column fix only
- `scripts/skip-migration-009.js` - Skip problematic migration
- `scripts/railway-start.js` - Improved startup with emergency role fix
- `package.json` - Added convenience scripts

## Next Steps

1. **Deploy the updated code** to Railway
2. **The startup script will automatically fix the role issue**
3. **If migrations still fail, run:** `npm run skip-migration-009`
4. **Restart your Railway service**

The role issue should now be resolved automatically on every startup!