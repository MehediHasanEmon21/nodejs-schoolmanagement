const toggle = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');

if (toggle && menu) {
  const mobile = window.matchMedia('(max-width: 767px)');
  function setOpen(open) {
    menu.hidden = mobile.matches && !open;
    toggle.setAttribute('aria-expanded', String(!menu.hidden));
  }
  toggle.hidden = false;
  setOpen(false);
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  mobile.addEventListener('change', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobile.matches && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
}
