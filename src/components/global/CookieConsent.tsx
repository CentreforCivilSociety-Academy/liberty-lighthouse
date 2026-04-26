/** @jsxImportSource preact */
import { useEffect, useState } from 'preact/hooks';
import { render } from 'preact';

const STORAGE_KEY = 'll-consent-v1';
const OPEN_EVENT = 'll-consent-open';

type Decision = 'granted' | 'denied' | null;

function readDecision(): Decision {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'granted' || v === 'denied') return v;
  } catch {}
  return null;
}

function writeDecision(state: 'granted' | 'denied') {
  try { localStorage.setItem(STORAGE_KEY, state); } catch {}
  window.dispatchEvent(new CustomEvent('ll-consent-update', { detail: { granted: state === 'granted' } }));
}

function ConsentBanner() {
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    if (readDecision() === null) setOpen(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!open) return null;

  const accept = () => { writeDecision('granted'); setOpen(false); };
  const decline = () => { writeDecision('denied'); setOpen(false); };

  return (
    <div
      class="cookie-consent"
      role="dialog"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
    >
      <div class="cookie-consent-inner">
        <div class="cookie-consent-text">
          <p id="cookie-consent-title" class="cookie-consent-title">Cookies on Liberty Lighthouse</p>
          <p id="cookie-consent-body" class="cookie-consent-body">
            We use Google Analytics to understand which articles people read and how they got here. Nothing is shared with advertisers and your IP address is anonymised. You can change this anytime in the footer.{' '}
            <a href="/privacy/" class="cookie-consent-link">Read our privacy notice</a>.
          </p>
        </div>
        <div class="cookie-consent-actions" role="group" aria-label="Cookie consent">
          <button type="button" class="cookie-consent-btn cookie-consent-btn-decline" onClick={decline}>Decline</button>
          <button type="button" class="cookie-consent-btn cookie-consent-btn-accept" onClick={accept}>Accept</button>
        </div>
      </div>
    </div>
  );
}

export function initCookieConsent() {
  const container = document.createElement('div');
  container.id = 'cookie-consent-root';
  document.body.appendChild(container);
  render(<ConsentBanner />, container);
}

/** Re-open the banner so the user can change their mind. Used by the footer link. */
export function openCookieConsent() {
  // Clear stored decision so the banner shows; the user must re-pick.
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  window.dispatchEvent(new Event(OPEN_EVENT));
}
