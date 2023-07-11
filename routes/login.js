const express = require("express");
const router = express.Router();
const passport = require("passport");

// This route displays the login form
router.get("/login", function (req, res, next) {
  res.render("login", { title: "Login" });
});

// This route handles user login, Passport authenticates the user based on the local strategy
// You would need to setup the local strategy in your Passport configuration
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard", // redirect to dashboard on successful login
    failureRedirect: "/login", // redirect back to login page on failure
    failureFlash: true, // allow flash messages
  })
);

module.exports = router;
