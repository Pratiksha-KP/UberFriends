// client.js
import WebSocket from 'ws';
import fetch from 'node-fetch';

const CLIENT_ID = process.argv[2] || 'C1'; // Run with: node client.js C1
const CLIENT_NAME = `User ${CLIENT_ID}`;
const NOTIFY_SERVER = 'ws://localhost:9000';
const API_SERVER = 'http://localhost:8000';

const ws = new WebSocket(NOTIFY_SERVER);

ws.on('open', () => {
    console.log('Connected to notification server.');
    // Register with the notification server
    ws.send(JSON.stringify({ type: 'register', id: `client_${CLIENT_ID}` }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'ride_assigned') {
        console.log('\n================================');
        console.log('🎉 RIDE ASSIGNED! 🎉');
        console.log(`Driver: ${msg.driver.driver_name}`);
        console.log(`Vehicle: ${msg.driver.vehicle_id}`);
        console.log('================================\n');
    } else {
        console.log(`[Notification]: ${msg.message}`);
    }
});

ws.on('close', () => console.log('Disconnected from notification server.'));

// Simulate booking a ride after 3 seconds
setTimeout(async () => {
    console.log('Requesting a ride...');
    try {
        const response = await fetch(`${API_SERVER}/book-ride`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: CLIENT_ID,
                user_name: CLIENT_NAME,
                source_location: 10,
                dest_location: 50
            })
        });
        const data = await response.json();
        console.log(`API Response: ${data.message}`);
    } catch (e) {
        console.error('Failed to book ride:', e.message);
    }
}, 3000);