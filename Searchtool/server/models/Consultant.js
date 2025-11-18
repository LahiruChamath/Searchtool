// server/models/Consultant.js
const mongoose = require("mongoose");

// ----- Sub-schemas (no own _id for compact embeds) -----
const ExperienceItemSchema = new mongoose.Schema(
  {
    role: { type: String, trim: true },
    org: { type: String, trim: true },
    location: { type: String, trim: true },
    start: { type: Date }, // store ISO; render as "MMM YYYY" in UI
    end: { type: Date },
    highlights: [{ type: String, trim: true }],
  },
  { _id: false }
);

const MediaSchema = new mongoose.Schema(
  {
    photo: { type: String, trim: true }, // public URL
    cv: {
      url: { type: String, trim: true },
      filename: { type: String, trim: true },
      mime: { type: String, trim: true },
      size: { type: Number, min: 0 },
    },
  },
  { _id: false }
);

const ReviewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// ----- Main schema -----
const consultantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },

    expertise: [{ type: String, trim: true }],
    emails: [{ type: String, trim: true, lowercase: true }],
    phones: [{ type: String, trim: true }],

    qualifications: [{ type: String, trim: true }],
    tags: [{ type: String, trim: true }],

    summary: { type: String, trim: true },
    img: { type: String, trim: true },

    media: MediaSchema,
    experience: [ExperienceItemSchema],

    // Associations: simple array of strings with trim + dedupe on set
    associations: {
      type: [String],
      default: [],
      set: (arr) => {
        if (!Array.isArray(arr)) return [];
        return Array.from(
          new Set(
            arr.map(s => String(s || "").trim()).filter(Boolean)
          )
        );
      }
    },

    reviews: { type: [ReviewSchema], default: [] },

    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

consultantSchema.methods.recomputeRatings = function recomputeRatings() {
  const n = this.reviews?.length || 0;
  this.ratingCount = n;
  this.ratingAvg = n
    ? Math.round(
        (this.reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / n) * 10
      ) / 10
    : 0;
  return this.ratingAvg;
};

consultantSchema.index({ name: "text", summary: "text", expertise: 1, tags: 1 });
consultantSchema.index({ category: 1 });
consultantSchema.index({ "media.cv.filename": 1 });

module.exports = mongoose.model("Consultant", consultantSchema);
