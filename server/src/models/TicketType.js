const mongoose = require("mongoose");

const ticketTypeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
});

module.exports = mongoose.model("TicketType", ticketTypeSchema);
