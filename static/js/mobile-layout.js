var mobileLayout = window.matchMedia('(max-width: 767px)');
var productsSection = document.getElementById('products');
var mapColumn = document.getElementById('map-column');
var organizationsSection = document.getElementById('organizations');

function positionProducts() {
    if (mobileLayout.matches) {
        organizationsSection.after(productsSection);
        productsSection.classList.add('col-xs-12');
    } else {
        mapColumn.appendChild(productsSection);
        productsSection.classList.remove('col-xs-12');
    }
}

positionProducts();
mobileLayout.addEventListener('change', positionProducts);

var sectionButtons = document.querySelectorAll('.mobile-section-toggle');
sectionButtons.forEach(function(button) {
    button.addEventListener('click', function() {
        var expanded = button.getAttribute('aria-expanded') !== 'true';
        var controls = button.getAttribute('aria-controls');
        sectionButtons.forEach(function(otherButton) {
            if (otherButton.getAttribute('aria-controls') === controls) {
                otherButton.setAttribute('aria-expanded', String(expanded));
            }
        });
        controls.split(' ').forEach(function(id) {
            var section = document.getElementById(id);
            section.classList.toggle('mobile-section-collapsed', !expanded);
            if (expanded && id === 'mapDiv') {
                document.dispatchEvent(new Event('mapexpanded'));
            }
        });
    });
});
