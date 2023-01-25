const jwt = require("jsonwebtoken");
const { token } = require("../config/config");
const User = require("../models/user");

exports.auth = async function (req, res, next) {
  try {
    const { Bearer } = req.cookies;
    console.log(Bearer);

    if (!Bearer) {
      res.redirect("/auth/login");
    }

    const decoded = jwt.verify(Bearer, token.Secret);
    console.log(decoded);
    req.user = await User.findOne({ _id: decoded.data._id });
    next();
  } catch (error) {
    console.log(error);
  }
};
