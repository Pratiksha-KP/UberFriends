// backend/driver.js

import fetch from "node-fetch";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function goOnline() {
  console.log("🚙 Driver App Simulator 🚙");
  console.log("==========================");

  try {
    const driverId = await askQuestion("Enter your Driver ID to go online: ");
    
    if (!driverId || isNaN(parseInt(driverId))) {
      console.log("❌ Invalid ID. Please enter a number.");
      return;
    }

    console.log(`\n📡 Sending request to set Driver #${driverId} to 'available'...`);

    const response = await fetch(`http://localhost:3000/api/drivers/${driverId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'available' }), // We only send 'available'
    });

    const data = await response.json();

    if (response.ok) {
      // Display the specific message from the server
      console.log(`\n✅ Server Response: ${data.message}`);
    } else {
      console.error(`\n❌ Error: ${data.error}`);
    }

  } catch (err) {
    console.error("\nAn error occurred:", err.message);
  } finally {
    rl.close();
  }
}

goOnline();