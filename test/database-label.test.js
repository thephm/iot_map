const test = require('node:test');
const assert = require('node:assert/strict');
const databaseLabel = require('../lib/database-label');

test('database label names the host actually in MONGODB_URI', function () {
    assert.deepEqual(databaseLabel('mongodb://mongo:27017/iotmap'), { text: 'local', kind: 'local' });
    assert.deepEqual(databaseLabel('mongodb://127.0.0.1:27017,localhost/iotmap'), { text: 'local', kind: 'local' });
    assert.deepEqual(databaseLabel('mongodb+srv://user:p%40ss@iotmap.abc.mongodb.net/iotmap?w=majority'),
        { text: 'Atlas (production)', kind: 'atlas' });
    assert.deepEqual(databaseLabel('mongodb://user:secret@db.example.com:27017/iotmap'),
        { text: 'db.example.com', kind: 'remote' });
    assert.deepEqual(databaseLabel(undefined), { text: 'unknown', kind: 'remote' });
});
