require("dotenv").config();
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const groupRoutes = require("./routes/groupRoutes");

const app = express();

app.use(cors());
app.use(express.json());

// DB connect
connectDB();

// Routes
app.use("/api", groupRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ message: "Server working" });
});

app.listen(process.env.PORT || 5000, () => {
  console.log("Server running on port 5000");
});
