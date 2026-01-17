document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('nav a');

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            // Skip if it's the current page
            if (window.location.pathname.endsWith(href)) return;

            e.preventDefault();

            const content = document.querySelector('.page-content');
            const canvas = document.getElementById('automaton');

            content.classList.add('page-exit');
            if (canvas) {
                canvas.classList.add('canvas-exit');
            }

            setTimeout(() => {
                window.location.href = href;
            }, 300);
        });
    });
});
