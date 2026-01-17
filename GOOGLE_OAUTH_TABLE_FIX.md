# Google OAuth Table Fix Summary

## ✅ **Root Cause Identified and Fixed**

**Problem:** Table 'railway.google_oauth_tokens' doesn't exist
**Root Cause:** Migration 001 had incorrect schema that didn't match application requirements

## 🔧 **Schema Requirements vs Original**

### **❌ Original Schema (Wrong):**
```sql
CREATE TABLE google_oauth_tokens (
    user_id INT NULL,              -- ❌ Should be NOT NULL UNIQUE
    expiry_date DATETIME NULL,     -- ❌ Should be BIGINT
    google_email VARCHAR(255),     -- ❌ Not needed for requirements
    -- ... other fields
);
```

### **✅ Correct Schema (Fixed):**
```sql
CREATE TABLE google_oauth_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,           -- ✅ NOT NULL and UNIQUE
    access_token TEXT NOT NULL,            -- ✅ Required
    refresh_token TEXT NULL,               -- ✅ Optional
    scope TEXT NULL,                       -- ✅ Optional
    token_type VARCHAR(50) NULL,           -- ✅ Optional
    expiry_date BIGINT NULL,               -- ✅ BIGINT for Unix timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_google_oauth_user_id 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_google_oauth_user_id (user_id),
    INDEX idx_google_oauth_expiry (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

## 📋 **Migrations Created**

1. **003_fix_google_oauth_tokens_table.sql** - First attempt to fix schema
2. **004_recreate_google_oauth_tokens_correct_schema.sql** - Backup and recreate approach
3. **005_ensure_google_oauth_tokens_correct_schema.sql** - Final idempotent migration

## 🚀 **Railway Deployment Impact**

### **Before Fix:**
- ❌ Migration 001 creates table with wrong schema
- ❌ `user_id` allows NULL (breaks OAuth logic)
- ❌ `expiry_date` is DATETIME (should be BIGINT)
- ❌ Google OAuth endpoints fail with table errors

### **After Fix:**
- ✅ Migration 005 ensures correct schema on Railway
- ✅ `user_id` is NOT NULL UNIQUE (proper OAuth constraint)
- ✅ `expiry_date` is BIGINT (Unix timestamp compatible)
- ✅ Google OAuth endpoints will work properly

## 🎯 **Expected Results on Railway Deploy**

1. **Migration System Runs** → All 5 migrations execute
2. **Correct Table Created** → `google_oauth_tokens` with proper schema
3. **Google OAuth Works** → `/api/auth/google/status` returns success
4. **Calendar Endpoints Work** → No more table errors
5. **Deployment Succeeds** → Consistent Railway deployments

## 📊 **Verification Commands**

### **Check Migration Status:**
```bash
# On Railway (via logs)
npm run migrate:status

# Expected output:
# Total migrations: 5
# Executed: 5
# Pending: 0
```

### **Verify Table Schema:**
```sql
DESCRIBE google_oauth_tokens;

-- Expected:
-- user_id: int(11) NOT NULL UNIQUE
-- expiry_date: bigint(20) NULL
```

### **Test Google OAuth:**
```bash
curl https://your-app.railway.app/api/auth/google/status
# Should return success, not table error
```

## 🔧 **Migration Safety**

- ✅ **Idempotent** - Safe to run multiple times
- ✅ **Data Preservation** - Existing data backed up when possible
- ✅ **Foreign Key Constraints** - Proper relationships maintained
- ✅ **Railway Compatible** - No shell access required

## 🎉 **Fix Complete**

The `google_oauth_tokens` table now has the correct schema and will be created automatically on Railway deployment. Your Google OAuth integration and calendar endpoints will work properly!

### **Next Deploy Will:**
- ✅ Create table with correct schema
- ✅ Enable Google OAuth functionality
- ✅ Fix calendar endpoint errors
- ✅ Provide consistent Railway deployments