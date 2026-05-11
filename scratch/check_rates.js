const { pool } = require('../src/config/database');
require('dotenv').config();

async function checkRates() {
    try {
        const [vehicles] = await pool.query(`
            SELECT v.id, v.slug, v.label, vp.base_rate, vp.per_mile, vp.per_hour 
            FROM vehicles v 
            JOIN vehicle_pricing vp ON v.id = vp.vehicle_id 
            WHERE v.slug = 'business-sedan'
        `);
        console.log('Vehicle Rates:', JSON.stringify(vehicles, null, 2));

        const [config] = await pool.query('SELECT * FROM form_rate_config WHERE id = 1');
        console.log('Rate Config:', JSON.stringify(config, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRates();
