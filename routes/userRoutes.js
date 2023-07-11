const express = require("express");
const router = express.Router();
const User = require("../models/User");

// User Registration
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = new User({ username, password });
    await user.save();

    res.status(201).json({
      message: "User registered successfully!",
    });
  } catch (err) {
    res.status(500).json({ error: "There was a server side error" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    // Session creation, token generation etc.
    // For simplicity, it is not included here

    res.json({
      message: "User logged in successfully!",
    });
  } catch (err) {
    res.status(500).json({ error: "There was a server side error" });
  }
});

module.exports = router;
