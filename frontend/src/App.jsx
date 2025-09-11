import React, { useState } from "react";

function App() {
  const [form, setForm] = useState({
    user_id: "",
    user_name: "",
    contact_number: "",
    source_location: "",
    dest_location: "",
  });

  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch("http://localhost:3000/api/book-ride", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          source_location: parseInt(form.source_location),
          dest_location: parseInt(form.dest_location),
        }),
      });

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ error: "Failed to connect to server" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.formBox}>
        <h1 style={styles.title}>Enter your details</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            name="user_id"
            placeholder="User ID"
            value={form.user_id}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <input
            type="text"
            name="user_name"
            placeholder="Name"
            value={form.user_name}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <input
            type="text"
            name="contact_number"
            placeholder="Contact Number"
            value={form.contact_number}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <input
            type="number"
            name="source_location"
            placeholder="Pickup Location (integer)"
            value={form.source_location}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <input
            type="number"
            name="dest_location"
            placeholder="Drop Location (integer)"
            value={form.dest_location}
            onChange={handleChange}
            required
            style={styles.input}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Booking..." : "Book Ride"}
          </button>
        </form>

        {response && (
          <div style={styles.responseBox}>
            <h3>📡 Server Response</h3>
            <pre>{JSON.stringify(response, null, 2)}</pre>
            {response.success && response.driver_details && (
              <p>
                🎉 Driver <b>{response.driver_details.driver_name}</b> (Vehicle:{" "}
                {response.driver_details.vehicle_id}) assigned!
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: "url('/bg.jpg')", // 🔥 Replace with your image path
    backgroundSize: "cover",
    backgroundPosition: "center",
  },
  formBox: {
    width: "400px",
    padding: "20px",
    borderRadius: "15px",
    backdropFilter: "blur(10px)",
    backgroundColor: "rgba(255, 255, 255, 0.1)", // translucent glass look
    boxShadow: "0 8px 20px rgba(0, 0, 0, 0.5)",
    color: "white",
  },
  title: {
    textAlign: "center",
    marginBottom: "20px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  input: {
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(255,255,255,0.05)",
    color: "white",
    fontSize: "16px",
    outline: "none",
  },
  button: {
    padding: "10px",
    backgroundColor: "#ffcc00",
    color: "#000",
    border: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    fontSize: "16px",
  },
  responseBox: {
    marginTop: "20px",
    padding: "15px",
    borderRadius: "10px",
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "white",
  },
};

export default App;
