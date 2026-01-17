# Railway Deployment Guide

This guide shows how to deploy your CRM backend to Railway with proper database configuration.

## 🚀 Quick Deployment

### 1. **Create Railway Project**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway new
```

### 2. **Add MySQL Database**
- Go to your Railway project dashboard
- Click "New" → "Database" → "Add MySQL"
- Railway automatically creates `MYSQL_URL` variable

### 3. **Set Environment Variables**

In your Railway project, add these environment variables:

```env
# Database (Railway provides this automatically)
DATABASE_URL=${{MYSQL_URL}}

# JWT Configuration
JWT_ACCESS_SECRET=your_super_secret_access_token_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_token_key_change_this_in_production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://your-app.railway.app/api/auth/google/callback
GOOGLE_CALENDAR_ID=your_google_calendar_id@gmail.com

# WhatsApp Configuration
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_phone_id
WHATSAPP_BUSINESS_ID=your_business_id
WHATSAPP_VERIFY_TOKEN=your_verify_token

# Frontend URL
FRONTEND_URL=https://your-frontend.vercel.app

# Server Configuration
PORT=5000
```

### 4. **Deploy**
```bash
# Deploy to Railway
railway up
```

## 🔧 Database Configuration

### **Why DATABASE_URL?**
- ✅ Railway's recommended approach
- ✅ Automatic connection string management
- ✅ No need to manage individual DB variables
- ✅ Works with Railway's internal networking

### **How it Works**
```javascript
// Your code now uses:
const pool = mysql.createPool(process.env.DATABASE_URL);

// Instead of:
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    // ... etc
});
```

### **Railway Variables**
Railway automatically provides:
- `MYSQL_URL` - Full database connection string
- `MYSQL_HOST` - Database host (but we don't use this)
- `MYSQL_PORT` - Database port (but we don't use this)
- `MYSQL_USER` - Database user (but we don't use this)
- `MYSQL_PASSWORD` - Database password (but we don't use this)
- `MYSQL_DATABASE` - Database name (but we don't use this)

We only use `MYSQL_URL` via `DATABASE_URL=${{MYSQL_URL}}`.

## 🚀 Automatic Migrations

Your app automatically runs migrations on startup:

1. **Railway starts your app**
2. **npm start** runs
3. **Migrations execute** automatically
4. **Server starts** on the assigned port

## 🔍 Troubleshooting

### **Database Connection Issues**
```bash
# Check Railway logs
railway logs

# Check environment variables
railway variables
```

### **Migration Issues**
```bash
# Check migration status (locally)
npm run migrate:status

# Force migration (if needed)
npm run migrate
```

### **Common Issues**

1. **DATABASE_URL not set**
   - Ensure `DATABASE_URL=${{MYSQL_URL}}` in Railway variables

2. **Google OAuth redirect URI**
   - Update `GOOGLE_REDIRECT_URI` to your Railway domain
   - Update Google Console with new redirect URI

3. **CORS issues**
   - Update `FRONTEND_URL` to your frontend domain
   - Ensure frontend `NEXT_PUBLIC_API_URL` points to Railway backend

## 📊 Monitoring

### **Check Deployment Status**
```bash
# View logs
railway logs

# Check service status
railway status
```

### **Database Health**
Your app includes health checks:
- `GET /api/health` - API health check
- Automatic database connection testing on startup

## 🔄 Updates

To update your deployment:
```bash
# Push changes
git push

# Railway auto-deploys from main branch
# Or manually deploy:
railway up
```

## 🎯 Production Checklist

- ✅ DATABASE_URL configured
- ✅ All environment variables set
- ✅ Google OAuth redirect URI updated
- ✅ Frontend CORS domain configured
- ✅ JWT secrets are secure (not default values)
- ✅ WhatsApp webhook URL updated
- ✅ SSL/HTTPS enabled (automatic on Railway)

Your CRM backend is now production-ready on Railway! 🎉