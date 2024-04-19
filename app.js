/// <reference path="app.sync-conflict-20221103-075835-HU2HSXF.js" />
// require everything needed, including Mongoose
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var express = require("express");
var mongoose = require("mongoose");
var passport = require("passport");
var path = require("path");
var session = require("express-session");
var favicon = require("serve-favicon");

var setUpPassport = require("./setuppassport");
var routes = require("./routes");

const { exit } = require("process");

var app = express();

// if Mongo running outside container, use
// mongoose.connect("mongodb://localhost:27017/iotmap", {useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true } );
// OR
// if Mongo running inside container, use
mongoose.connect("mongodb://mongo:27017/iotmap", { useUnifiedTopology: true, useNewUrlParser: true } );

setUpPassport();

//app.set("port", process.env.PORT || 443 );
app.set("port", process.env.PORT || 3000 );

// view engine setup
app.set("views", path.join( __dirname, "views") );
app.set("view engine", "ejs");

// uncomment after placing your favicon in /public
//app.use( favicon( path.join( __dirname, "public", "favicon.ico") ) );
app.use( bodyParser.json() );
app.use( bodyParser.urlencoded( { extended: false } ) );
app.use( cookieParser() );
app.use( express.static( path.join( __dirname, "static") ) );

app.use( session( {
  secret: "LUp$Dg?,I#i&owP3=9su+OB%`JgL4muLF5YJ~{;t",
  resave: true,
  saveUninitialized: true
}));

app.use( passport.initialize() );
app.use( passport.session() );

app.use( routes );

// handle `next(err)` calls
app.use( function( err, req, res, next ) {
  // do nothing for now
  next();
});

app.listen( app.get("port"), function() {
  console.log("Server started on port " + app.get("port") );
});
