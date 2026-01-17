# Firebase Setup Guide for Form Submissions

This guide explains how to set up Firebase integration to fetch form submissions from your Firebase project "rel-form".

## Prerequisites

1. Firebase project named "rel-form" with Firestore enabled
2. A collection named "formSubmissions" in Firestore
3. Firebase Admin SDK service account credentials

## Step 1: Install Firebase Admin SDK

The Firebase Admin SDK is already included in the dependencies. If you need to install it manually:

```bash
cd REL-backend
npm install firebase-admin
```

## Step 2: Get Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project "rel-form"
3. Click on the gear icon ⚙️ next to "Project Overview"
4. Select "Project settings"
5. Go to the "Service accounts" tab
6. Click "Generate new private key"
7. Download the JSON file (this contains your service account credentials)

## Step 3: Set Environment Variable

You need to set the `FIREBASE_SERVICE_ACCOUNT` environment variable with the contents of the service account JSON file.

### Option 1: As JSON String (Recommended for Railway/Production)

Convert the entire JSON file content to a single-line string and set it as an environment variable:

```env
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"rel-form",...}'
```

**Important:** The entire JSON must be on a single line with escaped quotes.

### Option 2: Using a File (Local Development)

For local development, you can modify `src/services/firebaseService.js` to load from a file:

```javascript
const serviceAccount = require('../path/to/serviceAccountKey.json');
```

However, **never commit the service account file to version control!**

## Step 4: Set Database URL (Optional)

If your Firebase project uses a custom database URL, set it:

```env
FIREBASE_DATABASE_URL=https://rel-form.firebaseio.com
```

If not set, it will default to `https://{project_id}.firebaseio.com`.

## Step 5: Verify Firestore Collection Structure

Ensure your Firestore collection is named `formSubmissions` and documents have the following structure:

```javascript
{
  // Document ID is auto-generated
  field1: "value1",
  field2: "value2",
  timestamp: Timestamp, // Firestore Timestamp
  createdAt: Timestamp,  // Optional
  updatedAt: Timestamp   // Optional
}
```

## Step 6: Test the Integration

1. Start your backend server:
   ```bash
   npm start
   ```

2. The Firebase service will initialize automatically when the first request is made.

3. Test the endpoint:
   ```bash
   curl -X GET http://localhost:5000/api/forms/submissions \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

## Environment Variables Summary

Add these to your `.env` file or Railway environment variables:

```env
# Firebase Configuration
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"rel-form",...}'
FIREBASE_DATABASE_URL=https://rel-form.firebaseio.com  # Optional
```

## Troubleshooting

### Error: "FIREBASE_SERVICE_ACCOUNT environment variable is required"

- Make sure you've set the `FIREBASE_SERVICE_ACCOUNT` environment variable
- Verify the JSON is valid and properly escaped

### Error: "Failed to initialize Firebase"

- Check that your service account JSON is valid
- Verify the project ID matches "rel-form"
- Ensure Firestore is enabled in your Firebase project

### Error: "Form submission not found"

- Verify the collection name is exactly "formSubmissions" (case-sensitive)
- Check that documents exist in the collection

### No data showing in the frontend

- Check browser console for errors
- Verify backend logs for Firebase connection issues
- Ensure you're authenticated (check Authorization header)

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit service account credentials to version control**
2. **Use environment variables** for all sensitive data
3. **Restrict Firebase security rules** to prevent unauthorized access
4. **Use least privilege principle** - only grant necessary permissions
5. **Rotate service account keys** periodically

## Firebase Security Rules Example

Set up Firestore security rules to protect your data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /formSubmissions/{document=**} {
      // Only allow read access with proper authentication
      allow read: if request.auth != null;
      // Prevent writes from client (only allow from admin SDK)
      allow write: if false;
    }
  }
}
```

## API Endpoints

Once configured, the following endpoints are available:

- `GET /api/forms/submissions` - Get all form submissions
- `GET /api/forms/submissions/:id` - Get specific submission
- `GET /api/forms/count` - Get total count
- `GET /api/forms/search?field=email&value=example@email.com` - Search submissions

All endpoints require authentication via Bearer token.

