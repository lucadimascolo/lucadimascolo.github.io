document.addEventListener('DOMContentLoaded', () => {
    const dropdown = document.querySelector('.dropdown');
    const toggle = document.querySelector('.dropdown-toggle');

    if (!window.matchMedia('(hover: hover)').matches) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
        });
    }

    const links = document.querySelectorAll('nav a');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            // Skip external links and current page
            if (link.getAttribute('target') === '_blank') return;
            if (window.location.pathname.endsWith(href)) return;

            e.preventDefault();

            const content = document.querySelector('.page-content');

            content.classList.add('page-exit');

            setTimeout(() => {
                window.location.href = href;
            }, 300);
        });
    });
});
