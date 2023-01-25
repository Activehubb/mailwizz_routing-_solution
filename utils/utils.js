const jwt = require("jsonwebtoken");
const { token, accountToken, googleSheetToken } = require("../config/config");

exports.tokens = function (payload) {
  const option = {
    data: payload,
  };
  return jwt.sign(option, token.Secret, { expiresIn: token.expireIn });
};

exports.storeAccount = function (payload) {
  const option = {
    payload,
  };

  return jwt.sign(option, accountToken.Secret);
};

exports.storeGoogleSheetData = function (payload) {
  const option = { payload };
  return jwt.sign(option, googleSheetToken);
};

exports.storeGoogleSheetID = function (payload) {
  const option = { payload };
  return jwt.sign(option, googleSheetToken);
};
