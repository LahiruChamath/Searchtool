// server/middleware/auth.js
const jwt = require("jsonwebtoken");

module.exports = (allowed = []) => {
  return (req, res, next) => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return res.status(401).json({ error: "Missing token" });

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload; // { id, email, name, role }

      if (allowed.length && !allowed.includes(payload.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
};
