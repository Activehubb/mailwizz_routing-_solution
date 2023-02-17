const express = require("express");
const { auth } = require("../middleware/auth");
const Account = require("../models/account");
const mailWizz = require("node-mailwizz");
const {
  storeAccount,
  storeGoogleSheetData,
  storeGoogleSheetID,
} = require("../utils/utils");
const jwt = require("jsonwebtoken");
const { accountToken, token, googleSheetToken } = require("../config/config");
const uploadFile = require("../middleware/fileupload");
const fs = require("fs");
const parse = require("csv-parser");
const path = require("path");
const process = require("process");
const { GoogleAuth } = require("google-auth-library");
const { google } = require("googleapis");
const User = require("../models/user");
const GoogleID = require("../models/googleId");
const SheetData = require("../models/sheet");
const { clearCookie } = require("../middleware/clearCookie");

// Create a Router instance from the express module
const router = express.Router();

// Define the GET route for all Accounts
// Use the "auth" middleware for authentication, and
// the "async" keyword for asynchronous programming
router.get("/", auth, async (req, res) => {
  try {
    // Get the "account" cookie
    const { account } = req.cookies;

    // Find all accounts in the database that belong to the user
    const accountDB = await Account.find({ user: req.user._id });

    // If the "account" cookie is not undefined,
    if (account !== undefined) {
      // Verify the account cookie and extract its payload
      const strAccount = jwt.verify(account, accountToken.Secret);
      const { accountAPIkey, baseURL, accountPublicKey } = strAccount.payload;

      // Create a config object with the extracted information
      const config = {
        publicKey: accountPublicKey,
        secret: accountAPIkey,
        baseUrl: baseURL,
      };

      // Create a new instance of the mailWizz "Lists" class
      const lists = new mailWizz.Lists(config);

      // Get the lists from the API and parse the response
      lists
        .getLists((page = 1), (perPage = 10))
        .then((response) => {
          const parseResponse = JSON.parse(response);

          // Log the parseResponse to the console
          console.log(parseResponse);

          // Render the "home" view and pass the accountDB and list data
          res.render("home", {
            accountDB: accountDB,
            list: parseResponse.data,
          });
        })
        .catch((err) => console.log(err));
    } else {
      // If the "account" cookie is undefined, render the "dashboard" view
      res.render("dashboard", { user: req.user });
    }
  } catch (error) {
    // Log any errors that occur
    console.log(error);
  }
});

// Get Account Template
router.get("/account", auth, async (req, res) => {
  try {
    // Find account data for current user from Account collection
    const account = await Account.find({ user: req.user._id });

    // If there's existing account data
    if (account.length !== 0) {
      // Render the "getAccount" view and pass the account data
      res.render("getAccount", {
        accountDB: account,
      });
    } else {
      // Render the "account" view if there's no existing account data
      res.render("account");
    }
  } catch (error) {
    // Log error message
    console.log(error.message);
  }
});

// Create Account
router.post("/account", auth, async (req, res) => {
  try {
    // Destructure the account data from the request body
    const { accountAPIkey, accountPublicKey, baseURL } = req.body;

    // Create a new Account document
    const account = new Account({
      user: req.user._id,
      accountAPIkey,
      accountPublicKey,
      baseURL,
    });

    // Save the account data to the database
    await account.save();

    // Call the storeAccount utility function and pass the account data
    const strAccount = storeAccount(account);

    // Store the returned string as a cookie with the name "account"
    res.cookie("account", strAccount).redirect("/onboarding/lists");
  } catch (error) {
    // Log error message
    console.log(error.message);
  }
});

// Connect ID
router.post("/connect", auth, async (req, res) => {
  try {
    // Destructure the googleId data from the request body
    const { idName, googleID, limit, range } = req.body;

    // Create a new GoogleID document
    const googleId = new GoogleID({
      user: req.user._id,
      idName,
      googleID,
      limit,
      range,
    });

    // Save the googleId data to the database
    await googleId.save();

    // Call the storeGoogleSheetID utility function and pass the googleId data
    const storeGoogleSheetId = storeGoogleSheetID(googleId);

    // Store the returned string as a cookie with the name "sheetID"
    res.cookie("sheetID", storeGoogleSheetId).redirect("/onboarding/sheet");
  } catch (error) {
    // Log error message
    console.log(error.message);
  }
});

// The first route "/connect" handles the connection with Google Sheets.
// The "auth" middleware is used to check if the user is authenticated before accessing this route.
// The "async" keyword is used to handle asynchronous operations in the route.

router.get("/connect", auth, async (req, res) => {
  try {
    // Search for the user's Google ID in the database
    const getAvailableSheet = await GoogleID.find({ user: req.user.id });

    // Store a response message in the session to be displayed to the user
    req.session.response = {
      message: `Save google sheet or use if google sheet is available`,
      success: true,
      type: "info",
    };

    // If the user has a Google ID available, render the "getConnectedSheet" template
    // and pass the "googleSheet" data to the template
    if (getAvailableSheet.length !== 0) {
      res.render("getConnectedSheet", {
        googleSheet: getAvailableSheet,
      });
    } else {
      // If the user does not have a Google ID available, render the "connect" template
      res.render("connect");
    }
  } catch (error) {
    // Log any errors that occur during the operation
    console.log(error.message);
  }
});

// The second route "/lists" is used to get a list of mailing lists from the MailWizz API.
// The "auth" middleware is used to check if the user is authenticated before accessing this route.

router.get("/lists", auth, async (req, res) => {
  try {
    // Check if the "account" cookie is set
    const { account } = req.cookies;

    if (account) {
      // If the "account" cookie is set, verify the contents of the cookie
      const strAccount = jwt.verify(account, accountToken.Secret);

      // Destructure the payload of the verified cookie
      const { accountAPIkey, baseURL, accountPublicKey } = strAccount.payload;

      // Create the configuration object for the MailWizz API client
      const config = {
        publicKey: accountPublicKey,
        secret: accountAPIkey,
        baseUrl: baseURL,
      };

      // Create a new instance of the MailWizz API client
      const lists = new mailWizz.Lists(config);

      // Call the "getLists" method of the MailWizz API client
      lists
        .getLists((page = 1), (perPage = 10))
        .then((response) => {
          if (response) {
            // If a response is received, store a success message in the session
            req.session.response = {
              message: "Account created successfully, List found",
              success: "info",
            };
            // Redirect the user to the "/onboarding" route
            return res.redirect("/onboarding");
          }
        })
        .catch((err) => {
          req.session.response = {
            message: "Invalid API request",
            success: "danger",
          };
          return res.redirect("/onboarding");
        });
    }
  } catch (error) {
    req.session.response = {
      message: error.message,
      success: "danger",
    };
    return res.redirect("/onboarding");
  }
});

// Get Lists Route
router.get("/lists/:id", auth, async (req, res) => {
  // Try to find the account details by ID
  try {
    const getAccountAPIkey = await Account.findById(req.params.id);

    // Log the account details for debugging purposes
    console.log(getAccountAPIkey);

    // Destructure the account details into separate variables
    const { accountAPIkey, baseURL, accountPublicKey } = getAccountAPIkey;

    // Create the configuration object for MailWizz API
    const config = {
      publicKey: accountPublicKey,
      secret: accountAPIkey,
      baseUrl: baseURL,
    };

    // Create a new instance of the MailWizz Lists API using the configuration
    const lists = new mailWizz.Lists(config);

    // Call the `getLists` method of the Lists API, passing in the page and perPage parameters (default to 1 and 10 respectively)
    lists
      .getLists((page = 1), (perPage = 10))
      .then((response) => {
        // If the response is truthy (not null or undefined), set the success message in the session and redirect to the onboarding page
        if (response) {
          req.session.response = {
            message: "Account created successfully, List found",
            success: "info",
          };

          // Store the account details in a cookie
          const strAccount = storeAccount(getAccountAPIkey);

          // Set the account cookie and redirect to the onboarding page
          return res.cookie("account", strAccount).redirect("/onboarding");
        }
      })
      .catch((err) => {
        // If there is an error, set the error message in the session and redirect to the onboarding page
        req.session.response = {
          message: "Invalid API request",
          success: "danger",
        };
        return res.redirect("/onboarding");
      });
  } catch (error) {
    // If there is an error finding the account details, set the error message in the session and redirect to the onboarding page
    req.session.response = {
      message: error.message,
      success: "danger",
    };
    return res.redirect("/onboarding");
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
    const sheet = await SheetData.findOne({ googleId: req.params.id });
    const sheetID = await GoogleID.findOne({ googleID: req.params.id });

    console.log(sheetID);

    if (!sheet) {
      req.session.response = {
        message: `Can't connect to sheet from database`,
        success: "danger",
      };
      return res.redirect("/onboarding");
    }

    req.session.response = {
      message: "Google sheet data connected from database",
      success: "info",
    };

    req.session.storeData = { rows: sheet, sheetID: sheetID };

    const storeGoogleSheetId = storeGoogleSheetID(sheetID);

    res.cookie("sheetID", storeGoogleSheetId).redirect("/onboarding");
  } catch (error) {
    if (error) {
      req.session.response = {
        message: `An error occur: ${error.message}`,
        success: "danger",
      };
      return res.redirect("/onboarding");
    }
  }
});
router.get("/sheet", auth, async (req, res) => {
  try {
    const { sheetID } = req.cookies;

    if (sheetID === undefined) {
      req.session.response = {
        message: `Google Sheet ID is not connected. Please connect google sheet`,
        success: "danger",
      };
      return res.redirect("/onboarding");
    }

    const getGoogleSheetId = jwt.verify(sheetID, googleSheetToken);

    // console.log(getGoogleSheetId);

    const { googleID, idName } = getGoogleSheetId.payload;

    const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

    const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

    // /**
    //  * Prints the names and majors of students in a sample spreadsheet:
    //  * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
    //  * https://docs.google.com/spreadsheets/d/1bIlgvhRip-_4TwVIhpcfvpNDkT_DU70Fcb9PvwFNE7Y/edit#gid=0
    //  * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
    //  */

    const auth = new GoogleAuth({
      scopes: SCOPES,
      keyFile: CREDENTIALS_PATH,
    });

    const client = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: client });
    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: googleID,
      range: "Sheet1",
    });
    const rows = response.data;

    if (rows === undefined || null) {
      req.session.response = {
        message: `No data found in the google sheet`,
        success: "info",
      };
      return res.redirect("/onboarding");
    }

    const spreadSheetData = new SheetData({
      user: req.user._id,
      googleId: googleID,
      idName: idName,
      rowData: rows,
    });

    spreadSheetData.save((err, data) => {
      if (err) {
        req.session.response = {
          message: `An error occur: ${err.message}`,
          success: "danger",
        };
        return res.redirect("/onboarding");
      }

      req.session.response = {
        message: `Saved google sheet data to database`,
        success: "info",
      };

      req.session.storeData = { rows: data };
      console.log("dataCreated:", data);
      const sheetDataID = data.googleId;
      res.cookie("sheetData", sheetDataID).redirect("/onboarding");
    });
  } catch (error) {
    if (error) {
      req.session.response = {
        message: `An error occur: ${error.message}`,
        success: "danger",
      };
      res.redirect("/onboarding");
    }
  }

  // console.log("Name, Major:");

  // rows.forEach((row) => {
  //   // Print columns A and E, which correspond to indices 0 and 4.
  //   console.log(`${row[0]}, ${row[4]}`);
  // });
});

router.post("/upload/sheet/:id", auth, async (req, res) => {
  try {
    const { sheetID } = req.cookies;

    if (sheetID === undefined) {
      req.session.response = {
        message: `Kindly choose google sheet ID if available or create one to database`,
        success: "danger",
      };
      return res.redirect("/onboarding");
    }

    const getGoogleSheetId = jwt.verify(sheetID, googleSheetToken);

    const { limit, googleID } = getGoogleSheetId.payload;

    const getSheetById = await SheetData.findOne({ googleId: googleID });

    const items = getSheetById.rowData.values;

    function forEachWithDelay(array, callback, delay) {
      let i = 0;
      let interval = setInterval(() => {
        callback(array[i], i, array);
        if (++i === array.length) clearInterval(interval);
      }, delay);
    }

    forEachWithDelay(
      items,
      (item, i) => {
        console.log(i, item);

        const FName = item[1];
        const LName = item[2];
        const Email = item[0];
        const IP = item[3];
        const { account } = req.cookies;

        const strAccount = jwt.verify(account, accountToken.Secret);

        const { accountAPIkey, baseURL, accountPublicKey } = strAccount.payload;

        const config = {
          publicKey: accountPublicKey,
          secret: accountAPIkey,
          baseUrl: baseURL,
        };

        const subscribers = new mailWizz.ListSubscribers(config);

        const userInfo = {
          FNAME: FName,
          LNAME: LName,
          EMAIL: Email,
          ip_address: IP,
        };

        subscribers
          .create(req.params.id, userInfo)
          .then(function (responseData) {
            req.session.response = {
              message: `Upload #${i}: ${item.FirstName} successfully`,
              success: "info",
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
      message: `Upload session start in a minute, you can view the progress in your log dashboard`,
      success: "info",
    };
    res.status(200).redirect(`/onboarding/upload/sheet/${req.params.id}`);
  } catch (error) {
    console.log(error.message);
  }
});

router.get("/delete/sheet/:id", auth, async (req, res) => {
  try {
    const sheet = await GoogleID.findByIdAndDelete({ _id: req.params.id });

    if (sheet !== null) {
      req.session.response = {
        message: `SheetID Deleted successfully`,
        success: "info",
      };
      return res.redirect("/onboarding");
    }
  } catch (error) {
    req.session.response = {
      message: `${error.message}`,
      success: "danger",
    };
    return res.redirect("/onboarding");
  }
});
router.get("/delete/account/:id", auth, async (req, res) => {
  try {
    const account = await Account.findByIdAndDelete({ _id: req.params.id });

    if (account !== null) {
      req.session.response = {
        message: `Account Deleted successfully`,
        success: "info",
      };
      return res.redirect("/onboarding");
    }
  } catch (error) {
    req.session.response = {
      message: `${error.message}`,
      success: "danger",
    };
    return res.redirect("/onboarding");
  }
});
router.get("/delete/user", [auth, clearCookie], async (req, res) => {
  try {
    await User.findByIdAndDelete({ _id: req.user.id });
    await SheetData.findByIdAndDelete({ user: req.user.id });
    await GoogleID.findByIdAndDelete({ user: req.user.id });
    await Account.findByIdAndDelete({ user: req.user.id });

    console.log(req.user.id);

    req.session.response = {
      message: `User application deleted successfully...`,
      success: "info",
    };

    res.redirect("/onboarding");
  } catch (error) {
    req.session.response = {
      message: `${error.message}`,
      success: "danger",
    };
    return res.redirect("/auth/login");
  }
});
router.get("/del/account/:id", auth, (req, res) => {
  const id = req.params.id;
  res.render("warning", { id: id });
});
router.get("/del/sheet/:id", auth, (req, res) => {
  const id = req.params.id;
  res.render("sheetDel", { id: id });
});
router.get("/del/user", auth, (req, res) => {
  res.render("userDel");
});
module.exports = router;
