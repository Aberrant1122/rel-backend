const { pool } = require('../src/config/database');

const run = async () => {
    try {
        const arg = process.argv.find(a => a.startsWith('--userId='));
        if (!arg) {
            console.log('DEV ONLY: Provide --userId=<id>');
            process.exit(1);
        }
        const userId = parseInt(arg.split('=')[1], 10);
        if (!Number.isInteger(userId) || userId <= 0) {
            console.log('DEV ONLY: Invalid userId');
            process.exit(1);
        }

        console.log(`DEV ONLY: Assigning NULL google_oauth_tokens.user_id to ${userId}`);

        const [countRows] = await pool.execute(
            'SELECT COUNT(*) AS cnt FROM google_oauth_tokens WHERE user_id IS NULL'
        );
        const nullCount = countRows[0]?.cnt || 0;
        console.log(`DEV ONLY: Found ${nullCount} rows with user_id IS NULL`);

        if (nullCount === 0) {
            console.log('DEV ONLY: Nothing to update');
            process.exit(0);
        }

        const [result] = await pool.execute(
            'UPDATE google_oauth_tokens SET user_id = ? WHERE user_id IS NULL',
            [userId]
        );
        console.log(`DEV ONLY: Updated ${result.affectedRows} rows`);
        process.exit(0);
    } catch (error) {
        console.error('DEV ONLY: Failed to assign userId:', error.message);
        process.exit(1);
    }
};

run();

