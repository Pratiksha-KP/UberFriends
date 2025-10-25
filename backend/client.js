// client.js
import WebSocket from 'ws';
import fetch from 'node-fetch';

const NOTIFY_SERVER = 'ws://localhost:9000';
const AUTH_SERVER = 'http://localhost:7001';
const API_SERVER = 'http://localhost:8000';

// --- Main execution ---
async function main() {
    const [email, password] = process.argv.slice(2);
    if (!email || !password) {
        console.error('Error: Please provide email and password.');
        console.log('Usage: node client.js user@example.com mypassword');
        return;
    }

    console.log(`▶️  Client ${email} attempting to log in...`);

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
        const clientUserId = user.id;
        console.log(`✅ Login successful for ${user.name} (ID: ${clientUserId}).`);

        // Step 2: Connect to WebSocket to listen
        connectAndListen(clientUserId);

        // --- Example: How to call a protected route ---
        // You can uncomment this to test booking a ride as this user
        /*
        setTimeout(() => {
            bookTestRide(token);
        }, 3000);
        */

    } catch (e) {
        console.error(`❌ ${e.message}`);
    }
}

// --- Helper Functions ---

function connectAndListen(clientUserId) {
    const ws = new WebSocket(NOTIFY_SERVER);

    ws.on('open', () => {
        console.log(`✅ Connected to notification server. Waiting for notifications...`);
        // Register with the REAL User ID
        ws.send(JSON.stringify({ type: 'register', id: `client_${clientUserId}` }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        
        switch(msg.type) {
            case 'ride_assigned':
                console.log('\n================================');
                console.log('🎉 RIDE ASSIGNED! 🎉');
                console.log(`Driver: ${msg.driver.driver_name}`);
                console.log(`Vehicle: ${msg.driver.vehicle_id}`);
                console.log('================================\n');
                break;
            
            case 'new_meetup_invite':
                console.log('\n================================');
                console.log('📬 NEW MEETUP INVITE! 📬');
                console.log(msg.message);
                console.log(`(To respond, use Postman to hit /meetups/invites/${msg.meetup_id}/respond)`);
                console.log('================================\n');
                break;
                
            default:
                console.log(`[Notification]: ${msg.message}`);
        }
    });

    ws.on('close', () => console.log('Disconnected from notification service.'));
    ws.on('error', (err) => console.error('WebSocket error:', err.message));
}

// Example function showing how to use the token
async function bookTestRide(token) {
    console.log('Booking a test ride...');
    try {
        const res = await fetch(`${API_SERVER}/book-ride`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // Use the token!
            },
            body: JSON.stringify({
                source_location: 10,
                dest_location: 50
            })
        });
        const data = await res.json();
        console.log('Test ride response:', data);
    } catch (e) {
        console.error('Test ride failed:', e.message);
    }
}

main();