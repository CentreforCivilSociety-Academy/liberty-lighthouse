/** @jsxImportSource preact */
import { useEffect, useRef, useState } from 'preact/hooks';
import { render } from 'preact';

interface GlossaryEntry {
  term: string;
  definition: string;
  url: string;
}
type GlossaryMap = Record<string, GlossaryEntry>;

const SS_KEY = 'll-glossary-v1';
const FETCH_URL = '/glossary.json';
const HOVER_OPEN_DELAY = 80;     // ms — how long before we even fetch on hover
const HOVER_CLOSE_GRACE = 120;   // ms — let user move to card without it disappearing

let cache: GlossaryMap | null = null;
let inflight: Promise<GlossaryMap> | null = null;

async function loadGlossary(): Promise<GlossaryMap> {
  if (cache) return cache;
  if (inflight) return inflight;

  try {
    const stored = sessionStorage.getItem(SS_KEY);
    if (stored) {
      cache = JSON.parse(stored);
      return cache!;
    }
  } catch { /* ignore */ }

  inflight = fetch(FETCH_URL, { credentials: 'omit' })
    .then((r) => {
      if (!r.ok) throw new Error('glossary.json failed');
      return r.json() as Promise<GlossaryMap>;
    })
    .then((data) => {
      cache = data;
      try { sessionStorage.setItem(SS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
      return data;
    })
    .finally(() => { inflight = null; });

  return inflight;
}

interface CardProps {
  anchor: HTMLAnchorElement;
  slug: string;
  onClose: () => void;
}

function GlossaryCard({ anchor, slug, onClose }: CardProps) {
  const [entry, setEntry] = useState<GlossaryEntry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; flipped: boolean }>({ top: 0, left: 0, flipped: false });

  // Position the card after it renders (so we can measure its height).
  useEffect(() => {
    const r = anchor.getBoundingClientRect();
    const card = cardRef.current;
    if (!card) return;
    const cardH = card.offsetHeight;
    const cardW = card.offsetWidth;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const margin = 8;

    let top = r.bottom + window.scrollY + 2;
    let flipped = false;
    if (r.bottom + cardH + margin > viewportH && r.top - cardH - margin > 0) {
      top = r.top + window.scrollY - cardH - 2;
      flipped = true;
    }
    let left = r.left + window.scrollX;
    if (left + cardW + margin > window.scrollX + viewportW) {
      left = window.scrollX + viewportW - cardW - margin;
    }
    if (left < window.scrollX + margin) left = window.scrollX + margin;
    setPos({ top, left, flipped });
  }, [anchor, entry]);

  // Lazy fetch glossary data.
  useEffect(() => {
    let cancelled = false;
    loadGlossary().then((data) => {
      if (cancelled) return;
      setEntry(data[slug] ?? null);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [slug]);

  // Click outside / Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t)) return;
      if (anchor.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onDocClick, true);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onDocClick, true);
    };
  }, [anchor, onClose]);

  if (!loading && !entry) return null;

  return (
    <div
      ref={cardRef}
      role="tooltip"
      class="glossary-card"
      style={`top:${pos.top}px;left:${pos.left}px;`}
    >
      {loading ? (
        <div class="glossary-card-skeleton" aria-hidden="true">
          <div class="glossary-card-skeleton-line" />
          <div class="glossary-card-skeleton-line" style="width:80%" />
        </div>
      ) : entry ? (
        <>
          <div class="glossary-card-term">{entry.term}</div>
          <div class="glossary-card-definition">{entry.definition}</div>
          <a href={entry.url} class="glossary-card-link">Read more →</a>
        </>
      ) : null}
    </div>
  );
}

function findGlossaryAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('a.glossary-term[data-glossary-slug]');
  return el as HTMLAnchorElement | null;
}

interface MountState {
  anchor: HTMLAnchorElement;
  slug: string;
  container: HTMLDivElement;
}

let mountState: MountState | null = null;
let openTimer: number | null = null;
let closeTimer: number | null = null;

function unmount() {
  if (closeTimer !== null) { window.clearTimeout(closeTimer); closeTimer = null; }
  if (openTimer !== null) { window.clearTimeout(openTimer); openTimer = null; }
  if (mountState) {
    render(null, mountState.container);
    mountState.container.remove();
    mountState.anchor.removeAttribute('aria-describedby');
    mountState = null;
  }
}

function mount(anchor: HTMLAnchorElement) {
  const slug = anchor.getAttribute('data-glossary-slug');
  if (!slug) return;
  if (mountState && mountState.anchor === anchor) return;
  unmount();

  const container = document.createElement('div');
  container.id = 'glossary-card-container';
  document.body.appendChild(container);
  mountState = { anchor, slug, container };

  anchor.setAttribute('aria-describedby', 'glossary-card-container');

  render(<GlossaryCard anchor={anchor} slug={slug} onClose={unmount} />, container);
}

function scheduleOpen(anchor: HTMLAnchorElement) {
  if (closeTimer !== null) { window.clearTimeout(closeTimer); closeTimer = null; }
  if (openTimer !== null) { window.clearTimeout(openTimer); }
  openTimer = window.setTimeout(() => {
    openTimer = null;
    mount(anchor);
  }, HOVER_OPEN_DELAY);
}

function scheduleClose() {
  if (openTimer !== null) { window.clearTimeout(openTimer); openTimer = null; }
  if (closeTimer !== null) return;
  closeTimer = window.setTimeout(() => {
    closeTimer = null;
    unmount();
  }, HOVER_CLOSE_GRACE);
}

export function initGlossaryHover() {
  function isInsideCard(target: EventTarget | null): boolean {
    if (!mountState) return false;
    return target instanceof Node && mountState.container.contains(target);
  }

  // Pointer (desktop) — open on hover, close after grace.
  // The card itself also counts as "still hovering" so the user can move
  // from the anchor onto the card to click "Read more".
  document.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    const anchor = findGlossaryAnchor(e.target);
    if (anchor) {
      scheduleOpen(anchor);
      return;
    }
    if (isInsideCard(e.target)) {
      // Cancel any pending close while the cursor is over the card.
      if (closeTimer !== null) { window.clearTimeout(closeTimer); closeTimer = null; }
    }
  });
  document.addEventListener('pointerout', (e) => {
    if ((e as PointerEvent).pointerType === 'touch') return;
    const anchor = findGlossaryAnchor(e.target);
    const insideCard = isInsideCard(e.target);
    if (!anchor && !insideCard) return;
    // Don't close if the pointer is moving INTO the card from the anchor (or vice versa).
    const related = (e as PointerEvent).relatedTarget;
    const stillInside = isInsideCard(related) || !!findGlossaryAnchor(related);
    if (stillInside) {
      if (closeTimer !== null) { window.clearTimeout(closeTimer); closeTimer = null; }
      return;
    }
    scheduleClose();
  });

  // Keyboard focus.
  document.addEventListener('focusin', (e) => {
    const anchor = findGlossaryAnchor(e.target);
    if (anchor) mount(anchor);
  });
  document.addEventListener('focusout', (e) => {
    const anchor = findGlossaryAnchor(e.target);
    if (anchor) {
      // Defer so focus moving INTO the card doesn't trigger close.
      setTimeout(() => {
        if (mountState && !mountState.container.contains(document.activeElement)) {
          unmount();
        }
      }, 0);
    }
  });

  // Touch — first tap opens; second tap on the same anchor follows the link.
  let lastTouchedAnchor: HTMLAnchorElement | null = null;
  document.addEventListener('click', (e) => {
    const anchor = findGlossaryAnchor(e.target);
    if (!anchor) return;
    // Only intervene for touch — pointerover handles desktop pre-hover.
    const isTouch = (e as PointerEvent).pointerType === 'touch' || !window.matchMedia('(hover: hover)').matches;
    if (!isTouch) return;
    if (lastTouchedAnchor === anchor && mountState?.anchor === anchor) {
      lastTouchedAnchor = null;
      return; // let the click follow the link
    }
    e.preventDefault();
    lastTouchedAnchor = anchor;
    mount(anchor);
  }, true);
}
