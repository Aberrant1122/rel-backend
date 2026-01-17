# Google OAuth Setup Guide - Fix "No stored tokens found"

## 🚨 **Current Issue**
Your logs show: `[GoogleOAuth] No stored tokens found` - This means users haven't connected their Google accounts yet.

## ✅ **Solution Implemented**

I've added a **Google Connection Status** component to your calendar page that will:
- Show connection status
- Provide a "Connect Google" button
- Handle the OAuth flow automatically

## 🔧 **What Was Added**

### **1. Google Connection Component**
- `components/GoogleConnectionStatus.tsx` - Shows connection status and connect button
- Integrated into calendar page with visual indicators

### **2. Updated Calendar Page**
- Added Google connection status at the top
- Only fetches meetings when Google is connected
- Shows clear instructions to connect Google account

## 🌐 **Google Cloud Console Setup Required**

### **Step 1: Add Authorized JavaScript Origins**
In Google Cloud Console → APIs & Services → Credentials → Your OAuth 2.0 Client:

**Add these to Authorized JavaScript origins:**
```
https://fortunefind-leads-crm-production.up.railway.app
https://your-frontend-domain.vercel.app (if separate)
```

**Add these to Authorized redirect URIs:**
```
https://fortunefind-leads-crm-production.up.railway.app/api/auth/google/callback
```

### **Step 2: Railway Environment Variables**
Ensure these are set in Railway:
```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://fortunefind-leads-crm-production.up.railway.app/api/auth/google/callback
GOOGLE_CALENDAR_ID=your_google_calendar_id@gmail.com
```

## 🎯 **How Users Connect Google Account**

### **1. Visit Calendar Page**
- User goes to `/calendar`
- Sees yellow banner: "Google Calendar not connected"

### **2. Click "Connect Google"**
- Redirects to Google OAuth consent screen
- User authorizes calendar access
- Redirects back to your app

### **3. Tokens Stored**
- OAuth tokens saved to `google_oauth_tokens` table
- Calendar functionality now works
- Green banner shows: "Google Calendar connected"

## 📊 **Available Endpoints**

Your app already has these Google OAuth endpoints:

- `GET /api/auth/google` - Start OAuth flow
- `GET /api/auth/google/callback` - Handle OAuth callback
- `GET /api/auth/google/status` - Check connection status
- `POST /api/auth/google/disconnect` - Disconnect account

## 🔍 **Testing the Fix**

### **1. Deploy Latest Code**
- The Google connection UI is now integrated
- Calendar page will show connection status

### **2. Test OAuth Flow**
1. Visit: `https://your-app.railway.app/calendar`
2. Click "Connect Google" button
3. Complete Google OAuth flow
4. Should see "Google Calendar connected"

### **3. Verify in Logs**
After connection, logs should show:
```
[GoogleOAuth] Stored tokens successfully
[GoogleCalendar] Listing meetings successfully
```

## 🎉 **Expected Results**

- ✅ **No more "No stored tokens found" errors**
- ✅ **Clear UI for users to connect Google**
- ✅ **Calendar functionality works after connection**
- ✅ **Visual feedback on connection status**

## 🚀 **Next Steps**

1. **Update Google Cloud Console** with redirect URIs
2. **Deploy the updated code** to Railway
3. **Test the OAuth flow** on production
4. **Users can now connect their Google accounts** via the UI

The "No stored tokens found" error will be resolved once users connect their Google accounts through the new UI! 🎉