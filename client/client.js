// client.js
import fetch from "node-fetch";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Ask a question with Promise
function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log("\n🚖 Welcome to UberFriends CLI 🚖");
  console.log("=================================\n");

  try {
    // Collect ride request details
    const user_id = await askQuestion("👤 Enter your User ID: ");
    const user_name = await askQuestion("🙍 Enter your Name: ");
    const contact_number = await askQuestion("📞 Enter your Contact Number: ");
    const source_location = parseInt(
      await askQuestion("📍 Enter Pickup Location (integer): ")
    );
    const dest_location = parseInt(
      await askQuestion("🏁 Enter Drop Location (integer): ")
    );

    rl.close();

    if (isNaN(source_location) || isNaN(dest_location)) {
      console.error("❌ Locations must be integers!");
      return;
    }

    // Make API call to server
    console.log("\n📡 Sending ride request to server...\n");

    const response = await fetch("http://localhost:3000/api/book-ride", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id,
        user_name,
        contact_number,
        source_location,
        dest_location,
      }),
    });

    const data = await response.json();

    // Display response
    console.log("\n🚀 Server Response:");
    console.log(JSON.stringify(data, null, 2));

    if (data.success && data.driver_details) {
      console.log(
        `\n🎉 Driver ${data.driver_details.driver_name} (Vehicle: ${data.driver_details.vehicle_id}) assigned! 🚗`
      );
    } else {
      console.log("\n⌛ Waiting for driver assignment...");
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
