const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { once } = require('node:events');
const { test } = require('node:test');
const express = require('express');
const mongoose = require('mongoose');
const Organization = require('../models/organization');
const Person = require('../models/person');

test('public app starts without session credentials and serves read-only routes', async function (t) {
    const root = path.resolve(__dirname, '..');
    const app = express();
    let server;
    const listen = app.listen.bind(app);
    app.listen = function (port, callback) {
        server = listen(0, '127.0.0.1', callback);
        return server;
    };
    t.after(async function () {
        if (server) {
            await new Promise(function (resolve, reject) {
                server.close(function (error) {
                    if (error) { reject(error); } else { resolve(); }
                });
            });
        }
    });

    const organization = new Organization({
        name: 'Example organization',
        slug: 'example',
        url: 'example.com',
        history: { founder: [{ name: 'Founder', url: 'founder.example.com' }] },
        post: [{ service: 'News', url: 'news.example.com' }],
        stock: { ticker_symbol: 'EX', url: 'stock.example.com' },
        location: [{ address: { lat: 45, lng: -75 } }],
        product: [{ name: 'Example product', slug: 'example-product', hardware: true }]
    });
    const connect = t.mock.method(mongoose, 'connect', async function (uri, options) {
        assert.equal(uri, 'mongodb://unused/iotmap');
        assert.equal(options.autoCreate, false);
        assert.equal(options.autoIndex, false);
    });
    t.mock.method(Organization, 'countDocuments', async function () { return 1; });
    t.mock.method(Person, 'countDocuments', async function () { return 2; });
    t.mock.method(Organization, 'aggregate', async function (pipeline) {
        return pipeline[0].$unwind ? [] : [{ count: 1 }];
    });
    t.mock.method(Organization, 'findOne', function () {
        return { exec: async function () { return organization; } };
    });
    t.mock.method(Organization, 'find', function () {
        const query = {
            sort: function () { return query; },
            exec: async function () { return [organization]; }
        };
        return query;
    });
    const requireApp = createRequire(path.join(root, 'app.js'));
    await vm.runInNewContext(fs.readFileSync(path.join(root, 'app.js'), 'utf8'), {
        require: function (name) {
            if (name === 'dotenv') { return { config: function () {} }; }
            if (name === 'express') {
                return Object.assign(function () { return app; }, express);
            }
            return requireApp(name);
        },
        __dirname: root,
        process: { env: { NODE_ENV: 'production', MONGODB_URI: 'mongodb://unused/iotmap' } },
        console: console
    }, { filename: 'app.js' });
    if (!server.listening) { await once(server, 'listening'); }
    assert.equal(connect.mock.callCount(), 1);
    const base = 'http://127.0.0.1:' + server.address().port;

    await t.test('removed authentication endpoints return 404 without cookies', async function () {
        for (const endpoint of ['/login', '/logout', '/edit', '/users', '/users/example']) {
            for (const method of ['GET', 'POST']) {
                const response = await fetch(base + endpoint, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: method === 'POST' ? '{"displayname":{"$ne":null},"bio":[]}' : undefined
                });
                assert.equal(response.status, 404, method + ' ' + endpoint);
                assert.equal(response.headers.get('set-cookie'), null);
                assert.equal(await response.text(), 'Not Found');
            }
        }
    });

    await t.test('homepage retains totals, CSP, and CDN integrity attributes without auth locals', async function () {
        const response = await fetch(base);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('set-cookie'), null);
        assert.match(response.headers.get('content-security-policy'), /script-src 'self' 'nonce-/);
        const html = await response.text();
        assert.match(html, /Database totals/);
        assert.doesNotMatch(html, /action="\/(?:login|logout|edit)"/);
        const scripts = html.match(/<script src="https:\/\/ajax\.googleapis\.com[^>]+>/g);
        assert.equal(scripts.length, 2);
        for (const script of scripts) {
            assert.match(script, /integrity="sha384-[A-Za-z0-9+/=]+"/);
            assert.match(script, /crossorigin="anonymous"/);
        }
    });

    await t.test('organization links use existing URL normalization', async function () {
        const response = await fetch(base + '/organization/example');
        assert.equal(response.status, 200);
        const html = await response.text();
        for (const host of ['founder.example.com', 'news.example.com', 'stock.example.com']) {
            assert.ok(html.includes('href="http://' + host + '"'), host);
        }
        assert.match(html, /Example product/);
    });

    await t.test('search, map and category endpoints remain accessible without sessions', async function () {
        for (const endpoint of [
            '/organization?term=example',
            '/organizations',
            '/product/example-product',
            '/product/categories',
            '/product/categories/iot-platform',
            '/organization/product/category/iot-platform/subcategory/software',
            '/map/organization?term=example',
            '/map/product/category/iot-platform/subcategory/software'
        ]) {
            const response = await fetch(base + endpoint);
            assert.equal(response.status, 200, endpoint);
            assert.equal(response.headers.get('set-cookie'), null);
            if (endpoint.startsWith('/map/')) {
                const geoJSON = await response.json();
                assert.equal(geoJSON.type, 'FeatureCollection');
                assert.deepEqual(geoJSON.features[0].geometry.coordinates, [-75, 45]);
            } else {
                await response.text();
            }
        }
    });
});
