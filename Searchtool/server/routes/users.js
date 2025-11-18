// server/routes/users.js
const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

// List users (admin only) – passwordHash omitted
router.get("/", auth(["admin"]), async (req, res) => {
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
  res.json(users);
});

// Update user name/role (admin only)
router.patch("/:id", auth(["admin"]), async (req, res) => {
  const { name, role } = req.body;
  const update = {};
  if (name) update.name = name;
  if (role) update.role = role;

  const u = await User.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, projection: { passwordHash: 0 } }
  );

  if (!u) return res.status(404).json({ error: "User not found" });
  res.json(u);
});

// Create user (admin only)
router.post("/", auth(["admin"]), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    const doc = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: role && ["admin","editor","viewer"].includes(role) ? role : "viewer",
    });

    const { passwordHash: _ignore, ...safe } = doc.toObject();
    res.status(201).json(safe);
  } catch (e) {
    if (e.code === 11000) {
      // duplicate key (email)
      return res.status(409).json({ error: "Email already exists" });
    }
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
