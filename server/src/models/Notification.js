const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  content: { type: String, required: true },
  type: String,
  status: { type: String, enum: ["read", "unread"], default: "unread" },
  createdAt: { type: Date, default: Date.now },
  relatedTicket: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket" },
});

module.exports = mongoose.model("Notification", notificationSchema);
