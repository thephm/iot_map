(function () {
    var theme = 'light';
    try {
        if (localStorage.getItem('iot-map-theme') === 'dark') theme = 'dark';
    } catch (error) {
        console.warn('Could not read the saved theme preference:', error);
    }
    document.documentElement.dataset.theme = theme;

    function updateSwitch() {
        var button = document.getElementById('theme-toggle');
        if (!button) return;
        var dark = document.documentElement.dataset.theme === 'dark';
        button.setAttribute('aria-checked', String(dark));
        button.querySelector('.theme-label').textContent = dark ? 'Dark' : 'Light';
    }

    document.addEventListener('DOMContentLoaded', updateSwitch);
    document.addEventListener('click', function (event) {
        var navigationToggle = event.target.closest('.navbar-toggle');
        if (navigationToggle) {
            var navbar = navigationToggle.closest('.navbar');
            var navigation = navbar && navbar.querySelector('.navbar-collapse');
            if (!navigation) return;
            var expanded = navigationToggle.getAttribute('aria-expanded') !== 'true';
            navigationToggle.setAttribute('aria-expanded', String(expanded));
            navigation.classList.toggle('in', expanded);
            return;
        }
        if (!event.target.closest('#theme-toggle')) return;
        var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        try {
            localStorage.setItem('iot-map-theme', next);
        } catch (error) {
            console.warn('Could not save the theme preference:', error);
        }
        updateSwitch();
        document.dispatchEvent(new CustomEvent('themechange', { detail: next }));
    });
})();
