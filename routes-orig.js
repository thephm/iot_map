var fs = require('fs');
var categoriesFile = fs.readFileSync('static/config/categories.json');
var Categories = JSON.parse(categoriesFile);


var User = require('./models/user');
var Organization = require('./models/organization');
var Person = require("./models/person");

var express = require('express');
var passport = require('passport');

var router = express.Router();

// https://github.com/winstonjs/winston/blob/master/examples/quick-start.js

const winston = require('winston');
const { format } = winston; // import the format utility

const logger = winston.createLogger({
    level: 'info',
    defaultMeta: { service: 'iot_map' },
    transports: [
        new winston.transports.File({
            level: 'info',
            filename: './logs/all-logs.log',
            handleExceptions: true,
            json: true,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            colorize: false
        }),
        new winston.transports.Console({
            level: 'debug',
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});

module.exports = logger;

module.exports.stream = {
    write: function (message, encoding) {
        logger.info(message);
    }
};

// if not in prod, log to the `console`
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            format.colorize(),
            format.simple()
        )
    }));
}

/**
 * Converts a string into a slug that can be used as a RESTful URI endpoint.
 * Changes to the string to lowercase and then replaces specific characters
 * like '&' and '/' with '-'
 *
 * @param str value the value to be slug-ged
 * @return str a slug that can be used for endpoint
 */
function getSlug(value) {

    slug = value.toLowerCase();
    slug = slug.replace(".", "-");
    slug = slug.replace("&", "-");
    slug = slug.replace("(", "-");
    slug = slug.replace(")", "-");
    slug = slug.replace(/ /gi, "-");
    slug = slug.replace(":", "-");
    slug = slug.replace(",", "");
    slug = slug.replace("/", "-");

    return slug;

} // getSlug

/**
 * Take the basic info values from 'req' and add them to the 'organization'
 *
 * @param req req request object with the Organizaion info from the form
 * @param array organization the organization to add the basic information to
 */
function addBasicInfo(req, organization) {

    orgName = req.body.name;
    slug = getSlug(orgName);

    description = req.body.description;
    url = req.body.url;
    today = new Date();

    organization['name'] = orgName;
    organization['slug'] = slug;
    organization['date_added'] = today;
    if (description.length) { organization['description'] = description; }
    if (url.length) { organization['url'] = url; }

} // addBasicInfo

/**
 * Take the organization history values from 'req' and set in 'organization'
 *
 * @todo: see if founder exists and use their ObjectID, if not found create a
 * new Person document for them
 *
 * @param req req request object with the Organizaion history info from the form
 * @param array organization the organization to add the history information to
 */
function addHistory(req, organization) {

    if (typeof req.body['founded_year'] != 'undefined') {
        organization['history']['founded_year'] = req.body.founded_year;
    }

    if (typeof req.body['acquired_year'] != 'undefined') {
        organization['history']['acquired_year'] = req.body.acquired_year;
    }

    if (typeof req.body['acquired_by'] != 'undefined') {
        organization['history']['acquired_by'] = req.body.acquired_by;
    }

    if (typeof req.body['died_year'] != 'undefined') {
        organization['history']['died_year'] = req.body.died_year;
    }

    firstName = '';
    lastName = '';
    founderName = '';

    if (typeof req.body['founder1_first_name'] != 'undefined') {
        firstName = req.body.founder1_first_name;
    }

    if (typeof req.body['founder1_last_name'] != 'undefined') {
        lastName = req.body.founder1_last_name;
    }

    if (firstName.length) {
        founderName = firstName;
        if (lastName.length) { fullName = firstName + ' ' + lastName; }
    } else if (lastName.length) {
        founderName = lastName;
    }

    if (founderName.length) {
        organization['history']['founder'][0]['name'] = founderName;
    }

    if (typeof req.body['founder1_url'] != 'undefined') {
        url = req.body['founder1_url'];
        if (url.length) {
            organization['history']['founder'][0]['url'] = url;
        }
    }

} // addHistory

/**
 * Take the values from 'req' and add them to the 'organization'.
 *
 * @param req req request object with the service info from the form submitted
 * @param array organization the organization to add Social Networks into
 */
function addServices(req, organization) {

    var services = ['Twitter', 'LinkedIn', 'Facebook', 'Instagram'];

    var serviceURLs = new Array;

    serviceURLs['Twitter'] = 'https://twitter.com/';
    serviceURLs['LinkedIn'] = 'https://linkedin.com/';
    serviceURLs['Facebook'] = 'https://facebook.com/';
    serviceURLs['Instagram'] = 'https://instagram.com/';

    x = 0;

    services.forEach(function (service) {
        field = service.toLowerCase() + '_account';
        url = service.toLowerCase() + '_url';

        if (typeof req.body[field] !== 'undefined') {
            account = req.body[field];
            if (account.length) {

                if (typeof req.body[url] != 'undefined') { url = req.body[url]; }
                else { url = serviceURLs[service] + account; }

                organization.social_network[x] = {
                    service: service,
                    account: account,
                    url: url
                };
                x++;
            }
        }
    });

} // addServices

/**
 * Take the location values from 'req' and add them to the 'organization'
 *
 * @param req req request object with the location info from the form submitted
 * @param array organization the organization to add the location info into
 */
function addLocation(req, organization) {

    organization['location'] = {
        head_office: true,
        address: {
        }
    }

    address = organization.location.address;

    if (typeof req.body.location_phone_number != 'undefined' &&
        typeof req.body.location_phone_number.length) {
        organization['location'][0]['phone_number'] =
            req.body.location_phone_number;
    }

    if (typeof req.body.location_email != 'undefined' &&
        req.body.zlocation_email.length) {
        organization['location'][0]['email'] = req.body.location_email;
    }

    if (typeof req.body.location_lng != 'undefined' &&
        req.body.location_lng.length) {
        organization['location'][0]['address']['lng'] =
            req.body.location_lng;
    }

    if (typeof req.body.location_address != 'undefined' &&
        req.body.location_address.length) {
        organization['location'][0]['address']['street'] =
            req.body.location_address;
    }

    if (typeof req.body.location_suite != 'undefined' &&
        req.body.location_suite.length) {
        organization['location'][0]['address']['suite'] =
            req.body.location_suite;
    }

    if (typeof req.body.location_city != 'undefined' &&
        req.body.location_city.length) {
        organization['location'][0]['address']['city'] =
            req.body.location_city;
    }

    if (typeof req.body.location_state_province != 'undefined' &&
        req.body.location_state_province.length) {
        organization['location'][0]['address']['state_province'] =
            req.body.location_state_province;
    }

    if (typeof req.body.location_country != 'undefined' &&
        req.body.location_country.length) {
        organization['location'][0]['address']['country'] =
            req.body.location_country;
    }

    if (typeof req.body.location_postal_zip != 'undefined' &&
        req.body.location_postal_zip.length) {
        organization['location'][0]['address']['zip_postal'] =
            req.body.location_postal_zip;
    }

    if (typeof req.body.location_lat != 'undefined' &&
        req.body.location_lat.length) {
        organization['location'][0]['address']['lat'] =
            req.body.location_lat;
    }

} // addLocation

/**
 * Take the stock info values from 'req' and add them to the 'organization'
 *
 * @param req req request object with the stock market info from the form
 * @param array organization the organization to add the stock market info to
 */
function addStock(req, organization) {

    if (typeof req.body['stock_exchange'] !== 'undefined') {
        exchange = req.body['stock_exchange'];
        if (exchange.length) {
            organization['stock']['exchange'] = exchange;
        }
    }
    if (typeof req.body['stock_ticker_symbol'] !== 'undefined') {
        symbol = req.body['stock_ticker_symbol'];
        if (symbol.length) {
            organization['stock']['ticker_symbol'] = symbol;
        }
    }
    if (typeof req.body['stock_url'] !== 'undefined') {
        url = req.body['stock_url'];
        if (symbol.length) {
            organization['stock']['url'] = url;
        }
    }

} // addStock

/**
 * Generate geoJSON for a set of organizations
 *
 * @param array organizations JSON representation of organizations
 */
function getGeoJSON(organizations) {

    json = '{ "type": "FeatureCollection", "features": [';
    count = 0;
    logger.info('organizations.length' + organizations.length);
    for (var o = 0; o < organizations.length; o++) {
        organization = organizations[o];

        lat = 0;
        lng = 0;

        if (organization['location'][0] &&
            organization['location'][0]['address']) {

            address = organization['location'][0]['address'];

            if (typeof (organization['name']) == "undefined") {
                orgName = '';
            } else {
                orgName = organization['name'];
            }

            if (typeof (organization['url']) == "undefined") {
                url = '';
            } else {
                url = organization['url'];
            }

            if (address.lat) { lat = address.lat; }
            if (address.lng) { lng = address.lng; }
            id = organization['slug'];

            if (lat && lng) {
                if (count) { json += ', '; }
                json += '{ "id": "' + id + '",';
                json += ' "type": "Feature",';
                json += ' "geometry": {';
                json += ' "type": "Point",';
                json += ' "coordinates": [' + lng + ', ' + lat + ']';
                json += ' },';
                json += ' "properties": {';
                json += ' "name": "' + orgName + '",';
                json += ' "url": "' + url + '"';
                json += ' }';
                json += ' }';
                count++;
            }
        }
    };
    json += ']';
    json += '}';

    return json;

} // getGeoJSON

// set some useful variables for the templates
router.use(function (req, res, next) {

    // every view will have access to currentUser, which pulls from req.user,
    // which is populated by Passport
    res.locals.currentUser = req.user;

    res.locals.errors = req.flash("error");
    res.locals.infos = req.flash("info");
    next();
});

// ------------------------------------------------------------------

router.get('/', function (req, res) {
    try {
        logger.debug("index");
        res.render('index');
    } catch (err) {
        res.json({ error: err.message || err.toString() });
    }
});



router.get('/organization', function (req, res, next) {
    var re = new RegExp(req.query.term, "g");

    Organization.find({
        $or:
            [{ 'slug': { $regex: re, $options: 'i' } },
            { 'product.slug': { $regex: re, $options: 'i' } },
            { 'product.description': { $regex: re, $options: 'i' } }
            ]
    },
        function (err, organizations) {
            if (err) { return next(err); }
            if (!organizations) { return next(404); }
            if (organizations.length > 1) {
                res.render("organizations", { organizations: organizations });
            } else if (organizations.length == 1) {
                res.render("organization", { organization: organizations[0] });
            } else {
                res.render("nonefound");
            }
        }).sort({ 'name': 1 });

});

router.get("/map/organization", function (req, res, next) {
    var re = new RegExp(req.query.term, "g");

    Organization.find({
        $or:
            [{ 'slug': { $regex: re, $options: 'i' } },
            { 'product.slug': { $regex: re, $options: 'i' } },
            { 'product.description': { $regex: re, $options: 'i' } }
            ]
    },
        function (err, organizations) {
            if (err) { return next(err); }
            if (!organizations) { return next(404); }
            json = getGeoJSON(organizations);
            res.send(json);
        });
});

router.get('/organizations', function (req, res) {

    Organization.find("{ 'location.address.country': 'Canada' }",
        function (err, organizations) {
            if (err) { return next(err); }
            if (!organizations) { return next(404); }
            res.render("organizations", { organizations: organizations });
        });

});

router.get("/users", function (req, res, next) {
    // query the "users" collection, returning the newest users first
    User.find()
        .sort({ createdAt: "descending" })    // sort descending by createdAt
        .exec(function (err, users) {         // runs the query
            if (err) { return next(err); }
            res.render("users", { users: users });
        });
});

router.get("/signup", function (req, res) {
    res.render("signup");
});

router.get("/addorganization", function (req, res) {
    logger.info('addorganization');
    res.render("addorganization");
});

router.post("/signup", function (req, res, next) {

    // body-parser adds the username and password to req.body
    var username = req.body.username;
    var password = req.body.password;

    User.findOne({ username: username }, function (err, user) {

        if (err) { return next(err); }

        // if found a user, bail out because that username already exists
        if (user) {
            req.flash("error", "User already exists");

            logger.debug('add user failed', user);
            return res.redirect("/signup");
        }

        // create a new instance of the User model with the username and password
        var newUser = new User({
            username: username,
            password: password
        });

        // save the new user to the DB and continue to the next request handler
        newUser.save(next);

    });
}, passport.authenticate("login", {   // authenticate the user
    successRedirect: "/",
    failureRedirect: "/signup",
    failureFlash: true
}));

router.get("/users/:username", function (req, res, next) {
    User.findOne({ username: req.params.username }, function (err, user) {
        if (err) { return next(err); }
        if (!user) { return next(404); }
        res.render("profile", { user: user });
    });
});

router.get("/login", function (req, res) {
    res.render("login");
});

router.post("/login", passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}));

router.get("/logout", function (req, res) {
    req.logout();
    res.redirect("/");
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {    // function provided by Passport
        next();
    } else {
        req.flash("info", "You must be logged in to see this page.");
        res.redirect("/login");
    }
}

/** ensure the user is authenticated; then run the request handler if they
 * haven’t been redirected
 */
router.get("/edit", ensureAuthenticated, function (req, res) {
    res.render("edit");
});

/** normally, this would be a PUT request, but browsers support only GET and
 * POST in HTML forms
 */
router.post("/edit", ensureAuthenticated, function (req, res, next) {
    req.user.displayName = req.body.displayname;
    req.user.bio = req.body.bio;
    req.user.save(function (err) {
        if (err) {
            next(err);
            return;
        }
        req.flash("info", "User updated!");
        res.redirect("/edit");
    });
});

router.get("/organization/:orgSlug", function (req, res, next) {
    slug = getSlug(req.params.orgSlug);
    logger.info('/organization/' + slug);
    Organization.findOne({ slug: slug },
        function (err, organization) {
            if (err) { return next(err); }
            if (!organization) { return next(404); }
            console.log(organization.date_added);
            res.render("organization", { organization: organization });
        });
});

router.get("/organization/product/category/:categorySlug", function (req, res, next) {
    slug = getSlug(req.params.categorySlug);

    Organization.find({ 'product.primary_category_slug': slug },
        function (err, organizations) {
            if (err) { return next(err); }
            if (!organizations) { return next(404); }
            res.render("organizations", { organizations: organizations });
        }).sort({ 'name': 1 });
});

/*
 * e.g. <site>/organization/product/category/iot-platform/subcategory/software
 */
router.get("/organization/product/category/:categorySlug/subcategory/:subCategorySlug", function (req, res, next) {
    categorySlug = getSlug(req.params.categorySlug);
    subCategorySlug = getSlug(req.params.subCategorySlug);

    Organization.find({ 'product.primary_category_slug': categorySlug, 'product.secondary_category_slug': subCategorySlug },
        function (err, organizations) {
            console.log(organizations);
            if (err) { return next(err); }
            if (!organizations) { return next(404); }
            res.render("organizations", { organizations: organizations });
        }).sort({ 'name': 1 });
});

function displayOrganization(req, res, next) {
    slug = getSlug(req.body.name);
    //  res.redirect("/oganization/" + slug);
    next();
}

router.post("/organization", displayOrganization, function (req, res, next) {

    var newOrganization = new Organization;

    addBasicInfo(req, newOrganization);
    addLocation(req, newOrganization);
    //  addServices(req, newOrganization);
    addHistory(req, newOrganization);
    addStock(req, newOrganization);

    newOrganization.save(function (err) {
        if (err) { next(new Error("Save failed")); }
        req.flash("organization", "Organization updated!");
        res.redirect("/oganization/" + slug);
        res.redirect("google.ca");
    });
});

router.get("/product/categories/:categorySlug", function (req, res, next) {
    slug = getSlug(req.params.categorySlug);
    found = false;
    for (var i = 0; i < Categories.length; i++) {
        category = Categories[i];
        if (category['slug'] == slug) {
            found = true;
            break;
        }
    }
    if (found) {
        res.send(category['subcategories']);
    } else {
        res.send({ "error": "no categories found" });
    }
});

router.get("/product/categories", function (req, res, next) {
    res.send(Categories);
});

router.get("/product/:productSlug", function (req, res, next) {
    slug = getSlug(req.params.productSlug);
    Organization.findOne({ 'product.slug': slug },
        function (err, organization) {
            if (err) { return next(err); }
            if (!organization) { return next(404); }
            console.log(organization.name);
            res.render("product", { organization: organization });
        });
});

router.get("/standard/:standardSlug", function (req, res, next) {
    slug = getSlug(req.params.standardSlug);
    Organization.findOne({ 'product.slug': slug },
        function (err, organization) {
            if (err) { return next(err); }
            if (!organization) { return next(404); }
            res.render("organization", { organization: organization });
        });
});

/*
 * This is the main function that is called to get organizations by their 
 * product category and sub-category.
 */
router.get("/map/product/category/:categorySlug/subcategory/:subCategorySlug", function (req, res, next) {
    categorySlug = getSlug(req.params.categorySlug);
    subCategorySlug = getSlug(req.params.subCategorySlug);
    console.log('categorySlug=' + categorySlug + ', subCategorySlug=' + subCategorySlug);

    Organization.find({ 'product.primary_category_slug': categorySlug, 'product.secondary_category_slug': subCategorySlug },
        function (err, organizations) {
            if (err) { return next(err); }
            if (!organizations) { return next(404); }
            json = getGeoJSON(organizations);
            res.send(json);
        });
});

// catch-all
router.get('*', function (req, res) {
    res.redirect("/");
});

module.exports = router;
