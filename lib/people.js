var mongoose = require('mongoose');
var Person = require('../models/person');
var Organization = require('../models/organization');
var websiteUrl = require('./website-url');
var publicComments = require('./comments');

// [profile URL field, older ID field, label, URL prefix for the older ID]. iot_map_admin now stores
// full profile URLs; the ID fields are read only until migrate-social-urls has run.
var socialServices = [
    ['linkedin_url', 'linkedin_id', 'LinkedIn', 'https://www.linkedin.com/in/'],
    ['facebook_url', 'facebook_id', 'Facebook', 'https://www.facebook.com/'],
    ['instagram_url', 'instagram_id', 'Instagram', 'https://www.instagram.com/'],
    ['bluesky_url', 'bluesky_id', 'Bluesky', 'https://bsky.app/profile/'],
    ['x_url', 'x_id', 'X', 'https://x.com/'],
    ['github_url', 'github_id', 'GitHub', 'https://github.com/'],
    ['medium_url', 'medium_id', 'Medium', 'https://medium.com/@'],
    ['threads_url', 'threads_id', 'Threads', 'https://www.threads.net/@']
];

function text(value) {
    return typeof value === 'string' ? value : '';
}

function organizationId(value) {
    var id = value instanceof mongoose.Types.ObjectId ? value.toHexString() : value;
    return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id) ? id.toLowerCase() : '';
}

function personPath(slug) {
    return text(slug).trim() ? '/people/' + encodeURIComponent(slug) : '';
}

// Explicit public shapes also remove sensitive/unknown data nested inside legacy positions.
function publicPerson(person) {
    return {
        id: String(person._id),
        slug: text(person.slug),
        href: personPath(person.slug),
        name: [text(person.first_name), text(person.last_name)].filter(Boolean).join(' ') || 'Unnamed person',
        title: text(person.title),
        url: websiteUrl(person.url),
        socials: socialServices.flatMap(function (service) {
            var url = websiteUrl(person[service[0]]);
            if (url) { return [{ name: service[2], url: url }]; }
            var id = text(person[service[1]]).trim().replace(/^@/, '');
            return id ? [{ name: service[2], url: service[3] + encodeURIComponent(id) }] : [];
        }),
        positions: (Array.isArray(person.positions) ? person.positions : []).flatMap(function (position, index) {
            if (!position || typeof position !== 'object' || Array.isArray(position)) {
                return typeof position === 'string' && position.trim()
                    ? [{ title: position, company: '', date: '', start_date: '', end_date: '', location: '',
                        current: false, order: index, organization_id: '', organization_slug: '' }]
                    : [];
            }
            return [{
                title: text(position.title),
                company: text(position.company),
                date: text(position.date),
                start_date: text(position.start_date),
                end_date: text(position.end_date),
                location: text(position.location),
                current: position.current === true,
                order: Number.isInteger(position.order) && position.order >= 0 ? position.order : index,
                organization_id: organizationId(position.organization_id),
                organization_slug: ''
            }];
        }).sort(function (a, b) { return a.order - b.order; })
    };
}

async function personWithOrganizations(person) {
    var result = publicPerson(person);
    var ids = [...new Set(result.positions.map(function (position) { return position.organization_id; }).filter(Boolean))];
    var organizations = ids.length ? await Organization.find({
        _id: mongoose.trusted({ $in: ids.map(function (id) { return new mongoose.Types.ObjectId(id); }) })
    }).select('name slug').lean().exec() : [];
    var byId = new Map(organizations.map(function (organization) {
        return [String(organization._id), organization];
    }));
    result.positions = result.positions.map(function (position) {
        var organization = byId.get(position.organization_id);
        return {
            ...position,
            organization_name: organization ? text(organization.name) : '',
            organization_slug: organization ? text(organization.slug) : '',
            organization_href: organization && text(organization.slug).trim()
                ? '/organization/' + encodeURIComponent(organization.slug) : ''
        };
    });
    return result;
}

async function peopleForOrganization(organization) {
    var id = organizationId(organization._id);
    if (!id) { throw new Error('Cannot load people for an organization without a valid ID.'); }
    var people = await Person.find({
        'positions.organization_id': mongoose.trusted({ $in: [new mongoose.Types.ObjectId(id), id] })
    }).select('-birthday').sort({ last_name: 1, first_name: 1, _id: 1 }).lean().exec();
    return people.map(publicPerson).map(function (person) {
        return {
            ...person,
            positions: person.positions.filter(function (position) { return position.organization_id === id; })
        };
    }).filter(function (person) { return person.positions.length > 0; });
}

function normalizedName(value) {
    return text(value).normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Embedded founders link to a person page only when exactly one listed person has that
// exact name and a Founder position here; otherwise the stored founder is shown unchanged.
function organizationFounders(organization, people) {
    var history = organization && organization.history;
    var founders = history && Array.isArray(history.founder) ? history.founder : [];
    var byName = new Map();
    people.forEach(function (person) {
        if (!person.href || !person.positions.some(function (position) { return /\bfounder\b/i.test(position.title); })) { return; }
        var key = normalizedName(person.name);
        byName.set(key, (byName.get(key) || []).concat([person]));
    });
    return founders.map(function (founder) {
        founder = founder || {};
        var name = [text(founder.first_name).trim(), text(founder.last_name).trim()].filter(Boolean).join(' ') ||
            text(founder.name).trim();
        var matches = name ? byName.get(normalizedName(name)) || [] : [];
        return {
            name: name || 'Unnamed founder',
            href: matches.length === 1 ? matches[0].href : '',
            url: matches.length === 1 ? '' : websiteUrl(founder.url, 'http:')
        };
    });
}

async function renderOrganization(req, res, organization) {
    var [people, comments, productComments] = await Promise.all([
        peopleForOrganization(organization),
        publicComments.forEntity('organization', organization._id),
        publicComments.forProducts(organization._id)
    ]);
    res.render(req.xhr ? 'organization' : 'organization-page', {
        organization: organization, people: people, founders: organizationFounders(organization, people),
        comments: comments, productComments: productComments
    });
}

module.exports = {
    publicPerson: publicPerson,
    personWithOrganizations: personWithOrganizations,
    peopleForOrganization: peopleForOrganization,
    organizationFounders: organizationFounders,
    renderOrganization: renderOrganization
};
