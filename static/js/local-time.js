// Comment times arrive as UTC; show them in the viewer's local time as "YYYY-MM-DD at HH:MM".
// Panels added later (the map's side panel) are converted as they appear.
(function () {
    function pad(n) { return String(n).padStart(2, '0'); }

    function localize(root) {
        if (!root.querySelectorAll) { return; }
        root.querySelectorAll('time[data-local-time]').forEach(function (time) {
            var date = new Date(time.getAttribute('datetime'));
            if (Number.isNaN(date.getTime())) { return; }
            time.textContent = date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
                ' at ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
            time.removeAttribute('data-local-time');
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        localize(document);
        new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) { mutation.addedNodes.forEach(localize); });
        }).observe(document.body, { childList: true, subtree: true });
    });
})();
