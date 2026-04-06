const { pool } = require('./src/config/database');
async function run() {
  try {
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'team', 'employee', 'driver', 'passenger', 'user') DEFAULT 'employee'");
    console.log('ALTERED successfully');
    
    // Also fix the users that got empty strings or weird roles
    await pool.query("UPDATE users SET role = 'team' WHERE role = ''");
    console.log('Fixed empty roles to team');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
