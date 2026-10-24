require('dotenv').config();

var crypto = require("crypto");
var express = require("express");
var mongoose = require("mongoose");
var helmet = require("helmet");
var path = require("path");

mongoose.set("sanitizeFilter", true);

var app = express();
app.set("trust proxy", 1);
app.set("port", process.env.PORT || 3000);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.locals.showProductUrls = process.env.SHOW_PRODUCT_URLS === 'true';
app.locals.mongoEnvironment = process.env.MONGODB_ENVIRONMENT || 'unknown';
app.locals.socialIcons = require('./config/social-icons.json');

app.use(function (req, res, next) {
    res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
    next();
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                function (req, res) { return "'nonce-" + res.locals.cspNonce + "'"; },
                "https://ajax.googleapis.com",
                "https://maps.googleapis.com",
                "https://maps.gstatic.com"
            ],
            scriptSrcAttr: ["'none'"],
            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                "https://maxcdn.bootstrapcdn.com",
                "https://cdnjs.cloudflare.com",
                "https://fonts.googleapis.com"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https://maps.google.com",
                "https://*.googleapis.com",
                "https://*.gstatic.com",
                "https://*.google.com",
                "https://*.googleusercontent.com"
            ],
            connectSrc: [
                "'self'",
                "https://*.googleapis.com",
                "https://*.gstatic.com",
                "https://*.google.com"
            ],
            fontSrc: [
                "'self'",
                "data:",
                "https://cdnjs.cloudflare.com",
                "https://maxcdn.bootstrapcdn.com",
                "https://fonts.gstatic.com"
            ],
            frameSrc: ["https://www.google.com", "https://maps.google.com"],
            workerSrc: ["'self'", "blob:"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: null
        }
    }
}));

app.use(express.static(path.join(__dirname, "static")));

var routes = require("./routes");

async function start() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is required');
        }
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 30000,
            autoCreate: false,
            autoIndex: false
        });
        console.log("MongoDB connected");

        app.use(routes);
        app.use(function (req, res) {
            res.status(404).send("Not Found");
        });
        app.use(function (error, req, res, next) {
            if (res.headersSent) {
                return next(error);
            }

            var details = error && error.stack ? error.stack : String(error);
            details = details.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[redacted MongoDB URI]');
            console.error("Request failed:", details);

            var status = Number.isInteger(error)
                ? error
                : error && (error.status || error.statusCode);
            if (!Number.isInteger(status) || status < 400 || status > 599) {
                status = 500;
            }
            res.status(status).send(status === 404 ? "Not Found" : "Something went wrong");
        });

        app.listen(app.get("port"), function() {
            console.log("Server started on port " + app.get("port"));
        });
    } catch (error) {
        var message = String(error.message).replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[redacted MongoDB URI]');
        console.error("MongoDB startup failed (" + error.name + "): " + message);
        await mongoose.disconnect();
        process.exitCode = 1;
    }
}

start();
