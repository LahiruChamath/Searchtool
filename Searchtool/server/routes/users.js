// server/routes/users.js  (unchanged)
const router = require("express").Router();
const User = require("../models/User");
const auth = require("../middleware/auth");

router.get("/", auth(["admin"]), async (req, res) => {
  const users = await User.find({}, { passwordHash: 0 }).sort({ createdAt: -1 });
  res.json(users);
});

router.patch("/:id", auth(["admin"]), async (req, res) => {
  const { name, role } = req.body;
  const update = {};
  if (name) update.name = name;
  if (role) update.role = role;
  const u = await User.findByIdAndUpdate(req.params.id, update, { new: true, projection: { passwordHash: 0 } });
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json(u);
});

module.exports = router;
