// backend_driver.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { pool } from './db.js';

const app = express();
const PORT = 8001;

app.use(cors());
app.use(bodyParser.json());

app.put('/drivers/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'available') {
        return res.status(400).json({ error: "Status can only be set to 'available'." });
    }

    try {
        await pool.query(
            "UPDATE drivers SET status = $1 WHERE id = $2",
            [status, id]
        );
        console.log(`Driver ${id} status updated to ${status}.`);
        res.status(200).json({ success: true, message: `You are now ${status}!` });
    } catch (e) {
        console.error("Error updating driver status:", e);
        res.status(500).json({ error: "Database error." });
    }
});

app.listen(PORT, () => console.log(`🚘 Driver Backend listening on port ${PORT}`));