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
        let sql = await fs.readFile(filePath, 'utf8');

        console.log(`🔄 Executing migration: ${filename}`);

        // Check if file contains stored procedures or DELIMITER (needs special handling)
        const hasStoredProcedure = /DELIMITER|CREATE\s+PROCEDURE|DROP\s+PROCEDURE/i.test(sql);
        
        if (hasStoredProcedure) {
            // Handle DELIMITER changes for stored procedures
            // DELIMITER is a MySQL client command, not SQL. When using multipleStatements,
            // we need to replace the temporary delimiter ($$) with semicolons
            // and remove DELIMITER commands
            
            // Replace DELIMITER $$ ... DELIMITER ; pattern
            // First, replace procedure body delimiters ($$) with semicolons
            sql = sql.replace(/\$\$/g, ';');
            
            // Remove DELIMITER commands (they're client commands, not SQL)
            sql = sql.replace(/DELIMITER\s+[^\s;]+/gi, '');
            
            // Execute as multi-statement query
            try {
                // Remove comments that start with -- (but preserve -- inside strings)
                const lines = sql.split('\n');
                const cleanedLines = lines.map(line => {
                    // Only remove comments at the start of the line or after whitespace
                    // This is a simple approach - more complex parsing would handle string literals
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('--')) {
                        return '';
                    }
                    // Remove inline comments (simple approach)
                    const commentIndex = line.indexOf('--');
                    if (commentIndex >= 0 && !line.substring(0, commentIndex).includes("'")) {
                        return line.substring(0, commentIndex).trim();
                    }
                    return line;
                }).filter(line => line.length > 0);
                
                const cleanedSql = cleanedLines.join('\n');
                
                // Execute the entire SQL as a multi-statement query
                await pool.query({ sql: cleanedSql, multipleStatements: true });
            } catch (error) {
                console.error(`❌ Failed to execute migration ${filename}:`);
                console.error(`   Message: ${error.message}`);
                throw error;
            }
        } else {
            // Standard handling: Split SQL file by semicolons and execute each statement
            const statements = sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            for (const statement of statements) {
                const trimmedStatement = statement.trim();
                if (trimmedStatement) {
                    try {
                        await pool.query(trimmedStatement);
                    } catch (error) {
                        console.error(`❌ Failed to execute statement in ${filename}:`);
                        console.error(`SQL: ${trimmedStatement.substring(0, 100)}...`);
                        throw error;
                    }
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
            console.log('✅ No pending migrations (All up to date)');
            return;
        }

        console.log(`📋 Found ${pendingMigrations.length} pending migration(s): ${pendingMigrations.join(', ')}`);

        // Execute pending migrations
        for (const migration of pendingMigrations) {
            try {
                console.log(`🚀 Executing migration: ${migration}...`);
                await this.executeMigration(migration);
                console.log(`✅ Successfully applied: ${migration}`);
            } catch (error) {
                console.error(`❌ FATAL error executing migration ${migration}:`);
                console.error(`   Message: ${error.message}`);
                console.warn('⚠️  Migration process halted to prevent database inconsistency.');
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