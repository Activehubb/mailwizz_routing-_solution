const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const googleIDSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    idName: {
      type: String,
      required: true,
    },
    limit: {
      type: String
    },
    googleID: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const GoogleID = mongoose.model("googleID", googleIDSchema);

module.exports = GoogleID;
