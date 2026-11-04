// Back links return to the previous page on this site, or to the map when opened directly.
document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a.back-link');
    if (!link || !document.referrer) { return; }
    var referrer;
    try { referrer = new URL(document.referrer); } catch (error) { return; }
    if (referrer.origin === window.location.origin && window.history.length > 1) {
        event.preventDefault();
        window.history.back();
    }
});
