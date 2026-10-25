module.exports = function websiteUrl(value, protocol = 'https:') {
    var input = typeof value === 'string' ? value.trim() : '';
    if (!input) { return ''; }
    if (!/^[a-z][a-z\d+.-]*:/i.test(input)) { input = protocol + '//' + input; }
    try {
        var url = new URL(input);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? input : '';
    } catch {
        return '';
    }
};
