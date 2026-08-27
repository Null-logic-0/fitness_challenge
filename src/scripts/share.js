/**
 * Builds the plain-text result summary used by "copy result", and the
 * LinkedIn share-dialog deep link. Kept framework-free so it can run from a
 * plain inline module script.
 */

/**
 * @param {{title:string, total:number, pullUps:number, dips:number, pullUpsLabel:string, dipsLabel:string, personalBestLabel?:string, canYouBeatLabel:string, isPersonalBest:boolean}} data
 */
export function buildShareText(data) {
  const lines = [
    data.title,
    '',
    `${data.total} ${data.totalLabel}`,
    '',
    `${data.pullUps} ${data.pullUpsLabel}`,
    `${data.dips} ${data.dipsLabel}`,
  ];
  if (data.isPersonalBest && data.personalBestLabel) {
    lines.push('', data.personalBestLabel);
  }
  lines.push('', data.canYouBeatLabel);
  return lines.join('\n');
}

/** @param {string} url */
export function buildLinkedInShareUrl(url) {
  const params = new URLSearchParams({ url });
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`;
}

/** @param {string} url @param {string} text */
export function buildXShareUrl(url, text) {
  const params = new URLSearchParams({ url, text });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** @param {string} text @returns {Promise<boolean>} */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generic "click to copy, then flash the label" wiring shared by every copy
 * button (result text, plain links, invite links).
 * @param {HTMLElement|null} button
 * @param {() => string} getText
 */
export function wireCopyButton(button, getText) {
  if (!button) return;
  const label = button.querySelector('[data-copy-label]') ?? button;
  const defaultText = label.textContent;
  const copiedText = button.dataset.copiedLabel ?? defaultText;

  button.addEventListener('click', async () => {
    const ok = await copyText(getText());
    if (!ok) return;
    label.textContent = copiedText;
    setTimeout(() => { label.textContent = defaultText; }, 2000);
  });
}

/**
 * Wires up a share card's "copy result" button. `root` must contain a
 * `[data-action="copy"]` button and expose the text via `data-share-text`.
 * @param {HTMLElement} root
 */
export function initShareCard(root) {
  wireCopyButton(root.querySelector('[data-action="copy"]'), () => root.dataset.shareText ?? '');
}
