// Mirrors iot_map_admin's transliterate() (src/lib/slug.ts) so typed URLs reach the same slugs.
var TRANSLITERATIONS = {
    'ß': 'ss', 'ẞ': 'ss', 'æ': 'ae', 'Æ': 'ae', 'œ': 'oe', 'Œ': 'oe', 'ø': 'o', 'Ø': 'o', 'đ': 'd', 'Đ': 'd',
    'ð': 'd', 'Ð': 'd', 'þ': 'th', 'Þ': 'th', 'ł': 'l', 'Ł': 'l', 'ı': 'i', 'ħ': 'h', 'Ħ': 'h', 'ŧ': 't',
    'Ŧ': 't', 'ŀ': 'l', 'Ŀ': 'l'
};

/** Turns accented Latin letters into ASCII (é→e, ß→ss, ø→o). */
module.exports = function transliterate(value) {
    return String(value)
        .replace(/[ßẞæÆœŒøØđĐðÐþÞłŁıħĦŧŦŀĿ]/g, function (letter) { return TRANSLITERATIONS[letter]; })
        .normalize('NFKD')
        .replace(/\p{M}/gu, '');
};
