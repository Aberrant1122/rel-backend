const { pool } = require('./src/config/database');
async function run() {
  try {
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'dispatcher', 'employee', 'driver', 'passenger', 'user') DEFAULT 'employee'");
    console.log('ALTERED successfully');
    
    // Also fix the users that got empty strings or weird roles
    await pool.query("UPDATE users SET role = 'dispatcher' WHERE role = ''");
    console.log('Fixed empty roles to dispatcher');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
