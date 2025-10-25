// backend_driver.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { pool } from './db.js';
import { authenticateToken } from './auth_middleware.js'; // Import the middleware

const app = express();
const PORT = 8001;

app.use(cors());
app.use(bodyParser.json());

// The endpoint is now PROTECTED and more generic.
// A driver can only update THEIR OWN status.
app.put('/driver/status', authenticateToken, async (req, res) => {
    // We get the user ID from the token, not the URL parameter.
    const { userId } = req.user;
    const { status } = req.body;

    if (status !== 'available') {
        return res.status(400).json({ error: "Status can only be set to 'available'." });
    }

    try {
        // We update the driver's status by matching their user_id
        const result = await pool.query(
            "UPDATE drivers SET status = $1 WHERE user_id = $2",
            [status, userId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Driver profile not found for this user." });
        }

        console.log(`Driver (User ID: ${userId}) status updated to ${status}.`);
        res.status(200).json({ success: true, message: `You are now ${status}!` });
    } catch (e) {
        console.error("Error updating driver status:", e);
        res.status(500).json({ error: "Database error." });
    }
});

app.listen(PORT, () => console.log(`🚘 Driver Backend listening on port ${PORT}`));