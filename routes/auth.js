const express = require("express");
const passport = require("passport");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const { tokens } = require("../utils/utils");

const router = express.Router();

// login route
// @desc ===  public
router.get("/login", (req, res) => {
  const { Bearer } = req.cookies;

  if (Bearer) {
    return res.redirect("/onboarding");
  }
  res.render("login");
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    console.log(user);

    if (!user) {
      req.session.response = {
        message: "User does not exist",
        success: "danger",
      };
      return res.redirect("/auth/login");
    } else if (user) {
      console.log("userdata", user);

      const validate = await bcrypt.compare(password, user.password);

      if (!validate) {
        req.session.response = {
          message: "Invalid credentials",
          success: "danger",
        };
        return res.redirect("/auth/login");
      }

      const assignToken = await tokens(user);

      const cookieOption = {
        maxAge: 3 * 24 * 60 * 60 * 1000,
        httpOnly: true,
      };
      req.session.response = {
        message: "Logged In successfully",
        success: "success",
      };
      res.cookie("Bearer", assignToken, cookieOption).redirect("/onboarding");
    }
  } catch (error) {
    console.log(error.message);
    req.session.response = {
      message: `An error occur: ${error.message}`,
      success: "danger",
    };
  }
});

router.get("/signup", (req, res) => {
  const { Bearer } = req.cookies;

  if (Bearer) {
    return res.redirect("/onboarding");
  }
  res.render("signup");
});

router.post("/signup", async (req, res) => {
  try {
    const checkUserIsAvailable = await User.findOne({ email: req.body.email });

    if (checkUserIsAvailable) {
      req.session.response = {
        message: "There is a user with this email, kindly login",
        success: "info",
      };
      return res.redirect("/auth/signup");
    }
    // Hash password
    const genSalt = await bcrypt.genSalt(10);
    const hashPass = await bcrypt.hash(req.body.password, genSalt);

    const user = new User({
      email: req.body.email,
      password: hashPass,
    });

    // Save data to DB
    await user.save();

    // Assign a token TO Data
    const assignToken = tokens(user);

    // Store assignToken in a cookie
    const cookieOption = {
      maxAge: 3 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    };

    res
      .status(200)
      .cookie("Bearer", assignToken, cookieOption)
      .redirect("/onboarding");
  } catch (error) {
    console.log(error.message);
    req.session.response = {
      message: `An error occur: ${error.message}`,
      success: "danger",
    };
  }
});

router.get("/logout", (req, res) => {
  res.send("logout");
});

module.exports = router;
