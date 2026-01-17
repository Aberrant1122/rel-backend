# Backend (Node.js) — CRM API

This backend powers the CRM application with authentication, Google OAuth binding, Google Calendar integration, leads and tasks management, analytics, pipeline, dashboard, and WhatsApp webhook/operations.

## Quick Start

- Install dependencies: `npm install`
- Configure environment: create `.env` with the variables below
- Start server: `npm start` (or `npm run dev`)
- Base URL: `http://localhost:${PORT}/api` (default: `http://localhost:5000/api`)

## Tech Stack

- Node.js, Express
- MySQL (`mysql2`)
- JWT auth (`jsonwebtoken`)
- Google APIs (`googleapis`)
- Validation (`express-validator`)
- CORS, cookies

## Environment Variables

- Server
  - `PORT`
  - `NODE_ENV`
  - `FRONTEND_URL`
- Database
  - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
- JWT
  - `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRY`
  - `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRY`
- Google OAuth
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- WhatsApp Cloud API
  - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_BUSINESS_ID`

## Server Entrypoint

- `server.js` mounts `app.use('/api', routes)` and includes:
  - Health check at `/api/health`
  - Request logging
  - Global error handling
  - MySQL connection test and table initialization (users, leads, tasks)

## Authentication

- JWT access and refresh tokens
- Routes
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET  /api/auth/me` (requires `Authorization: Bearer <token>`)
  - `POST /api/auth/logout`
  - `POST /api/auth/refresh-token`
- Middleware
  - `src/middleware/authMiddleware.js` attaches `req.user = { id, email, role }`
  - `src/middleware/roleMiddleware.js` enforces role-based access

## Google OAuth + Calendar

- Endpoints
  - `GET  /api/auth/google` — Initiates OAuth; requires auth; includes `state` with `req.user.id`
  - `GET  /api/auth/google/callback` — Handles callback; parses `state.userId`; saves tokens for that user
  - `GET  /api/auth/google/status` — Connection status for the authenticated user
  - `POST /api/auth/google/disconnect` — Disconnect (delete tokens) for the authenticated user
- Implementation
  - Controller: `src/controllers/googleOAuthController.js` (init and callback)
  - Service: `src/services/googleOAuthService.js` (token exchange, user info, storage, refresh, retrieval)
- Token storage
  - Table: `google_oauth_tokens` with `user_id`, `google_email`, `access_token`, `refresh_token`, `token_type`, `scope`, `expiry_date`
  - Upsert logic: insert or update existing `(user_id, google_email)` without overwriting a non-null refresh token
- Calendar
  - Routes (auth required): `src/routes/calendarRoutes.js`
    - `POST /api/calendar/meeting`
    - `GET  /api/calendar/meetings?date=YYYY-MM-DD&timeZone=...`
    - `GET  /api/calendar/meeting/:eventId`
    - `DELETE /api/calendar/meeting/:eventId`
  - Service: `src/services/googleCalendarService.js` creates events with Meet links, lists, gets, deletes using `getAuthenticatedClient(userId)`
- Errors and safety
  - If no tokens for user: calendar controller returns `400` "Google account not connected. Please connect your Google account."
  - Refresh tokens are used to refresh expired access tokens automatically
- Security
  - Uses OAuth user-consent flow only
  - No service accounts
  - Does not store authorization codes

## Leads and Tasks

- Leads Routes (auth required)
  - `POST /api/leads`
  - `GET  /api/leads`
  - `GET  /api/leads/:id`
  - `PUT  /api/leads/:id`
  - `DELETE /api/leads/:id`
- Tasks Routes (auth required)
  - `GET    /api/tasks`
  - `GET    /api/tasks/:id`
  - `POST   /api/tasks`
  - `PUT    /api/tasks/:id`
  - `PATCH  /api/tasks/:id/status`
  - `DELETE /api/tasks/:id`

## Pipeline, Dashboard, Analytics

- Pipeline (auth required)
  - `GET /api/pipeline`
  - `PATCH /api/pipeline/leads/:id/stage`
  - `GET /api/pipeline/stats`
- Dashboard (auth required)
  - `GET /api/dashboard/stats`
  - `GET /api/dashboard/kpis`
  - `GET /api/dashboard/pipeline-overview`
  - `GET /api/dashboard/upcoming-tasks`
- Analytics (auth required)
  - Trend and performance endpoints under `/api/analytics/*`

## WhatsApp Integration

- Webhook
  - `GET  /api/webhook/whatsapp` — Verification
  - `POST /api/webhook/whatsapp` — Events/messages
- Send message
  - `POST /api/whatsapp/send`
- Ensure environment variables are set and webhook is configured in Meta Developer Portal

## Database

- The server initializes core tables if missing (users, leads, tasks)
- Google tokens table supports indexing and upsert; cascade deletes when user is removed
- Set `DB_*` variables in `.env` and ensure MySQL is running

## Error Handling

- Standard JSON responses:
  - Success: `{ success: true, message, data? }`
  - Error: `{ success: false, message, errors? }`
- Logged with consistent prefixes, e.g. `[GoogleOAuthController]`, `[GoogleOAuth]`, `[CalendarController]`

## Development and Scripts

- `npm start` — run server
- `npm run dev` — run with nodemon
- Test scripts:
  - `node test-api.js` — basic API verification
  - `node test-analytics-pipeline.js` — pipeline/analytics checks
  - `node test-whatsapp.js` — WhatsApp config and DB connectivity

## OAuth Flow Summary

- User logs in → clicks "Connect Google"
- `GET /api/auth/google` builds state as `JSON.stringify({ userId })` and redirects to Google
- Google redirects to callback with `code` and `state`
- Callback validates and parses `state` → exchanges `code` for tokens → saves tokens bound to `userId`
- Calendar services use `userId` to retrieve tokens and perform operations

## Troubleshooting

- "Google account not connected": connect via `/api/auth/google`; ensure callback saves tokens for your user
- "Failed to refresh access token": reconnect Google account to issue a new refresh token
- 401/403 on calendar: check token validity and scopes; ensure auth header is set
- DB errors: verify `.env` and that MySQL is running; check table existence

## Security Notes

- No service accounts are used for Google APIs
- Secrets are not logged
- JWT secrets should be rotated and kept out of version control

