const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true },
  ticketTypes: [{ type: mongoose.Schema.Types.ObjectId, ref: "TicketType" }],
  manager: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  visibleToRoles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],
});

module.exports = mongoose.model("Project", projectSchema);
