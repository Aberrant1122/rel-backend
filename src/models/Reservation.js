const { pool } = require('../config/database');
const { generateReservationNumber } = require('../utils/reservationNumberGenerator');

class Reservation {
    /**
     * Create reservations table if not exists
     */
    static async createTable() {
        const query = `
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reservation_number VARCHAR(50) NOT NULL UNIQUE,
        booking_type ENUM('form', 'contract', 'manual') NOT NULL,
        trip_type ENUM('hourly', 'distance', 'contract') NOT NULL,
        
        -- Passenger Information
        passenger_id INT NOT NULL,
        passenger_name VARCHAR(255) NOT NULL,
        passenger_email VARCHAR(255) NOT NULL,
        passenger_phone VARCHAR(20) NOT NULL,
        
        -- Trip Details
        pickup_location TEXT NOT NULL,
        dropoff_location TEXT NOT NULL,
        pickup_date DATE NOT NULL,
        pickup_time TIME NOT NULL,
        vehicle_type_id INT NOT NULL,
        passenger_count INT DEFAULT 1,
        luggage_count INT DEFAULT 0,
        
        -- Booking Details
        price DECIMAL(10,2) NOT NULL,
        payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
        reservation_status ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        
        -- Assignment
        assigned_driver_id INT NULL,
        assigned_vehicle_id INT NULL,
        
        -- Contract specific
        contract_start_date DATE NULL,
        contract_end_date DATE NULL,
        daily_rate DECIMAL(10,2) NULL,
        hourly_rate DECIMAL(10,2) NULL,
        
        -- Metadata
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (passenger_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (vehicle_type_id) REFERENCES vehicles(id),
        FOREIGN KEY (assigned_driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id),
        
        INDEX idx_reservation_number (reservation_number),
        INDEX idx_passenger_id (passenger_id),
        INDEX idx_status (reservation_status),
        INDEX idx_pickup_date (pickup_date),
        INDEX idx_driver_id (assigned_driver_id),
        INDEX idx_booking_type (booking_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

        try {
            await pool.query(query);
            console.log('✅ Reservations table ready');
        } catch (error) {
            console.error('❌ Error creating reservations table:', error.message);
            throw error;
        }
    }

    /**
     * Create a new reservation
     */
    static async create(reservationData, createdBy) {
        const {
            booking_type,
            trip_type,
            passenger_id,
            passenger_name,
            passenger_email,
            passenger_phone,
            pickup_location,
            dropoff_location,
            pickup_date,
            pickup_time,
            vehicle_type_id,
            passenger_count = 1,
            luggage_count = 0,
            price,
            payment_status = 'pending',
            reservation_status = 'pending',
            assigned_driver_id = null,
            assigned_vehicle_id = null,
            contract_start_date = null,
            contract_end_date = null,
            daily_rate = null,
            hourly_rate = null
        } = reservationData;

        const reservation_number = generateReservationNumber();

        const query = `
            INSERT INTO reservations (
                reservation_number, booking_type, trip_type,
                passenger_id, passenger_name, passenger_email, passenger_phone,
                pickup_location, dropoff_location, pickup_date, pickup_time,
                vehicle_type_id, passenger_count, luggage_count, price,
                payment_status, reservation_status,
                assigned_driver_id, assigned_vehicle_id,
                contract_start_date, contract_end_date, daily_rate, hourly_rate,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await pool.query(query, [
            reservation_number, booking_type, trip_type,
            passenger_id, passenger_name, passenger_email, passenger_phone,
            pickup_location, dropoff_location, pickup_date, pickup_time,
            vehicle_type_id, passenger_count, luggage_count, price,
            payment_status, reservation_status,
            assigned_driver_id, assigned_vehicle_id,
            contract_start_date, contract_end_date, daily_rate, hourly_rate,
            createdBy
        ]);

        return await this.findById(result.insertId);
    }

    /**
     * Find reservation by ID
     */
    static async findById(id) {
        const query = `
            SELECT 
                r.*,
                v.vehicle_type, v.vehicle_code, v.passenger_capacity, v.luggage_capacity,
                v.hourly_rate as vehicle_hourly_rate, v.base_fare, v.per_mile_rate,
                d.id as driver_id,
                u_driver.name as driver_name,
                u_driver.phone as driver_phone,
                u_creator.name as created_by_name
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            LEFT JOIN drivers d ON r.assigned_driver_id = d.id
            LEFT JOIN users u_driver ON d.user_id = u_driver.id
            LEFT JOIN users u_creator ON r.created_by = u_creator.id
            WHERE r.id = ?
        `;

        const [rows] = await pool.query(query, [id]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Find reservation by number
     */
    static async findByNumber(reservationNumber) {
        const query = 'SELECT * FROM reservations WHERE reservation_number = ?';
        const [rows] = await pool.query(query, [reservationNumber]);
        return rows.length > 0 ? rows[0] : null;
    }

    /**
     * Get all reservations with filters and pagination
     */
    static async getAll(filters = {}, pagination = {}) {
        const { page = 1, limit = 10 } = pagination;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let queryParams = [];

        // Build WHERE clause
        if (filters.status) {
            whereConditions.push('r.reservation_status = ?');
            queryParams.push(filters.status);
        }

        if (filters.booking_type) {
            whereConditions.push('r.booking_type = ?');
            queryParams.push(filters.booking_type);
        }

        if (filters.passenger_id) {
            whereConditions.push('r.passenger_id = ?');
            queryParams.push(filters.passenger_id);
        }

        if (filters.driver_id) {
            whereConditions.push('r.assigned_driver_id = ?');
            queryParams.push(filters.driver_id);
        }

        if (filters.start_date && filters.end_date) {
            whereConditions.push('r.pickup_date BETWEEN ? AND ?');
            queryParams.push(filters.start_date, filters.end_date);
        } else if (filters.start_date) {
            whereConditions.push('r.pickup_date >= ?');
            queryParams.push(filters.start_date);
        } else if (filters.end_date) {
            whereConditions.push('r.pickup_date <= ?');
            queryParams.push(filters.end_date);
        }

        if (filters.search) {
            whereConditions.push('(r.passenger_name LIKE ? OR r.passenger_email LIKE ? OR r.passenger_phone LIKE ? OR r.reservation_number LIKE ?)');
            const searchTerm = `%${filters.search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereClause = whereConditions.length > 0 
            ? 'WHERE ' + whereConditions.join(' AND ') 
            : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM reservations r ${whereClause}`;
        const [countResult] = await pool.query(countQuery, queryParams);
        const total = countResult[0].total;

        // Get paginated results
        const dataQuery = `
            SELECT 
                r.*,
                v.vehicle_type, v.vehicle_code,
                d.id as driver_id,
                u_driver.name as driver_name
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            LEFT JOIN drivers d ON r.assigned_driver_id = d.id
            LEFT JOIN users u_driver ON d.user_id = u_driver.id
            ${whereClause}
            ORDER BY r.pickup_date DESC, r.pickup_time DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await pool.query(dataQuery, [...queryParams, parseInt(limit), parseInt(offset)]);

        return {
            data: rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Update reservation
     */
    static async update(id, updateData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'pickup_location', 'dropoff_location', 'pickup_date', 'pickup_time',
            'passenger_count', 'luggage_count', 'price', 'payment_status',
            'reservation_status', 'assigned_driver_id', 'assigned_vehicle_id'
        ];

        Object.keys(updateData).forEach(key => {
            if (allowedFields.includes(key)) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);

        const query = `UPDATE reservations SET ${fields.join(', ')} WHERE id = ?`;
        const [result] = await pool.query(query, values);

        return result.affectedRows > 0;
    }

    /**
     * Update reservation status
     */
    static async updateStatus(id, status) {
        const query = 'UPDATE reservations SET reservation_status = ? WHERE id = ?';
        const [result] = await pool.query(query, [status, id]);
        return result.affectedRows > 0;
    }

    /**
     * Assign driver to reservation
     */
    static async assignDriver(id, driverId) {
        const query = 'UPDATE reservations SET assigned_driver_id = ?, reservation_status = "assigned" WHERE id = ?';
        const [result] = await pool.query(query, [driverId, id]);
        return result.affectedRows > 0;
    }

    /**
     * Cancel reservation
     */
    static async cancel(id) {
        const query = 'UPDATE reservations SET reservation_status = "cancelled" WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    }

    /**
     * Get reservations by passenger
     */
    static async getByPassenger(passengerId, pagination = {}) {
        return await this.getAll({ passenger_id: passengerId }, pagination);
    }

    /**
     * Get reservations by driver
     */
    static async getByDriver(driverId, pagination = {}) {
        return await this.getAll({ driver_id: driverId }, pagination);
    }

    /**
     * Get reservation statistics
     */
    static async getStats() {
        // Total reservations
        const [total] = await pool.query('SELECT COUNT(*) as count FROM reservations');

        // Today's reservations
        const today = new Date().toISOString().split('T')[0];
        const [todayRes] = await pool.query(
            'SELECT COUNT(*) as count FROM reservations WHERE pickup_date = ?',
            [today]
        );

        // By status
        const [byStatus] = await pool.query(`
            SELECT reservation_status, COUNT(*) as count 
            FROM reservations 
            GROUP BY reservation_status
        `);

        // By booking type
        const [byType] = await pool.query(`
            SELECT booking_type, COUNT(*) as count 
            FROM reservations 
            GROUP BY booking_type
        `);

        // Recent reservations
        const [recent] = await pool.query(`
            SELECT 
                r.id, r.reservation_number, r.passenger_name,
                r.pickup_date, r.pickup_time, r.reservation_status,
                v.vehicle_type
            FROM reservations r
            LEFT JOIN vehicles v ON r.vehicle_type_id = v.id
            ORDER BY r.created_at DESC
            LIMIT 5
        `);

        return {
            total: total[0].count,
            today: todayRes[0].count,
            byStatus,
            byType,
            recent
        };
    }

    /**
     * Delete reservation
     */
    static async delete(id) {
        const query = 'DELETE FROM reservations WHERE id = ?';
        const [result] = await pool.query(query, [id]);
        return result.affectedRows > 0;
    }
}

module.exports = Reservation;