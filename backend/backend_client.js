// backend_client.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { pool } from './db.js';

const app = express();
const PORT = 8000;

app.use(cors());
app.use(bodyParser.json());

app.post('/book-ride', async (req, res) => {
    const { user_id, user_name, source_location, dest_location } = req.body;
    if (!user_id || !source_location || !dest_location) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        const result = await pool.query(
            "INSERT INTO ride_requests (user_id, user_name, source_location, dest_location, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id",
            [user_id, user_name, source_location, dest_location]
        );
        const rideId = result.rows[0].id;
        console.log(`Ride request ${rideId} from user ${user_id} queued.`);
        res.status(202).json({ success: true, message: "Request received, finding a driver.", ride_id: rideId });
    } catch (e) {
        console.error("Error booking ride:", e);
        res.status(500).json({ error: "Database error." });
    }
});

app.listen(PORT, () => console.log(`🚕 Client Backend listening on port ${PORT}`));