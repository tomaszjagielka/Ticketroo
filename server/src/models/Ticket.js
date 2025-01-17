const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  status: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
  attachments: [
    {
      name: String,
      path: String,
      type: String,
      size: Number,
    },
  ],
  resolution: String,
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  resolvedAt: Date,
  satisfaction: { type: Number, min: 1, max: 5 },
  reopenReason: String,
  reopenedAt: Date,
  reopenedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

module.exports = mongoose.model("Ticket", ticketSchema);
