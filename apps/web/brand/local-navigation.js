// Keep link labels and styling while preventing navigation off this instance.
function blockExternalLink(event) {
  const anchor = event.target.closest?.('a[href], area[href]');
  if (!anchor) return;
  const destination = new URL(anchor.getAttribute('href'), location.href);
  if (destination.origin !== location.origin) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

for (const event of ['click', 'auxclick', 'contextmenu', 'dragstart']) {
  document.addEventListener(event, blockExternalLink, true);
}
