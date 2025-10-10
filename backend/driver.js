// driver.js
import WebSocket from 'ws';
import fetch from 'node-fetch';

const DRIVER_ID = process.argv[2] || '1';
const NOTIFY_SERVER = 'ws://localhost:9000';
const API_SERVER = 'http://localhost:8001';

async function goOnlineAndListen() {
    console.log(`▶️  Driver ${DRIVER_ID} starting...`);

    // Step 1: Immediately set status to 'available' via HTTP request
    try {
        const response = await fetch(`${API_SERVER}/drivers/${DRIVER_ID}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'available' })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to go online');

        console.log(`✅ Driver ${DRIVER_ID} is now online and available.`);

    } catch (e) {
        console.error(`❌ Failed to set driver ${DRIVER_ID} as available:`, e.message);
        return; // Stop if we can't go online
    }

    // Step 2: Connect to WebSocket to listen for ride assignments
    const ws = new WebSocket(NOTIFY_SERVER);

    ws.on('open', () => {
        console.log(`✅ Driver ${DRIVER_ID} connected to notification server. Waiting for rides...`);
        ws.send(JSON.stringify({ type: 'register', id: `driver_${DRIVER_ID}` }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'new_ride_assigned') {
            console.log('\n================================');
            console.log('💰 NEW RIDE ASSIGNED! 💰');
            console.log(`Pick up ${msg.client.name} (ID: ${msg.client.id})`);
            console.log(`From: ${msg.ride.source_location} -> To: ${msg.ride.dest_location}`);
            console.log('================================\n');
        } else {
            console.log(`[Notification]: ${msg.message}`);
        }
    });

    ws.on('close', () => console.log('Disconnected from notification service.'));
    ws.on('error', (err) => console.error('WebSocket error:', err.message));
}

goOnlineAndListen();