const assert = require('node:assert/strict');
const path = require('node:path');
const { once } = require('node:events');
const { test } = require('node:test');
const express = require('express');
const ejs = require('ejs');
const mongoose = require('mongoose');
const Person = require('../models/person');
const Organization = require('../models/organization');
const publicPeople = require('../lib/people');
const Comment = require('../models/comment');
const publicComments = require('../lib/comments');
const websiteUrl = require('../lib/website-url');

const orgId = new mongoose.Types.ObjectId();
const missingId = new mongoose.Types.ObjectId();
const personId = new mongoose.Types.ObjectId();
const person = {
    _id: personId, slug: 'jo-smith', first_name: 'Jo', last_name: 'Smith',
    title: 'Engineer', url: 'example.com', birthday: '1978-03-05',
    github_id: 'jo', unknown: { birthday: 'private' },
    positions: [
        { title: 'Engineer', organization_id: orgId, organization_slug: 'stale-slug',
            company: 'Original Co', order: 1, current: true, start_date: '2020', location: 'Ottawa',
            birthday: 'private-position', extra: { birthday: 'private-nested' } },
        { title: 'Legacy role', company: 'Unresolved Co', date: '5-Mar-2018', order: 0 },
        { title: 'Missing org', organization_id: missingId, organization_slug: 'deleted-org',
            company: 'Deleted Co', end_date: '2019-04' },
        { title: 'Invalid reference', organization_id: 'not-an-id', organization_slug: 'unsafe-stale',
            company: 'Unlinked Co', current: false },
        null, 12, 'Historical note'
    ]
};

function query(result, onSelect) {
    const value = {
        select: function (fields) { if (onSelect) { onSelect(fields); } return value; },
        sort: function () { return value; },
        skip: function () { return value; },
        limit: function () { return value; },
        lean: function () { return value; },
        exec: async function () { return result; }
    };
    return value;
}

test('person model reads new fields and preserves old mixed positions, hiding birthdays by default', function () {
    const model = new Person(person);
    assert.equal(model.slug, 'jo-smith');
    assert.equal(model.github_id, 'jo');
    assert.equal(model.positions[1].company, 'Unresolved Co');
    assert.equal(model.positions[4], null);
    assert.equal(Person.schema.path('birthday').options.select, false);
    assert.equal(Person.schema.path('first_name').options.unique, undefined);
});

test('public person shape excludes birthdays and unknown fields even when a query returns them', function () {
    const value = publicPeople.publicPerson(person);
    const json = JSON.stringify(value);
    assert.doesNotMatch(json, /birthday|1978-03-05|private|extra|unknown/);
    assert.equal(value.url, 'https://example.com');
    assert.deepEqual(value.socials, [{ name: 'GitHub', url: 'https://github.com/jo' }]);
    assert.equal(value.positions[0].title, 'Legacy role');
    assert.equal(value.positions[0].date, '5-Mar-2018');
    assert.equal(value.positions[0].start_date, '');
    assert.equal(value.positions[0].end_date, '');
    assert.equal(value.positions[0].current, false);
    assert.equal(value.positions.find((position) => position.title === 'Historical note').company, '');
    assert.ok(value.positions.every((position) => !position.organization_slug));
    assert.equal(publicPeople.publicPerson({ _id: personId }).href, '');
});

test('social links use stored profile URLs and fall back to older IDs', function () {
    const value = publicPeople.publicPerson({
        _id: personId, linkedin_url: 'https://www.linkedin.com/in/jo-smith', linkedin_id: 'stale',
        x_id: 'jo', github_url: 'javascript:alert(1)'
    });
    assert.deepEqual(value.socials, [
        { name: 'LinkedIn', url: 'https://www.linkedin.com/in/jo-smith' },
        { name: 'X', url: 'https://x.com/jo' }
    ]);
});

test('website and social URLs never turn untrusted values into executable links', function () {
    for (const value of ['javascript:alert(1)', 'data:text/html,hello', 'ftp://example.com', 'https://user:password@example.com', null, {}]) {
        assert.equal(websiteUrl(value), '');
    }
    assert.equal(websiteUrl('http://example.com/path'), 'http://example.com/path');
    const value = publicPeople.publicPerson({ _id: personId, x_id: 'name"/><script>' });
    assert.equal(value.socials[0].url, 'https://x.com/name%22%2F%3E%3Cscript%3E');
    assert.equal(new Organization({ name: 'No URL', slug: 'no-url' }).getUrl(), '');
});

test('person organization links use durable IDs and current slugs, never stale slugs or name guesses', async function (t) {
    t.mock.method(Organization, 'find', function (filter) {
        assert.deepEqual(filter._id.$in.map(String).sort(), [String(orgId), String(missingId)].sort());
        return query([{ _id: orgId, name: 'Current Co', slug: 'current-co' }], function (fields) {
            assert.equal(fields, 'name slug');
        });
    });
    const result = await publicPeople.personWithOrganizations(person);
    assert.equal(result.positions.find((position) => position.title === 'Engineer').organization_href, '/organization/current-co');
    for (const title of ['Legacy role', 'Missing org', 'Invalid reference']) {
        assert.equal(result.positions.find((position) => position.title === title).organization_href, '');
    }
    assert.doesNotMatch(JSON.stringify(result), /stale-slug|deleted-org|unsafe-stale|birthday/);
    t.mock.method(Organization, 'find', function () { return query([{ _id: orgId, name: 'No slug' }]); });
    assert.equal((await publicPeople.personWithOrganizations(person)).positions.find((position) => position.title === 'Engineer').organization_href, '');
});

test('organization people queries exclude birthdays and match IDs in either BSON or string form', async function (t) {
    const sameNameOnly = { ...person, _id: new mongoose.Types.ObjectId(), positions: [{ title: 'Other', company: 'Current Co' }] };
    t.mock.method(Person, 'find', function (filter) {
        const ids = filter['positions.organization_id'].$in;
        assert.ok(ids[0] instanceof mongoose.Types.ObjectId);
        assert.equal(ids[1], orgId.toHexString());
        return query([person, sameNameOnly], function (fields) { assert.equal(fields, '-birthday'); });
    });
    const result = await publicPeople.peopleForOrganization({ _id: orgId });
    assert.equal(result.length, 1);
    assert.equal(result[0].href, '/people/jo-smith');
    assert.equal(result[0].positions.length, 1);
    assert.equal(result[0].positions[0].title, 'Engineer');
    assert.doesNotMatch(JSON.stringify(result), /birthday|private|Unresolved Co/);
});

test('embedded founders link to a unique matching Founder person and otherwise keep stored values', async function () {
    const founder = (name, href, title) => ({ name, href, positions: [{ title }] });
    const people = [
        founder('Ada Lovelace', '/people/ada-lovelace', 'Co-Founder & CEO'),
        founder('Grace Hopper', '/people/grace-hopper', 'Engineer'),
        founder('Jo Lee', '/people/jo-lee', 'Founder'),
        founder('jo  lee', '/people/jo-lee-2', 'Founder'),
        founder('Unlinked', '', 'Founder')
    ];
    const founders = publicPeople.organizationFounders(new Organization({ history: { founder: [
        { first_name: ' ada ', last_name: 'LOVELACE', url: 'ada.example.com' },
        { name: 'Grace Hopper', url: 'javascript:alert(1)' },
        { name: 'Jo Lee' },
        { name: 'Unlinked', url: 'unlinked.example.com' },
        {}
    ] } }), people);
    assert.deepEqual(founders, [
        { name: 'ada LOVELACE', href: '/people/ada-lovelace', url: '' },
        { name: 'Grace Hopper', href: '', url: '' },
        { name: 'Jo Lee', href: '', url: '' },
        { name: 'Unlinked', href: '', url: 'http://unlinked.example.com' },
        { name: 'Unnamed founder', href: '', url: '' }
    ]);
    const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'organization.ejs'), {
        organization: new Organization({ name: 'Acme', slug: 'acme' }), people: [], founders: [
            { name: '<b>Ada</b>', href: '/people/ada-lovelace', url: '' }, { name: 'Bob', href: '', url: 'http://bob.example' }
        ], socialIcons: {}, showProductUrls: false
    });
    assert.match(html, /Founders:/);
    assert.match(html, /<a href="\/people\/ada-lovelace">&lt;b&gt;Ada&lt;\/b&gt;<\/a>/);
    assert.match(html, /<a href="http:\/\/bob.example" target="acme">Bob<\/a>/);
});

test('only public comments are loaded, with text and date but never the author', async function (t) {
    const productId = new mongoose.Types.ObjectId();
    const filters = [];
    t.mock.method(Comment, 'find', function (filter) {
        filters.push(filter);
        return query([
            { text: 'Shown <b>escaped</b>', created_at: new Date('2026-10-27T10:00:00Z'), created_by: { email: 'admin@example.com' },
                entity: { product_id: productId } },
            { text: '', created_at: new Date() }
        ], function (fields) { assert.equal(fields, 'text created_at entity.product_id'); });
    });
    const comments = await publicComments.forEntity('person', personId);
    assert.deepEqual(comments, [{ text: 'Shown <b>escaped</b>', date: '2026-10-27' }]);
    assert.deepEqual(filters[0], { 'entity.type': 'person', 'entity.id': personId, public: true });
    const byProduct = await publicComments.forProducts(orgId);
    assert.deepEqual(filters[1], { 'entity.type': 'product', 'entity.id': orgId, public: true });
    assert.deepEqual(Object.keys(byProduct), [String(productId)]);
    assert.doesNotMatch(JSON.stringify([comments, byProduct]), /admin@example.com/);
});

test('the People navbar link is hidden unless enabled (it is off in production)', async function () {
    const navbar = path.join(__dirname, '..', 'views', 'navbar.ejs');
    assert.doesNotMatch(await ejs.renderFile(navbar, {}), /href="\/people"/);
    assert.doesNotMatch(await ejs.renderFile(navbar, { showPeopleNav: false }), /href="\/people"/);
    assert.match(await ejs.renderFile(navbar, { showPeopleNav: true }), /href="\/people">People</);
});

test('person rendering escapes old/new position text and keeps as-of dates separate', async function (t) {
    t.mock.method(Organization, 'find', function () { return query([]); });
    const result = await publicPeople.personWithOrganizations({
        ...person, first_name: '<script>alert(1)</script>',
        positions: [{ title: '<img src=x>', company: '<b>Legacy</b>', date: '2018' }]
    });
    const html = await ejs.renderFile(path.join(__dirname, '..', 'views', 'person.ejs'), {
        person: result, mongoEnvironment: 'test'
    });
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&lt;img src=x&gt;/);
    assert.match(html, /&lt;b&gt;Legacy&lt;\/b&gt;/);
    assert.match(html, /As of: 2018/);
    assert.doesNotMatch(html, /Start: 2018|Current position|birthday|1978-03-05/);
});

test('public people routes and every organization detail entry point are compatible', async function (t) {
    const organization = new Organization({
        _id: orgId, name: 'Current Co', slug: 'current-co',
        history: { founder: [
            { name: 'Legacy Founder', url: 'founder.example.com' },
            { first_name: 'New', last_name: 'Founder', url: 'javascript:alert(1)' },
            { name: '<script>old</script>' }
        ] }
    });
    let listResult = [person];
    let detailResult = person;
    let orgResult = organization;
    let linkedError = false;
    let capturedPerson;
    const organizationLookups = [];
    const projections = [];
    t.mock.method(Comment, 'find', function (filter) {
        assert.equal(filter.public, true);
        return query(filter['entity.type'] === 'product' ? [] : [
            { text: 'Public note on ' + filter['entity.type'], created_at: new Date('2026-10-27T00:00:00Z') }
        ]);
    });
    t.mock.method(Person, 'find', function (filter) {
        if (filter['positions.organization_id'] && linkedError) { throw new Error('People query failed'); }
        return query(listResult, function (fields) { projections.push(fields); });
    });
    t.mock.method(Person, 'findOne', function (filter) {
        assert.equal(typeof filter.slug, 'string');
        return query(detailResult, function (fields) { projections.push(fields); });
    });
    t.mock.method(Organization, 'find', function (filter) {
        return query(filter._id ? [{ _id: orgId, name: 'Current Co', slug: 'current-co' }] : [organization]);
    });
    t.mock.method(Organization, 'findOne', function (filter) {
        organizationLookups.push(filter);
        return query(orgResult);
    });
    const app = express();
    app.set('views', path.join(__dirname, '..', 'views'));
    app.set('view engine', 'ejs');
    app.locals.mongoEnvironment = 'test';
    app.locals.socialIcons = {};
    app.locals.showProductUrls = false;
    app.use(function (req, res, next) {
        const render = res.render.bind(res);
        res.render = function (view, locals) {
            if (view === 'person') { capturedPerson = locals.person; }
            return render(view, locals);
        };
        next();
    });
    app.use(require('../routes'));
    app.use(function (error, req, res, next) {
        res.status(error === 404 ? 404 : 500).send(error === 404 ? 'Not Found' : 'Failed');
    });
    const server = app.listen(0, '127.0.0.1');
    t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + server.address().port;

    await t.test('people list links migrated records and safely displays unmigrated records', async function () {
        listResult = [person, { _id: new mongoose.Types.ObjectId(), first_name: 'Legacy', birthday: 'private' }];
        const response = await fetch(base + '/people');
        const html = await response.text();
        assert.equal(response.status, 200);
        assert.match(html, /href="\/people\/jo-smith"/);
        assert.match(html, /Legacy/);
        assert.doesNotMatch(html, /birthday|private|1978-03-05|href="\/people\/undefined"/);
    });
    await t.test('person page has new and old positions, current organization links, no birthday', async function () {
        const response = await fetch(base + '/people/jo-smith');
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.match(html, /href="\/organization\/current-co"/);
        assert.match(html, /Unresolved Co/);
        assert.match(html, /Deleted Co/);
        assert.match(html, /As of: 5-Mar-2018/);
        assert.match(html, /Current position/);
        assert.match(html, /Public note on person/);
        assert.doesNotMatch(html, /stale-slug|deleted-org|unsafe-stale|birthday|1978-03-05/);
        assert.doesNotMatch(JSON.stringify(capturedPerson), /birthday|private/);
    });
    await t.test('nested organization results link back to people and retain old/new founders', async function () {
        listResult = [person];
        for (const route of ['/organization/current-co', '/organization?term=current', '/standard/current-co']) {
            const response = await fetch(base + route);
            assert.equal(response.status, 200, route);
            const html = await response.text();
            assert.match(html, /href="\/people\/jo-smith"/);
            assert.match(html, /Legacy Founder/);
            assert.match(html, /New Founder/);
            assert.match(html, /&lt;script&gt;old&lt;\/script&gt;/);
            assert.match(html, /Public note on organization/);
            assert.doesNotMatch(html, /javascript:|birthday|1978-03-05|Unresolved Co/);
        }
        assert.ok(projections.length > 0);
        assert.ok(projections.every((fields) => fields === '-birthday'));
    });
    await t.test('pagination is bounded and malformed query values are rejected', async function () {
        listResult = Array.from({ length: 51 }, () => person);
        const first = await (await fetch(base + '/people')).text();
        assert.match(first, /href="\/people\?page=2"/);
        assert.equal((first.match(/href="\/people\/jo-smith"/g) || []).length, 50);
        const second = await (await fetch(base + '/people?page=2')).text();
        assert.match(second, /href="\/people\?page=1"/);
        for (const page of ['0', '-1', '1.5', 'abc', '1000001', '1&page=2']) {
            assert.equal((await fetch(base + '/people?page=' + page)).status, 400);
        }
        listResult = [];
        assert.match(await (await fetch(base + '/people')).text(), /No people found/);
    });
    await t.test('direct organization pages have a document wrapper while AJAX stays a fragment', async function () {
        listResult = [person];
        const direct = await (await fetch(base + '/organization/current-co')).text();
        assert.match(direct, /<!DOCTYPE html>/);
        assert.match(direct, /aria-label="Dark mode"/);
        const fragment = await (await fetch(base + '/organization/current-co', {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        })).text();
        assert.doesNotMatch(fragment, /<!DOCTYPE html>|navbar-static-top/);
        assert.match(fragment, /href="\/people\/jo-smith"/);
    });
    await t.test('missing records produce 404 and database failures propagate', async function () {
        detailResult = null;
        assert.equal((await fetch(base + '/people/missing')).status, 404);
        orgResult = null;
        assert.equal((await fetch(base + '/organization/missing')).status, 404);
        orgResult = organization;
        linkedError = true;
        assert.equal((await fetch(base + '/organization/current-co')).status, 500);
    });
    await t.test('organization navigation looks up exact stored slugs before legacy normalization', async function () {
        linkedError = false;
        const response = await fetch(base + '/organization/current.co');
        assert.equal(response.status, 200);
        assert.deepEqual(organizationLookups.at(-1), { slug: 'current.co' });
    });
    await t.test('typed organization URLs with accents fall back to the transliterated slug', async function () {
        organizationLookups.length = 0;
        orgResult = null;
        assert.equal((await fetch(base + '/organization/' + encodeURIComponent('Société Générale'))).status, 404);
        assert.deepEqual(organizationLookups, [{ slug: 'Société Générale' }, { slug: 'societe-generale' }]);
        orgResult = organization;
    });
});
