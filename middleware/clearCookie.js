exports.clearCookie = function (req, res, next) {
  Object.keys(req.cookies).forEach(function (cookieName) {
    res.clearCookie(cookieName);
  });
  next();
};
