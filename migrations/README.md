# Database Migrations

This directory contains database migration files for the CRM backend.

## Migration System

The migration system automatically runs when you start the server with `npm start` or `npm run dev`. It ensures your database schema is up-to-date.

## Available Commands

### Run Migrations
```bash
npm run migrate
```
Executes all pending migrations.

### Check Migration Status
```bash
npm run migrate:status
```
Shows which migrations have been executed and which are pending.

### Create New Migration
```bash
npm run create-migration "migration_name"
```
Creates a new migration file with a timestamp prefix.

Example:
```bash
npm run create-migration "add_user_preferences_table"
```

## Migration Files

Migration files are named with the format: `YYYYMMDD_HHMMSS_migration_name.sql`

Each migration file should:
- Use `IF NOT EXISTS` for CREATE TABLE statements
- Include proper indexes for performance
- Use appropriate data types and constraints
- Include foreign key constraints where needed

## Migration Tracking

The system tracks executed migrations in the `schema_migrations` table. This ensures migrations are only run once.

## Existing Migrations

- `001_google_oauth_tables.sql` - Creates Google OAuth and meeting tables for calendar functionality

## Best Practices

1. **Always test migrations** on a development database first
2. **Use transactions** for complex migrations (wrap in BEGIN/COMMIT)
3. **Add indexes** for columns used in WHERE clauses
4. **Use foreign keys** to maintain data integrity
5. **Document changes** in the migration file comments
6. **Keep migrations small** and focused on a single change

## Rollback Strategy

Currently, the system doesn't support automatic rollbacks. If you need to rollback:
1. Create a new migration that reverses the changes
2. Or manually execute SQL to undo the changes
3. Remove the migration record from `schema_migrations` table if needed

## Server Integration

The migration system is integrated into the server startup process:
- `npm start` - Runs migrations then starts the server
- `npm run dev` - Runs migrations then starts the development server
- `npm run start:server` - Starts server without running migrations
- `npm run dev:server` - Starts dev server without running migrations