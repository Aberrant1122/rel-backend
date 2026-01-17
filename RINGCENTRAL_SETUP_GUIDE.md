# RingCentral Integration Setup Guide

## 1. Prerequisites
- RingCentral Developer Account (https://developers.ringcentral.com/)
- Node.js Backend with Express

## 2. Environment Variables
Add these to your `.env` file in `REL-backend`:

```env
# RingCentral Configuration
RINGCENTRAL_CLIENT_ID=your_client_id_here
RINGCENTRAL_CLIENT_SECRET=your_client_secret_here
RINGCENTRAL_SERVER_URL=https://platform.devtest.ringcentral.com # Use https://platform.ringcentral.com for production
RINGCENTRAL_REDIRECT_URI=http://localhost:5000/api/auth/ringcentral/callback
```

## 3. Database Migration
Run the table creation script:
```bash
node scripts/create-ringcentral-table.js
```

## 4. API Endpoints

### Authentication
- `GET /api/auth/ringcentral`: Initiates OAuth flow (redirects to RingCentral)
- `GET /api/auth/ringcentral/callback`: Callback URL (handled automatically)
- `GET /api/auth/ringcentral/status`: Check connection status
- `POST /api/auth/ringcentral/disconnect`: Disconnect account

### Usage Usage (Service Layer)
The `src/services/ringCentralService.js` provides methods to interact with the API:
- `getAuthenticatedPlatform(userId)`: Returns an authenticated SDK platform instance.

Example usage in a new controller:
```javascript
const rcService = require('../services/ringCentralService');

const sendSms = async (req, res) => {
    const platform = await rcService.getAuthenticatedPlatform(req.user.id);
    await platform.post('/restapi/v1.0/account/~/extension/~/sms', {
        from: { phoneNumber: '+1234567890' },
        to: [{ phoneNumber: '+1987654321' }],
        text: 'Hello from REL CRM!'
    });
};
```

## 5. Frontend Integration
1. Add a "Connect RingCentral" button pointing to `http://localhost:5000/api/auth/ringcentral`.
2. Handle the redirect back to your app (example: `/settings?rc=connected`).

## 6. Testing
1. Set up the `.env` variables.
2. Start the backend (`npm run dev`).
3. Navigate to `http://localhost:5000/api/auth/ringcentral` in your browser.
4. Login with RingCentral credentials.
5. You should be redirected to the frontend settings page.
