// server/models/Permission.js
const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema({
  role: { type: String, unique: true }, // admin | editor | viewer
  canEditConsultant: { type: Boolean, default: false },
  canDeleteConsultant: { type: Boolean, default: false },
  canManageUsers: { type: Boolean, default: false },
  canAddReview: { type: Boolean, default: true },
  canRate: { type: Boolean, default: true },
  canEditExperience: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Permission", permissionSchema);
