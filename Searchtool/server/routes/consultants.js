// server/routes/consultants.js
const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const Consultant = require("../models/Consultant");
const Permission = require("../models/Permission");
const auth = require("../middleware/auth");

// ---------- helpers ----------
function stripUndefinedDeep(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === 'object') {
      const nested = stripUndefinedDeep(v);
      if (Array.isArray(nested)) out[k] = nested;
      else if (Object.keys(nested).length > 0) out[k] = nested;
      else if (Array.isArray(v)) out[k] = []; // preserve empty arrays
    } else {
      out[k] = v;
    }
  }
  return out;
}

function buildSearch(doc) {
  const parts = [
    doc.name,
    ...(doc.expertise || []),
    ...(doc.tags || []),
    ...(doc.sectors || []),
    ...(doc.qualifications || []),
    ...(doc.projects || []).flatMap(p => [p.title, p.client, ...(p.funders || [])]),
    ...(doc.experience || []).flatMap(e => [e.role, e.org, e.location, ...(e.highlights || [])])
  ].filter(Boolean).map(String);
  const text = parts.join(" ").toLowerCase();
  const keywords = Array.from(new Set(parts.map(p => p.toLowerCase())));
  doc.search = doc.search || {};
  doc.search.text = text;
  doc.search.keywords = keywords;
}

async function can(req, key) {
  if (!req.user) return false;
  const row = await Permission.findOne({ role: req.user.role });
  return !!row?.[key];
}

// ---------- uploads setup ----------
const baseDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

// photos
const photoDir = path.join(baseDir, "photos");
if (!fs.existsSync(photoDir)) fs.mkdirSync(photoDir, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, photoDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});
const photoFilter = (_, file, cb) => {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  cb(ok ? null : new Error("Only JPG/PNG/WEBP allowed"), ok);
};
const uploadPhoto = multer({ storage: photoStorage, fileFilter: photoFilter });

// CVs
const cvDir = path.join(baseDir, "cv");
if (!fs.existsSync(cvDir)) fs.mkdirSync(cvDir, { recursive: true });

const cvStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, cvDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});
const cvFilter = (_, file, cb) => {
  const ok = file.mimetype === "application/pdf";
  cb(ok ? null : new Error("Only PDF files allowed"), ok);
};
const uploadCV = multer({ storage: cvStorage, fileFilter: cvFilter });

// ---------- routes ----------

// create (admin/editor)
router.post("/", auth(["admin", "editor"]), async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.emails && body.contacts?.emails) body.emails = body.contacts.emails.map(e => e.value);
    if (!body.phones && body.contacts?.phones) body.phones = body.contacts.phones.map(p => p.value);
    buildSearch(body);
    const doc = await Consultant.create(body);
    res.status(201).json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// read all
router.get("/", async (_, res) => {
  try {
    const list = await Consultant.find().sort({ name: 1 });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// read one
router.get("/:id", async (req, res) => {
  try {
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// update (admin only) — safe set (strip undefined, don't clobber media.cv)
router.put("/:id", auth(["admin"]), async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.emails && body.contacts?.emails) body.emails = body.contacts.emails.map(e => e.value);
    if (!body.phones && body.contacts?.phones) body.phones = body.contacts.phones.map(p => p.value);
    buildSearch(body);

    const payload = stripUndefinedDeep(body);
    if (payload.media && payload.media.cv === undefined) {
      delete payload.media.cv;
      if (Object.keys(payload.media).length === 0) delete payload.media;
    }

    const updated = await Consultant.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// delete (admin only)
router.delete("/:id", auth(["admin"]), async (req, res) => {
  try {
    const removed = await Consultant.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// upload profile photo (does NOT touch media.cv)
router.post("/:id/photo", uploadPhoto.single("photo"), async (req, res) => {
  try {
    const c = await Consultant.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Consultant not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name 'photo')" });

    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/photos/${req.file.filename}`;
    c.img = publicUrl;
    c.media = { ...(c.media || {}), photo: publicUrl };
    await c.save();

    res.json({ message: "Photo uploaded", url: publicUrl, consultant: c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// upload CV (writes media.cv object)
router.post("/:id/cv", uploadCV.single("cv"), async (req, res) => {
  try {
    const c = await Consultant.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Consultant not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name 'cv')" });

    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/cv/${req.file.filename}`;

    // legacy fields for compatibility
    c.cvUrl = publicUrl;
    c.cv = publicUrl;

    // structured media metadata
    c.media = {
      ...(c.media || {}),
      cv: {
        url: publicUrl,
        filename: req.file.filename,
        mime: req.file.mimetype,
        size: req.file.size,
      }
    };

    await c.save();
    res.json({ message: "CV uploaded", cvUrl: publicUrl, consultant: c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// add single experience (permissioned)
router.post("/:id/experience", auth(), async (req, res) => {
  try {
    if (!(await can(req, "canEditExperience"))) return res.status(403).json({ error: "No permission" });
    const { role, org, start, end, location, highlights } = req.body;
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    doc.experience = doc.experience || [];
    doc.experience.push({
      role, org,
      start: start ? new Date(start) : null,
      end: end ? new Date(end) : null,
      location,
      highlights: Array.isArray(highlights) ? highlights : (highlights ? [highlights] : [])
    });
    buildSearch(doc);
    await doc.save();
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// edit one experience by index
router.put("/:id/experience/:idx", auth(), async (req, res) => {
  try {
    if (!(await can(req, "canEditExperience"))) return res.status(403).json({ error: "No permission" });
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    const i = Number(req.params.idx);
    if (!doc.experience || i < 0 || i >= doc.experience.length) return res.status(400).json({ error: "Bad index" });
    doc.experience[i] = { ...doc.experience[i], ...req.body };
    buildSearch(doc);
    await doc.save();
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// delete one experience by index
router.delete("/:id/experience/:idx", auth(), async (req, res) => {
  try {
    if (!(await can(req, "canEditExperience"))) return res.status(403).json({ error: "No permission" });
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    const i = Number(req.params.idx);
    if (!doc.experience || i < 0 || i >= doc.experience.length) return res.status(400).json({ error: "Bad index" });
    doc.experience.splice(i, 1);
    buildSearch(doc);
    await doc.save();
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// add review (permissioned roles)
router.post("/:id/reviews", auth(), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!(await can(req, "canAddReview"))) return res.status(403).json({ error: "No permission" });
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    const r = { userId: req.user.id, userName: req.user.name || req.user.email, rating: Number(rating), comment: comment || "" };
    doc.reviews = doc.reviews || [];
    doc.reviews.push(r);
    doc.ratingCount = doc.reviews.length;
    const sum = doc.reviews.reduce((a, b) => a + (b.rating || 0), 0);
    doc.ratingAvg = doc.ratingCount ? Math.round((sum / doc.ratingCount) * 10) / 10 : 0;
    await doc.save();
    res.json(doc);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
