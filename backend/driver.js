// driver.js
import WebSocket from 'ws';
import fetch from 'node-fetch';

const NOTIFY_SERVER = 'ws://localhost:9000';
const AUTH_SERVER = 'http://localhost:7000';
const API_SERVER = 'http://localhost:8001';

// --- Main execution ---
async function main() {
    const [email, password] = process.argv.slice(2);
    if (!email || !password) {
        console.error('Error: Please provide email and password.');
        console.log('Usage: node driver.js driver@example.com mypassword');
        return;
    }

    console.log(`▶️  Driver ${email} attempting to log in...`);

    try {
        // Step 1: Log in to the Auth Server
        const loginRes = await fetch(`${AUTH_SERVER}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const loginData = await loginRes.json();
        if (!loginRes.ok) throw new Error(loginData.error || 'Login failed');

        const { token, user } = loginData;
        const driverUserId = user.id;
        console.log(`✅ Login successful for ${user.name} (ID: ${driverUserId}).`);

        // Step 2: Go online using the token
        await goOnline(token);

        // Step 3: Connect to WebSocket to listen for rides
        connectAndListen(driverUserId);

    } catch (e) {
        console.error(`❌ ${e.message}`);
    }
}

// --- Helper Functions ---

// Step 2: Tell the backend you are 'available'
async function goOnline(token) {
    const response = await fetch(`${API_SERVER}/driver/status`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` // Use the token
        },
        body: JSON.stringify({ status: 'available' })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to go online');

    console.log(`✅ Driver is now online and available.`);
}

// Step 3: Connect to the notification server
function connectAndListen(driverUserId) {
    const ws = new WebSocket(NOTIFY_SERVER);

    ws.on('open', () => {
        console.log(`✅ Connected to notification server. Waiting for rides...`);
        // Register with the REAL User ID
        ws.send(JSON.stringify({ type: 'register', id: `driver_${driverUserId}` }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'new_ride_assigned') {
            console.log('\n================================');
            console.log('💰 NEW RIDE ASSIGNED! 💰');
            console.log(`Pick up ${msg.client.name} (ID: ${msg.client.id})`);
            console.log(`From: ${msg.ride.source_location} -> To: ${msg.ride.dest_location}`);
            console.log('================================\n');
        } else if (msg.type === 'new_meetup_invite') {
            // Drivers can also be invited to meetups if they are also users
            console.log(`[MEETUP]: ${msg.message}`);
        } else {
            console.log(`[Notification]: ${msg.message}`);
        }
    });

    ws.on('close', () => console.log('Disconnected from notification service.'));
    ws.on('error', (err) => console.error('WebSocket error:', err.message));
}

main();