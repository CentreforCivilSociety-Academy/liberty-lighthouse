/**
 * Font Preview for Decap CMS
 *
 * Strategy:
 * 1. Register a custom preview template (right panel) that renders fonts beautifully
 * 2. Inject live preview panels into the editor (left panel) by finding
 *    react-select containers via label text proximity
 * 3. Style react-select dropdown options in their own typeface
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════
   * Font catalogue (must match config.yml options)
   * ═══════════════════════════════════════════════════ */

  var ALL_FONTS = [
    // Serif / Display
    'Fraunces','Playfair Display','Merriweather','Lora','Libre Baskerville',
    'Cormorant Garamond','EB Garamond','Crimson Text','Spectral','DM Serif Display',
    'Bitter','Noto Serif','Vollkorn','Alegreya','Cardo','Gentium Plus','PT Serif',
    'Zilla Slab','Josefin Slab','Rokkitt','Crimson Pro','Newsreader','Literata',
    'Gelasio','Domine','Tinos','Noto Serif Display','Brygada 1918','Piazzolla',
    'Yrsa','Martel','Lusitana','Noticia Text','Old Standard TT','Sorts Mill Goudy',
    'Cinzel','Abril Fatface','Bodoni Moda','Cormorant','Petrona','Libre Caslon Text',
    'DM Serif Text','Arvo','Neuton','Mate','Arapey','Prata','Yeseva One',
    'Cormorant Infant','Quando','Tenor Sans','Philosopher','Vidaloka','Oranienbaum',
    'Cambo','Italiana','Buenard','Unna','Headland One','Fanwood Text','Rufina',
    'GFS Didot','Vesper Libre','Coustard','Proza Libre','Alike',
    // Sans-serif / Body
    'Source Sans 3','Inter','Open Sans','Roboto','Lato','Nunito','Work Sans',
    'DM Sans','Poppins','Raleway','Outfit','Plus Jakarta Sans','Noto Sans','Mukta',
    'Rubik','Cabin','Karla','Lexend','Figtree','Manrope','Montserrat','Barlow',
    'Josefin Sans','Quicksand','Mulish','Overpass','Urbanist','Red Hat Display',
    'Albert Sans','Sora','Commissioner','Atkinson Hyperlegible','Public Sans',
    'Nunito Sans','Exo 2','Libre Franklin','IBM Plex Sans','PT Sans','Titillium Web',
    'Hind','Signika','Heebo','Asap','Red Hat Text','Bricolage Grotesque',
    'Instrument Sans','Wix Madefor Display','Geist',
    // Monospace
    'JetBrains Mono','Fira Code','Source Code Pro','IBM Plex Mono','Roboto Mono',
    'Space Mono','Inconsolata','Ubuntu Mono','Overpass Mono','DM Mono','Anonymous Pro',
    'Courier Prime','Noto Sans Mono','Red Hat Mono','Martian Mono','Geist Mono',
  ];

  var fontSet = {};
  ALL_FONTS.forEach(function (f) { fontSet[f] = true; });

  /* ═══════════════════════════════════════════════════
   * Load all Google Fonts
   * ═══════════════════════════════════════════════════ */

  var families = ALL_FONTS.map(function (f) {
    return 'family=' + f.replace(/ /g, '+') + ':wght@400;600;700';
  }).join('&');

  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?' + families + '&display=swap';
  document.head.appendChild(link);

  /* ═══════════════════════════════════════════════════
   * Preview config per font field
   * ═══════════════════════════════════════════════════ */

  var PREVIEWS = {
    displayFont: {
      label: 'Heading Font Preview',
      heading: 'Liberty Lighthouse',
      body: 'Ideas that advance freedom, markets, and the rule of law.',
      headingSize: '26px',
      bodySize: '15px',
    },
    bodyFont: {
      label: 'Body Font Preview',
      heading: 'Explore by Topic',
      body: 'Dive into India\u2019s most pressing policy questions through curated FAQs, video curricula, and guided syllabi.',
      headingSize: '18px',
      bodySize: '15px',
    },
    monoFont: {
      label: 'Monospace Font Preview',
      heading: 'Code & Data',
      body: 'const freedom = markets + rule_of_law;\nfunction lighthouse(topic) {\n  return curate(faqs, videos);\n}',
      headingSize: '15px',
      bodySize: '13px',
    },
  };

  // Maps label text (lowercase) → field name
  var LABEL_MAP = {
    'display font (headings)': 'displayFont',
    'body font': 'bodyFont',
    'monospace font': 'monoFont',
  };

  /* ═══════════════════════════════════════════════════
   * Inject styles
   * ═══════════════════════════════════════════════════ */

  var style = document.createElement('style');
  style.textContent = [
    '.ll-fp { margin:12px 0 4px; padding:20px 24px; border:1px solid #e0ddd8; border-radius:10px;',
    '  background:linear-gradient(135deg,#fdfbf9,#f7f3ef); box-shadow:0 1px 3px rgba(0,0,0,.04); transition:box-shadow .3s; }',
    '.ll-fp:hover { box-shadow:0 2px 8px rgba(0,0,0,.08); }',
    '.ll-fp-badge { display:inline-block; margin-bottom:10px; padding:3px 10px; font-size:10px; font-weight:600;',
    '  text-transform:uppercase; letter-spacing:.08em; color:#7d726a; background:#ece7e1; border-radius:4px;',
    '  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }',
    '.ll-fp-heading { margin:0 0 8px; color:#1a1612; font-weight:700; line-height:1.2; letter-spacing:-.01em; }',
    '.ll-fp-body { margin:0; color:#5c524a; line-height:1.65; white-space:pre-wrap; }',
  ].join('\n');
  document.head.appendChild(style);

  /* ═══════════════════════════════════════════════════
   * Apply site typography to CMS markdown editors
   * Fetches current font settings and injects CSS
   * that styles all rich-text editors (ProseMirror,
   * Slate, and raw textareas) with the site's fonts.
   * ═══════════════════════════════════════════════════ */

  function loadEditorTypography() {
    fetch('/src/content/settings/typography.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (typo) {
        if (!typo) {
          typo = {
            displayFont: 'Fraunces',
            bodyFont: 'Source Sans 3',
            monoFont: 'JetBrains Mono',
            h1Size: 2,
            h2Size: 1.5,
            h3Size: 1.125,
            baseLineHeight: 1.7,
          };
        }

        var display = "'" + typo.displayFont + "'";
        var body = "'" + typo.bodyFont + "'";
        var mono = "'" + typo.monoFont + "'";
        var lh = typo.baseLineHeight || 1.7;

        // Load the active fonts specifically (with weights needed for editing)
        var editorFontsLink = document.createElement('link');
        editorFontsLink.rel = 'stylesheet';
        editorFontsLink.href = 'https://fonts.googleapis.com/css2?family=' +
          typo.displayFont.replace(/ /g, '+') + ':wght@400;600;700;800&family=' +
          typo.bodyFont.replace(/ /g, '+') + ':wght@300;400;500;600;700&family=' +
          typo.monoFont.replace(/ /g, '+') + ':wght@400;500&display=swap';
        document.head.appendChild(editorFontsLink);

        var editorCSS = [
          '/* ── Liberty Lighthouse editor typography ── */',
          '',
          '/* Rich-text editor body (ProseMirror / Slate) */',
          '[data-slate-editor], .ProseMirror, .cms-editor-visual, [contenteditable="true"] {',
          '  font-family: ' + body + ' !important;',
          '  line-height: ' + lh + ' !important;',
          '  color: #1a1612 !important;',
          '  font-size: 16px !important;',
          '}',
          '',
          '/* Headings inside the editor */',
          '[data-slate-editor] h1, .ProseMirror h1, [contenteditable="true"] h1 {',
          '  font-family: ' + display + ' !important;',
          '  font-size: ' + typo.h1Size + 'rem !important;',
          '  font-weight: 700 !important;',
          '  line-height: 1.15 !important;',
          '  color: #1a1612 !important;',
          '  margin: 1.2em 0 0.4em !important;',
          '}',
          '[data-slate-editor] h2, .ProseMirror h2, [contenteditable="true"] h2 {',
          '  font-family: ' + display + ' !important;',
          '  font-size: ' + typo.h2Size + 'rem !important;',
          '  font-weight: 600 !important;',
          '  line-height: 1.2 !important;',
          '  color: #1a1612 !important;',
          '  margin: 1em 0 0.4em !important;',
          '}',
          '[data-slate-editor] h3, .ProseMirror h3, [contenteditable="true"] h3 {',
          '  font-family: ' + display + ' !important;',
          '  font-size: ' + typo.h3Size + 'rem !important;',
          '  font-weight: 600 !important;',
          '  line-height: 1.25 !important;',
          '  color: #1a1612 !important;',
          '  margin: 0.8em 0 0.3em !important;',
          '}',
          '[data-slate-editor] h4, .ProseMirror h4, [contenteditable="true"] h4,',
          '[data-slate-editor] h5, .ProseMirror h5, [contenteditable="true"] h5,',
          '[data-slate-editor] h6, .ProseMirror h6, [contenteditable="true"] h6 {',
          '  font-family: ' + display + ' !important;',
          '  font-weight: 600 !important;',
          '  line-height: 1.3 !important;',
          '  color: #1a1612 !important;',
          '}',
          '',
          '/* Paragraphs */',
          '[data-slate-editor] p, .ProseMirror p, [contenteditable="true"] p {',
          '  font-family: ' + body + ' !important;',
          '  line-height: ' + lh + ' !important;',
          '  margin: 0 0 0.8em !important;',
          '}',
          '',
          '/* Lists */',
          '[data-slate-editor] ul, [data-slate-editor] ol,',
          '.ProseMirror ul, .ProseMirror ol,',
          '[contenteditable="true"] ul, [contenteditable="true"] ol {',
          '  font-family: ' + body + ' !important;',
          '  line-height: ' + lh + ' !important;',
          '}',
          '',
          '/* Inline code */',
          '[data-slate-editor] code, .ProseMirror code, [contenteditable="true"] code {',
          '  font-family: ' + mono + ' !important;',
          '  font-size: 0.875em !important;',
          '  background: #f7f3ef !important;',
          '  padding: 2px 6px !important;',
          '  border-radius: 4px !important;',
          '}',
          '',
          '/* Code blocks */',
          '[data-slate-editor] pre, .ProseMirror pre, [contenteditable="true"] pre {',
          '  font-family: ' + mono + ' !important;',
          '  font-size: 0.875em !important;',
          '  background: #1a1612 !important;',
          '  color: #faf7f4 !important;',
          '  padding: 16px 20px !important;',
          '  border-radius: 8px !important;',
          '  overflow-x: auto !important;',
          '}',
          '[data-slate-editor] pre code, .ProseMirror pre code, [contenteditable="true"] pre code {',
          '  background: transparent !important;',
          '  padding: 0 !important;',
          '  color: inherit !important;',
          '}',
          '',
          '/* Blockquotes */',
          '[data-slate-editor] blockquote, .ProseMirror blockquote, [contenteditable="true"] blockquote {',
          '  font-family: ' + body + ' !important;',
          '  border-left: 3px solid #c4703c !important;',
          '  padding-left: 1em !important;',
          '  color: #5c524a !important;',
          '  font-style: italic !important;',
          '}',
          '',
          '/* Links */',
          '[data-slate-editor] a, .ProseMirror a, [contenteditable="true"] a {',
          '  color: #a96032 !important;',
          '  text-decoration: underline !important;',
          '}',
          '',
          '/* Strong / Bold */',
          '[data-slate-editor] strong, .ProseMirror strong, [contenteditable="true"] strong {',
          '  font-weight: 600 !important;',
          '}',
          '',
          '/* Tables */',
          '[data-slate-editor] table, .ProseMirror table, [contenteditable="true"] table {',
          '  width: 100% !important;',
          '  border-collapse: collapse !important;',
          '  margin: 1em 0 !important;',
          '  font-family: ' + body + ' !important;',
          '}',
          '[data-slate-editor] th, .ProseMirror th, [contenteditable="true"] th {',
          '  font-weight: 600 !important;',
          '  background: #f7f3ef !important;',
          '  border: 1px solid #e8e2dc !important;',
          '  padding: 0.5rem 0.75rem !important;',
          '  text-align: left !important;',
          '  font-family: ' + body + ' !important;',
          '}',
          '[data-slate-editor] td, .ProseMirror td, [contenteditable="true"] td {',
          '  border: 1px solid #e8e2dc !important;',
          '  padding: 0.5rem 0.75rem !important;',
          '  vertical-align: top !important;',
          '  font-family: ' + body + ' !important;',
          '}',
          '[data-slate-editor] caption, .ProseMirror caption, [contenteditable="true"] caption {',
          '  caption-side: top !important;',
          '  text-align: left !important;',
          '  font-size: 0.875em !important;',
          '  font-weight: 600 !important;',
          '  color: #5c524a !important;',
          '  padding-bottom: 0.5em !important;',
          '}',
          '',
          '/* Raw markdown textarea fallback */',
          '.cms-editor-raw textarea, [class*="RawEditor"] textarea {',
          '  font-family: ' + mono + ' !important;',
          '  font-size: 14px !important;',
          '  line-height: 1.6 !important;',
          '}',
        ].join('\n');

        var editorStyle = document.createElement('style');
        editorStyle.id = 'll-editor-typography';
        editorStyle.textContent = editorCSS;
        document.head.appendChild(editorStyle);

        // Also register as a preview style for the right panel iframes
        if (window.CMS && window.CMS.registerPreviewStyle) {
          try {
            window.CMS.registerPreviewStyle(editorFontsLink.href);
            window.CMS.registerPreviewStyle(editorCSS, { raw: true });
          } catch (e) {
            // Silently ignore if CMS isn't ready
          }
        }
      });
  }

  /* ═══════════════════════════════════════════════════
   * Utility: extract font name from react-select text
   * ═══════════════════════════════════════════════════ */

  function extractFont(text) {
    if (!text) return null;
    // "Fraunces — Warm old-style serif..." → "Fraunces"
    var name = text.split(' \u2014 ')[0].split('\u2014')[0].trim();
    return fontSet[name] ? name : null;
  }

  /* ═══════════════════════════════════════════════════
   * Create a preview panel element
   * ═══════════════════════════════════════════════════ */

  function makePanel(fieldName, fontName) {
    var cfg = PREVIEWS[fieldName];
    if (!cfg) return null;

    var panel = document.createElement('div');
    panel.className = 'll-fp';
    panel.setAttribute('data-ll-field', fieldName);

    panel.innerHTML = [
      '<span class="ll-fp-badge">' + cfg.label + '</span>',
      '<p class="ll-fp-heading" style="font-size:' + cfg.headingSize +
        ';font-family:\'' + fontName + '\'">' + cfg.heading + '</p>',
      '<p class="ll-fp-body" style="font-size:' + cfg.bodySize +
        ';font-family:\'' + fontName + '\'">' + cfg.body + '</p>',
    ].join('');

    return panel;
  }

  function updatePanel(panel, fieldName, fontName) {
    var h = panel.querySelector('.ll-fp-heading');
    var b = panel.querySelector('.ll-fp-body');
    if (h) h.style.fontFamily = "'" + fontName + "'";
    if (b) b.style.fontFamily = "'" + fontName + "'";
  }

  /* ═══════════════════════════════════════════════════
   * Find font field containers using label text
   * Decap CMS renders: <label>Label Text</label>
   * near a react-select container or native <select>
   * ═══════════════════════════════════════════════════ */

  function findFontFields() {
    var results = {}; // { fieldName: { container, currentFont } }

    // Strategy 1: Search all labels for matching text
    var labels = document.querySelectorAll('label, legend, span');
    for (var i = 0; i < labels.length; i++) {
      var el = labels[i];
      var text = (el.textContent || '').trim().toLowerCase();

      for (var labelText in LABEL_MAP) {
        if (text === labelText) {
          var fieldName = LABEL_MAP[labelText];
          if (results[fieldName]) continue;

          // Walk up to find the field's container
          var container = el.parentElement;
          for (var j = 0; j < 6; j++) {
            if (!container) break;
            // Check if this container has a react-select or native select inside
            var hasSelect = container.querySelector('[class*="control"], select');
            if (hasSelect) break;
            container = container.parentElement;
          }

          if (container) {
            // Get current font from react-select single value or native select
            var currentFont = getCurrentFont(container);
            results[fieldName] = { container: container, currentFont: currentFont };
          }
          break;
        }
      }
    }

    return results;
  }

  function getCurrentFont(container) {
    // Strategy A: react-select — look for the displayed value text
    // react-select puts the selected value in a div inside the control
    var singleValues = container.querySelectorAll('[class*="singleValue"], [class*="single-value"], [class*="SingleValue"]');
    for (var i = 0; i < singleValues.length; i++) {
      var font = extractFont(singleValues[i].textContent);
      if (font) return font;
    }

    // Strategy B: Look for any div/span inside a control-like container
    // that contains text matching "FontName — description"
    var control = container.querySelector('[class*="control"], [class*="Control"]');
    if (control) {
      var spans = control.querySelectorAll('div, span');
      for (var j = 0; j < spans.length; j++) {
        var text = (spans[j].textContent || '').trim();
        if (text.indexOf(' \u2014 ') !== -1) {
          var font2 = extractFont(text);
          if (font2) return font2;
        }
      }
    }

    // Strategy C: Native <select>
    var sel = container.querySelector('select');
    if (sel) {
      var font3 = extractFont(sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : sel.value);
      if (font3) return font3;
      if (fontSet[sel.value]) return sel.value;
    }

    return null;
  }

  /* ═══════════════════════════════════════════════════
   * Style react-select dropdown options in their font
   * ═══════════════════════════════════════════════════ */

  function styleDropdownOptions() {
    // react-select menu options
    var options = document.querySelectorAll('[class*="option"], [class*="Option"]');
    options.forEach(function (opt) {
      var text = (opt.textContent || '').trim();
      var font = extractFont(text);
      if (font && !opt.getAttribute('data-ll-styled')) {
        opt.style.fontFamily = "'" + font + "'";
        opt.style.fontSize = '14px';
        opt.style.lineHeight = '1.5';
        opt.setAttribute('data-ll-styled', '1');
      }
    });

    // react-select displayed values
    var values = document.querySelectorAll('[class*="singleValue"], [class*="single-value"], [class*="SingleValue"]');
    values.forEach(function (val) {
      var font = extractFont(val.textContent);
      if (font) {
        val.style.fontFamily = "'" + font + "'";
        val.style.fontSize = '14px';
      }
    });

    // Native selects
    document.querySelectorAll('select').forEach(function (sel) {
      var font = fontSet[sel.value] ? sel.value : extractFont(sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '');
      if (font) {
        sel.style.fontFamily = "'" + font + "'";
        sel.style.fontSize = '14px';
      }
      for (var i = 0; i < sel.options.length; i++) {
        var optFont = extractFont(sel.options[i].text) || (fontSet[sel.options[i].value] ? sel.options[i].value : null);
        if (optFont) {
          sel.options[i].style.fontFamily = "'" + optFont + "'";
        }
      }
    });
  }

  /* ═══════════════════════════════════════════════════
   * Inject / update preview panels on the edit side
   * ═══════════════════════════════════════════════════ */

  function injectPreviews() {
    var fields = findFontFields();

    for (var fieldName in fields) {
      var info = fields[fieldName];
      if (!info.currentFont) continue;

      // Find existing panel
      var existing = info.container.querySelector('[data-ll-field="' + fieldName + '"]');
      if (existing) {
        updatePanel(existing, fieldName, info.currentFont);
      } else {
        var panel = makePanel(fieldName, info.currentFont);
        if (panel) {
          info.container.appendChild(panel);
        }
      }
    }
  }

  /* ═══════════════════════════════════════════════════
   * Register a custom preview template for the right panel
   * Uses Decap CMS API if available
   * ═══════════════════════════════════════════════════ */

  function registerPreviewTemplate() {
    if (!window.CMS) return;

    try {
      var h = window.CMS.getPreviewStyles ? null : null; // just checking CMS exists

      // Use createClass if available (Decap CMS exposes it)
      var React = window.React || (window.CMS && window.CMS._dependencies && window.CMS._dependencies.React);
      var createClass = window.createClass || (React && React.createClass);

      // Simpler approach: use registerPreviewTemplate with a function component
      window.CMS.registerPreviewTemplate('typography', function (props) {
        var entry = props.entry;
        var data = entry.get('data');
        if (!data) return null;

        var displayFont = data.get('displayFont') || 'Fraunces';
        var bodyFont = data.get('bodyFont') || 'Source Sans 3';
        var monoFont = data.get('monoFont') || 'JetBrains Mono';
        var baseFontSize = data.get('baseFontSize') || 106.25;
        var baseLineHeight = data.get('baseLineHeight') || 1.7;
        var heroTitleSize = data.get('heroTitleSize') || 3.5;
        var h1Size = data.get('h1Size') || 2;
        var h2Size = data.get('h2Size') || 1.5;
        var h3Size = data.get('h3Size') || 1.125;

        // Build Google Fonts URL for preview
        var fontsUrl = 'https://fonts.googleapis.com/css2?family=' +
          displayFont.replace(/ /g, '+') + ':wght@400;600;700;800&family=' +
          bodyFont.replace(/ /g, '+') + ':wght@300;400;500;600;700&family=' +
          monoFont.replace(/ /g, '+') + ':wght@400;500&display=swap';

        var containerStyle = {
          padding: '32px 28px',
          background: 'linear-gradient(135deg, #fdfbf9 0%, #f7f3ef 100%)',
          fontFamily: "'" + bodyFont + "'",
          fontSize: (baseFontSize / 100 * 16) + 'px',
          lineHeight: baseLineHeight,
          color: '#1a1612',
          minHeight: '100%',
        };

        var sectionStyle = {
          marginBottom: '32px',
          paddingBottom: '24px',
          borderBottom: '1px solid #e8e2dc',
        };

        var badgeStyle = {
          display: 'inline-block',
          marginBottom: '12px',
          padding: '3px 10px',
          fontSize: '10px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#7d726a',
          background: '#ece7e1',
          borderRadius: '4px',
          fontFamily: '-apple-system, sans-serif',
        };

        var heroStyle = {
          fontFamily: "'" + displayFont + "'",
          fontSize: heroTitleSize + 'rem',
          fontWeight: '800',
          lineHeight: '1.05',
          letterSpacing: '-0.025em',
          color: '#faf7f4',
          background: '#1a1612',
          padding: '40px 28px',
          borderRadius: '10px',
          textAlign: 'center',
          marginBottom: '16px',
        };

        var h1Style = {
          fontFamily: "'" + displayFont + "'",
          fontSize: h1Size + 'rem',
          fontWeight: '700',
          lineHeight: '1.15',
          color: '#1a1612',
          margin: '0 0 8px',
        };

        var h2Style = {
          fontFamily: "'" + displayFont + "'",
          fontSize: h2Size + 'rem',
          fontWeight: '600',
          lineHeight: '1.2',
          color: '#1a1612',
          margin: '0 0 6px',
        };

        var h3Style = {
          fontFamily: "'" + displayFont + "'",
          fontSize: h3Size + 'rem',
          fontWeight: '600',
          lineHeight: '1.25',
          color: '#1a1612',
          margin: '0 0 6px',
        };

        var bodyTextStyle = {
          fontFamily: "'" + bodyFont + "'",
          fontSize: '1rem',
          lineHeight: baseLineHeight,
          color: '#5c524a',
          margin: '0 0 12px',
        };

        var monoStyle = {
          fontFamily: "'" + monoFont + "'",
          fontSize: '0.875rem',
          lineHeight: '1.5',
          color: '#5c524a',
          background: '#1a1612',
          color: '#faf7f4',
          padding: '16px 20px',
          borderRadius: '8px',
          whiteSpace: 'pre-wrap',
        };

        var el = window.h || React.createElement;

        return el('div', { style: containerStyle }, [
          el('link', { rel: 'stylesheet', href: fontsUrl, key: 'fonts' }),

          // Hero preview
          el('div', { style: sectionStyle, key: 'hero-section' }, [
            el('span', { style: badgeStyle, key: 'hero-badge' }, 'Hero Title'),
            el('div', { style: heroStyle, key: 'hero' }, 'Liberty Lighthouse'),
          ]),

          // Heading hierarchy
          el('div', { style: sectionStyle, key: 'headings-section' }, [
            el('span', { style: badgeStyle, key: 'h-badge' }, 'Heading Hierarchy'),
            el('p', { style: h1Style, key: 'h1' }, 'H1 — Page Titles like Education'),
            el('p', { style: bodyTextStyle, key: 'h1-body' }, 'Used for the main title on each page.'),
            el('p', { style: h2Style, key: 'h2' }, 'H2 — Section Headings'),
            el('p', { style: bodyTextStyle, key: 'h2-body' }, 'Used for sections like "Explore by Topic" or "About".'),
            el('p', { style: h3Style, key: 'h3' }, 'H3 — Card & Item Titles'),
            el('p', { style: bodyTextStyle, key: 'h3-body' }, 'Used for FAQ questions, video titles, and sidebar headings.'),
          ]),

          // Body text preview
          el('div', { style: sectionStyle, key: 'body-section' }, [
            el('span', { style: badgeStyle, key: 'body-badge' }, 'Body Text (' + bodyFont + ')'),
            el('p', { style: bodyTextStyle, key: 'body' },
              'Understanding India\u2019s policy landscape through curated FAQs, video curricula, and guided syllabi. Ideas that advance freedom, markets, and the rule of law. A project of the Centre for Civil Society.'
            ),
          ]),

          // Monospace preview
          el('div', { style: { marginBottom: '16px' }, key: 'mono-section' }, [
            el('span', { style: badgeStyle, key: 'mono-badge' }, 'Monospace (' + monoFont + ')'),
            el('pre', { style: monoStyle, key: 'mono' },
              'const freedom = markets + rule_of_law;\nfunction lighthouse(topic) {\n  return curate(faqs, videos, syllabus);\n}'
            ),
          ]),

          // Scale info
          el('div', { style: { padding: '16px 20px', background: '#ece7e1', borderRadius: '8px', fontSize: '12px', color: '#7d726a', fontFamily: '-apple-system, sans-serif' }, key: 'info' }, [
            el('strong', { key: 'info-label' }, 'Current Scale: '),
            'Base ' + baseFontSize + '% \u00b7 Line height ' + baseLineHeight +
            ' \u00b7 Hero ' + heroTitleSize + 'rem \u00b7 H1 ' + h1Size + 'rem \u00b7 H2 ' + h2Size + 'rem \u00b7 H3 ' + h3Size + 'rem',
          ]),
        ]);
      });
    } catch (e) {
      console.warn('[font-preview] Could not register preview template:', e);
    }
  }

  /* ═══════════════════════════════════════════════════
   * Main loop — polls for changes
   * ═══════════════════════════════════════════════════ */

  var debounce;
  var observer = new MutationObserver(function (muts) {
    var hasNew = false;
    for (var i = 0; i < muts.length; i++) {
      if (muts[i].addedNodes.length > 0) { hasNew = true; break; }
    }
    if (hasNew) {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        styleDropdownOptions();
        injectPreviews();
      }, 250);
    }
  });

  function init() {
    loadEditorTypography();
    registerPreviewTemplate();
    observer.observe(document.body, { childList: true, subtree: true });
    styleDropdownOptions();
    injectPreviews();
    // Keep polling in case of lazy rendering
    setInterval(function () {
      styleDropdownOptions();
      injectPreviews();
    }, 2000);
  }

  // Wait for Decap CMS to render
  if (document.readyState === 'complete') {
    setTimeout(init, 2500);
  } else {
    window.addEventListener('load', function () {
      setTimeout(init, 2500);
    });
  }
})();
