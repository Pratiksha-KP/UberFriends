// client.js
import WebSocket from 'ws';

const CLIENT_ID = process.argv[2] || 'C1';
const NOTIFY_SERVER = 'ws://localhost:9000';

console.log(`👂 Client listener ${CLIENT_ID} starting...`);

const ws = new WebSocket(NOTIFY_SERVER);

ws.on('open', () => {
    console.log(`✅ Client ${CLIENT_ID} connected to notification server. Waiting for notifications...`);
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

ws.on('close', () => console.log('Disconnected from notification service.'));
ws.on('error', (err) => console.error('WebSocket error:', err.message));