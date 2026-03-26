/**
 * CMS Global Styles & Preview Templates
 *
 * Makes the entire Decap CMS admin portal look polished and on-brand:
 * 1. Global CSS overrides (sidebar, cards, fields, buttons)
 * 2. Preview templates for all collections (FAQs, Videos, Topics, Colors, Crawlers, Content Guide)
 *
 * Font and color values are fetched dynamically from settings JSON files,
 * so previews always reflect the admin's current typography and color choices.
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════
   * Shared settings object — starts with defaults,
   * updated async when fetches complete.
   * Preview templates read from this at render time.
   * ═══════════════════════════════════════════════════ */

  var site = {
    displayFont: 'Fraunces',
    bodyFont: 'Source Sans 3',
    monoFont: 'JetBrains Mono',
    lineHeight: 1.7,
    textPrimary: '#1A1612',
    textSecondary: '#5C524A',
    textTertiary: '#7D726A',
    textMuted: '#A89E96',
    accent: '#C4703C',
    accentText: '#A96032',
    bgPage: '#FDFBF9',
    bgSection: '#F7F3EF',
    bgCard: '#FFFFFF',
    borderDefault: '#E8E2DC',
    borderSubtle: '#F0EBE6',
  };

  // Helper functions that read from `site` at call time
  function displayFamily() { return "'" + site.displayFont + "', serif"; }
  function bodyFamily() { return "'" + site.bodyFont + "', sans-serif"; }
  function monoFamily() { return "'" + site.monoFont + "', monospace"; }

  function wrap() {
    return { padding: '28px 24px', fontFamily: bodyFamily(), color: site.textPrimary, background: 'linear-gradient(135deg, ' + site.bgPage + ', ' + site.bgSection + ')', minHeight: '100%', lineHeight: String(site.lineHeight) };
  }
  function badgeStyle() {
    return { display: 'inline-block', marginBottom: '10px', padding: '3px 10px', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.08em', color: site.textTertiary, background: site.borderSubtle, borderRadius: '4px', fontFamily: '-apple-system, sans-serif' };
  }
  function titleStyle() {
    return { fontFamily: displayFamily(), fontSize: '1.5rem', fontWeight: '700', lineHeight: '1.2', color: site.textPrimary, margin: '0 0 8px' };
  }
  function subtitleStyle() {
    return { fontFamily: displayFamily(), fontSize: '1.125rem', fontWeight: '600', lineHeight: '1.3', color: site.textPrimary, margin: '16px 0 6px' };
  }
  function bodyStyle() {
    return { fontSize: '15px', lineHeight: String(site.lineHeight), color: site.textSecondary, margin: '0 0 12px' };
  }
  function metaStyle() {
    return { fontSize: '12px', color: site.textMuted, margin: '0 0 4px' };
  }
  function cardS() {
    return { background: site.bgCard, border: '1px solid ' + site.borderDefault, borderRadius: '10px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.04)' };
  }
  function tagStyle(bgColor) {
    return { display: 'inline-block', padding: '2px 8px', fontSize: '11px', fontWeight: '600', borderRadius: '4px', marginRight: '6px', background: bgColor || site.borderSubtle, color: site.textSecondary };
  }
  function colorSwatch(hex) {
    return { display: 'inline-block', width: '28px', height: '28px', borderRadius: '6px', background: hex, border: '1px solid ' + site.borderDefault, verticalAlign: 'middle', marginRight: '10px' };
  }

  /* ═══════════════════════════════════════════════════
   * 1. Global CMS Styling
   * ═══════════════════════════════════════════════════ */

  function buildGlobalCSS(bodyFont) {
    return [
      '/* ── Liberty Lighthouse CMS Theme ── */',
      '',
      '/* App frame */',
      '[class*="AppHeader"] {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '}',
      '',
      '/* Sidebar / Nav */',
      'nav a, nav span, [class*="SidebarNavList"] {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '}',
      '',
      '/* Collection list entries */',
      '[class*="ListCard"], [class*="EntryListing"] {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '}',
      '',
      '/* Field labels */',
      '[class*="ControlLabel"], [class*="FieldLabel"], label {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '}',
      '',
      '/* Hint text — clean and readable */',
      '[class*="ControlHint"], [class*="hint"], small {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '  font-size: 12.5px !important;',
      '  line-height: 1.5 !important;',
      '  color: #7d726a !important;',
      '  letter-spacing: 0.01em !important;',
      '}',
      '',
      '/* String/text input fields */',
      'input[type="text"], input[type="number"], input[type="url"], input[type="email"], textarea {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '  font-size: 15px !important;',
      '  border-radius: 6px !important;',
      '}',
      '',
      '/* Collection description */',
      '[class*="CollectionDescription"], [class*="collectionDescription"] {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '  font-size: 14px !important;',
      '  color: #5c524a !important;',
      '}',
      '',
      '/* Buttons */',
      '[class*="ToolbarButton"], button[class*="Button"] {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '  border-radius: 6px !important;',
      '}',
      '',
      '/* Boolean toggle labels */',
      '[class*="Toggle"] label, [class*="toggle"] label {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '}',
      '',
      '/* Select widget (react-select) */',
      '[class*="control"], [class*="Control"], [class*="menu"], [class*="Menu"] {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '}',
      '',
      '/* Settings file view — better card spacing */',
      '[class*="ControlPane"] > div {',
      '  font-family: "' + bodyFont + '", -apple-system, sans-serif !important;',
      '}',
    ].join('\n');
  }

  function buildFontsUrl(displayFont, bodyFont, monoFont) {
    return 'https://fonts.googleapis.com/css2?family=' +
      displayFont.replace(/ /g, '+') + ':wght@400;600;700;800&family=' +
      bodyFont.replace(/ /g, '+') + ':wght@300;400;500;600;700&family=' +
      (monoFont || 'JetBrains Mono').replace(/ /g, '+') + ':wght@400;500&display=swap';
  }

  // Insert initial fonts + global CSS with defaults
  var fontsLink = document.createElement('link');
  fontsLink.rel = 'stylesheet';
  fontsLink.id = 'll-cms-fonts';
  fontsLink.href = buildFontsUrl(site.displayFont, site.bodyFont, site.monoFont);
  document.head.appendChild(fontsLink);

  var globalStyle = document.createElement('style');
  globalStyle.id = 'll-cms-global';
  globalStyle.textContent = buildGlobalCSS(site.bodyFont);
  document.head.appendChild(globalStyle);

  /* ═══════════════════════════════════════════════════
   * 2. Register preview templates after CMS fully loads.
   *
   * Matches font-preview.js's exact working pattern:
   * - setTimeout(2500) after load
   * - Resolve React ONCE at registration time
   * - Use `window.h || React.createElement` at render time
   * - No registerPreviewStyle (font-preview.js already handles it)
   * ═══════════════════════════════════════════════════ */

  function initTemplates() {
    if (!window.CMS) return;
    var CMS = window.CMS;

    // Resolve React ONCE at registration time (same as font-preview.js line 510)
    var React = window.React || (CMS._dependencies && CMS._dependencies.React);

    console.log('[cms-styles] initTemplates()', 'CMS:', !!CMS, 'h:', !!window.h, 'React:', !!React);

    // ── FAQ Preview ──
    try {
      CMS.registerPreviewTemplate('faqs', function (props) {
        var el = window.h || React.createElement;
        var data = props.entry.get('data');
        if (!data) return null;
        var question = data.get('question') || 'Untitled Question';
        var topic = data.get('topic') || '';
        var order = data.get('order') || 1;
        var draft = data.get('draft');
        var bodyContent = props.widgetFor('body');

        return el('div', { style: wrap() }, [
          el('div', { style: cardS(), key: 'header' }, [
            el('span', { style: badgeStyle(), key: 'type' }, 'FAQ Preview'),
            draft && el('span', { style: tagStyle('#fef3cd'), key: 'draft' }, 'DRAFT'),
            el('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' }, key: 'meta-row' }, [
              topic && el('span', { style: tagStyle(), key: 'topic' }, topic),
              el('span', { style: metaStyle(), key: 'order' }, 'Order: ' + order),
            ]),
            el('h1', { style: titleStyle(), key: 'q' }, question),
          ]),
          el('div', { style: Object.assign({}, cardS(), { lineHeight: String(site.lineHeight) }), key: 'answer' }, [
            el('span', { style: badgeStyle(), key: 'answer-badge' }, 'Answer'),
            el('div', { key: 'body' }, bodyContent),
          ]),
        ]);
      });
      console.log('[cms-styles] Registered: faqs');
    } catch (e) { console.warn('[cms-styles] FAQ preview:', e); }

    // ── Video Preview ──
    try {
      CMS.registerPreviewTemplate('videos', function (props) {
        var el = window.h || React.createElement;
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

        return el('div', { style: wrap() }, [
          youtubeId && el('div', { style: { borderRadius: '10px', overflow: 'hidden', marginBottom: '16px', background: site.textPrimary, textAlign: 'center' }, key: 'thumb' }, [
            el('img', { src: thumbUrl, alt: videoTitle, style: { width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }, key: 'img' }),
          ]),

          el('div', { style: cardS(), key: 'header' }, [
            el('span', { style: badgeStyle(), key: 'type' }, 'Video Preview'),
            draft && el('span', { style: tagStyle('#fef3cd'), key: 'draft' }, 'DRAFT'),
            el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }, key: 'meta-row' }, [
              topic && el('span', { style: tagStyle(), key: 'topic' }, topic),
              el('span', { style: tagStyle(), key: 'format' }, format === 'short' ? 'SHORT' : 'VIDEO'),
              orientation === 'vertical' && el('span', { style: tagStyle(), key: 'orient' }, 'VERTICAL'),
              duration && el('span', { style: metaStyle(), key: 'dur' }, duration),
              speaker && el('span', { style: metaStyle(), key: 'speaker' }, speaker),
              el('span', { style: metaStyle(), key: 'order' }, 'Order: ' + order),
            ]),
            el('h1', { style: titleStyle(), key: 'title' }, videoTitle),
            description && el('p', { style: bodyStyle(), key: 'desc' }, description),
          ]),

          bodyContent && el('div', { style: Object.assign({}, cardS(), { lineHeight: String(site.lineHeight) }), key: 'notes' }, [
            el('span', { style: badgeStyle(), key: 'notes-badge' }, 'Extended Notes'),
            el('div', { key: 'body' }, bodyContent),
          ]),
        ]);
      });
      console.log('[cms-styles] Registered: videos');
    } catch (e) { console.warn('[cms-styles] Video preview:', e); }

    // ── Topics Preview ──
    try {
      CMS.registerPreviewTemplate('topics', function (props) {
        var el = window.h || React.createElement;
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

        return el('div', { style: wrap() }, [
          el('div', { style: cardS(), key: 'header' }, [
            el('span', { style: badgeStyle(), key: 'type' }, 'Topic Preview'),
            el('div', { style: { fontSize: '40px', marginBottom: '8px' }, key: 'icon' }, emoji),
            el('h1', { style: titleStyle(), key: 'name' }, topicTitle),
            slug && el('p', { style: metaStyle(), key: 'slug' }, '/' + slug + '/'),
            description && el('p', { style: bodyStyle(), key: 'desc' }, description),
            el('p', { style: metaStyle(), key: 'order' }, 'Display order: ' + order),
          ]),

          syllabus && el('div', { style: cardS(), key: 'syllabus' }, [
            el('span', { style: badgeStyle(), key: 'syl-badge' }, 'Guided Syllabus'),
            el('div', { style: { whiteSpace: 'pre-wrap', lineHeight: String(site.lineHeight) }, key: 'syl-body' }, syllabus),
          ]),
        ]);
      });
      console.log('[cms-styles] Registered: topics');
    } catch (e) { console.warn('[cms-styles] Topics preview:', e); }

    // ── Colors Preview ──
    try {
      CMS.registerPreviewTemplate('colors', function (props) {
        var el = window.h || React.createElement;
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

        return el('div', { style: wrap() }, [
          el('span', { style: badgeStyle(), key: 'badge' }, 'Color Theme Preview'),
          el('h1', { style: Object.assign({}, titleStyle(), { marginBottom: '20px' }), key: 'title' }, 'Color Palette'),

          colorGroups.map(function (group, gi) {
            return el('div', { style: Object.assign({}, cardS(), { marginBottom: '12px' }), key: 'g' + gi }, [
              el('h3', { style: Object.assign({}, subtitleStyle(), { margin: '0 0 12px' }), key: 'gl' + gi }, group.label),
              el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px' }, key: 'gf' + gi },
                group.fields.map(function (f, fi) {
                  var hex = data.get(f[0]) || '#ccc';
                  return el('div', { style: { display: 'flex', alignItems: 'center', minWidth: '140px' }, key: 'f' + gi + fi }, [
                    el('span', { style: colorSwatch(hex), key: 's' }),
                    el('div', { key: 'd' }, [
                      el('div', { style: { fontSize: '13px', fontWeight: '500', color: site.textPrimary }, key: 'n' }, f[1]),
                      el('div', { style: { fontSize: '11px', color: site.textMuted, fontFamily: monoFamily() }, key: 'v' }, hex),
                    ]),
                  ]);
                })
              ),
            ]);
          }),

          // Live demo card — uses the colors being edited + current typography
          el('div', { style: { marginTop: '20px' }, key: 'demo' }, [
            el('span', { style: badgeStyle(), key: 'demo-badge' }, 'Live Demo'),
            el('div', { style: {
              background: data.get('colorBgCard') || '#fff',
              border: '1px solid ' + (data.get('colorBorderDefault') || site.borderDefault),
              borderRadius: (data.get('radiusMd') || 8) + 'px',
              padding: '24px',
              marginTop: '8px',
            }, key: 'demo-card' }, [
              el('h2', { style: { fontFamily: displayFamily(), fontSize: '1.25rem', fontWeight: '700', color: data.get('colorTextPrimary') || site.textPrimary, margin: '0 0 8px' }, key: 'demo-h' }, 'Sample Card'),
              el('p', { style: { fontSize: '14px', fontFamily: bodyFamily(), color: data.get('colorTextSecondary') || site.textSecondary, margin: '0 0 12px', lineHeight: '1.6' }, key: 'demo-p' },
                'This is how a content card looks with your chosen colors. The heading, body text, and border all update in real time.'
              ),
              el('a', { style: { color: data.get('colorAccentText') || site.accentText, textDecoration: 'underline', fontSize: '14px' }, href: '#', key: 'demo-a' }, 'Read more \u2192'),
            ]),
          ]),
        ]);
      });
      console.log('[cms-styles] Registered: colors');
    } catch (e) { console.warn('[cms-styles] Colors preview:', e); }

    // ── Crawlers Preview ──
    try {
      CMS.registerPreviewTemplate('crawlers', function (props) {
        var el = window.h || React.createElement;
        var data = props.entry.get('data');
        if (!data) return null;

        var trainingBots = [
          ['gptBot', 'OpenAI \u2014 GPTBot', 'Trains ChatGPT models with your content'],
          ['claudeBot', 'Anthropic \u2014 ClaudeBot', 'Trains Claude models with your content'],
          ['googleExtended', 'Google \u2014 Google-Extended', 'Trains Gemini & AI Overviews (not regular Search)'],
          ['ccBot', 'Common Crawl \u2014 CCBot', 'Non-profit web archive used by researchers & AI'],
          ['applebotExtended', 'Apple \u2014 Applebot-Extended', 'Powers Siri & Apple Intelligence features'],
        ];

        var searchBots = [
          ['oaiSearchBot', 'ChatGPT Search \u2014 OAI-SearchBot', 'Cites your page in ChatGPT answers with a link back'],
          ['claudeSearchBot', 'Claude Search \u2014 Claude-SearchBot', 'Cites your page in Claude answers with a link back'],
          ['chatgptUser', 'ChatGPT Link Reader \u2014 ChatGPT-User', 'Reads pages users paste into ChatGPT conversations'],
          ['claudeUser', 'Claude Link Reader \u2014 Claude-User', 'Reads pages users paste into Claude conversations'],
          ['perplexityBot', 'Perplexity Search \u2014 PerplexityBot', 'AI search engine that cites sources with links'],
        ];

        var allBots = trainingBots.concat(searchBots);
        var allowed = 0;
        var blocked = 0;
        allBots.forEach(function (b) {
          if (data.get(b[0]) === 'block') blocked++; else allowed++;
        });

        function renderBotList(bots, startIndex) {
          return bots.map(function (b, i) {
            var status = data.get(b[0]) || 'allow';
            var isBlocked = status === 'block';
            var idx = startIndex + i;
            return el('div', { style: {
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < bots.length - 1 ? '1px solid ' + site.borderSubtle : 'none',
            }, key: 'b' + idx }, [
              el('div', { key: 'info' + idx }, [
                el('div', { style: { fontWeight: '500', fontSize: '14px', color: site.textPrimary }, key: 'name' + idx }, b[1]),
                el('div', { style: metaStyle(), key: 'desc' + idx }, b[2]),
              ]),
              el('span', { style: {
                padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
                background: isBlocked ? '#f8d7da' : '#d4edda',
                color: isBlocked ? '#721c24' : '#155724',
              }, key: 'status' + idx }, isBlocked ? 'BLOCKED' : 'ALLOWED'),
            ]);
          });
        }

        return el('div', { style: wrap() }, [
          el('span', { style: badgeStyle(), key: 'badge' }, 'Crawler Settings Preview'),
          el('h1', { style: Object.assign({}, titleStyle(), { marginBottom: '8px' }), key: 'title' }, 'AI & Search Crawlers'),
          el('p', { style: bodyStyle(), key: 'summary' },
            allowed + ' allowed, ' + blocked + ' blocked'
          ),
          el('p', { style: Object.assign({}, bodyStyle(), { fontSize: '13px', lineHeight: '1.6' }), key: 'explainer' },
            'Training bots learn from your content to improve their AI models. Search & Chat bots fetch your pages in real time to answer questions \u2014 with a link back to your site.'
          ),

          // Training bots group
          el('div', { style: cardS(), key: 'training' }, [
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }, key: 'train-header' }, [
              el('span', { style: { fontSize: '16px' }, key: 'train-icon' }, '\uD83E\uDDE0'),
              el('h3', { style: Object.assign({}, subtitleStyle(), { margin: '0' }), key: 'train-title' }, 'Training Bots'),
            ]),
            el('p', { style: Object.assign({}, metaStyle(), { marginBottom: '10px' }), key: 'train-desc' }, 'These bots read your content to train their AI models. No direct link back, but your knowledge shapes future AI answers.'),
          ].concat(renderBotList(trainingBots, 0))),

          // Search & Chat bots group
          el('div', { style: cardS(), key: 'search' }, [
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }, key: 'search-header' }, [
              el('span', { style: { fontSize: '16px' }, key: 'search-icon' }, '\uD83D\uDD0D'),
              el('h3', { style: Object.assign({}, subtitleStyle(), { margin: '0' }), key: 'search-title' }, 'Search & Chat Bots'),
            ]),
            el('p', { style: Object.assign({}, metaStyle(), { marginBottom: '10px' }), key: 'search-desc' }, 'These bots fetch your pages when users ask questions \u2014 your content appears in the answer with a link back to your site.'),
          ].concat(renderBotList(searchBots, trainingBots.length))),
        ]);
      });
      console.log('[cms-styles] Registered: crawlers');
    } catch (e) { console.warn('[cms-styles] Crawlers preview:', e); }

    // ── Content Guide Preview ──
    try {
      CMS.registerPreviewTemplate('content-guide', function (props) {
        var el = window.h || React.createElement;
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

        return el('div', { style: wrap() }, [
          el('span', { style: badgeStyle(), key: 'badge' }, 'Reference'),
          el('h1', { style: Object.assign({}, titleStyle(), { marginBottom: '20px' }), key: 'title' }, 'Content Guide'),

          sections.map(function (s, i) {
            var text = data.get(s.field) || '';
            return el('div', { style: Object.assign({}, cardS(), { display: 'flex', gap: '14px', alignItems: 'flex-start' }), key: 's' + i }, [
              el('div', { style: { fontSize: '24px', flexShrink: '0', marginTop: '2px' }, key: 'icon' + i }, s.icon),
              el('div', { key: 'content' + i }, [
                el('h3', { style: Object.assign({}, subtitleStyle(), { margin: '0 0 4px' }), key: 'label' + i }, s.label),
                el('p', { style: Object.assign({}, bodyStyle(), { margin: '0', whiteSpace: 'pre-wrap' }), key: 'text' + i }, text),
              ]),
            ]);
          }),
        ]);
      });
      console.log('[cms-styles] Registered: content-guide');
    } catch (e) { console.warn('[cms-styles] Content Guide preview:', e); }

    // ── Fetch settings and update the shared `site` object ──
    // Preview templates re-read `site` on every render, so
    // once this completes, any re-render picks up real values.
    Promise.all([
      fetch('/src/content/settings/typography.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('/src/content/settings/colors.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
    ]).then(function (results) {
      var typo = results[0];
      var colors = results[1];

      if (typo) {
        if (typo.displayFont) site.displayFont = typo.displayFont;
        if (typo.bodyFont) site.bodyFont = typo.bodyFont;
        if (typo.monoFont) site.monoFont = typo.monoFont;
        if (typo.baseLineHeight) site.lineHeight = typo.baseLineHeight;
      }

      if (colors) {
        if (colors.colorTextPrimary) site.textPrimary = colors.colorTextPrimary;
        if (colors.colorTextSecondary) site.textSecondary = colors.colorTextSecondary;
        if (colors.colorTextTertiary) site.textTertiary = colors.colorTextTertiary;
        if (colors.colorTextMuted) site.textMuted = colors.colorTextMuted;
        if (colors.colorAccent) site.accent = colors.colorAccent;
        if (colors.colorAccentText) site.accentText = colors.colorAccentText;
        if (colors.colorBgPage) site.bgPage = colors.colorBgPage;
        if (colors.colorBgSection) site.bgSection = colors.colorBgSection;
        if (colors.colorBgCard) site.bgCard = colors.colorBgCard;
        if (colors.colorBorderDefault) site.borderDefault = colors.colorBorderDefault;
        if (colors.colorBorderSubtle) site.borderSubtle = colors.colorBorderSubtle;
      }

      // Update global CSS and fonts link with fetched values
      var existingFonts = document.getElementById('ll-cms-fonts');
      if (existingFonts) existingFonts.href = buildFontsUrl(site.displayFont, site.bodyFont, site.monoFont);

      var existingGlobal = document.getElementById('ll-cms-global');
      if (existingGlobal) existingGlobal.textContent = buildGlobalCSS(site.bodyFont);
    });
  }

  // Wait for CMS to fully initialize (same timing as font-preview.js)
  if (document.readyState === 'complete') {
    setTimeout(initTemplates, 2500);
  } else {
    window.addEventListener('load', function () {
      setTimeout(initTemplates, 2500);
    });
  }
})();
