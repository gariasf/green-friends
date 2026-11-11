for (const link of document.querySelectorAll('a[data-domain]')) {
  const address = `${link.dataset.user}@${link.dataset.domain}`;
  link.href = `mailto:${address}`;
  if (link.textContent.includes(' at ')) link.textContent = address;
}
