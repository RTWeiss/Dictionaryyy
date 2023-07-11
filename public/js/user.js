const express = require("express");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const app = express();

// Mock user data
const users = [{ id: 1, username: "user", password: "password" }];

// Passport setup
passport.use(
  new LocalStrategy(function (username, password, done) {
    const user = users.find((user) => user.username === username);
    if (!user) {
      return done(null, false, { message: "Incorrect username." });
    }
    if (user.password !== password) {
      return done(null, false, { message: "Incorrect password." });
    }
    return done(null, user);
  })
);

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  const user = users.find((user) => user.id === id);
  done(null, user);
});

// Middleware setup
app.use(express.urlencoded({ extended: false }));
app.use(
  session({ secret: "secret key", resave: false, saveUninitialized: false })
);
app.use(passport.initialize());
app.use(passport.session());

// Set the view engine to EJS
app.set("view engine", "ejs");

// Routes
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/dashboard");
  }
);

app.get(
  "/dashboard",
  require("connect-ensure-login").ensureLoggedIn(),
  (req, res) => {
    res.render("dashboard", { user: req.user });
  }
);

app.listen(3000, () => {
  console.log("App is running on http://localhost:3000");
});
