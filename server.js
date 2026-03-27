require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { testConnection } = require('./src/config/database');
const MigrationRunner = require('./src/utils/migrationRunner');
const User = require('./src/models/User');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'https://rel-production-8166.up.railway.app',
    'https://rel-dashboard.vercel.app'
].filter(Boolean).map(o => o.replace(/\/$/, ''));

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        
        const normalized = origin.replace(/\/$/, '');
        
        // Check against allowed origins
        if (allowedOrigins.includes(normalized)) {
            return callback(null, true);
        }
        
        // Allow *.railway.app and *.vercel.app in production
        if (process.env.NODE_ENV === 'production') {
            if (normalized.match(/\.up\.railway\.app$/) || 
                normalized.match(/\.vercel\.app$/)) {
                return callback(null, true);
            }
        }
        
        console.log(`CORS blocked: ${origin} not in allowed origins:`, allowedOrigins);
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Public health check (no auth required)
app.get('/api/health', async (req, res) => {
    const health = {
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        database: 'unknown',
        migrations: 'unknown',
        google_oauth_table: 'unknown'
    };

    try {
        // Test database connection
        const dbConnected = await testConnection();
        health.database = dbConnected ? 'connected' : 'disconnected';

        if (dbConnected) {
            // Check if migrations table exists and get status
            try {
                const migrationRunner = new MigrationRunner();
                const status = await migrationRunner.getMigrationStatus();
                health.migrations = {
                    total: status.total,
                    executed: status.executed,
                    pending: status.pending
                };
            } catch (error) {
                health.migrations = 'error';
            }

            // Check if google_oauth_tokens table exists
            try {
                const { pool } = require('./src/config/database');
                const [rows] = await pool.execute(
                    "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'google_oauth_tokens'"
                );
                health.google_oauth_table = rows[0].count > 0 ? 'exists' : 'missing';
            } catch (error) {
                health.google_oauth_table = 'error';
            }
        }
    } catch (error) {
        health.database = 'error';
    }

    res.json(health);
});

// Emergency table creation endpoint for Railway
app.post('/api/emergency/create-tables', async (req, res) => {
    try {
        const { pool } = require('./src/config/database');

        // Create google_oauth_tokens table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS google_oauth_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                access_token TEXT NOT NULL,
                refresh_token TEXT NULL,
                scope TEXT NULL,
                token_type VARCHAR(50) NULL,
                expiry_date BIGINT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_google_oauth_user_id 
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_google_oauth_user_id (user_id),
                INDEX idx_google_oauth_expiry (expiry_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        res.json({
            success: true,
            message: 'Emergency tables created successfully',
            tables_created: ['google_oauth_tokens']
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to create emergency tables',
            error: error.message
        });
    }
});

// API Routes
app.use('/api', routes);
app.use('/', routes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'CRM Authentication API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            me: 'GET /api/auth/me',
            logout: 'POST /api/auth/logout',
            refreshToken: 'POST /api/auth/refresh-token'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// Initialize database and start server
const startServer = async () => {
    let migrationSuccess = false;

    try {
        // Test database connection with retries for Railway
        console.log('🔄 Testing database connection...');
        let dbConnected = false;
        let retries = 5;

        while (!dbConnected && retries > 0) {
            dbConnected = await testConnection();
            if (!dbConnected) {
                console.log(`⏳ Database not ready, retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                retries--;
            }
        }

        if (!dbConnected) {
            console.warn('⚠️  Database connection failed after retries. Starting server anyway...');
        } else {
            console.log('✅ Database connection established');

            // Run database migrations safely
            console.log('🔄 Running database migrations...');
            const migrationRunner = new MigrationRunner();
            try {
                await migrationRunner.runMigrations();
                migrationSuccess = true;
                console.log('✅ Database migrations completed successfully');
            } catch (error) {
                console.warn('⚠️  Migration failed:', error.message);
                console.warn('💡 Server will continue starting. Migrations can be run later.');
            }

            // Create legacy tables if migrations didn't run
            if (!migrationSuccess) {
                console.log('🔄 Creating legacy tables...');
                try {
                    await User.createTable();
                    await User.createRefreshTokensTable();

                    // Create WhatsApp/Lead tables
                    const Lead = require('./src/models/Lead');
                    await Lead.createTable();
                    await Lead.createMessagesTable();
                    await Lead.createTimelineTable();

                    // Create Tasks table
                    const Task = require('./src/models/Task');
                    await Task.createTable();

                    console.log('✅ Legacy tables created');
                } catch (tableError) {
                    console.warn('⚠️  Some tables may not be available:', tableError.message);
                }
            }

            // EMERGENCY: Ensure google_oauth_tokens table exists (Railway fix)
            console.log('🔄 Ensuring google_oauth_tokens table exists...');
            try {
                const { pool } = require('./src/config/database');
                await pool.execute(`
                    CREATE TABLE IF NOT EXISTS google_oauth_tokens (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL UNIQUE,
                        google_email VARCHAR(255) NOT NULL,
                        access_token TEXT NOT NULL,
                        refresh_token TEXT NULL,
                        scope TEXT NULL,
                        token_type VARCHAR(50) NULL,
                        expiry_date BIGINT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        CONSTRAINT fk_google_oauth_user_id 
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                        INDEX idx_google_oauth_user_id (user_id),
                        INDEX idx_google_oauth_expiry (expiry_date)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                `);
                console.log('✅ google_oauth_tokens table ensured');
            } catch (oauthTableError) {
                console.warn('⚠️  Could not create google_oauth_tokens table:', oauthTableError.message);
            }
        }

        // Start server regardless of migration status
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT}`);
            console.log(`📍 API URL: http://localhost:${PORT}`);
            console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
            console.log(`📊 Database: ${dbConnected ? '✅ Connected' : '❌ Not Connected'}`);
            console.log(`📊 Migrations: ${migrationSuccess ? '✅ Completed' : '⚠️  Pending'}`);
            console.log(`\n✅ Ready to accept requests\n`);
        });

    } catch (error) {
        console.error('❌ Server startup error:', error.message);
        // Don't exit - try to start server anyway for Railway
        app.listen(PORT, () => {
            console.log(`\n🚀 Server running on port ${PORT} (with errors)`);
            console.log(`⚠️  Some features may not work properly`);
            console.log(`💡 Check database configuration and run migrations manually\n`);
        });
    }
};

startServer();

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);
    
    try {
        const { closePool } = require('./src/config/database');
        await closePool();
        console.log('✅ Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error.message);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});
