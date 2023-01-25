const express = require("express");
const authRoute = require("./routes/auth");
const dbConnect = require("./config/dbConfig");
const config = require("./config/config");
const profileRoute = require("./routes/onboarding");
const bodyParser = require("body-parser");
const session = require("express-session");
const cookieParser = require("cookie-parser");

global.__basename = __dirname + "/";

const app = express();

app.set("view engine", "ejs");

app.use(express.static("public"));
// app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: "secretkey",
    saveUninitialized: true,
    resave: true,
  })
);

app.use((req, res, next) => {
  res.locals.storeData = req.session.storeData;
  req.session.storeData;
  res.locals.response = req.session.response;
  delete req.session.response;
  next();
});

dbConnect();
// Home route

app.get("/", (req, res) => {
  res.redirect("/auth/login");
});

app.use("/auth", authRoute);
app.use("/onboarding", profileRoute);

const PORT = 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
