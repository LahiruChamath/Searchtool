require("dotenv").config();
const mongoose = require("mongoose");

const dbConnect = () => {
    mongoose.connect(process.env.MONGO_URI)
        .then(() => console.log("✅ Database connected"))
        .catch(err => console.error("❌ Database connection error:", err));
};

module.exports = dbConnect;
