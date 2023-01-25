const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const accountSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    accountAPIkey: {
      type: String,
      required: true,
    },
    accountPublicKey: {
      type: String,
      required: true,
    },
    baseURL: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const Account = mongoose.model("account", accountSchema);

module.exports = Account;
