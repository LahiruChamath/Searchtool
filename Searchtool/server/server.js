// server/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const dbConnect = require("./dbConnect");

const consultantsRouter = require("./routes/consultants");
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const permissionsRouter = require("./routes/permissions");

const app = express();

// Allow ALL origins (reflected) + credentials
const corsOptions = {
  origin: true, // reflect the request origin
  credentials: true,
  exposedHeaders: ["Authorization"],
};

// Global CORS
app.use(cors(corsOptions));
// Optional explicit preflight handling (cors() already does this)
app.options(/.*/, cors(corsOptions));

app.use(express.json());

// Serve uploads with CORS
app.use("/uploads", cors(corsOptions), express.static(path.join(__dirname, "uploads")));

// API routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/consultants", consultantsRouter);
app.use("/api/permissions", permissionsRouter);

const PORT = process.env.PORT || 8081;

// Start server after DB connects
(async () => {
  try {
    await dbConnect();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
      console.log("CORS: allowing all origins (reflected)");
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();``