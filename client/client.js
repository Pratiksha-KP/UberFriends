import fetch from "node-fetch";

async function sendRideRequest() {
  const rideRequest = {
    source_location: "Downtown",
    dest_location: "Airport",
    user_id: "user123",
  };

  const response = await fetch("http://localhost:3000/api/ride-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rideRequest),
  });

  const data = await response.json();
  console.log("Server Response:", data);
}

sendRideRequest();