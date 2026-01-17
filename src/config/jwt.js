require('dotenv').config();

const jwtConfig = {
    accessToken: {
        secret: process.env.JWT_ACCESS_SECRET || 'your_access_token_secret',
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m'
    },
    refreshToken: {
        secret: process.env.JWT_REFRESH_SECRET || 'your_refresh_token_secret',
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d'
    }
};

module.exports = jwtConfig;
