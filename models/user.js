const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: { type: String },
  password: { type: String },
});

const User = mongoose.model("user", userSchema);

module.exports = User;
