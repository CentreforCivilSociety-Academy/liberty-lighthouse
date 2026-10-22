import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { listOf, openingParagraphs, openingSentences, plural } from '../../src/lib/homepage';
import { DEFAULT_DIRECTION, DIRECTIONS } from '../../src/components/directions/directions';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

/**
 * The homepage directions print sentences built from the content: counts in
 * words, lists of topics, and the opening lines of real answers. These guard
 * the helpers that build them, because a broken one prints nonsense on the
 * front page rather than failing the build.
 */

describe('the opening of an answer', () => {
  it('skips headings, lists, tables and images, and strips the markdown', () => {
    const md = [
      '## A heading',
      '',
      '![a chart](/images/x.png)',
      '',
      '- a list item',
      '',
      'Rent depends on **where** you live, as [the data](https://example.com) shows.',
      '',
      '| a | b |',
      '',
      'India\\\'s cities keep growing.',
    ].join('\n');
    expect(openingParagraphs(md)).toEqual([
      'Rent depends on where you live, as the data shows.',
      "India's cities keep growing.",
    ]);
  });

  it('stops after the paragraph that reaches the word budget, never mid-paragraph', () => {
    const md = ['one two three four five.', '', 'six seven eight.', '', 'nine ten.'].join('\n');
    expect(openingParagraphs(md, 6)).toEqual(['one two three four five.', 'six seven eight.']);
  });

  it('ends on a full stop, and decimals or abbreviations do not end a sentence', () => {
    const md =
      'Inflation fell to 1.5% last year. Rs. 20 buys less than it did in 2010, which is the point of this answer. A third sentence follows.';
    const out = openingSentences(md, 10, 40);
    expect(out.startsWith('Inflation fell to 1.5% last year. Rs. 20 buys')).toBe(true);
    expect(out.endsWith('answer.')).toBe(true);
  });

  it('falls back to a clean cut with an ellipsis when one sentence is too long', () => {
    const md = `${Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')}.`;
    const out = openingSentences(md, 10, 20);
    expect(out.split(/\s+/)).toHaveLength(20);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('counts and lists read as English', () => {
  it('pluralises', () => {
    expect(plural(1, 'question')).toBe('1 question');
    expect(plural(18, 'question')).toBe('18 questions');
    expect(plural(1, 'short video')).toBe('1 short video');
  });

  it('joins lists without middle dots or an Oxford comma', () => {
    expect(listOf(['a'])).toBe('a');
    expect(listOf(['a', 'b'])).toBe('a and b');
    expect(listOf(['18 questions', '6 videos', 'a syllabus'])).toBe('18 questions, 6 videos and a syllabus');
  });
});

describe('the directions under review', () => {
  it('are three, with distinct slugs, and / serves one of them', () => {
    expect(DIRECTIONS).toHaveLength(3);
    expect(new Set(DIRECTIONS.map((d) => d.slug)).size).toBe(3);
    expect(DIRECTIONS.map((d) => d.slug)).toContain(DEFAULT_DIRECTION);
  });

  it('each is routed from / and from /preview/<slug>/, and has its screenshots', () => {
    const home = read('src/pages/index.astro');
    const preview = read('src/pages/preview/[direction].astro');
    for (const d of DIRECTIONS) {
      expect(home).toContain(`DEFAULT_DIRECTION === '${d.slug}'`);
      expect(preview).toContain(`direction === '${d.slug}'`);
      expect(existsSync(resolve(process.cwd(), `public/preview/${d.slug}-desktop.webp`))).toBe(true);
      expect(existsSync(resolve(process.cwd(), `public/preview/${d.slug}-mobile.webp`))).toBe(true);
    }
  });

  it('stay out of search engines: noindex, robots and the sitemap', () => {
    expect(read('src/pages/robots.txt.ts')).toContain("'Disallow: /preview/'");
    expect(read('astro.config.mjs')).toMatch(/!page\.includes\('\/preview\/'\)/);
    for (const d of DIRECTIONS) {
      const dir = d.slug.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
      const name = dir.charAt(0).toUpperCase() + dir.slice(1);
      const component = read(`src/components/directions/${d.slug}/${name}.astro`);
      expect(component, `${name} must pass noindex when previewed`).toMatch(/noindex=\{preview\}/);
    }
    expect(read('src/pages/preview/index.astro')).toMatch(/\bnoindex\b/);
  });
});

describe('the index moved off the homepage', () => {
  it('lives at /questions/ with its markdown twin', () => {
    expect(existsSync(resolve(process.cwd(), 'src/pages/questions/index.astro'))).toBe(true);
    expect(existsSync(resolve(process.cwd(), 'src/pages/questions.md.ts'))).toBe(true);
  });

  it('is one click away from every page, top and bottom', () => {
    expect(read('src/components/global/Navbar.astro')).toContain("href: '/questions/'");
    expect(read('src/components/global/BottomNav.astro')).toContain("href: '/questions/'");
    expect(read('src/components/global/Footer.astro')).toContain("href: '/questions/'");
  });
});
