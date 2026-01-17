const fs = require('fs').promises;
const path = require('path');
const { pool, testConnection } = require('../config/database');

class MigrationRunner {
    constructor() {
        this.migrationsPath = path.join(__dirname, '../../migrations');
        this.migrationsTable = 'schema_migrations';
    }

    /**
     * Test database connection before running migrations
     */
    async ensureConnection() {
        let retries = 3;
        while (retries > 0) {
            const isConnected = await testConnection();
            if (isConnected) {
                return true;
            }
            console.log(`⏳ Database connection retry... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retries--;
        }
        throw new Error('Database connection failed after retries. Please check your DATABASE_URL configuration.');
    }

    /**
     * Create migrations tracking table
     */
    async createMigrationsTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_filename (filename)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `;
        
        await pool.execute(query);
        console.log('✅ Migrations table ready');
    }

    /**
     * Get list of executed migrations
     */
    async getExecutedMigrations() {
        try {
            const [rows] = await pool.execute(
                `SELECT filename FROM ${this.migrationsTable} ORDER BY filename`
            );
            return rows.map(row => row.filename);
        } catch (error) {
            // Table doesn't exist yet
            return [];
        }
    }

    /**
     * Get list of migration files
     */
    async getMigrationFiles() {
        try {
            const files = await fs.readdir(this.migrationsPath);
            return files
                .filter(file => file.endsWith('.sql'))
                .sort();
        } catch (error) {
            console.log('📁 No migrations directory found, creating...');
            await fs.mkdir(this.migrationsPath, { recursive: true });
            return [];
        }
    }

    /**
     * Execute a single migration file
     */
    async executeMigration(filename) {
        const filePath = path.join(this.migrationsPath, filename);
        const sql = await fs.readFile(filePath, 'utf8');
        
        // Split SQL file by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        console.log(`🔄 Executing migration: ${filename}`);
        
        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await pool.execute(statement);
                } catch (error) {
                    console.error(`❌ Failed to execute statement in ${filename}:`);
                    console.error(`SQL: ${statement.substring(0, 100)}...`);
                    throw error;
                }
            }
        }

        // Record migration as executed
        await pool.execute(
            `INSERT INTO ${this.migrationsTable} (filename) VALUES (?)`,
            [filename]
        );

        console.log(`✅ Migration completed: ${filename}`);
    }

    /**
     * Run all pending migrations
     */
    async runMigrations() {
        console.log('🚀 Starting database migrations...');
        
        // Test database connection first with retries
        try {
            await this.ensureConnection();
        } catch (error) {
            console.warn('⚠️  Database not ready for migrations:', error.message);
            throw error;
        }
        
        // Ensure migrations table exists
        try {
            await this.createMigrationsTable();
        } catch (error) {
            console.error('❌ Failed to create migrations table:', error.message);
            throw error;
        }
        
        // Get executed and available migrations
        const executedMigrations = await this.getExecutedMigrations();
        const migrationFiles = await this.getMigrationFiles();
        
        // Find pending migrations
        const pendingMigrations = migrationFiles.filter(
            file => !executedMigrations.includes(file)
        );

        if (pendingMigrations.length === 0) {
            console.log('✅ No pending migrations');
            return;
        }

        console.log(`📋 Found ${pendingMigrations.length} pending migration(s)`);
        
        // Execute pending migrations
        for (const migration of pendingMigrations) {
            try {
                await this.executeMigration(migration);
            } catch (error) {
                console.error(`❌ Migration failed: ${migration}`);
                console.error(`Error: ${error.message}`);
                throw error;
            }
        }

        console.log('🎉 All migrations completed successfully!');
    }

    /**
     * Check migration status
     */
    async getMigrationStatus() {
        // Test database connection first
        await this.ensureConnection();
        
        await this.createMigrationsTable();
        
        const executedMigrations = await this.getExecutedMigrations();
        const migrationFiles = await this.getMigrationFiles();
        
        const pendingMigrations = migrationFiles.filter(
            file => !executedMigrations.includes(file)
        );

        return {
            total: migrationFiles.length,
            executed: executedMigrations.length,
            pending: pendingMigrations.length,
            executedMigrations,
            pendingMigrations
        };
    }
}

module.exports = MigrationRunner;