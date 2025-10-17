// server.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Setup Postgres connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "uber-2",
  password: "ishaninotokbutwhocares",
  port: 5432,
});

// ==================== HELPER FUNCTIONS ====================

// Simple distance calculation using absolute difference
function calculateSimpleDistance(driverLocation, userLocation) {
  return Math.abs(driverLocation - userLocation);
}

// Find closest available driver
async function findClosestAvailableDriver(userLocation) {
  try {
    console.log(`🔍 Finding closest driver to location: ${userLocation}`);
    const result = await pool.query('SELECT * FROM drivers WHERE status = $1', ['available']);

    if (result.rows.length === 0) {
      console.log('❌ No available drivers found');
      return null;
    }

    console.log(`📋 Found ${result.rows.length} available drivers`);

    const driversWithDistance = result.rows.map(driver => {
      const distance = calculateSimpleDistance(driver.location, userLocation);
      return { ...driver, distance };
    });

    driversWithDistance.sort((a, b) => a.distance - b.distance);
    const closestDriver = driversWithDistance[0];
    console.log(`🎯 Closest driver: ${closestDriver.driver_name} at distance ${closestDriver.distance}`);
    return closestDriver;
  } catch (err) {
    console.error('❌ Error finding closest driver:', err);
    return null;
  }
}

// Assign driver to ride and update database
async function assignDriverToRide(rideId, driverId) {
  try {
    await pool.query(
      'UPDATE ride_requests SET assigned_driver_id = $1, status = $2 WHERE id = $3',
      [driverId, 'assigned', rideId]
    );
    await pool.query(
      'UPDATE drivers SET status = $1 WHERE id = $2',
      ['not_available', driverId]
    );
    console.log(`✅ Driver ${driverId} assigned to ride ${rideId}`);
    return true;
  } catch (err) {
    console.error('❌ Error assigning driver:', err);
    return false;
  }
}

// Send notification to driver (console log simulation)
function notifyDriver(driver, userDetails, rideDetails) {
  console.log('\n' + '='.repeat(60));
  console.log('📱 DRIVER NOTIFICATION SENT');
  console.log('='.repeat(60));
  console.log(`👨‍💼 TO: ${driver.driver_name} (ID: ${driver.id})`);
  console.log(`🔔 NEW RIDE REQUEST:`);
  console.log(`   Customer: ${userDetails.user_name || userDetails.user_id}`);
  console.log(`   Contact: ${userDetails.contact_number || "Not provided"}`);
  console.log(`   Pickup: Location ${rideDetails.source_location}`);
  console.log(`   Drop: Location ${rideDetails.dest_location}`);
  console.log(`   Distance from you: ${driver.distance} units`);
  console.log('='.repeat(60) + '\n');
}

// ==================== API ENDPOINTS ====================

// Book a ride
app.post("/api/book-ride", async (req, res) => {
  const { user_id, user_name, contact_number, source_location, dest_location } = req.body;

  if (!user_id || !source_location || !dest_location) {
    return res.status(400).json({ error: "Missing required fields: user_id, source_location, dest_location" });
  }
  if (!Number.isInteger(source_location) || !Number.isInteger(dest_location)) {
    return res.status(400).json({ error: "Locations must be integers" });
  }

  try {
    console.log(`\n📱 NEW RIDE REQUEST from User: ${user_id}`);
    console.log(`📍 Route: Location ${source_location} → Location ${dest_location}`);

    // Insert ride request directly (no user table check)
    const rideQuery = `
      INSERT INTO ride_requests (user_id, user_name, contact_number, source_location, dest_location)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `;
    const rideResult = await pool.query(rideQuery, [user_id, user_name, contact_number, source_location, dest_location]);
    const rideId = rideResult.rows[0].id;

    console.log(`✅ Ride request created with ID: ${rideId}`);

    // Find and assign the closest driver
    const closestDriver = await findClosestAvailableDriver(source_location);
    if (!closestDriver) {
      return res.json({ success: false, message: "No drivers available at the moment", ride_id: rideId, status: "waiting" });
    }

    const assignmentSuccess = await assignDriverToRide(rideId, closestDriver.id);
    if (!assignmentSuccess) {
      return res.status(500).json({ success: false, message: "Failed to assign driver" });
    }

    // Notify driver and respond to user
    notifyDriver(closestDriver, req.body, { source_location, dest_location });

    res.json({
      success: true,
      message: "Ride booked successfully!",
      ride_id: rideId,
      status: "driver_assigned",
      driver_details: {
        driver_name: closestDriver.driver_name,
        vehicle_id: closestDriver.vehicle_id,
        contact_number: closestDriver.contact_number,
        distance_from_pickup: closestDriver.distance
      }
    });

  } catch (err) {
    console.error("❌ Database error:", err);
    res.status(500).json({ error: "Database error during booking" });
  }
});

// Update driver status
// backend/server.js

app.put("/api/drivers/:driver_id/status", async (req, res) => {
  const { driver_id } = req.params;
  const { status } = req.body;

  if (status !== 'available') {
    // For this endpoint's logic, we only care about setting status to 'available'
    return res.status(400).json({ error: "This endpoint can only be used to set status to 'available'" });
  }

  try {
    // First, get the driver's current status
    const currentStatusResult = await pool.query('SELECT status, driver_name FROM drivers WHERE id = $1', [driver_id]);

    if (currentStatusResult.rows.length === 0) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const driver = currentStatusResult.rows[0];
    
    // Check if the status is already 'available'
    if (driver.status === 'available') {
      console.log(`📱 Driver ${driver.driver_name} is already available. No update needed.`);
      return res.json({ success: true, message: `You are already online and available for rides.` });
    }
    
    // If not, update the status
    await pool.query('UPDATE drivers SET status = $1 WHERE id = $2', [status, driver_id]);
    
    console.log(`📱 Driver ${driver.driver_name} status updated to: ${status}`);
    res.json({ success: true, message: `Status updated successfully! You are now online.` });

  } catch (err) {
    console.error("❌ Error updating driver status:", err);
    res.status(500).json({ error: "Failed to update driver status" });
  }
});

// Get ride history for a user
app.get("/api/users/:user_id/rides", async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT rr.id as ride_id, rr.source_location, rr.dest_location, rr.status, rr.created_at,
             d.driver_name, d.vehicle_id
      FROM ride_requests rr
      LEFT JOIN drivers d ON rr.assigned_driver_id = d.id
      WHERE rr.user_id = $1
      ORDER BY rr.created_at DESC
    `, [user_id]);
    res.json({ success: true, user_id, rides: result.rows });
  } catch (err) {
    console.error("❌ Error fetching user rides:", err);
    res.status(500).json({ error: "Failed to fetch ride history" });
  }
});

// Test database connection
app.get("/api/test", async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ success: true, message: "Database connection successful" });
  } catch (err) {
    console.error("❌ Database connection test failed:", err);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// ==================== START SERVER ====================
app.listen(port, () => {
  console.log('\n' + '🚗'.repeat(20));
  console.log(`🚀 UBER SERVER RUNNING AT http://localhost:${port}`);
  console.log('\n📋 CORE API ENDPOINTS:');
  console.log('  POST /api/book-ride - Book a new ride');
  console.log('  PUT  /api/drivers/:id/status - Update driver status');
  console.log('  GET  /api/users/:user_id/rides - Get user ride history');
  console.log('  GET  /api/test - Test database connection');
  console.log('🚗'.repeat(20) + '\n');
});