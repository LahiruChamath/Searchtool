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

// ---------- Review weights & helpers ----------
const REVIEW_WEIGHTS = {
  technical_expertise: 0.25,    // 25%
  relevant_experience: 0.15,    // 15%
  proposed_methodology: 0.15,   // 15%
  communication_skills: 0.10,   // 10%
  involvement_tasks: 0.15,      // 15%
  timeliness: 0.10,             // 10%
  cost_effectiveness: 0.10,     // 10%
};

function computeWeightedReviewScore(review) {
  if (!review) return 0;

  // Prefer structured answers if present
  if (review.answers) {
    let sum = 0;
    let totalW = 0;
    for (const [key, weight] of Object.entries(REVIEW_WEIGHTS)) {
      const v = review.answers[key];
      if (typeof v === "number" && v > 0) {
        sum += v * weight;
        totalW += weight;
      }
    }
    if (totalW > 0) {
      return sum / totalW; // still on 1–5 scale
    }
  }

  // Fallback to overallRating, then legacy rating
  if (typeof review.overallRating === "number" && review.overallRating > 0) {
    return review.overallRating;
  }
  if (typeof review.rating === "number" && review.rating > 0) {
    return review.rating;
  }
  return 0;
}

const ReviewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userName: { type: String, trim: true },

    // Legacy fields (still kept for backward compatibility)
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, trim: true },

    // NEW: project metadata
    projectName: { type: String, trim: true },
    projectDate: { type: String, trim: true }, // store as string (e.g. 2025-01-15)

    // New structured answers based on the evaluation matrix
    answers: {
      technical_expertise: { type: Number, min: 1, max: 5 },
      relevant_experience: { type: Number, min: 1, max: 5 },
      proposed_methodology: { type: Number, min: 1, max: 5 },
      communication_skills: { type: Number, min: 1, max: 5 },
      involvement_tasks: { type: Number, min: 1, max: 5 },
      timeliness: { type: Number, min: 1, max: 5 },
      cost_effectiveness: { type: Number, min: 1, max: 5 },
    },

    // Cached overall rating (1–5) computed via weights above
    overallRating: { type: Number, min: 0, max: 5 },
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
            arr
              .map((s) => String(s || "").trim())
              .filter(Boolean)
          )
        );
      },
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

  if (!n) {
    this.ratingAvg = 0;
    return this.ratingAvg;
  }

  const total = this.reviews.reduce(
    (sum, r) => sum + computeWeightedReviewScore(r),
    0
  );
  this.ratingAvg = Math.round((total / n) * 10) / 10;
  return this.ratingAvg;
};

consultantSchema.index({
  name: "text",
  summary: "text",
  expertise: 1,
  tags: 1,
});
consultantSchema.index({ category: 1 });
consultantSchema.index({ "media.cv.filename": 1 });

module.exports = mongoose.model("Consultant", consultantSchema);
