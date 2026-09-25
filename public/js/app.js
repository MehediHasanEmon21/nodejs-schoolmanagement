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
  menu.addEventListener('click', (event) => {
    if (mobile.matches && event.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !document.querySelector('dialog[open]') && mobile.matches && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
}

// Keep the original POST form functional when JavaScript or native dialogs are unavailable.
document.querySelectorAll('form[data-confirm-dialog]').forEach((form) => {
  const dialog = document.getElementById(form.dataset.confirmDialog);
  if (!dialog || typeof dialog.showModal !== 'function') return;
  let opener;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    opener = event.submitter || form.querySelector('button');
    dialog.showModal();
  });
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const controls = [...dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
      .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  dialog.addEventListener('click', (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
});

document.querySelectorAll('[data-print-button]').forEach((button) => {
  button.addEventListener('click', () => window.print());
});
