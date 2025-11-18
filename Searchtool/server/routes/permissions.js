// server/routes/permissions.js
const router = require("express").Router();
const Permission = require("../models/Permission");
const auth = require("../middleware/auth");

// seed defaults if empty
async function ensureDefaults() {
  const count = await Permission.countDocuments();
  if (count > 0) return;
  await Permission.create([
    { role: "admin",  canEditConsultant: true, canDeleteConsultant: true, canManageUsers: true, canAddReview: true, canRate: true, canEditExperience: true },
    { role: "editor", canEditConsultant: true, canDeleteConsultant: false, canManageUsers: false, canAddReview: true, canRate: true, canEditExperience: true },
    { role: "viewer", canEditConsultant: false, canDeleteConsultant: false, canManageUsers: false, canAddReview: true, canRate: true, canEditExperience: false }
  ]);
}

// list all (admin)
router.get("/", auth(["admin"]), async (req, res) => {
  await ensureDefaults();
  const rows = await Permission.find().sort({ role: 1 });
  res.json(rows);
});

// get my permissions (logged-in)
router.get("/my", auth(), async (req, res) => {
  await ensureDefaults();
  const row = await Permission.findOne({ role: req.user.role });
  res.json(row || {});
});

// update one role (admin)
router.patch("/:role", auth(["admin"]), async (req, res) => {
  const role = req.params.role;
  const update = { ...req.body };
  delete update.role;
  const row = await Permission.findOneAndUpdate({ role }, update, { upsert: true, new: true });
  res.json(row);
});

module.exports = router;
