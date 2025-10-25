// backend_client.js
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import { pool } from './db.js';
import bcrypt from 'bcrypt';
import fetch from 'node-fetch';

const app = express();
const PORT = 8000;
const NOTIFY_SERVER_URL = 'http://localhost:9000/send-notification';

app.use(cors());
app.use(bodyParser.json());

// ===========================================
// == USER AUTHENTICATION ENDPOINTS ==
// ===========================================

// Register a new user
app.post('/users/register', async (req, res) => {
    const { user_name, password } = req.body;
    if (!user_name || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    try {
        // Hash the password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Store user in database
        const newUser = await pool.query(
            "INSERT INTO users (user_name, password_hash) VALUES ($1, $2) RETURNING id, user_name",
            [user_name, password_hash]
        );

        res.status(201).json({ 
            success: true, 
            message: "User registered successfully!", 
            user: newUser.rows[0] 
        });

    } catch (e) {
        if (e.code === '23505') { // Unique constraint violation
            return res.status(409).json({ error: "Username already exists." });
        }
        console.error("Error registering user:", e);
        res.status(500).json({ error: "Database error." });
    }
});

// Login a user (In a real app, you'd return a JWT or session token)
app.post('/users/login', async (req, res) => {
    const { user_name, password } = req.body;
    if (!user_name || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    try {
        const result = await pool.query("SELECT * FROM users WHERE user_name = $1", [user_name]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found." });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            // Login successful
            res.status(200).json({ 
                success: true, 
                message: "Login successful!",
                user: { id: user.id, user_name: user.user_name }
                // TODO: Return a session token here
            });
        } else {
            // Invalid password
            res.status(401).json({ error: "Invalid credentials." });
        }
    } catch (e) {
        console.error("Error logging in:", e);
        res.status(500).json({ error: "Database error." });
    }
});


// ===========================================
// == STANDARD RIDE BOOKING ENDPOINT ==
// ===========================================

// This is your original endpoint for a single user booking a ride
app.post('/book-ride', async (req, res) => {
    // Note: You'll need to adapt this to use the authenticated user ID
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
        console.log(`(Standard Ride) Request ${rideId} from user ${user_id} queued.`);
        res.status(202).json({ success: true, message: "Request received, finding a driver.", ride_id: rideId });
    } catch (e) {
        console.error("Error booking standard ride:", e);
        res.status(500).json({ error: "Database error." });
    }
});


// ===========================================
// == "BOOK WITH FRIENDS" ENDPOINTS ==
// ===========================================

/**
 * Creates a new meetup and sends invitations.
 * Assumes request is authenticated and provides 'organizer_id'.
 */
app.post('/meetups/create', async (req, res) => {
    // In a real app, organizer_id would come from the auth token
    const { organizer_id, organizer_name, meetup_location, invitee_usernames } = req.body;
    
    if (!organizer_id || !meetup_location || !invitee_usernames || invitee_usernames.length === 0) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Create the meetup
        const meetupRes = await client.query(
            "INSERT INTO meetups (organizer_id, meetup_location, status) VALUES ($1, $2, 'pending') RETURNING id",
            [organizer_id, meetup_location]
        );
        const meetup_id = meetupRes.rows[0].id;

        // Step 2: Find user IDs for all invitees
        const userRes = await client.query(
            "SELECT id, user_name FROM users WHERE user_name = ANY($1::varchar[])",
            [invitee_usernames]
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

        // Step 4: Send notifications (after committing to DB)
        const notifyPromises = invitees.map(invitee => {
            return fetch(NOTIFY_SERVER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    targetId: `client_${invitee.id}`, // Assumes client IDs are based on user IDs
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

/**
 * Gets all pending invites for the authenticated user.
 */
app.get('/meetups/invites/:user_id', async (req, res) => {
    // In a real app, user_id would come from the auth token
    const { user_id } = req.params;

    try {
        const invites = await pool.query(
            `SELECT mi.id as invite_id, m.meetup_location, u.user_name as organizer_name
             FROM meetup_invites mi
             JOIN meetups m ON mi.meetup_id = m.id
             JOIN users u ON m.organizer_id = u.id
             WHERE mi.invitee_id = $1 AND mi.status = 'pending'`,
            [user_id]
        );
        res.status(200).json({ success: true, invites: invites.rows });
    } catch (e) {
        console.error("Error fetching invites:", e);
        res.status(500).json({ error: "Database error." });
    }
});

/**
 * Allows an invitee to respond to an invite.
 * If they accept, this automatically books their ride.
 */
app.post('/meetups/invites/:invite_id/respond', async (req, res) => {
    const { invite_id } = req.params;
    // user_id and user_name would come from auth token
    const { user_id, user_name, response, source_location } = req.body; 

    if (response === 'accepted' && !source_location) {
        return res.status(400).json({ error: "Source location is required to accept." });
    }

    try {
        if (response === 'rejected') {
            await pool.query("UPDATE meetup_invites SET status = 'rejected' WHERE id = $1", [invite_id]);
            return res.status(200).json({ success: true, message: "Invite rejected." });
        }

        // --- Handle ACCEPTED response ---
        // Step 1: Update the invite
        const inviteRes = await pool.query(
            "UPDATE meetup_invites SET status = 'accepted', invitee_source_location = $1 WHERE id = $2 RETURNING meetup_id",
            [source_location, invite_id]
        );
        if (inviteRes.rows.length === 0) {
            return res.status(404).json({ error: "Invite not found." });
        }
        const { meetup_id } = inviteRes.rows[0];

        // Step 2: Get the meetup's destination location
        const meetupRes = await pool.query("SELECT meetup_location FROM meetups WHERE id = $1", [meetup_id]);
        const dest_location = meetupRes.rows[0].meetup_location;

        // Step 3: Create the ride request (THE MAGIC)
        // This is the same logic as your /book-ride endpoint
        const rideResult = await pool.query(
            "INSERT INTO ride_requests (user_id, user_name, source_location, dest_location, status) VALUES ($1, $2, $3, $4, 'pending') RETURNING id",
            [user_id, user_name, source_location, dest_location]
        );
        const rideId = rideResult.rows[0].id;
        
        console.log(`(Meetup Ride) Request ${rideId} from user ${user_id} queued.`);
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