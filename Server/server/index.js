// server.js
import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";

const { Pool } = pkg;
const app = express();
const port = 3000;

app.use(bodyParser.json());

// // Setup Postgres connection (update with your own credentials)
// const pool = new Pool({
//   user: "postgres",       
//   host: "localhost",
//   database: "ridesdb",     // make sure this database exists
//   password: "password",    // change if needed
//   port: 5432,
// });

// API endpoint for ride request
app.post("/api/ride-request", async (req, res) => {
  const { source_location, dest_location, user_id } = req.body;

  if (!source_location || !dest_location || !user_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Try inserting into Postgres
    const query = `
      INSERT INTO ride_requests (source_location, dest_location, user_id)
      VALUES ($1, $2, $3) RETURNING id
    `;
    const values = [source_location, dest_location, user_id];

    const result = await pool.query(query, values);

    res.json({
      message: "Ride request stored successfully",
      ride_id: result.rows[0].id,
    });
  } catch (err) {
    // Fallback: Just print to console if Postgres fails
    console.log("We will store this data in Postgres now:");
    console.log({ source_location, dest_location, user_id });

    res.json({
      message: "Postgres not available, printing data instead",
      data: { source_location, dest_location, user_id },
    });
  }
});

app.listen(port, () => {
  console.log(`Ride Request Server running at http://localhost:${port}`);
});