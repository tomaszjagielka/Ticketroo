const mongoose = require("mongoose");

const eventLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  details: String,
  timestamp: { type: Date, default: Date.now },
  ip: String,
});

module.exports = mongoose.model("EventLog", eventLogSchema);
