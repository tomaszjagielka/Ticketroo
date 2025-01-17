const mongoose = require("mongoose");

const slaSchema = new mongoose.Schema({
  ticketType: { type: mongoose.Schema.Types.ObjectId, ref: "TicketType" },
  responseTime: Number, // czas w minutach
  resolutionTime: Number, // czas w minutach
  priority: String,
});

module.exports = mongoose.model("Sla", slaSchema);
