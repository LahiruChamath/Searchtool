const mongoose = require("mongoose");

const ContactItem = new mongoose.Schema({
  value: String,
  label: String,
  primary: Boolean,
}, { _id: false });

const ExperienceItem = new mongoose.Schema({
  role: String,
  org: String,
  location: String,
  start: Date,   // stored as ISO; you render "MMM YYYY"
  end: Date,
  highlights: [String],
}, { _id: false });

const MediaSchema = new mongoose.Schema({
  photo: { type: String },          // public URL
  cv: {                              // keep CV metadata when you upload a CV
    url: { type: String },
    filename: { type: String },
    mime: { type: String },
    size: { type: Number },
  }
}, { _id: false });

const ConsultantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String },
  expertise: [{ type: String }],
  qualifications: [{ type: String }],
  tags: [{ type: String }],
  summary: { type: String },
  info: { type: String },

  // legacy flat fields (kept for compatibility)
  emails: [{ type: String }],
  phones: [{ type: String }],
  img: { type: String },

  // normalized contacts
  contacts: {
    emails: [ContactItem],
    phones: [ContactItem],
  },

  // NEW bits
  media: { type: MediaSchema, default: undefined }, // optional
  experience: [ExperienceItem],
  reviews: [{
    userId: String,
    userName: String,
    rating: Number,
    comment: String,
    createdAt: { type: Date, default: Date.now }
  }],
  ratingAvg: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model("Consultant", ConsultantSchema);
