/**
 * CMS Global Styles & Preview Templates
 *
 * Makes the entire Decap CMS admin portal look polished and on-brand:
 * 1. Global CSS overrides (sidebar, cards, fields, buttons)
 * 2. Preview templates for all collections (FAQs, Videos, Topics, Colors, Crawlers, Content Guide)
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════
   * 1. Global CMS Styling
   * ═══════════════════════════════════════════════════ */

  var globalCSS = [
    '/* ── Liberty Lighthouse CMS Theme ── */',
    '',
    '/* Load brand fonts for the admin */',
    '@import url("https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&family=Fraunces:wght@400;600;700;800&display=swap");',
    '',
    '/* App frame */',
    '[class*="AppHeader"] {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '}',
    '',
    '/* Sidebar / Nav */',
    'nav a, nav span, [class*="SidebarNavList"] {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '}',
    '',
    '/* Collection list entries */',
    '[class*="ListCard"], [class*="EntryListing"] {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '}',
    '',
    '/* Field labels */',
    '[class*="ControlLabel"], [class*="FieldLabel"], label {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '}',
    '',
    '/* Hint text — clean and readable */',
    '[class*="ControlHint"], [class*="hint"], small {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '  font-size: 12.5px !important;',
    '  line-height: 1.5 !important;',
    '  color: #7d726a !important;',
    '  letter-spacing: 0.01em !important;',
    '}',
    '',
    '/* String/text input fields */',
    'input[type="text"], input[type="number"], input[type="url"], input[type="email"], textarea {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '  font-size: 15px !important;',
    '  border-radius: 6px !important;',
    '}',
    '',
    '/* Collection description */',
    '[class*="CollectionDescription"], [class*="collectionDescription"] {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '  font-size: 14px !important;',
    '  color: #5c524a !important;',
    '}',
    '',
    '/* Buttons */',
    '[class*="ToolbarButton"], button[class*="Button"] {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '  border-radius: 6px !important;',
    '}',
    '',
    '/* Boolean toggle labels */',
    '[class*="Toggle"] label, [class*="toggle"] label {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '}',
    '',
    '/* Select widget (react-select) */',
    '[class*="control"], [class*="Control"], [class*="menu"], [class*="Menu"] {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '}',
    '',
    '/* Settings file view — better card spacing */',
    '[class*="ControlPane"] > div {',
    '  font-family: "Source Sans 3", -apple-system, sans-serif !important;',
    '}',
  ].join('\n');

  var globalStyle = document.createElement('style');
  globalStyle.id = 'll-cms-global';
  globalStyle.textContent = globalCSS;
  document.head.appendChild(globalStyle);

  /* ═══════════════════════════════════════════════════
   * 2. Preview Templates for Collections
   * ═══════════════════════════════════════════════════ */

  function waitForCMS(cb) {
    if (window.CMS) { cb(); return; }
    var attempts = 0;
    var timer = setInterval(function () {
      attempts++;
      if (window.CMS) { clearInterval(timer); cb(); }
      if (attempts > 40) clearInterval(timer); // give up after ~20s
    }, 500);
  }

  waitForCMS(function () {
    var CMS = window.CMS;
    var React = window.React || (CMS._dependencies && CMS._dependencies.React);
    if (!React) return;
    var el = React.createElement;

    // ── Push fonts + base CSS into preview iframes ──
    var previewFontsUrl = 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&family=Fraunces:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap';
    try {
      CMS.registerPreviewStyle(previewFontsUrl);
      CMS.registerPreviewStyle([
        '* { box-sizing: border-box; }',
        'body { margin: 0; font-family: "Source Sans 3", -apple-system, sans-serif; color: #1a1612; line-height: 1.65; }',
        'h1, h2, h3, h4, h5, h6 { font-family: "Fraunces", serif; }',
        'a { color: #a96032; }',
        'code { font-family: "JetBrains Mono", monospace; font-size: 0.875em; background: #f7f3ef; padding: 2px 6px; border-radius: 4px; }',
        'pre { font-family: "JetBrains Mono", monospace; font-size: 0.875em; background: #1a1612; color: #faf7f4; padding: 16px 20px; border-radius: 8px; overflow-x: auto; }',
        'pre code { background: transparent; padding: 0; color: inherit; }',
        'blockquote { border-left: 3px solid #c4703c; padding-left: 1em; color: #5c524a; font-style: italic; margin: 1em 0; }',
        'table { width: 100%; border-collapse: collapse; margin: 1em 0; }',
        'th { font-weight: 600; background: #f7f3ef; border: 1px solid #e8e2dc; padding: 0.5rem 0.75rem; text-align: left; }',
        'td { border: 1px solid #e8e2dc; padding: 0.5rem 0.75rem; vertical-align: top; }',
        'img { max-width: 100%; height: auto; border-radius: 8px; }',
      ].join('\n'), { raw: true });
    } catch (e) { console.warn('[cms-styles] Could not register preview styles:', e); }

    // ── Shared styles ──
    var wrap = { padding: '28px 24px', fontFamily: "'Source Sans 3', sans-serif", color: '#1a1612', background: 'linear-gradient(135deg, #fdfbf9, #f7f3ef)', minHeight: '100%', lineHeight: '1.65' };
    var badge = { display: 'inline-block', marginBottom: '10px', padding: '3px 10px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7d726a', background: '#ece7e1', borderRadius: '4px', fontFamily: '-apple-system, sans-serif' };
    var title = { fontFamily: "'Fraunces', serif", fontSize: '1.5rem', fontWeight: '700', lineHeight: '1.2', color: '#1a1612', margin: '0 0 8px' };
    var subtitle = { fontFamily: "'Fraunces', serif", fontSize: '1.125rem', fontWeight: '600', lineHeight: '1.3', color: '#1a1612', margin: '16px 0 6px' };
    var body = { fontSize: '15px', lineHeight: '1.65', color: '#5c524a', margin: '0 0 12px' };
    var meta = { fontSize: '12px', color: '#a89e96', margin: '0 0 4px' };
    var divider = { borderTop: '1px solid #e8e2dc', margin: '20px 0' };
    var card = { background: '#fff', border: '1px solid #e8e2dc', borderRadius: '10px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' };
    var tag = function (text, color) {
      return { display: 'inline-block', padding: '2px 8px', fontSize: '11px', fontWeight: '600', borderRadius: '4px', marginRight: '6px', background: color || '#ece7e1', color: '#5c524a' };
    };
    var colorSwatch = function (hex) {
      return { display: 'inline-block', width: '28px', height: '28px', borderRadius: '6px', background: hex, border: '1px solid #e8e2dc', verticalAlign: 'middle', marginRight: '10px' };
    };

    // ── FAQ Preview ──
    try {
      CMS.registerPreviewTemplate('faqs', function (props) {
        var data = props.entry.get('data');
        if (!data) return null;
        var question = data.get('question') || 'Untitled Question';
        var topic = data.get('topic') || '';
        var order = data.get('order') || 1;
        var draft = data.get('draft');
        var bodyContent = props.widgetFor('body');

        return el('div', { style: wrap }, [
          el('div', { style: card, key: 'header' }, [
            el('span', { style: badge, key: 'type' }, 'FAQ Preview'),
            draft && el('span', { style: tag('Draft', '#fef3cd'), key: 'draft' }, 'DRAFT'),
            el('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' }, key: 'meta-row' }, [
              topic && el('span', { style: tag(topic), key: 'topic' }, topic),
              el('span', { style: meta, key: 'order' }, 'Order: ' + order),
            ]),
            el('h1', { style: title, key: 'q' }, question),
          ]),
          el('div', { style: Object.assign({}, card, { lineHeight: '1.7' }), key: 'answer' }, [
            el('span', { style: badge, key: 'answer-badge' }, 'Answer'),
            el('div', { key: 'body' }, bodyContent),
          ]),
        ]);
      });
    } catch (e) { console.warn('[cms-styles] FAQ preview:', e); }

    // ── Video Preview ──
    try {
      CMS.registerPreviewTemplate('videos', function (props) {
        var data = props.entry.get('data');
        if (!data) return null;
        var videoTitle = data.get('title') || 'Untitled Video';
        var topic = data.get('topic') || '';
        var youtubeId = data.get('youtubeId') || '';
        var format = data.get('format') || 'video';
        var orientation = data.get('orientation') || 'horizontal';
        var description = data.get('description') || '';
        var duration = data.get('duration') || '';
        var speaker = data.get('speaker') || '';
        var order = data.get('order') || 1;
        var draft = data.get('draft');
        var bodyContent = props.widgetFor('body');

        var thumbUrl = youtubeId ? 'https://img.youtube.com/vi/' + youtubeId + '/maxresdefault.jpg' : '';

        return el('div', { style: wrap }, [
          // Video thumbnail
          youtubeId && el('div', { style: { borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', background: '#1a1612', textAlign: 'center' }, key: 'thumb' }, [
            el('img', { src: thumbUrl, alt: videoTitle, style: { width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }, key: 'img' }),
          ]),

          el('div', { style: card, key: 'header' }, [
            el('span', { style: badge, key: 'type' }, 'Video Preview'),
            draft && el('span', { style: tag('Draft', '#fef3cd'), key: 'draft' }, 'DRAFT'),
            el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }, key: 'meta-row' }, [
              topic && el('span', { style: tag(topic), key: 'topic' }, topic),
              el('span', { style: tag(format === 'short' ? 'Short' : 'Video'), key: 'format' }, format === 'short' ? 'SHORT' : 'VIDEO'),
              orientation === 'vertical' && el('span', { style: tag('Vertical'), key: 'orient' }, 'VERTICAL'),
              duration && el('span', { style: meta, key: 'dur' }, duration),
              speaker && el('span', { style: meta, key: 'speaker' }, speaker),
              el('span', { style: meta, key: 'order' }, 'Order: ' + order),
            ]),
            el('h1', { style: title, key: 'title' }, videoTitle),
            description && el('p', { style: body, key: 'desc' }, description),
          ]),

          bodyContent && el('div', { style: Object.assign({}, card, { lineHeight: '1.7' }), key: 'notes' }, [
            el('span', { style: badge, key: 'notes-badge' }, 'Extended Notes'),
            el('div', { key: 'body' }, bodyContent),
          ]),
        ]);
      });
    } catch (e) { console.warn('[cms-styles] Video preview:', e); }

    // ── Topics Preview ──
    try {
      CMS.registerPreviewTemplate('topics', function (props) {
        var data = props.entry.get('data');
        if (!data) return null;
        var topicTitle = data.get('title') || 'Untitled Topic';
        var slug = data.get('slug') || '';
        var description = data.get('description') || '';
        var icon = data.get('icon') || '';
        var order = data.get('order') || 1;
        var syllabus = data.get('guidedSyllabus') || '';

        var iconEmojis = {
          'book-open': '\uD83D\uDCD6', 'sprout': '\uD83C\uDF31', 'heart-pulse': '\uD83D\uDC93',
          'landmark': '\uD83C\uDFDB\uFE0F', 'banknote': '\uD83D\uDCB5', 'scale': '\u2696\uFE0F',
          'factory': '\uD83C\uDFED', 'globe': '\uD83C\uDF0D', 'shield': '\uD83D\uDEE1\uFE0F',
          'droplets': '\uD83D\uDCA7', 'zap': '\u26A1', 'building': '\uD83C\uDFD7\uFE0F',
        };
        var emoji = iconEmojis[icon] || '\uD83D\uDCCC';

        return el('div', { style: wrap }, [
          el('div', { style: card, key: 'header' }, [
            el('span', { style: badge, key: 'type' }, 'Topic Preview'),
            el('div', { style: { fontSize: '40px', marginBottom: '8px' }, key: 'icon' }, emoji),
            el('h1', { style: title, key: 'name' }, topicTitle),
            slug && el('p', { style: meta, key: 'slug' }, '/' + slug + '/'),
            description && el('p', { style: body, key: 'desc' }, description),
            el('p', { style: meta, key: 'order' }, 'Display order: ' + order),
          ]),

          syllabus && el('div', { style: card, key: 'syllabus' }, [
            el('span', { style: badge, key: 'syl-badge' }, 'Guided Syllabus'),
            el('div', { style: { whiteSpace: 'pre-wrap', lineHeight: '1.7' }, key: 'syl-body' }, syllabus),
          ]),
        ]);
      });
    } catch (e) { console.warn('[cms-styles] Topics preview:', e); }

    // ── Colors Preview ──
    try {
      CMS.registerPreviewTemplate('colors', function (props) {
        var data = props.entry.get('data');
        if (!data) return null;

        var colorGroups = [
          { label: 'Brand', fields: [
            ['colorPrimary', 'Primary'], ['colorPrimaryLight', 'Primary Light'],
            ['colorAccent', 'Accent'], ['colorAccentText', 'Accent Text'], ['colorAccentSoft', 'Accent Soft'],
          ]},
          { label: 'Text', fields: [
            ['colorTextPrimary', 'Primary'], ['colorTextSecondary', 'Secondary'],
            ['colorTextTertiary', 'Tertiary'], ['colorTextMuted', 'Muted'], ['colorTextOnDark', 'On Dark'],
          ]},
          { label: 'Backgrounds', fields: [
            ['colorBgPage', 'Page'], ['colorBgSection', 'Section'], ['colorBgCard', 'Card'],
            ['colorBgElevated', 'Elevated'], ['colorBgDark', 'Dark'], ['colorBgDarkSoft', 'Dark Soft'],
          ]},
          { label: 'Borders', fields: [
            ['colorBorderDefault', 'Default'], ['colorBorderStrong', 'Strong'],
            ['colorBorderSubtle', 'Subtle'], ['colorBorderFocus', 'Focus'],
          ]},
          { label: 'Status', fields: [
            ['colorSuccess', 'Success'], ['colorWarning', 'Warning'], ['colorError', 'Error'],
          ]},
        ];

        return el('div', { style: wrap }, [
          el('span', { style: badge, key: 'badge' }, 'Color Theme Preview'),
          el('h1', { style: Object.assign({}, title, { marginBottom: '20px' }), key: 'title' }, 'Color Palette'),

          // Render each group
          colorGroups.map(function (group, gi) {
            return el('div', { style: Object.assign({}, card, { marginBottom: '12px' }), key: 'g' + gi }, [
              el('h3', { style: Object.assign({}, subtitle, { margin: '0 0 12px' }), key: 'gl' + gi }, group.label),
              el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px' }, key: 'gf' + gi },
                group.fields.map(function (f, fi) {
                  var hex = data.get(f[0]) || '#ccc';
                  return el('div', { style: { display: 'flex', alignItems: 'center', minWidth: '140px' }, key: 'f' + gi + fi }, [
                    el('span', { style: colorSwatch(hex), key: 's' }),
                    el('div', { key: 'd' }, [
                      el('div', { style: { fontSize: '13px', fontWeight: '500', color: '#1a1612' }, key: 'n' }, f[1]),
                      el('div', { style: { fontSize: '11px', color: '#a89e96', fontFamily: "'JetBrains Mono', monospace" }, key: 'v' }, hex),
                    ]),
                  ]);
                })
              ),
            ]);
          }),

          // Live demo card
          el('div', { style: { marginTop: '20px' }, key: 'demo' }, [
            el('span', { style: badge, key: 'demo-badge' }, 'Live Demo'),
            el('div', { style: {
              background: data.get('colorBgCard') || '#fff',
              border: '1px solid ' + (data.get('colorBorderDefault') || '#e8e2dc'),
              borderRadius: (data.get('radiusMd') || 8) + 'px',
              padding: '24px',
              marginTop: '8px',
            }, key: 'demo-card' }, [
              el('h2', { style: { fontFamily: "'Fraunces', serif", fontSize: '1.25rem', fontWeight: '700', color: data.get('colorTextPrimary') || '#1a1612', margin: '0 0 8px' }, key: 'demo-h' }, 'Sample Card'),
              el('p', { style: { fontSize: '14px', color: data.get('colorTextSecondary') || '#5c524a', margin: '0 0 12px', lineHeight: '1.6' }, key: 'demo-p' },
                'This is how a content card looks with your chosen colors. The heading, body text, and border all update in real time.'
              ),
              el('a', { style: { color: data.get('colorAccentText') || '#a96032', textDecoration: 'underline', fontSize: '14px' }, href: '#', key: 'demo-a' }, 'Read more \u2192'),
            ]),
          ]),
        ]);
      });
    } catch (e) { console.warn('[cms-styles] Colors preview:', e); }

    // ── Crawlers Preview ──
    try {
      CMS.registerPreviewTemplate('crawlers', function (props) {
        var data = props.entry.get('data');
        if (!data) return null;

        var bots = [
          ['gptBot', 'GPTBot', 'OpenAI training'],
          ['claudeBot', 'ClaudeBot', 'Anthropic training'],
          ['googleExtended', 'Google-Extended', 'Google AI training'],
          ['ccBot', 'CCBot', 'Common Crawl archive'],
          ['oaiSearchBot', 'OAI-SearchBot', 'ChatGPT search'],
          ['claudeSearchBot', 'Claude-SearchBot', 'Claude search'],
          ['chatgptUser', 'ChatGPT-User', 'ChatGPT link reading'],
          ['claudeUser', 'Claude-User', 'Claude link reading'],
          ['perplexityBot', 'PerplexityBot', 'Perplexity search'],
          ['applebotExtended', 'Applebot-Extended', 'Apple Intelligence'],
        ];

        var allowed = 0;
        var blocked = 0;
        bots.forEach(function (b) {
          if (data.get(b[0]) === 'block') blocked++; else allowed++;
        });

        return el('div', { style: wrap }, [
          el('span', { style: badge, key: 'badge' }, 'Crawler Settings Preview'),
          el('h1', { style: Object.assign({}, title, { marginBottom: '8px' }), key: 'title' }, 'AI & Search Crawlers'),
          el('p', { style: body, key: 'summary' },
            allowed + ' allowed, ' + blocked + ' blocked'
          ),
          el('div', { style: card, key: 'list' },
            bots.map(function (b, i) {
              var status = data.get(b[0]) || 'allow';
              var isBlocked = status === 'block';
              return el('div', { style: {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0',
                borderBottom: i < bots.length - 1 ? '1px solid #f0ebe6' : 'none',
              }, key: 'b' + i }, [
                el('div', { key: 'info' + i }, [
                  el('div', { style: { fontWeight: '500', fontSize: '14px', color: '#1a1612' }, key: 'name' + i }, b[1]),
                  el('div', { style: meta, key: 'desc' + i }, b[2]),
                ]),
                el('span', { style: {
                  padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                  background: isBlocked ? '#f8d7da' : '#d4edda',
                  color: isBlocked ? '#721c24' : '#155724',
                }, key: 'status' + i }, isBlocked ? 'BLOCKED' : 'ALLOWED'),
              ]);
            })
          ),
        ]);
      });
    } catch (e) { console.warn('[cms-styles] Crawlers preview:', e); }

    // ── Content Guide Preview ──
    try {
      CMS.registerPreviewTemplate('content-guide', function (props) {
        var data = props.entry.get('data');
        if (!data) return null;

        var sections = [
          { icon: '\uD83D\uDCDD', label: 'Headings', field: '_headingsGuide' },
          { icon: '\uD83D\uDCF7', label: 'Images', field: '_imagesGuide' },
          { icon: '\uD83D\uDCCA', label: 'Tables', field: '_tablesGuide' },
          { icon: '\uD83D\uDD17', label: 'Links', field: '_linksGuide' },
          { icon: '\uD83D\uDCE4', label: 'Workflow', field: '_workflowGuide' },
          { icon: '\uD83C\uDFA5', label: 'YouTube', field: '_youtubeGuide' },
        ];

        return el('div', { style: wrap }, [
          el('span', { style: badge, key: 'badge' }, 'Reference'),
          el('h1', { style: Object.assign({}, title, { marginBottom: '20px' }), key: 'title' }, 'Content Guide'),

          sections.map(function (s, i) {
            var text = data.get(s.field) || '';
            return el('div', { style: Object.assign({}, card, { display: 'flex', gap: '14px', alignItems: 'flex-start' }), key: 's' + i }, [
              el('div', { style: { fontSize: '24px', flexShrink: '0', marginTop: '2px' }, key: 'icon' + i }, s.icon),
              el('div', { key: 'content' + i }, [
                el('h3', { style: Object.assign({}, subtitle, { margin: '0 0 4px' }), key: 'label' + i }, s.label),
                el('p', { style: Object.assign({}, body, { margin: '0', whiteSpace: 'pre-wrap' }), key: 'text' + i }, text),
              ]),
            ]);
          }),
        ]);
      });
    } catch (e) { console.warn('[cms-styles] Content Guide preview:', e); }
  });
})();
