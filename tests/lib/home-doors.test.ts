import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The homepage already told you a theme had videos and a syllabus, and then
 * made you go through the theme page to reach either — three clicks to a video
 * the page had named. The ledger and the foot of each section are doors now.
 *
 * The rule that survives from before: name only what exists. Seven of eleven
 * themes have no video, and none of them should grow an empty door.
 */

const section = readFileSync(resolve(process.cwd(), 'src/components/home/ThemeSection.astro'), 'utf8');
const css = readFileSync(resolve(process.cwd(), 'src/styles/home.css'), 'utf8');
const footer = readFileSync(resolve(process.cwd(), 'src/components/global/Footer.astro'), 'utf8');

describe('each theme names its own destinations', () => {
  it('the ledger links questions, videos and syllabus separately', () => {
    expect(section).toMatch(/\/topics\/\$\{theme\.slug\}\/faq\//);
    expect(section).toMatch(/\/topics\/\$\{theme\.slug\}\/videos\//);
    expect(section).toMatch(/\/topics\/\$\{theme\.slug\}\/syllabus\//);
  });

  it('still names only what exists', () => {
    // A theme with no video must not grow an empty door.
    expect(section).toMatch(/theme\.videos > 0/);
    expect(section).toMatch(/theme\.hasSyllabus \?/);
  });

  it('the foot carries a door per destination, not one shared link', () => {
    expect(section).toContain('section-go-lead');
    expect(section).toMatch(/doors\.map/);
    // The old single link and its label are gone.
    expect(section).not.toContain('section-foot-go');
    expect(section).not.toContain('section-foot-has');
  });

  it('says which theme a door belongs to, for a screen reader link list', () => {
    // "6 videos" read out of context says nothing on a page with eleven themes.
    expect(section).toMatch(/aria-label=\{`\$\{door\.label\} in \$\{theme\.title\}`\}/);
    expect(section).toMatch(/aria-label=\{`\$\{item\.label\} in \$\{theme\.title\}`\}/);
  });

  it('does not add eleven more landmarks to do it', () => {
    expect(section).not.toMatch(/<nav class="section-foot"/);
  });

  it('gives every door a thumb-sized target', () => {
    const go = css.slice(css.indexOf('.section-go {'), css.indexOf('.section-go:hover'));
    expect(go).toMatch(/min-height:\s*2\.75rem/);
  });
});

describe('the partner band', () => {
  it('carries the publisher only', () => {
    expect(footer).toContain('Centre for Civil Society');
    expect(footer).not.toMatch(/atlas/i);
  });
});

describe('images scale, and hold their place while they load', () => {
  const global = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');

  it('the scaling rule is not scoped to a class a layout has to remember', () => {
    // It was `.prose img`, which is a promise about markup, not about images.
    const rule = global.slice(global.indexOf('\n  img {'), global.indexOf('.prose img'));
    expect(rule).toMatch(/max-width:\s*100%/);
    expect(rule).toMatch(/height:\s*auto/);
  });

  it('every render path stamps the real dimensions on', () => {
    const config = readFileSync(resolve(process.cwd(), 'astro.config.mjs'), 'utf8');
    const syllabus = readFileSync(resolve(process.cwd(), 'src/lib/render-markdown.ts'), 'utf8');
    expect(config).toContain('rehypeImageResponsive');
    expect(syllabus).toContain('rehypeImageResponsive');
  });
});
