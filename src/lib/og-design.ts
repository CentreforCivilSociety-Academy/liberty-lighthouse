/**
 * The OG card design, as data.
 *
 * One definition, used by the batch job that renders every published page and
 * by the browser tool that renders arbitrary text. Neither owns the design.
 *
 * The card is the site's own vocabulary at poster scale: paper ground, ink
 * type in the display face, a theme-coloured rule, mono micro-labels, and the
 * mark. It is not a screenshot of the page — a 1200x630 card seen at thumbnail
 * size in a feed has about a second to work, so it carries one question, large.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export const OG_COLOURS = {
  paper: '#FDFBF9',
  ink: '#1A1612',
  muted: '#5C524A',
  rule: '#E8E2DC',
} as const;

export type OgCard = {
  /** The line above the headline: theme, or section of the site. */
  eyebrow: string;
  /** The headline. A question wherever there is one. */
  title: string;
  /** Optional line under the headline — counts, or a short standfirst. */
  meta?: string;
  /** Theme ink; falls back to the site's ink. */
  accent?: string;
  /** The call to action printed bottom right. */
  cta?: string;
};

/**
 * Type size for the headline.
 *
 * Fitted to the text rather than fixed, so a nine-word question fills the card
 * and a twenty-five-word one still fits without being clipped. The bands come
 * from the real corpus: questions run 18 to 260 characters, median 77.
 */
export function titleSize(title: string): number {
  const n = title.length;
  if (n <= 40) return 82;
  if (n <= 70) return 70;
  if (n <= 100) return 60;
  if (n <= 140) return 50;
  if (n <= 190) return 42;
  return 36;
}

/** The eight-beam mark, as SVG path data at a 24-unit grid. */
export const MARK_PATHS = {
  square: 'M9.5 9.5h5v5h-5z',
  beams:
    'M12 5.5V2M12 18.5V22M5.5 12H2M18.5 12H22M7.4 7.4L4.9 4.9M16.6 16.6L19.1 19.1M16.6 7.4L19.1 4.9M7.4 16.6L4.9 19.1',
} as const;

/**
 * The card as a satori element tree.
 *
 * Kept as a plain object rather than JSX so the same function runs in a build
 * script and in the browser without a compile step in either.
 */
export function ogTree(card: OgCard) {
  const accent = card.accent || OG_COLOURS.ink;
  const size = titleSize(card.title);

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        background: OG_COLOURS.paper,
        padding: '64px 72px',
        fontFamily: 'EB Garamond',
      },
      children: [
        // Eyebrow, in the theme's ink.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontFamily: 'JetBrains Mono',
              fontSize: 22,
              letterSpacing: 2.6,
              textTransform: 'uppercase',
              color: accent,
            },
            children: card.eyebrow,
          },
        },

        // The headline, which is the whole point of the card.
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontSize: size,
              lineHeight: 1.08,
              letterSpacing: -1.2,
              color: OG_COLOURS.ink,
              maxWidth: 1000,
            },
            children: card.title,
          },
        },

        // Footer: rule, then mark + wordmark on the left, meta and CTA right.
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column' },
            children: [
              {
                type: 'div',
                props: {
                  style: { display: 'flex', height: 3, background: accent, marginBottom: 26 },
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
                  children: [
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', alignItems: 'center' },
                        children: [
                          {
                            type: 'svg',
                            props: {
                              width: 34,
                              height: 34,
                              viewBox: '0 0 24 24',
                              children: [
                                { type: 'path', props: { d: MARK_PATHS.square, fill: OG_COLOURS.ink } },
                                {
                                  type: 'path',
                                  props: {
                                    d: MARK_PATHS.beams,
                                    stroke: OG_COLOURS.ink,
                                    strokeWidth: 1.4,
                                    strokeLinecap: 'round',
                                    fill: 'none',
                                  },
                                },
                              ],
                            },
                          },
                          {
                            type: 'div',
                            props: {
                              style: { display: 'flex', fontSize: 30, marginLeft: 12, color: OG_COLOURS.ink },
                              children: 'Liberty Lighthouse',
                            },
                          },
                        ],
                      },
                    },
                    {
                      type: 'div',
                      props: {
                        style: { display: 'flex', alignItems: 'center' },
                        children: [
                          card.meta
                            ? {
                                type: 'div',
                                props: {
                                  style: {
                                    display: 'flex',
                                    fontFamily: 'JetBrains Mono',
                                    fontSize: 19,
                                    letterSpacing: 1.6,
                                    textTransform: 'uppercase',
                                    color: OG_COLOURS.muted,
                                    marginRight: 22,
                                  },
                                  children: card.meta,
                                },
                              }
                            : null,
                          {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                fontFamily: 'JetBrains Mono',
                                fontSize: 19,
                                letterSpacing: 1.6,
                                textTransform: 'uppercase',
                                color: OG_COLOURS.paper,
                                background: accent,
                                padding: '12px 20px',
                              },
                              children: card.cta || 'Read the answer',
                            },
                          },
                        ].filter(Boolean),
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };
}
