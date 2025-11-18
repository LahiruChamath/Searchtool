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
  if (obj == null || typeof obj !== "object") return obj;
  const out = Array.isArray(obj) ? [] : {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v && typeof v === "object") {
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
    ...(doc.associations || []),
    ...(doc.projects || []).flatMap((p) => [p.title, p.client, ...(p.funders || [])]),
    ...(doc.experience || []).flatMap((e) => [e.role, e.org, e.location, ...(e.highlights || [])]),
  ]
    .filter(Boolean)
    .map(String);
  const text = parts.join(" ").toLowerCase();
  const keywords = Array.from(new Set(parts.map((p) => p.toLowerCase())));
  doc.search = doc.search || {};
  doc.search.text = text;
  doc.search.keywords = keywords;
}

async function can(req, key) {
  if (!req.user) return false;
  const row = await Permission.findOne({ role: req.user.role });
  return !!row?.[key];
}

async function canEditAssociations(req) {
  if (!req.user) return false;
  try {
    const row = await Permission.findOne({ role: req.user.role }).lean();
    if (row && typeof row.canEditAssociations === "boolean") return row.canEditAssociations;
  } catch (_) {}
  return req.user.role === "admin" || req.user.role === "editor";
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
    if (!body.emails && body.contacts?.emails) body.emails = body.contacts.emails.map((e) => e.value);
    if (!body.phones && body.contacts?.phones) body.phones = body.contacts.phones.map((p) => p.value);
    buildSearch(body);
    const doc = await Consultant.create(body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// read all
router.get("/", async (_, res) => {
  try {
    const list = await Consultant.find().sort({ name: 1 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// read one
router.get("/:id", async (req, res) => {
  try {
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json(doc);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// update (admin/editor)  <-- CHANGED
router.put("/:id", auth(["admin", "editor"]), async (req, res) => {
  try {
    const body = { ...req.body };
    if (!body.emails && body.contacts?.emails) body.emails = body.contacts.emails.map((e) => e.value);
    if (!body.phones && body.contacts?.phones) body.phones = body.contacts.phones.map((p) => p.value);
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
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// delete (admin only)
router.delete("/:id", auth(["admin", "editor"]), async (req, res) => {
  try {
    const removed = await Consultant.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// upload profile photo (admin/editor)  <-- CHANGED (added auth)
router.post("/:id/photo", auth(["admin", "editor"]), uploadPhoto.single("photo"), async (req, res) => {
  try {
    const c = await Consultant.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Consultant not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name 'photo')" });

    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/photos/${req.file.filename}`;
    c.img = publicUrl;
    c.media = { ...(c.media || {}), photo: publicUrl };
    await c.save();

    res.json({ message: "Photo uploaded", url: publicUrl, consultant: c });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// upload CV (admin/editor)  <-- CHANGED (added auth)
router.post("/:id/cv", auth(["admin", "editor"]), uploadCV.single("cv"), async (req, res) => {
  try {
    const c = await Consultant.findById(req.params.id);
    if (!c) return res.status(404).json({ error: "Consultant not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded (field name 'cv')" });

    const publicUrl = `${req.protocol}://${req.get("host")}/uploads/cv/${req.file.filename}`;

    c.cvUrl = publicUrl; // legacy
    c.cv = publicUrl;    // legacy

    c.media = {
      ...(c.media || {}),
      cv: {
        url: publicUrl,
        filename: req.file.filename,
        mime: req.file.mimetype,
        size: req.file.size,
      },
    };

    await c.save();
    res.json({ message: "CV uploaded", cvUrl: publicUrl, consultant: c });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// experience add/edit/delete (permission-driven)
router.post("/:id/experience", auth(), async (req, res) => {
  try {
    if (!(await can(req, "canEditExperience"))) return res.status(403).json({ error: "No permission" });
    const { role, org, start, end, location, highlights } = req.body;
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    doc.experience = doc.experience || [];
    doc.experience.push({
      role,
      org,
      start: start ? new Date(start) : null,
      end: end ? new Date(end) : null,
      location,
      highlights: Array.isArray(highlights) ? highlights : highlights ? [highlights] : [],
    });
    buildSearch(doc);
    await doc.save();
    res.json(doc);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

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
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

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
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ---------- associations endpoints ----------
router.get("/:id/associations", async (req, res) => {
  try {
    const doc = await Consultant.findById(req.params.id).select("associations");
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ associations: doc.associations || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Replace whole array
router.put("/:id/associations", auth(["admin", "editor"]), async (req, res) => {
  try {
    if (!(await canEditAssociations(req))) return res.status(403).json({ error: "No permission" });
    const { associations } = req.body;
    if (!Array.isArray(associations)) {
      return res.status(400).json({ error: "associations must be an array of strings" });
    }
    const deduped = Array.from(new Set(associations.map(s => String(s).trim()).filter(Boolean)));
    const doc = await Consultant.findByIdAndUpdate(
      req.params.id,
      { $set: { associations: deduped } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: "Not found" });
    res.json({ associations: doc.associations });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Add single value
router.post("/:id/associations", auth(["admin", "editor"]), async (req, res) => {
  try {
    if (!(await canEditAssociations(req))) return res.status(403).json({ error: "No permission" });
    const { value } = req.body;
    const v = String(value || "").trim();
    if (!v) return res.status(400).json({ error: "value is required" });

    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    const set = new Set(doc.associations || []);
    set.add(v);
    doc.associations = Array.from(set);
    await doc.save();
    res.json({ associations: doc.associations });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Remove by index
router.delete("/:id/associations/:idx", auth(["admin", "editor"]), async (req, res) => {
  try {
    if (!(await canEditAssociations(req))) return res.status(403).json({ error: "No permission" });
    const i = Number(req.params.idx);
    const doc = await Consultant.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: "Not found" });
    if (!Array.isArray(doc.associations) || i < 0 || i >= doc.associations.length) {
      return res.status(400).json({ error: "Bad index" });
    }
    doc.associations.splice(i, 1);
    await doc.save();
    res.json({ associations: doc.associations });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
