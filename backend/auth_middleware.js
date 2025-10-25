// auth_middleware.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'uberfriends_secret_key'; // Must be the same secret as in auth_server.js

export const authenticateToken = (req, res, next) => {
    // Get the token from the Authorization header (e.g., "Bearer TOKEN_VALUE")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ error: 'No token provided' }); // Unauthorized
    }

    // Verify the token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token is invalid' }); // Forbidden
        }

        // Token is valid! Attach the user payload to the request object
        req.user = user; // This 'user' object is { userId: 1, email: '...' }
        next(); // Move on to the next function (the actual route handler)
    });
};