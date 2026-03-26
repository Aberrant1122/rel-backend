// scripts/reset-and-migrate.js
const { pool } = require('../src/config/database');

async function resetAndMigrate() {
    console.log('🔄 Resetting database and running migrations...\n');

    try {
        // Drop tables in reverse dependency order
        console.log('Dropping existing tables...');
        const dropOrder = [
            'trips',
            'payments',
            'invoices',
            'reservations',
            'drivers',
            'vehicles',
            'schema_migrations'
        ];

        for (const table of dropOrder) {
            try {
                await pool.query(`DROP TABLE IF EXISTS ${table}`);
                console.log(`✅ Dropped ${table}`);
            } catch (err) {
                console.log(`⚠️  Could not drop ${table}: ${err.message}`);
            }
        }

        console.log('\n🚀 Creating tables in correct order...');

        // 1. Create schema_migrations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created schema_migrations');

        // 2. Create vehicles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS vehicles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                vehicle_code VARCHAR(50) NOT NULL UNIQUE,
                vehicle_type VARCHAR(100) NOT NULL,
                passenger_capacity INT NOT NULL,
                luggage_capacity INT NOT NULL,
                description TEXT,
                hourly_rate DECIMAL(10,2),
                base_fare DECIMAL(10,2),
                per_mile_rate DECIMAL(10,2),
                image_url VARCHAR(255),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created vehicles');
        await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES (?)',
            ['016_create_vehicles_table.sql']
        );

        // 3. Create drivers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS drivers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL UNIQUE,
                license_number VARCHAR(100),
                license_expiry DATE,
                vehicle_id INT,
                status ENUM('available', 'on_trip', 'off_duty', 'inactive') DEFAULT 'available',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ Created drivers');
        await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES (?)',
            ['017_create_drivers_table.sql']
        );

        // 4. Create reservations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                reservation_number VARCHAR(50) NOT NULL UNIQUE,
                booking_type ENUM('form', 'contract', 'manual') NOT NULL,
                trip_type ENUM('hourly', 'distance', 'contract') NOT NULL,
                passenger_id INT NOT NULL,
                passenger_name VARCHAR(255) NOT NULL,
                passenger_email VARCHAR(255) NOT NULL,
                passenger_phone VARCHAR(20) NOT NULL,
                pickup_location TEXT NOT NULL,
                dropoff_location TEXT NOT NULL,
                pickup_date DATE NOT NULL,
                pickup_time TIME NOT NULL,
                vehicle_type_id INT NOT NULL,
                passenger_count INT DEFAULT 1,
                luggage_count INT DEFAULT 0,
                price DECIMAL(10,2) NOT NULL,
                payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
                reservation_status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
                assigned_driver_id INT NULL,
                assigned_vehicle_id INT NULL,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (passenger_id) REFERENCES users(id),
                FOREIGN KEY (vehicle_type_id) REFERENCES vehicles(id),
                FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
                FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
                FOREIGN KEY (created_by) REFERENCES users(id)
            )
        `);
        console.log('✅ Created reservations');
        await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES (?)',
            ['018_create_reservations_table.sql']
        );

        // Insert sample vehicles
        await pool.query(`
            INSERT IGNORE INTO vehicles (vehicle_code, vehicle_type, passenger_capacity, luggage_capacity, hourly_rate, base_fare, per_mile_rate)
            VALUES 
                ('SED001', 'Sedan', 4, 2, 50.00, 25.00, 2.50),
                ('SUV001', 'SUV', 6, 4, 75.00, 35.00, 3.00),
                ('VAN001', 'Van', 10, 8, 100.00, 50.00, 4.00)
        `);
        console.log('✅ Sample vehicles inserted');

        console.log('\n📊 Final table status:');
        const [tables] = await pool.query(`
            SELECT TABLE_NAME, TABLE_ROWS 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
        `);
        console.table(tables);

        console.log('\n🎉 Database reset and migration complete!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        process.exit(0);
    }
}

resetAndMigrate();