/**
 * Font Preview for Decap CMS
 *
 * 1. Loads all Google Fonts
 * 2. Styles react-select dropdown options in their own typeface
 * 3. Injects a live preview panel below each font selector showing
 *    sample heading + paragraph text in the currently selected font
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

  // Lookup set
  var fontSet = {};
  allFonts.forEach(function (f) { fontSet[f] = true; });

  // Font field names → preview config
  var fontFields = {
    displayFont: {
      heading: 'Liberty Lighthouse',
      body: 'Ideas that advance freedom, markets, and the rule of law. Understanding India\u2019s policy landscape through curated FAQs and guided syllabi.',
      headingSize: '28px',
      bodySize: '16px',
    },
    bodyFont: {
      heading: 'Explore by Topic',
      body: 'Dive into India\u2019s most pressing policy questions through curated FAQs, video curricula, and guided syllabi. A project of the Centre for Civil Society.',
      headingSize: '20px',
      bodySize: '16px',
    },
    monoFont: {
      heading: 'Code & Data',
      body: 'const freedom = markets + rule_of_law;\nfunction libertyLighthouse(topic) {\n  return curate(faqs, videos, syllabus);\n}',
      headingSize: '18px',
      bodySize: '14px',
    },
  };

  // ── Load Google Fonts ──
  var families = allFonts.map(function (f) { return 'family=' + f.replace(/ /g, '+'); }).join('&');
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?' + families + '&display=swap';
  document.head.appendChild(link);

  // ── Inject preview panel styles ──
  var style = document.createElement('style');
  style.textContent = [
    '.font-preview-panel {',
    '  margin: 10px 0 4px 0;',
    '  padding: 20px 24px;',
    '  border: 1px solid #e0ddd8;',
    '  border-radius: 8px;',
    '  background: linear-gradient(135deg, #fdfbf9 0%, #f7f3ef 100%);',
    '  transition: all 0.3s ease;',
    '}',
    '.font-preview-heading {',
    '  margin: 0 0 8px 0;',
    '  color: #1a1612;',
    '  font-weight: 700;',
    '  line-height: 1.2;',
    '  letter-spacing: -0.01em;',
    '}',
    '.font-preview-body {',
    '  margin: 0;',
    '  color: #5c524a;',
    '  line-height: 1.65;',
    '  white-space: pre-wrap;',
    '}',
    '.font-preview-label {',
    '  display: inline-block;',
    '  margin-bottom: 8px;',
    '  padding: 2px 8px;',
    '  font-size: 10px;',
    '  font-weight: 600;',
    '  text-transform: uppercase;',
    '  letter-spacing: 0.08em;',
    '  color: #7d726a;',
    '  background: #ece7e1;',
    '  border-radius: 4px;',
    '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  // ── Helpers ──

  function extractFontName(text) {
    if (!text) return null;
    var name = text.split(' \u2014 ')[0].split(' \u2014')[0].trim();
    return fontSet[name] ? name : null;
  }

  function styleFontElement(el) {
    var text = el.textContent || el.innerText || '';
    var fontName = extractFontName(text);
    if (fontName) {
      el.style.fontFamily = "'" + fontName + "', serif";
      el.style.fontSize = '15px';
      el.style.lineHeight = '1.6';
    }
  }

  // ── Create or update a preview panel for a font field ──

  function createPreviewPanel(fieldName, fontName) {
    var config = fontFields[fieldName];
    if (!config) return null;

    var panel = document.createElement('div');
    panel.className = 'font-preview-panel';
    panel.setAttribute('data-font-preview', fieldName);

    var label = document.createElement('span');
    label.className = 'font-preview-label';
    label.textContent = 'Preview';

    var heading = document.createElement('p');
    heading.className = 'font-preview-heading';
    heading.style.fontSize = config.headingSize;
    heading.style.fontFamily = "'" + fontName + "', serif";
    heading.textContent = config.heading;

    var body = document.createElement('p');
    body.className = 'font-preview-body';
    body.style.fontSize = config.bodySize;
    body.style.fontFamily = "'" + fontName + "', serif";
    body.textContent = config.body;

    panel.appendChild(label);
    panel.appendChild(heading);
    panel.appendChild(body);
    return panel;
  }

  function updatePreviewPanel(panel, fieldName, fontName) {
    var config = fontFields[fieldName];
    if (!config) return;

    var heading = panel.querySelector('.font-preview-heading');
    var body = panel.querySelector('.font-preview-body');
    if (heading) heading.style.fontFamily = "'" + fontName + "', serif";
    if (body) body.style.fontFamily = "'" + fontName + "', serif";
  }

  // ── Find font field containers and inject preview panels ──

  function findFieldWrapper(fieldName) {
    // Decap CMS renders labels with "for" attributes or text content
    // matching the field name. We search for the label text.
    var labelTexts = {
      displayFont: 'Display Font (Headings)',
      bodyFont: 'Body Font',
      monoFont: 'Monospace Font',
    };
    var searchText = labelTexts[fieldName];
    if (!searchText) return null;

    var labels = document.querySelectorAll('label');
    for (var i = 0; i < labels.length; i++) {
      var t = (labels[i].textContent || '').trim();
      if (t === searchText) {
        // The wrapper is usually the label's parent or grandparent
        return labels[i].closest('[class*="WidgetControl"]') ||
               labels[i].closest('[class*="ObjectControl"]') ||
               labels[i].parentElement.parentElement;
      }
    }
    return null;
  }

  function getSelectedFont(wrapper) {
    // Try react-select single value
    var singleValue = wrapper.querySelector('[class*="__single-value"]');
    if (singleValue) {
      return extractFontName(singleValue.textContent);
    }
    // Try native select
    var sel = wrapper.querySelector('select');
    if (sel && fontSet[sel.value]) {
      return sel.value;
    }
    return null;
  }

  function injectPreviews() {
    Object.keys(fontFields).forEach(function (fieldName) {
      var wrapper = findFieldWrapper(fieldName);
      if (!wrapper) return;

      var fontName = getSelectedFont(wrapper);
      if (!fontName) return;

      var existing = wrapper.querySelector('[data-font-preview="' + fieldName + '"]');
      if (existing) {
        updatePreviewPanel(existing, fieldName, fontName);
      } else {
        var panel = createPreviewPanel(fieldName, fontName);
        if (panel) wrapper.appendChild(panel);
      }
    });
  }

  // ── Style dropdown options ──

  function applyFontStyles() {
    document.querySelectorAll('[class*="__option"], [class*="__single-value"]').forEach(styleFontElement);

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

    // Also update preview panels
    injectPreviews();
  }

  // ── MutationObserver ──

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

  function init() {
    observer.observe(document.body, { childList: true, subtree: true });
    applyFontStyles();
    // Re-apply periodically to catch slow-loading fonts
    setInterval(injectPreviews, 3000);
  }

  if (document.readyState === 'complete') {
    setTimeout(init, 1500);
  } else {
    window.addEventListener('load', function () { setTimeout(init, 1500); });
  }
})();
