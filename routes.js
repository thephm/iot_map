var fs = require('fs');
var categoriesFile = fs.readFileSync('static/config/categories.json');
var Categories = JSON.parse(categoriesFile);


var Organization = require('./models/organization');
var Person = require("./models/person");

var express = require('express');
var mongoose = require('mongoose');
var passport = require('passport');
var rateLimit = require('express-rate-limit');
var csrfSync = require('csrf-sync').csrfSync;
var csrf = csrfSync({
    getTokenFromRequest: function (req) {
        return req.body && req.body._csrf;
    }
});
var csrfProtection = csrf.csrfSynchronisedProtection;
var generateCsrfToken = csrf.generateToken;

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
 * 
 * Converts a string into a slug that can be used as a RESTful URI endpoint.
 * Changes to the string to lowercase and then replaces specific characters
 * like '&' and '/' with '-'
 *
 * @param str value the value to be slug-ged
 * 
 * @return str a slug that can be used for endpoint
 * 
 */
function getSlug(value) {

    var slug = value.toLowerCase();
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
 * 
 * Generate geoJSON for a set of organizations
 *
 * @param array organizations JSON representation of organizations
 * 
 */
function getGeoJSON(organizations) {
    return JSON.stringify({
        type: "FeatureCollection",
        features: organizations.reduce(function (features, organization) {
            var location = organization.location && organization.location[0];
            var address = location && location.address;
            if (!address || !address.lat || !address.lng) {
                return features;
            }

            features.push({
                id: organization.slug,
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [address.lng, address.lat]
                },
                properties: {
                    name: organization.name || "",
                    url: organization.url || ""
                }
            });
            return features;
        }, [])
    }).replace(/</g, "\\u003c");

} // getGeoJSON

// set some useful variables for the templates
router.use(function (req, res, next) {

    // every view will have access to currentUser, which pulls from req.user,
    // which is populated by Passport
    res.locals.currentUser = req.user;
    if (req.isAuthenticated && req.isAuthenticated()) {
        res.locals.csrfToken = generateCsrfToken(req);
    }

    res.locals.errors = req.flash("error");
    res.locals.infos = req.flash("info");
    next();
});

// ------------------------------------------------------------------

router.get('/', function (req, res, next) {
    Promise.all([
        Organization.countDocuments({}),
        Person.countDocuments({}),
        Organization.aggregate([
            { $group: { _id: null, count: { $sum: { $size: { $ifNull: ['$product', []] } } } } }
        ])
    ]).then(function ([companies, people, products]) {
        res.render('index', {
            totals: { companies: companies, people: people, products: products.length ? products[0].count : 0 }
        });
    }).catch(next);
});

router.get('/organization', function (req, res, next) {
    var re = String(req.query.term || "");

    Organization.find({
        $or:
            [{ 'slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.description': mongoose.trusted({ $regex: re, $options: 'i' }) }
            ]
    })
        .sort({ 'name': 1 })
        .exec()
        .then(function (organizations) {
            if (organizations.length > 1) {
                res.render("organizations", { organizations: organizations });
            } else if (organizations.length == 1) {
                res.render("organization", { organization: organizations[0] });
            } else {
                res.render("nonefound");
            }
        })
        .catch(next);

});

router.get("/map/organization", function (req, res, next) {
    var re = String(req.query.term || "");

    Organization.find({
        $or:
            [{ 'slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.description': mongoose.trusted({ $regex: re, $options: 'i' }) }
            ]
    })
        .exec()
        .then(function (organizations) {
            res.type("json").send(getGeoJSON(organizations));
        })
        .catch(next);
});

router.get('/organizations', function (req, res, next) {

    Organization.find({ 'location.address.country': 'Canada' })
        .exec()
        .then(function (organizations) {
            res.render("organizations", { organizations: organizations });
        })
        .catch(next);

});

router.get("/login", function (req, res) {
    res.render("login", { csrfToken: generateCsrfToken(req) });
});

var loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." }
});

router.post("/login", loginLimiter, csrfProtection, function (req, res, next) {
    var body = req.body || {};
    if (typeof body.username !== "string" || typeof body.password !== "string") {
        req.flash("error", "Invalid username or password");
        return res.redirect("/login");
    }
    next();
}, passport.authenticate("login", {
    successRedirect: "/",
    failureRedirect: "/login",
    failureFlash: true
}));

router.post("/logout", csrfProtection, function (req, res, next) {
    req.logout(function (error) {
        if (error) {
            return next(error);
        }
        res.redirect("/");
    });
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        req.flash("info", "You must be logged in to see this page.");
        res.redirect("/login");
    }
}

router.get("/edit", ensureAuthenticated, function (req, res) {
    res.render("edit", { csrfToken: generateCsrfToken(req) });
});

router.post("/edit", csrfProtection, ensureAuthenticated, function (req, res, next) {
    req.user.displayName = req.body.displayname;
    req.user.bio = req.body.bio;
    req.user.save().then(function () {
        req.flash("info", "User updated!");
        res.redirect("/edit");
    }).catch(next);
});

router.get("/organization/:orgSlug", function (req, res, next) {
    var slug = getSlug(req.params.orgSlug);
    logger.info('/organization/' + slug);
    Organization.findOne({ slug: slug }).exec().then(function (organization) {
        if (!organization) { return next(404); }
        res.render("organization", { organization: organization });
    }).catch(next);
});

router.get("/organization/product/category/:categorySlug", function (req, res, next) {
    var slug = getSlug(req.params.categorySlug);

    Organization.find({ 'product.primary_category_slug': slug })
        .sort({ 'name': 1 })
        .exec()
        .then(function (organizations) {
            res.render("organizations", { organizations: organizations });
        })
        .catch(next);
});

/*
 * e.g. <site>/organization/product/category/iot-platform/subcategory/software
 */
router.get("/organization/product/category/:categorySlug/subcategory/:subCategorySlug", function (req, res, next) {
    var categorySlug = getSlug(req.params.categorySlug);
    var subCategorySlug = getSlug(req.params.subCategorySlug);

    Organization.find({
        product: mongoose.trusted({
            $elemMatch: { primary_category_slug: categorySlug, secondary_category_slug: subCategorySlug }
        })
    })
        .sort({ 'name': 1 })
        .exec()
        .then(organizations => {
            if (!organizations || organizations.length === 0) {
                return res.status(404).send('Organizations not found'); 
            }
            res.render("organizations", { organizations: organizations });
        })
        .catch (err => next(err));
});

async function getCategoriesWithCounts() {
    var rows = await Organization.aggregate([
        { $unwind: '$product' },
        { $group: {
            _id: { category: '$product.primary_category_slug', organization: '$_id' },
            subcategories: { $addToSet: '$product.secondary_category_slug' }
        } }
    ]);
    return Categories.map(function (category) {
        var organizations = rows.filter(function (row) {
            return row._id.category === category.slug;
        });
        return {
            ...category,
            count: organizations.length,
            subcategories: category.subcategories.map(function (subcategory) {
                return {
                    ...subcategory,
                    count: organizations.filter(function (row) {
                        return row.subcategories.includes(subcategory.slug);
                    }).length
                };
            })
        };
    });
}

router.get("/product/categories/:categorySlug", function (req, res, next) {
    var slug = getSlug(req.params.categorySlug);
    getCategoriesWithCounts().then(function (categories) {
        var category = categories.find(function (item) { return item.slug === slug; });
        if (category) {
            res.send(category.subcategories);
        } else {
            res.send({ "error": "no categories found" });
        }
    }).catch(next);
});

router.get("/product/categories", function (req, res, next) {
    getCategoriesWithCounts().then(function (categories) {
        res.send(categories);
    }).catch(next);
});

router.get("/product/:productSlug", function (req, res, next) {
    var slug = getSlug(req.params.productSlug);
    Organization.findOne({ 'product.slug': slug }).exec().then(function (organization) {
        if (!organization) { return next(404); }
        res.render("product", { organization: organization });
    }).catch(next);
});

router.get("/standard/:standardSlug", function (req, res, next) {
    var slug = getSlug(req.params.standardSlug);
    Organization.findOne({ 'product.slug': slug }).exec().then(function (organization) {
        if (!organization) { return next(404); }
        res.render("organization", { organization: organization });
    }).catch(next);
});

/*
 * This is the main function that is called to get organizations by their 
 * product category and sub-category.
 */
router.get("/map/product/category/:categorySlug/subcategory/:subCategorySlug", function (req, res, next) {
    var categorySlug = getSlug(req.params.categorySlug);
    var subCategorySlug = getSlug(req.params.subCategorySlug);
    Organization.find({
        product: mongoose.trusted({
            $elemMatch: { primary_category_slug: categorySlug, secondary_category_slug: subCategorySlug }
        })
    })
        .exec()
        .then(function (organizations) {
            res.type("json").send(getGeoJSON(organizations));
        })
        .catch(next);
});

module.exports = router;
