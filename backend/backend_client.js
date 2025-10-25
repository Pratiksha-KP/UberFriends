import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { pool } from './db.js';
import fetch from 'node-fetch';
import { authenticateToken } from './auth_middleware.js'; // Import the middleware

const app = express();
const PORT = 8000;
const NOTIFY_SERVER_URL = 'http://localhost:9000/send-notification';

app.use(cors());
app.use(bodyParser.json());

// ===========================================
// == REMOVED AUTHENTICATION ENDPOINTS ==
// ===========================================
//
// /users/register and /users/login have been removed.
// Your auth_server.js (port 7000) now handles this.
//
// ===========================================

// ===========================================
// == STANDARD RIDE BOOKING ENDPOINT ==
// ===========================================

// This route is now protected. Only logged-in users can book.
app.post('/book-ride', authenticateToken, async (req, res) => {
    // We get user info from the token, not the body
    const { userId, name } = req.user; // 'name' might not be in your token, let's get it
    const { source_location, dest_location } = req.body;

    if (!source_location || !dest_location) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    try {
        // Fetch user's name from DB for a friendlier experience
        const userRes = await pool.query("SELECT name FROM users WHERE id = $1", [userId]);
        const user_name = userRes.rows[0]?.name || 'User';

        const result = await pool.query(
            "INSERT INTO ride_requests (user_id, user_name, source_location, dest_location, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id",
            [userId, user_name, source_location, dest_location]
        );
        const rideId = result.rows[0].id;

        console.log(`(Standard Ride) Request ${rideId} from user ${userId} queued.`);
        res.status(202).json({ success: true, message: "Request received, finding a driver.", ride_id: rideId });
    } catch (e) {
        console.error("Error booking standard ride:", e);
        res.status(500).json({ error: "Database error." });
    }
});

// ===========================================
// == "BOOK WITH FRIENDS" ENDPOINTS ==
// ===========================================

// All these routes are now protected by the authenticateToken middleware.

app.post('/meetups/create', authenticateToken, async (req, res) => {
    // The organizer is the authenticated user
    const { userId: organizer_id } = req.user;
    const { meetup_location, invitee_usernames } = req.body;
    
    if (!meetup_location || !invitee_usernames || invitee_usernames.length === 0) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Get organizer's name
        const orgRes = await client.query("SELECT name FROM users WHERE id = $1", [organizer_id]);
        const organizer_name = orgRes.rows[0].name;

        // Step 1: Create the meetup
        const meetupRes = await client.query(
            "INSERT INTO meetups (organizer_id, meetup_location, status) VALUES ($1, $2, 'pending') RETURNING id",
            [organizer_id, meetup_location]
        );
        const meetup_id = meetupRes.rows[0].id;

        // Step 2: Find user IDs for all invitees
        const userRes = await client.query(
            "SELECT id FROM users WHERE email = ANY($1::varchar[])", // Using email as it's unique
            [invitee_usernames] // Assuming 'invitee_usernames' is actually an array of emails
        );
        const invitees = userRes.rows;

        if (invitees.length === 0) {
            throw new Error("No valid users found for invitation.");
        }

        // Step 3: Create an invite for each user
        const invitePromises = invitees.map(invitee => {
            return client.query(
                "INSERT INTO meetup_invites (meetup_id, invitee_id, status) VALUES ($1, $2, 'pending')",
                [meetup_id, invitee.id]
            );
        });
        await Promise.all(invitePromises);
        await client.query('COMMIT');

        // Step 4: Send notifications
        const notifyPromises = invitees.map(invitee => {
            return fetch(NOTIFY_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetId: `client_${invitee.id}`,
                    payload: { 
                        type: 'new_meetup_invite', 
                        message: `You have a new meetup invite from ${organizer_name}!`,
                        meetup_id: meetup_id,
                        organizer_name: organizer_name
                    }
                })
            });
        });
        await Promise.all(notifyPromises);

        console.log(`Meetup ${meetup_id} created by user ${organizer_id}.`);
        res.status(201).json({ success: true, message: "Meetup created and invites sent!", meetup_id });

    } catch (e) {
        await client.query('ROLLBACK');
        console.error("Error creating meetup:", e);
        res.status(500).json({ error: "Database error.", details: e.message });
    } finally {
        client.release();
    }
});

// Gets all pending invites for the logged-in user
app.get('/meetups/invites', authenticateToken, async (req, res) => {
    const { userId } = req.user; // Get user ID from the token

    try {
        const invites = await pool.query(
            `SELECT mi.id as invite_id, m.meetup_location, u.name as organizer_name
             FROM meetup_invites mi
             JOIN meetups m ON mi.meetup_id = m.id
             JOIN users u ON m.organizer_id = u.id
             WHERE mi.invitee_id = $1 AND mi.status = 'pending'`,
            [userId]
        );
        res.status(200).json({ success: true, invites: invites.rows });
    } catch (e) {
        console.error("Error fetching invites:", e);
        res.status(500).json({ error: "Database error." });
    }
});

// Allows an invitee to respond to an invite.
app.post('/meetups/invites/:invite_id/respond', authenticateToken, async (req, res) => {
    const { invite_id } = req.params;
    const { userId, email } = req.user; // Get user from token
    const { response, source_location } = req.body; 

    if (response === 'accepted' && !source_location) {
        return res.status(400).json({ error: "Source location is required to accept." });
    }

    try {
        // Verify this user is the correct invitee
        const inviteCheck = await pool.query("SELECT * FROM meetup_invites WHERE id = $1 AND invitee_id = $2", [invite_id, userId]);
        if(inviteCheck.rows.length === 0) {
            return res.status(403).json({ error: "You are not authorized to respond to this invite." });
        }

        if (response === 'rejected') {
            await pool.query("UPDATE meetup_invites SET status = 'rejected' WHERE id = $1", [invite_id]);
            return res.status(200).json({ success: true, message: "Invite rejected." });
        }

        // --- Handle ACCEPTED response ---
        const { meetup_id } = inviteCheck.rows[0];

        // Step 1: Update the invite
        await pool.query(
            "UPDATE meetup_invites SET status = 'accepted', invitee_source_location = $1 WHERE id = $2",
            [source_location, invite_id]
        );

        // Step 2: Get meetup's destination & user's name
        const meetupRes = await pool.query("SELECT meetup_location FROM meetups WHERE id = $1", [meetup_id]);
        const userRes = await pool.query("SELECT name FROM users WHERE id = $1", [userId]);
        const dest_location = meetupRes.rows[0].meetup_location;
        const user_name = userRes.rows[0].name;

        // Step 3: Create the ride request
        const rideResult = await pool.query(
            "INSERT INTO ride_requests (user_id, user_name, source_location, dest_location, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id",
            [userId, user_name, source_location, dest_location]
        );
        const rideId = rideResult.rows[0].id;
        
        console.log(`(Meetup Ride) Request ${rideId} from user ${userId} queued.`);
        res.status(202).json({ 
            success: true, 
            message: "Invite accepted! Your ride to the meetup is being booked.", 
            ride_id: rideId 
        });

    } catch (e) {
        console.error("Error responding to invite:", e);
        res.status(500).json({ error: "Database error." });
    }
});

// ===========================================
// == START SERVER ==
// ===========================================

app.listen(PORT, () => console.log(`🚕 Client Backend listening on port ${PORT}`));