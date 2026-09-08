(() => {
  const initialize = () => {
    const menus = [...document.querySelectorAll('.nav-menu')];
    const close = menu => {
      menu.querySelector('button').setAttribute('aria-expanded', 'false');
      menu.querySelector('.submenu').hidden = true;
    };
    for (const menu of menus) {
      const button = menu.querySelector('button'), panel = menu.querySelector('.submenu');
      button.addEventListener('click', () => {
        const open = button.getAttribute('aria-expanded') !== 'true';
        menus.forEach(close);
        button.setAttribute('aria-expanded', String(open)); panel.hidden = !open;
      });
      menu.addEventListener('keydown', event => {
        if (event.key === 'Escape') { close(menu); button.focus(); }
        if (event.key === 'ArrowDown' && event.target === button) {
          event.preventDefault(); menus.forEach(close);
          button.setAttribute('aria-expanded', 'true'); panel.hidden = false;
          panel.querySelector('a')?.focus();
        }
      });
    }
    document.addEventListener('click', event => menus.forEach(menu => {
      if (!menu.contains(event.target)) close(menu);
    }));
    document.querySelector('main')?.setAttribute('id', 'main-content');
    document.documentElement.dataset.navigationReady = 'true';
    const page = location.pathname.split('/').at(-1) || 'index.html';
    for (const link of document.querySelectorAll('.submenu a')) {
      if (new URL(link.href).pathname.split('/').at(-1) === page) link.setAttribute('aria-current', 'page');
    }
  };
  const start = async () => {
    await Promise.all([...document.querySelectorAll('[data-include]')].map(async element => {
      try {
        const response = await fetch(element.dataset.include);
        if (!response.ok) throw new Error('Missing shared content');
        element.innerHTML = await response.text();
      } catch {
        if (!element.textContent.trim()) element.textContent = 'Shared navigation needs an HTTP documentation server.';
      }
    }));
    initialize();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
