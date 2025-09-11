import React from "react";
import "./RideCard.css"; // import CSS file
import taxiImg from "./taxi.png"; // put your taxi image in src/ folder

function RideCard() {
  return (
    <div className="ride-container">
      {/* Background with road stripes */}
      <div className="road-stripes"></div>

      {/* Glass card */}
      <div className="ride-card">
        <div className="ride-details">
          <h2>UberFriends Ride</h2>
          <p><strong>Pickup:</strong> Downtown</p>
          <p><strong>Drop:</strong> Airport</p>
          <p><strong>Driver:</strong> John Doe</p>
        </div>
        {/* Taxi image sticking out */}
        <img src={taxiImg} alt="Taxi" className="taxi-img" />
      </div>
    </div>
  );
}

export default RideCard;
