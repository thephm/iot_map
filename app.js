// IoT Map main Node.js file

// Load the `.env` file to get:
//
// GOOGLE_MAPS_API_KEY=blah
// SESSION_SECRET = guess
// 
require('dotenv').config();

// Express middleware for parsing body of incoming HTTP requests. It 
// extracts the body of an incoming stream and exposes it on `req.body`
var bodyParser = require("body-parser"); 

// Express middleware to parse cookies attached to incoming HTTP requests
var cookieParser = require("cookie-parser");

// Express.js web app framework for Node.js 
var express = require("express");

// Mongo database access
var mongoose = require("mongoose");

// Node.js authentication middleware for credentials including OAuth, JWT
var passport = require("passport");

// Node.js cross-platform utilities for file and directory paths
var path = require("path");

// Express middleware for session management
var session = require('express-session');
var flash = require('connect-flash');

// Express middleware to serve the favicon ("favorite icon")
//var favicon = require("serve-favicon");

var setUpPassport = require("./setuppassport");

const { exit } = require("process");

var app = express();

// connect to the datbase
mongoose.connect(process.env.MONGODB_URI)

setUpPassport();

//app.set("port", process.env.PORT || 443);
app.set("port", process.env.PORT || 3000);

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, "public", "favicon.ico")));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "static")));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true
}));

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

var routes = require("./routes");
app.use(routes);

// handle `next(err)` calls
//app.use(function (err, req, res, next) {
    // do nothing for now
//    next();
//});

app.listen(app.get("port"), function() {
    console.log("Server started on port " + app.get("port"));
});
