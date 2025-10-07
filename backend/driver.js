// driver.js
import WebSocket from 'ws';
import fetch from 'node-fetch';

const DRIVER_ID = process.argv[2] || '1'; // Run with: node driver.js 1
const NOTIFY_SERVER = 'ws://localhost:9000';
const API_SERVER = 'http://localhost:8001';

const ws = new WebSocket(NOTIFY_SERVER);

ws.on('open', () => {
    console.log('Connected to notification server.');
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

ws.on('close', () => console.log('Disconnected from notification server.'));

// Simulate going online after 2 seconds
setTimeout(async () => {
    console.log('Updating status to "available"...');
    try {
        const response = await fetch(`${API_SERVER}/drivers/${DRIVER_ID}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'available' })
        });
        const data = await response.json();
        console.log(`API Response: ${data.message}`);
    } catch (e) {
        console.error('Failed to go online:', e.message);
    }
}, 2000);