/**
 * Font Preview for Decap CMS
 *
 * Loads all Google Fonts and uses a MutationObserver to style
 * the react-select dropdown options so each font name renders
 * in its own typeface. Works with Decap CMS's React-based UI.
 */

(function () {
  var allFonts = [
    'Fraunces','Playfair Display','Merriweather','Lora','Libre Baskerville',
    'Cormorant Garamond','EB Garamond','Crimson Text','Spectral','DM Serif Display',
    'Bitter','Noto Serif','Vollkorn','Alegreya','Cardo','Gentium Plus','PT Serif',
    'Zilla Slab','Josefin Slab','Rokkitt','Crimson Pro','Newsreader','Literata',
    'Gelasio','Domine','Tinos','Noto Serif Display','Brygada 1918','Piazzolla',
    'Yrsa','Martel','Lusitana','Noticia Text','Old Standard TT','Sorts Mill Goudy',
    'Cinzel','Abril Fatface','Bodoni Moda','Cormorant','Petrona','Libre Caslon Text',
    'DM Serif Text','Arvo','Neuton','Mate','Arapey','Prata','Yeseva One',
    'Cormorant Infant','Quando',
    'Source Sans 3','Inter','Open Sans','Roboto','Lato','Nunito','Work Sans',
    'DM Sans','Poppins','Raleway','Outfit','Plus Jakarta Sans','Noto Sans','Mukta',
    'Rubik','Cabin','Karla','Lexend','Figtree','Manrope','Montserrat','Barlow',
    'Josefin Sans','Quicksand','Mulish','Overpass','Urbanist','Red Hat Display',
    'Albert Sans','Sora','Commissioner','Atkinson Hyperlegible','Public Sans',
    'Nunito Sans','Exo 2','Libre Franklin','IBM Plex Sans','PT Sans','Titillium Web',
    'Hind','Signika','Heebo','Asap','Red Hat Text','Bricolage Grotesque',
    'Instrument Sans','Wix Madefor Display','Geist',
    'JetBrains Mono','Fira Code','Source Code Pro','IBM Plex Mono','Roboto Mono',
    'Space Mono','Inconsolata','Ubuntu Mono','Overpass Mono','DM Mono','Anonymous Pro',
    'Courier Prime','Noto Sans Mono','Red Hat Mono','Martian Mono','Geist Mono',
  ];

  // Build a lookup set for fast matching
  var fontSet = {};
  allFonts.forEach(function (f) { fontSet[f] = true; });

  // Load all Google Fonts (one weight each to keep payload small)
  var families = allFonts.map(function (f) { return 'family=' + f.replace(/ /g, '+'); }).join('&');
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?' + families + '&display=swap';
  document.head.appendChild(link);

  // Extract the font name from a CMS select option label like
  // "Fraunces — Warm old-style serif with optical sizing (default)"
  function extractFontName(text) {
    if (!text) return null;
    var name = text.split(' — ')[0].split(' —')[0].trim();
    return fontSet[name] ? name : null;
  }

  // Apply font-family to an element if its text matches a font name
  function styleFontElement(el) {
    var text = el.textContent || el.innerText || '';
    var fontName = extractFontName(text);
    if (fontName) {
      el.style.fontFamily = "'" + fontName + "', serif";
      el.style.fontSize = '15px';
      el.style.lineHeight = '1.6';
    }
  }

  // Scan all react-select option elements and the selected value display
  function applyFontStyles() {
    // react-select dropdown options (class contains "__option")
    document.querySelectorAll('[class*="__option"], [class*="__single-value"]').forEach(styleFontElement);

    // Also try native select elements (fallback)
    document.querySelectorAll('select option').forEach(function (opt) {
      if (fontSet[opt.value]) {
        opt.style.fontFamily = "'" + opt.value + "', serif";
      }
    });
    document.querySelectorAll('select').forEach(function (sel) {
      if (fontSet[sel.value]) {
        sel.style.fontFamily = "'" + sel.value + "', serif";
        sel.style.fontSize = '15px';
      }
    });
  }

  // Use MutationObserver to catch dynamically rendered dropdowns
  var observer = new MutationObserver(function (mutations) {
    var shouldApply = false;
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) {
        shouldApply = true;
        break;
      }
    }
    if (shouldApply) {
      requestAnimationFrame(applyFontStyles);
    }
  });

  // Start observing once the CMS has loaded
  function init() {
    observer.observe(document.body, { childList: true, subtree: true });
    applyFontStyles();
  }

  // Wait for CMS to be ready
  if (document.readyState === 'complete') {
    setTimeout(init, 1000);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 1000); });
  }
})();
