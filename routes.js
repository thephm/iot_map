var fs = require('fs');
var categoriesFile = fs.readFileSync('static/config/categories.json');
var Categories = JSON.parse(categoriesFile);


var Organization = require('./models/organization');
var Person = require("./models/person");
var publicPeople = require('./lib/people');
var transliterate = require('./lib/transliterate');

var express = require('express');
var mongoose = require('mongoose');

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

    // Accented letters become ASCII, matching how iot_map_admin generates slugs.
    var slug = transliterate(value).toLowerCase();
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

// ------------------------------------------------------------------

/**
 * Organizations shown on the map, in search, in lists and in totals. Organizations without the
 * flag predate it and are all IoT organizations; false marks a non-IoT organization that exists
 * only so people's positions can link to it.
 */
function iotOnly(filter) {
    return { ...filter, iot_organization: mongoose.trusted({ $ne: false }) };
}

router.get('/', function (req, res, next) {
    Promise.all([
        Organization.countDocuments(iotOnly({})),
        Person.countDocuments({}),
        Organization.aggregate([
            { $match: { iot_organization: { $ne: false } } },
            { $group: { _id: null, count: { $sum: { $size: { $ifNull: ['$product', []] } } } } }
        ])
    ]).then(function ([companies, people, products]) {
        res.render('index', {
            totals: { companies: companies, people: people, products: products.length ? products[0].count : 0 }
        });
    }).catch(next);
});

router.get('/people', async function (req, res, next) {
    var page = req.query.page === undefined ? '1' : req.query.page;
    if (typeof page !== 'string' || !/^[1-9]\d*$/.test(page) ||
        !Number.isSafeInteger(Number(page)) || Number(page) > 1000000) {
        return res.status(400).send('Invalid page');
    }
    page = Number(page);
    try {
        var people = await Person.find({}).select('-birthday')
            .sort({ last_name: 1, first_name: 1, _id: 1 }).skip((page - 1) * 50).limit(51).lean().exec();
        res.render('people', {
            people: people.slice(0, 50).map(publicPeople.publicPerson),
            page: page, hasNext: people.length > 50
        });
    } catch (error) { next(error); }
});

router.get('/people/:personSlug', async function (req, res, next) {
    var slug = req.params.personSlug;
    if (!slug.trim() || slug.length > 200) { return next(404); }
    try {
        var person = await Person.findOne({ slug: slug }).select('-birthday').lean().exec();
        if (!person) { return next(404); }
        res.render('person', { person: await publicPeople.personWithOrganizations(person) });
    } catch (error) { next(error); }
});

router.get('/organization', function (req, res, next) {
    var re = String(req.query.term || "");

    Organization.find(iotOnly({
        $or:
            [{ 'slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.description': mongoose.trusted({ $regex: re, $options: 'i' }) }
            ]
    }))
        .sort({ 'name': 1 })
        .exec()
        .then(function (organizations) {
            if (organizations.length > 1) {
                res.render("organizations", { organizations: organizations });
            } else if (organizations.length == 1) {
                return publicPeople.renderOrganization(req, res, organizations[0]);
            } else {
                res.render("nonefound");
            }
        })
        .catch(next);

});

router.get("/map/organization", function (req, res, next) {
    var re = String(req.query.term || "");

    Organization.find(iotOnly({
        $or:
            [{ 'slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.slug': mongoose.trusted({ $regex: re, $options: 'i' }) },
            { 'product.description': mongoose.trusted({ $regex: re, $options: 'i' }) }
            ]
    }))
        .exec()
        .then(function (organizations) {
            res.type("json").send(getGeoJSON(organizations));
        })
        .catch(next);
});

router.get('/organizations', function (req, res, next) {

    Organization.find(iotOnly({ 'location.address.country': 'Canada' }))
        .exec()
        .then(function (organizations) {
            res.render("organizations", { organizations: organizations });
        })
        .catch(next);

});

router.get("/organization/:orgSlug", async function (req, res, next) {
    var slug = req.params.orgSlug;
    logger.info('/organization/' + slug);
    try {
        var organization = await Organization.findOne({ slug: slug }).exec();
        if (!organization && getSlug(slug) !== slug) {
            organization = await Organization.findOne({ slug: getSlug(slug) }).exec();
        }
        if (!organization) { return next(404); }
        await publicPeople.renderOrganization(req, res, organization);
    } catch (error) { next(error); }
});

router.get("/organization/product/category/:categorySlug", function (req, res, next) {
    var slug = getSlug(req.params.categorySlug);

    Organization.find(iotOnly({ 'product.primary_category_slug': slug }))
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

    Organization.find(iotOnly({
        product: mongoose.trusted({
            $elemMatch: { primary_category_slug: categorySlug, secondary_category_slug: subCategorySlug }
        })
    }))
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
        { $match: { iot_organization: { $ne: false } } },
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
        return publicPeople.renderOrganization(req, res, organization);
    }).catch(next);
});

/*
 * This is the main function that is called to get organizations by their 
 * product category and sub-category.
 */
router.get("/map/product/category/:categorySlug/subcategory/:subCategorySlug", function (req, res, next) {
    var categorySlug = getSlug(req.params.categorySlug);
    var subCategorySlug = getSlug(req.params.subCategorySlug);
    Organization.find(iotOnly({
        product: mongoose.trusted({
            $elemMatch: { primary_category_slug: categorySlug, secondary_category_slug: subCategorySlug }
        })
    }))
        .exec()
        .then(function (organizations) {
            res.type("json").send(getGeoJSON(organizations));
        })
        .catch(next);
});

module.exports = router;
