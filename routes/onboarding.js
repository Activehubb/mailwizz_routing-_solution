const express = require("express");
const { auth } = require("../middleware/auth");
const Account = require("../models/account");
const mailWizz = require("node-mailwizz");
const { storeAccount, storeGoogleSheetData, storeGoogleSheetID } = require("../utils/utils");
const jwt = require("jsonwebtoken");
const { accountToken, token, googleSheetToken } = require("../config/config");
const EventEmitter = require("events");
const uploadFile = require("../middleware/fileupload");
const fs = require("fs");
const parse = require("csv-parser");
const fsp = require("fs").promises;
const path = require("path");
const process = require("process");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const User = require("../models/user");
const GoogleID = require("../models/googleId");

const router = express.Router();

// Get all Account
router.get("/", auth, async (req, res) => {
  try {
    const { Bearer, account, rows } = req.cookies;

    const decoded = jwt.verify(Bearer, token.Secret);

    req.user = await User.findOne({ _id: decoded.data._id });

    console.log("User:", req.user);

    const accountDB = await Account.find({ user: req.user._id });

    if (account !== undefined) {
      const strAccount = jwt.verify(account, accountToken.Secret);

      const { accountAPIkey, baseURL } = strAccount.payload;

      const config = {
        publicKey: accountAPIkey,
        secret: accountAPIkey,
        baseUrl: baseURL,
      };

      if (rows !== undefined) {
        const decodeRow = jwt.verify(rows, googleSheetToken);

        console.log(decodeRow);
        req.session.storeData = { rows: decodeRow.payload };
      }

      const lists = new mailWizz.Lists(config);

      lists.getLists((page = 1), (perPage = 10)).then((response) => {
        const parseResponse = JSON.parse(response);
        console.log(parseResponse);
        res.render("home", {
          accountDB: accountDB,
          list: parseResponse.data,
        });
      });
    } else {
      res.render("dashboard", { user: req.user });
    }
  } catch (error) {
    console.log(error);
  }
});

// Get Account Template
router.get("/account", auth, async (req, res) => {
  try {
    const account = await Account.find({ user: req.user._id });
    console.log(account);

    if (account.length !== 0) {
      res.render("getAccount", {
        accountDB: account,
      });
    } else {
      res.render("account");
    }
  } catch (error) {
    console.log(error.message);
  }
});

// Create Account
router.post("/account", auth, async (req, res) => {
  try {
    const { accountAPIkey, accountPublicKey, baseURL } = req.body;

    const account = new Account({
      user: req.user._id,
      accountAPIkey,
      accountPublicKey,
      baseURL,
    });

    await account.save();

    const strAccount = storeAccount(account);

    res.cookie("account", strAccount).redirect("/onboarding/lists");
  } catch (error) {
    console.log(error.message);
  }
});

// Connect ID
router.post("/connect", auth, async (req, res) => {
  try {
    const { idName, googleID } = req.body;

    const googleId = new GoogleID({
      user: req.user._id,
      idName,
      googleID,
    });

    await googleId.save();

    const storeGoogleSheetId = storeGoogleSheetID(googleId);

    res.cookie("sheetID", storeGoogleSheetId).redirect("/onboarding/sheet");
  } catch (error) {
    console.log(error.message);
  }
});

router.get('/connect', auth, async(req, res) => {
try {
  const getAvailableSheet = await GoogleID.find({user:  req.user.id})

  req.session.response = {
    message: `Save google sheet or use if google sheet is available`,
    success: true,
    type: "info",
  };

  if (getAvailableSheet.length !== 0) {
    res.render("getConnectedSheet", {
      googleSheet: getAvailableSheet,
    });
  } else {
    res.render("connect");
  }
} catch (error) {
  console.log(error.message)
}
})

router.get("/list", auth, async (req, res) => {
  const { account } = req.cookies;

  if (account !== undefined) {
    const strAccount = jwt.verify(account, accountToken.Secret);

    const { accountAPIkey, baseURL } = strAccount.payload;

    const config = {
      publicKey: accountAPIkey,
      secret: accountAPIkey,
      baseUrl: baseURL,
    };

    const lists = new mailWizz.Lists(config);

    lists
      .getLists((page = 1), (perPage = 10))
      .then((response) => {
        if (response) res.redirect("/onboarding");
      })
      .catch((err) => console.log(err));
  } else {
    res.redirect("/onboarding/account");
  }
});

router.get("/lists", auth, async (req, res) => {
  const { account } = req.cookies;

  if (account !== undefined) {
    const strAccount = jwt.verify(account, accountToken.Secret);

    const { accountAPIkey, baseURL } = strAccount.payload;

    const config = {
      publicKey: accountAPIkey,
      secret: accountAPIkey,
      baseUrl: baseURL,
    };

    const lists = new mailWizz.Lists(config);

    lists
      .getLists((page = 1), (perPage = 10))
      .then((response) => {
        if (response) res.redirect("/onboarding");
      })
      .catch((err) => console.log(err));
  } else {
    res.redirect("/onboarding/account");
  }
});

// Get Lists
router.get("/lists/:id", auth, async (req, res) => {
  const getAccountAPIkey = await Account.findById(req.params.id);

  console.log(getAccountAPIkey);

  if (getAccountAPIkey !== undefined) {
    const { accountAPIkey, baseURL, accountPublicKey } = getAccountAPIkey;

    const config = {
      publicKey: accountAPIkey,
      secret: accountAPIkey,
      baseUrl: baseURL,
    };

    const lists = new mailWizz.Lists(config);

    lists
      .getLists((page = 1), (perPage = 10))
      .then((responseData) => {
        const parseResponse = JSON.parse(responseData);
        req.session.response = {
          message: `This list contains your first 10 list from the ${accountPublicKey} name`,
          success: true,
          type: "info",
        };
        res.render("lists", {
          list: parseResponse.data,
        });
      })
      .catch((err) => console.log(err));
  } else {
    res.redirect("/onboarding/account");
  }
});

// Create List
router.get("/lists/upload/:id", auth, (req, res) => {
  const id = req.params.id;
  res.render("upload", { id });
});

router.get("/upload/sheet/:id", auth, (req, res) => {
  const id = req.params.id;
  res.render("upload", { id });
});

router.post(
  "/lists/upload/:id",
  auth,
  uploadFile.single("file"),
  (req, res) => {
    try {
      if (req.file === undefined) {
        req.session.response = {
          message: `Please upload a csv file`,
          success: "danger",
        };
        res.redirect(`/onboarding/lists/upload/${req.params.id}`);
      }
      console.log(req.file);

      const fileResult = [];

      const path = __basename + "/upload/" + req.file.filename;

      fs.createReadStream(path)
        .pipe(
          parse({
            skipComments: true,
            columns: true,
          })
        )
        .on("data", (data) => {
          fileResult.push(data);
        })
        .on("error", (err) => {
          console.log(err);
        })
        .on("end", () => {
          const uniqueID = req.params.id;

          function forEachWithDelay(array, callback, delay) {
            let i = 0;
            let interval = setInterval(() => {
              callback(array[i], i, array);
              if (++i === array.length) clearInterval(interval);
            }, delay);
          }

          const items = fileResult;
          console.log(items);

          forEachWithDelay(
            items,
            (item, i) => {
              console.log(`#${i}: ${item.FirstName} `);
              const FName = item.FirstName;
              const LName = item.LastName;
              const Email = `${i}xyz@gmail.com`;
              const { account } = req.cookies;

              const strAccount = jwt.verify(account, accountToken.Secret);

              const { accountAPIkey, baseURL } = strAccount.payload;

              const config = {
                publicKey: accountAPIkey,
                secret: accountAPIkey,
                baseUrl: baseURL,
              };

              const subscribers = new mailWizz.ListSubscribers(config);

              const userInfo = {
                FNAME: FName,
                LNAME: LName,
                EMAIL: Email,
              };

              subscribers
                .create(uniqueID, userInfo)
                .then(function (responseData) {
                  req.session.response = {
                    message: `Upload #${i}: ${item.FirstName} successfully`,
                    success: "info",
                    data: responseData,
                  };
                  res.redirect(`/onboarding/lists/upload/${req.params.id}`);
                })
                .catch((err) => {
                  if (err) {
                    req.session.response = {
                      message: `An error occured ${err.error}`,
                      success: "info",
                    };
                    return res.redirect(
                      `/onboarding/lists/upload/${req.params.id}`
                    );
                  }
                });
            },
            60000
          );
        });
    } catch (error) {
      console.log(error);
    }
  }
);

router.get("/sheet/:id", auth, async (req, res) => {
  try {
    const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

    const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

    /**
     * Prints the names and majors of students in a sample spreadsheet:
     * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
     * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
     */

    const auth = new GoogleAuth({
      scopes: SCOPES,
      keyFile: CREDENTIALS_PATH,
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: req.params.id,
      range: "Class Data!A2:E",
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      req.session.response = {
        message: `No data found in the google sheet`,
        success: "info",
      };
      return res.redirect("/onboarding");
    } else {
      const storeRowsToCookies = storeGoogleSheetData(rows);
      req.session.storeData = { rows:rows, };
      req.session.response = {
        message: `Data found in the google sheet`,
        success: "info",
      };
      res.cookie("rows", storeRowsToCookies).render("sheet", {
        rows: rows,
      });
    }
  } catch (error) {
    if (error) {
      req.session.response = {
        message: `An error occur: ${error.message}`,
        success: "danger",
      };
      return res.redirect("/onboarding");
    }
  }

  // console.log("Name, Major:");

  // rows.forEach((row) => {
  //   // Print columns A and E, which correspond to indices 0 and 4.
  //   console.log(`${row[0]}, ${row[4]}`);
  // });
});
router.get("/sheet", auth, async (req, res) => {
  try {

    const {sheetID} = req.cookies

    if(sheetID === undefined) {
      return res.redirect('/onboarding/connect')
    }

    const {googleID} = sheetID.payload
    console.log(sheetID)

    const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

    const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

    /**
     * Prints the names and majors of students in a sample spreadsheet:
     * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
     * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
     */

    const auth = new GoogleAuth({
      scopes: SCOPES,
      keyFile: CREDENTIALS_PATH,
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: googleID,
      range: "Class Data!A2:E",
    });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      req.session.response = {
        message: `No data found in the google sheet`,
        success: "info",
      };
      return res.redirect("/onboarding");
    } else {
      const storeRowsToCookies = storeGoogleSheetData(rows);
      req.session.response = {
        rows: rows,
        message: `Data found in the google sheet`,
        success: "info",
      };
      res.cookie("rows", storeRowsToCookies).render("sheet", {
        rows: rows,
      });
    }
  } catch (error) {
    if (error) {
      req.session.response = {
        message: `An error occur: ${error.message}`,
        success: "info",
      };
      return res.redirect("/onboarding");
    }
  }

  // console.log("Name, Major:");

  // rows.forEach((row) => {
  //   // Print columns A and E, which correspond to indices 0 and 4.
  //   console.log(`${row[0]}, ${row[4]}`);
  // });
});

router.post("/upload/sheet/:id", async (req, res) => {
  try {
    const { rows } = req.cookies;

    if (rows === undefined) {
      req.session.response = {
        message: `Google sheet is not connected`,
        success: "danger",
      };
      return res.redirect("/onboarding");
    }

    function forEachWithDelay(array, callback, delay) {
      let i = 0;
      let interval = setInterval(() => {
        callback(array[i], i, array);
        if (++i === array.length) clearInterval(interval);
      }, delay);
    }

    const decodeRow = jwt.verify(rows, googleSheetToken);

    const items = decodeRow.payload;
    console.log(items);

    forEachWithDelay(
      items,
      (item, i) => {
        console.log(`#${i}: ${item[0]} `);
        const FName = item[1];
        const LName = item[2];
        const Email = item[3];
        const { account } = req.cookies;

        const strAccount = jwt.verify(account, accountToken.Secret);

        const { accountAPIkey, baseURL } = strAccount.payload;

        const config = {
          publicKey: accountAPIkey,
          secret: accountAPIkey,
          baseUrl: baseURL,
        };

        const subscribers = new mailWizz.ListSubscribers(config);

        const userInfo = {
          FNAME: FName,
          LNAME: LName,
          EMAIL: `${i}xyz@gmail.com`,
        };

        subscribers
          .create(req.params.id, userInfo)
          .then(function (responseData) {
            req.session.response = {
              rows:rows,
              message: `Upload #${i}: ${item.FirstName} successfully`,
              success: "info",
              data: responseData,
            };
            console.log(responseData);
          })
          .catch((err) => {
            if (err) {
              req.session.response = {
                message: `An error occur: ${err.error}`,
                success: "info",
              };
            }
            console.log(err);
          });
      },
      60000
    );

    req.session.response = {
      message: `Upload in a minute`,
      success: "info",
    };
    res.status(200).redirect(`/onboarding/upload/sheet/${req.params.id}`);
  } catch (error) {
    console.log(error.message);
  }
});

router.delete("/lists/delete/:id", auth, (req, res) => {
  res.render("account");
});
module.exports = router;
