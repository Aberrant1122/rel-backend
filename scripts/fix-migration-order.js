// scripts/fix-migration-order.js
const { pool } = require('../src/config/database');
const fs = require('fs').promises;
const path = require('path');

async function fixMigrationOrder() {
    console.log('🔧 Fixing migration order...\n');

    try {
        // 1. Check current migration status
        console.log('📊 Current migration status:');
        const [executed] = await pool.query(
            'SELECT filename FROM schema_migrations ORDER BY filename'
        );
        console.log('Executed migrations:', executed.map(e => e.filename));

        // 2. Check what tables exist
        const [tables] = await pool.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
        `);
        console.log('\n📋 Existing tables:', tables.map(t => t.TABLE_NAME));

        // 3. Define correct order based on dependencies
        const correctOrder = [
            '015_create_attendance_table.sql',
            '016_create_vehicles_table.sql',     // No dependencies
            '017_create_drivers_table.sql',      // Depends on users, vehicles
            '018_create_reservations_table.sql', // Depends on users, vehicles, drivers
            '019_create_trips_table.sql',        // Depends on reservations, drivers, vehicles
            '020_create_payments_table.sql',     // Depends on reservations
            '021_create_invoices_table.sql'      // Depends on reservations, users
        ];

        // 4. Check if vehicles table exists
        const [vehiclesExist] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles'
        `);

        if (vehiclesExist[0].count === 0) {
            console.log('\n❌ Vehicles table missing! Creating it now...');
            
            // Create vehicles table directly
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
            console.log('✅ Vehicles table created');
            
            // Insert sample vehicles
            await pool.query(`
                INSERT IGNORE INTO vehicles (vehicle_code, vehicle_type, passenger_capacity, luggage_capacity, hourly_rate, base_fare, per_mile_rate)
                VALUES 
                    ('SED001', 'Sedan', 4, 2, 50.00, 25.00, 2.50),
                    ('SUV001', 'SUV', 6, 4, 75.00, 35.00, 3.00),
                    ('VAN001', 'Van', 10, 8, 100.00, 50.00, 4.00)
            `);
            console.log('✅ Sample vehicles inserted');

            // Mark migration as executed
            await pool.query(
                'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
                ['016_create_vehicles_table.sql']
            );
            console.log('✅ Migration recorded in schema_migrations');
        }

        // 5. Now try to create drivers table
        console.log('\n🚀 Creating drivers table...');
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
        console.log('✅ Drivers table created');

        // Mark drivers migration
        await pool.query(
            'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
            ['017_create_drivers_table.sql']
        );

        // 6. Create remaining tables
        console.log('\n🚀 Creating reservations table...');
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
        console.log('✅ Reservations table created');
        await pool.query(
            'INSERT IGNORE INTO schema_migrations (filename) VALUES (?)',
            ['018_create_reservations_table.sql']
        );

        // 7. Verify all tables
        console.log('\n📊 Final table status:');
        const [finalTables] = await pool.query(`
            SELECT 
                TABLE_NAME, 
                TABLE_ROWS
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE()
            ORDER BY TABLE_NAME
        `);
        console.table(finalTables);

        console.log('\n🎉 Migration fix completed successfully!');

    } catch (error) {
        console.error('❌ Error fixing migrations:', error);
    } finally {
        process.exit(0);
    }
}

fixMigrationOrder();