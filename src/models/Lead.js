const { pool } = require('../config/database');

class Lead {
    /**
     * Create leads table if it doesn't exist
     */
    static async createTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS leads (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255),
                phone VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(255),
                stage ENUM('New', 'Incoming', 'Contacted', 'Qualified', 'Proposal', 'Second Wing', 'Won', 'Lost') DEFAULT 'New',
                source ENUM('WhatsApp', 'Website', 'Referral', 'Cold Call', 'Email', 'Social Media', 'Other') DEFAULT 'WhatsApp',
                last_message TEXT,
                last_message_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_phone (phone),
                INDEX idx_stage (stage),
                INDEX idx_source (source),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        try {
            await pool.query(createTableQuery);
            console.log('✅ Leads table ready');
            return true;
        } catch (error) {
            console.error('❌ Error creating leads table:', error.message);
            throw error;
        }
    }

    /**
     * Create messages table for storing WhatsApp message history
     */
    static async createMessagesTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS lead_messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lead_id INT NOT NULL,
                message_id VARCHAR(255),
                direction ENUM('inbound', 'outbound') NOT NULL,
                message_text TEXT NOT NULL,
                message_type VARCHAR(50) DEFAULT 'text',
                status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
                INDEX idx_lead_id (lead_id),
                INDEX idx_message_id (message_id),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        try {
            await pool.query(createTableQuery);
            console.log('✅ Lead messages table ready');
            return true;
        } catch (error) {
            console.error('❌ Error creating lead_messages table:', error.message);
            throw error;
        }
    }

    /**
     * Create timeline table for tracking all lead activities
     */
    static async createTimelineTable() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS lead_timeline (
                id INT AUTO_INCREMENT PRIMARY KEY,
                lead_id INT NOT NULL,
                event_type ENUM('message_received', 'message_sent', 'stage_changed', 'note_added', 'call_made', 'email_sent') NOT NULL,
                description TEXT NOT NULL,
                metadata JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
                INDEX idx_lead_id (lead_id),
                INDEX idx_event_type (event_type),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;

        try {
            await pool.query(createTableQuery);
            console.log('✅ Lead timeline table ready');
            return true;
        } catch (error) {
            console.error('❌ Error creating lead_timeline table:', error.message);
            throw error;
        }
    }

    /**
     * Find lead by phone number
     */
    static async findByPhone(phone) {
        const query = 'SELECT * FROM leads WHERE phone = ?';
        const [rows] = await pool.query(query, [phone]);
        return rows[0] || null;
    }

    /**
     * Create a new lead
     */
    static async create(leadData) {
        const { name, phone, email, stage = 'Incoming', source = 'WhatsApp', last_message } = leadData;
        
        const query = `
            INSERT INTO leads (name, phone, email, stage, source, last_message, last_message_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;
        
        const [result] = await pool.query(query, [name, phone, email, stage, source, last_message]);
        return result.insertId;
    }

    /**
     * Update existing lead
     */
    static async update(id, updateData) {
        const fields = [];
        const values = [];

        if (updateData.name !== undefined) {
            fields.push('name = ?');
            values.push(updateData.name);
        }
        if (updateData.email !== undefined) {
            fields.push('email = ?');
            values.push(updateData.email);
        }
        if (updateData.stage !== undefined) {
            fields.push('stage = ?');
            values.push(updateData.stage);
        }
        if (updateData.last_message !== undefined) {
            fields.push('last_message = ?');
            values.push(updateData.last_message);
            fields.push('last_message_at = NOW()');
        }

        if (fields.length === 0) return false;

        values.push(id);
        const query = `UPDATE leads SET ${fields.join(', ')} WHERE id = ?`;
        
        const [result] = await pool.query(query, values);
        return result.affectedRows > 0;
    }

    /**
     * Add message to lead's message history
     */
    static async addMessage(leadId, messageData) {
        const { message_id, direction, message_text, message_type = 'text', status = 'sent' } = messageData;
        
        const query = `
            INSERT INTO lead_messages (lead_id, message_id, direction, message_text, message_type, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await pool.query(query, [leadId, message_id, direction, message_text, message_type, status]);
        return result.insertId;
    }

    /**
     * Add timeline entry
     */
    static async addTimelineEntry(leadId, timelineData) {
        const { event_type, description, metadata = null } = timelineData;
        
        const query = `
            INSERT INTO lead_timeline (lead_id, event_type, description, metadata)
            VALUES (?, ?, ?, ?)
        `;
        
        const metadataJson = metadata ? JSON.stringify(metadata) : null;
        const [result] = await pool.query(query, [leadId, event_type, description, metadataJson]);
        return result.insertId;
    }

    /**
     * Get lead with messages and timeline
     */
    static async getLeadWithDetails(leadId) {
        const leadQuery = 'SELECT * FROM leads WHERE id = ?';
        const messagesQuery = 'SELECT * FROM lead_messages WHERE lead_id = ? ORDER BY created_at DESC';
        const timelineQuery = 'SELECT * FROM lead_timeline WHERE lead_id = ? ORDER BY created_at DESC';

        const [leadRows] = await pool.query(leadQuery, [leadId]);
        const [messages] = await pool.query(messagesQuery, [leadId]);
        const [timeline] = await pool.query(timelineQuery, [leadId]);

        if (leadRows.length === 0) return null;

        return {
            ...leadRows[0],
            messages,
            timeline
        };
    }

    /**
     * Get all leads with pagination
     */
    static async getAll(page = 1, limit = 50, filters = {}) {
        const offset = (page - 1) * limit;
        let query = 'SELECT * FROM leads';
        const conditions = [];
        const values = [];

        if (filters.stage) {
            conditions.push('stage = ?');
            values.push(filters.stage);
        }
        if (filters.source) {
            conditions.push('source = ?');
            values.push(filters.source);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
        values.push(limit, offset);

        const [rows] = await pool.query(query, values);
        
        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM leads';
        if (conditions.length > 0) {
            countQuery += ' WHERE ' + conditions.join(' AND ');
        }
        const [countRows] = await pool.query(countQuery, values.slice(0, -2));

        return {
            leads: rows,
            total: countRows[0].total,
            page,
            limit,
            totalPages: Math.ceil(countRows[0].total / limit)
        };
    }
}

module.exports = Lead;
