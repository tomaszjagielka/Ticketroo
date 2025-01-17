const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: { type: String, required: true },
  type: String,
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  relatedTicket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
});

module.exports = mongoose.model("Notification", notificationSchema);
