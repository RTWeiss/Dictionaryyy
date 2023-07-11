const express = require("express");
const router = express.Router();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// User Registration
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *",
      [username, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully!",
      user: newUser.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: "There was a server side error" });
  }
});

// User Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await pool.query("SELECT * FROM users WHERE username = $1", [
      username,
    ]);

    if (user.rows.length > 0) {
      const validPassword = await bcrypt.compare(
        password,
        user.rows[0].password
      );

      if (!validPassword) {
        return res.status(401).json({ error: "Incorrect password!" });
      }

      res.json({
        message: "Logged in successfully!",
        user: user.rows[0],
      });
    } else {
      res.status(401).json({ error: "User does not exist!" });
    }
  } catch (err) {
    res.status(500).json({ error: "There was a server side error" });
  }
});

module.exports = router;
