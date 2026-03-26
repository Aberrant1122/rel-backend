const { pool } = require('../config/database');

class Vehicle {
    /**
     * Create vehicles table if not exists
     */
    static async createTable() {
        const query = `
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
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_vehicle_code (vehicle_code),
        INDEX idx_vehicle_type (vehicle_type),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

        try {
            await pool.query(query);
            console.log('✅ Vehicles table ready');
            
            // Insert sample vehicles if table is empty
            await this.insertSampleVehicles();
        } catch (error) {
            console.error('❌ Error creating vehicles table:', error.message);
            throw error;
        }
    }

    /**
     * Insert sample vehicles if table is empty
     */
    static async insertSampleVehicles() {
        try {
            const [rows] = await pool.query('SELECT COUNT(*) as count FROM vehicles');
            
            if (rows[0].count === 0) {
                const sampleVehicles = [
                    ['SED001', 'Sedan', 4, 2, 'Comfortable sedan for up to 4 passengers', 50.00, 25.00, 2.50, null, true],
                    ['SUV001', 'SUV', 6, 4, 'Spacious SUV with extra luggage space', 75.00, 35.00, 3.00, null, true],
                    ['VAN001', 'Van', 10, 8, 'Large van for groups', 100.00, 50.00, 4.00, null, true],
                    ['LUX001', 'Luxury Sedan', 4, 3, 'Premium luxury sedan', 120.00, 60.00, 5.00, null, true],
                    ['MINI001', 'Minivan', 7, 6, 'Family-friendly minivan', 85.00, 40.00, 3.50, null, true]
                ];

                const query = `
                    INSERT INTO vehicles (
                        vehicle_code, vehicle_type, passenger_capacity, luggage_capacity, 
                        description, hourly_rate, base_fare, per_mile_rate, image_url, is_active
                    ) VALUES ?
                `;

                await pool.query(query, [sampleVehicles]);
                console.log('✅ Sample vehicles inserted');
            }
        } catch (error) {
            console.error('❌ Error inserting sample vehicles:', error.message);
        }
    }

    /**
     * Find vehicle by ID
     */
    static async findById(id) {
        const query = 'SELECT * FROM vehicles WHERE id = ?';
        const [rows] = await pool.query(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find vehicle by code
     */
    static async findByCode(vehicleCode) {
        const query = 'SELECT * FROM vehicles WHERE vehicle_code = ?';
        const [rows] = await pool.query(query, [vehicleCode]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Get all active vehicles
     */
    static async getAllActive() {
        const query = 'SELECT * FROM vehicles WHERE is_active = true ORDER BY vehicle_type';
        const [rows] = await pool.query(query);
        return rows;
    }

    /**
     * Get all vehicles (with optional filters)
     */
    static async getAll(filters = {}) {
        let query = 'SELECT * FROM vehicles WHERE 1=1';
        const values = [];

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            values.push(filters.is_active);
        }

        if (filters.vehicle_type) {
            query += ' AND vehicle_type LIKE ?';
            values.push(`%${filters.vehicle_type}%`);
        }

        if (filters.min_capacity) {
            query += ' AND passenger_capacity >= ?';
            values.push(filters.min_capacity);
        }

        query += ' ORDER BY vehicle_type';

        const [rows] = await pool.query(query, values);
        return rows;
    }

    /**
     * Create new vehicle
     */
    static async create(vehicleData) {
        const {
            vehicle_code,
            vehicle_type,
            passenger_capacity,
            luggage_capacity,
            description,
            hourly_rate,
            base_fare,
            per_mile_rate,
            image_url,
            is_active = true
        } = vehicleData;

        const query = `
            INSERT INTO vehicles (
                vehicle_code, vehicle_type, passenger_capacity, luggage_capacity,
                description, hourly_rate, base_fare, per_mile_rate, image_url, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(query, [
            vehicle_code, vehicle_type, passenger_capacity, luggage_capacity,
            description, hourly_rate, base_fare, per_mile_rate, image_url, is_active
        ]);

        return await this.findById(result.insertId);
    }

    /**
     * Update vehicle
     */
    static async update(id, updateData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'vehicle_code', 'vehicle_type', 'passenger_capacity', 'luggage_capacity',
            'description', 'hourly_rate', 'base_fare', 'per_mile_rate', 'image_url', 'is_active'
        ];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);

        const query = `UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await pool.query(query, values);

        return result.affectedRows > 0;
    }

    /**
     * Delete vehicle (soft delete by setting is_active = false)
     */
    static async softDelete(id) {
        const query = 'UPDATE vehicles SET is_active = false WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Permanently delete vehicle
     */
    static async permanentDelete(id) {
        const query = 'DELETE FROM vehicles WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Get vehicle stats
     */
    static async getStats() {
        const [total] = await pool.query('SELECT COUNT(*) as count FROM vehicles');
        const [active] = await pool.query('SELECT COUNT(*) as count FROM vehicles WHERE is_active = true');
        const [byType] = await pool.query(`
            SELECT vehicle_type, COUNT(*) as count 
            FROM vehicles 
            WHERE is_active = true 
            GROUP BY vehicle_type
        `);

        return {
            total: total[0].count,
            active: active[0].count,
            byType
        };
    }
}

module.exports = Vehicle;