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
dbConnect();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*", exposedHeaders: ["Authorization"] }));
app.use(express.json());
app.use("/uploads", cors({ origin: process.env.FRONTEND_ORIGIN || "*" }), express.static(path.join(__dirname, "uploads")));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/consultants", consultantsRouter);
app.use("/api/permissions", permissionsRouter);

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

