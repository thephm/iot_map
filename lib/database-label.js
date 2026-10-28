// The navbar names the database the app is actually connected to, read from MONGODB_URI, so a
// local app pointed at Atlas cannot pass for development data.
var localHosts = ['localhost', '127.0.0.1', '[::1]', 'mongo'];

module.exports = function databaseLabel(uri) {
    var match = /^mongodb(?:\+srv)?:\/\/(?:[^@\/]*@)?([^\/?]+)/.exec(typeof uri === 'string' ? uri : '');
    if (!match) { return { text: 'unknown', kind: 'remote' }; }
    var hosts = match[1].toLowerCase().split(',').map(function (host) {
        return host.replace(/:\d+$/, '');
    });
    if (hosts.every(function (host) { return localHosts.indexOf(host) !== -1; })) {
        return { text: 'local', kind: 'local' };
    }
    if (hosts.every(function (host) { return /\.mongodb\.net$/.test(host); })) {
        return { text: 'Atlas (production)', kind: 'atlas' };
    }
    return { text: hosts.join(', '), kind: 'remote' };
};
