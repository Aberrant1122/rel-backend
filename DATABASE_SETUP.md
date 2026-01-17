# Database Setup Guide

This guide will help you set up the MySQL database for the CRM backend.

# Database Setup Guide

This guide will help you set up the MySQL database for the CRM backend.

## Railway Deployment (Recommended)

### Using DATABASE_URL (Railway/Production)

Railway automatically provides a `DATABASE_URL` environment variable when you add a MySQL service.

1. **Add MySQL Service in Railway**
   - Go to your Railway project
   - Click "New" → "Database" → "Add MySQL"
   - Railway will automatically set `MYSQL_URL` variable

2. **Set Environment Variables**
   ```env
   DATABASE_URL=${{MYSQL_URL}}
   ```

3. **Deploy**
   - Your app will automatically use `DATABASE_URL`
   - Migrations run automatically on deployment

## Local Development Setup

### Option 1: Using DATABASE_URL (Recommended)

1. **Update .env file**
   ```env
   DATABASE_URL=mysql://root:@localhost:3307/fortune-crm
   ```

2. **Setup Database**
   ```bash
   npm run setup-db
   ```

### Option 2: Using XAMPP (Windows)

1. **Download and Install XAMPP**
   - Go to https://www.apachefriends.org/
   - Download XAMPP for Windows
   - Install and start the XAMPP Control Panel

2. **Start MySQL**
   - Open XAMPP Control Panel
   - Click "Start" next to MySQL
   - MySQL will run on port 3306 by default

3. **Update .env file**
   ```env
   DATABASE_URL=mysql://root:@localhost:3306/fortune-crm
   ```

4. **Setup Database**
   ```bash
   npm run setup-db
   ```

## Environment Variables Priority

The system uses this priority order:
1. **DATABASE_URL** (preferred for Railway/production)
2. **Individual variables** (fallback for local development)
   - DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT

## DATABASE_URL Format

```
mysql://username:password@host:port/database
```

Examples:
- Local: `mysql://root:@localhost:3306/fortune-crm`
- Railway: `mysql://root:password@containers-us-west-1.railway.app:3306/railway`

## Current Configuration

Your current .env file supports both approaches:
```env
# Primary (Railway/Production)
DATABASE_URL=mysql://root:@localhost:3307/fortune-crm

# Fallback (Local Development)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=fortune-crm
DB_PORT=3307
```

## Troubleshooting

### Error: Database connection failed

**Check if MySQL is running:**
```bash
# Windows (if using XAMPP)
# Open XAMPP Control Panel and start MySQL

# Or check if MySQL service is running
net start mysql
```

**Test connection manually:**
```bash
mysql -h localhost -P 3307 -u root -p
```

### Error: Access denied

1. **Check credentials in .env file**
2. **Reset MySQL root password if needed**
3. **Create a new MySQL user:**
   ```sql
   CREATE USER 'crm_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON fortune_crm.* TO 'crm_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Port 3307 vs 3306

If you're using port 3307, you might have:
- Multiple MySQL installations
- XAMPP configured for a different port
- MySQL running as a service on 3306

**To check what's running on port 3307:**
```bash
netstat -an | findstr 3307
```

## Migration Commands

Once database is set up:

```bash
# Check migration status
npm run migrate:status

# Run pending migrations
npm run migrate

# Create new migration
npm run create-migration "add_new_feature"

# Start server (runs migrations automatically)
npm start

# Start server without migrations
npm run start:force
```

## Database Schema

After migrations, you'll have these tables:
- `users` - User accounts
- `refresh_tokens` - JWT refresh tokens
- `leads` - Lead management
- `lead_messages` - WhatsApp messages
- `lead_timeline` - Lead activity timeline
- `tasks` - Task management
- `google_oauth_tokens` - Google OAuth credentials
- `meetings` - Calendar meetings
- `meeting_participants` - Meeting participants
- `schema_migrations` - Migration tracking

## Need Help?

1. **Check MySQL is running** on the correct port
2. **Verify .env credentials** match your MySQL setup
3. **Run setup-db** to create the database
4. **Check migration status** to see what's pending
5. **Start server** - migrations run automatically

For XAMPP users, the most common solution is changing DB_PORT to 3306 in your .env file.