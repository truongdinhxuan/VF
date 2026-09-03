const FOCUSABLE_SELECTOR = [
  '[data-autofocus="true"]',
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const isFocusable = (element: HTMLElement): boolean =>
  !element.hidden
  && element.getAttribute('aria-hidden') !== 'true'
  && element.getClientRects().length > 0;

export const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(isFocusable);

export const focusFirstElement = (
  container: HTMLElement,
  preferred?: HTMLElement | null,
): void => {
  if (preferred?.isConnected && container.contains(preferred)) {
    preferred.focus();
    return;
  }
  const autoFocusTarget = container.querySelector<HTMLElement>('[data-autofocus="true"]');
  if (autoFocusTarget && isFocusable(autoFocusTarget)) {
    autoFocusTarget.focus();
    return;
  }
  const [first] = getFocusableElements(container);
  (first ?? container).focus();
};

export const trapTabKey = (event: KeyboardEvent, container: HTMLElement): void => {
  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey && (active === first || !container.contains(active))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !container.contains(active))) {
    event.preventDefault();
    first.focus();
  }
};

export const restoreFocus = (element: HTMLElement | null): void => {
  if (element?.isConnected && !element.hasAttribute('disabled')) {
    window.requestAnimationFrame(() => element.focus());
  }
};
