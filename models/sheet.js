const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const sheetSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    rowData: {
      type: Object,
    },
    googleId: {
      type: String,
    },
    idName: {
      type: String,
    },
  },
  { timestamps: true }
);

const SheetData = mongoose.model("sheet", sheetSchema);

module.exports = SheetData;
