const mongoose = require("mongoose");

const changeHistorySchema = new mongoose.Schema({
  changeDate: { type: Date, default: Date.now },
  newStatus: String,
  ticket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  changeDetails: String,
});

module.exports = mongoose.model("ChangeHistory", changeHistorySchema);
