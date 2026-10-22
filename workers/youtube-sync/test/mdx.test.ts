import { describe, expect, it } from 'vitest';
import {
  type Provenance,
  type VideoFile,
  commitMessage,
  formatProbability,
  renderVideoMdx,
  slugify,
  videoPath,
  videoSlug,
  yamlField,
} from '../src/mdx';
import { readFrontmatter } from './helpers';

describe('slugify', () => {
  it.each([
    ['Why Spending ₹20,000 Crore Might Not Help the Economy', 'why-spending-20-000-crore-might-not-help-the-economy'],
    ["Why India Stores Grain It Can't Use", 'why-india-stores-grain-it-cant-use'],
    ['Why India Stores Grain It Can’t Use', 'why-india-stores-grain-it-cant-use'],
    ['Café Économique, naïvely', 'cafe-economique-naively'],
    ['  Padded   title  ', 'padded-title'],
    ['Q&A: GST — explained!', 'q-a-gst-explained'],
    ['U.S. Trade_Policy~Notes', 'u-s-trade-policy-notes'],
    ['ﬁnancial ＡＢＣ', 'financial-abc'],
    ['भारत', ''],
  ])('%j → %j', (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  // Every video an editor has made in Decap, title as saved → filename.
  // Matching these is what "the same rules as the CMS" means in practice.
  it.each([
    ['Why So Many Indian Farmers Want to Quit', 'why-so-many-indian-farmers-want-to-quit'],
    ['The Case for Contract Farming', 'the-case-for-contract-farming'],
    ["The Policy Behind India's Food Waste", 'the-policy-behind-indias-food-waste'],
    ['Why Farming Pays So Little in India', 'why-farming-pays-so-little-in-india'],
    ["Why India Stores Grain It Can't Use", 'why-india-stores-grain-it-cant-use'],
    ["Why Subsidies Aren't Making Farmers Richer", 'why-subsidies-arent-making-farmers-richer'],
    ["Why India's Megaprojects Are Always Delayed ", 'why-indias-megaprojects-are-always-delayed'],
    ['Why Long-Term Vision Gets Indian Politicians Voted Out', 'why-long-term-vision-gets-indian-politicians-voted-out'],
    ["Why Good Policies Fail Even When They're Sensible", 'why-good-policies-fail-even-when-theyre-sensible'],
    ["How India's Voting System Fuels Freebie Politics ", 'how-indias-voting-system-fuels-freebie-politics'],
    ["Why India's Bureaucrats Are Never Fired", 'why-indias-bureaucrats-are-never-fired'],
    ['Why India Keeps Renaming Old Government Schemes', 'why-india-keeps-renaming-old-government-schemes'],
    ["Why India's Loss-Making PSUs Never Get Shut Down", 'why-indias-loss-making-psus-never-get-shut-down'],
    ["Why Elections Alone Can't Fix Bad Policy in India ", 'why-elections-alone-cant-fix-bad-policy-in-india'],
    ["How Policy Created Delhi's Smog", 'how-policy-created-delhis-smog'],
    ['How Good Intentions Can Reduce Jobs for Women', 'how-good-intentions-can-reduce-jobs-for-women'],
    ["India's Missed Manufacturing Boom", 'indias-missed-manufacturing-boom'],
    ['Why Indian Factories Stopped Hiring Permanent Workers ', 'why-indian-factories-stopped-hiring-permanent-workers'],
  ])('reproduces the CMS filename for %j', (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it('falls back to the video id when a title has nothing to slug', () => {
    expect(videoSlug('भारत की नीति', '-q05TW2BXGs')).toBe('video-q05tw2bxgs');
    expect(videoSlug('Why Doing Less Made India Richer', 'LYoNBT1fT3I')).toBe('why-doing-less-made-india-richer');
    expect(videoPath('gst', 'a-slug')).toBe('src/content/videos/gst/a-slug.mdx');
  });
});

describe('yamlField', () => {
  it('writes a plain scalar where YAML allows one, apostrophes and ₹ included', () => {
    expect(yamlField('title', "Why India's ₹20,000 Crore Bet")).toBe("title: Why India's ₹20,000 Crore Bet");
  });

  it.each([
    ['GST: a primer', 'title: "GST: a primer"'],
    ['Ends with a colon:', 'title: "Ends with a colon:"'],
    ['Tax #GST', 'title: "Tax #GST"'],
    ['#1 Reason', 'title: "#1 Reason"'],
    ['"Quoted" title', 'title: "\\"Quoted\\" title"'],
    ["'Quoted' title", 'title: "\'Quoted\' title"'],
    ['2026', 'title: "2026"'],
    ['2026-10-22', 'title: "2026-10-22"'],
    ['true', 'title: "true"'],
    ['No', 'title: "No"'],
    ['null', 'title: "null"'],
    ['-q05TW2BXGs', 'title: "-q05TW2BXGs"'],
    ['- a list?', 'title: "- a list?"'],
    ['[brackets]', 'title: "[brackets]"'],
    ['& more', 'title: "& more"'],
    ['', 'title: ""'],
  ])('quotes %j', (value, line) => {
    expect(yamlField('title', value)).toBe(line);
  });

  it('reproduces a description Decap wrote, double-quoted and folded at 80 columns', () => {
    const description =
      "Free bus rides for women, free power for farmers: India's welfare spending keeps favouring narrow groups over universal public goods. This short explores how first-past-the-post elections push politicians toward targeted freebies over broad-based development.";
    expect(yamlField('description', description)).toBe(
      [
        `description: "Free bus rides for women, free power for farmers: India's welfare`,
        '  spending keeps favouring narrow groups over universal public goods. This short',
        '  explores how first-past-the-post elections push politicians toward targeted',
        '  freebies over broad-based development."',
      ].join('\n'),
    );
  });

  it('never folds a value of 79 characters or fewer, as Decap does not', () => {
    const value = 'x'.repeat(30) + ' ' + 'y'.repeat(40);
    expect(yamlField('description', value)).toBe(`description: ${value}`);
  });

  it('never starts a continuation line with a character YAML could read as syntax', () => {
    const value = 'word '.repeat(13) + '- dash "quote" #hash (paren) ' + 'more '.repeat(20);
    const lines = yamlField('description', value.trim()).split('\n');
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(1)) expect(line).toMatch(/^ {2}[\p{L}\p{N}]/u);
  });
});

const farmers: VideoFile = {
  topic: 'agriculture',
  title: 'Why So Many Indian Farmers Want to Quit',
  youtubeId: 'lANiSBGrobs',
  format: 'short',
  description:
    'Around three out of four Indian farmers say they would leave farming if they could, not because they dislike it, but because tiny plots and thin margins mean it barely pays. This short explores why no country has grown rich with half its workforce on one-hectare farms, and why the answer is better jobs outside agriculture rather than trapping more people in it.',
  draft: false,
};

const provenance: Provenance = {
  addedOn: '2026-10-22',
  model: 'typesafe/jev-1.14-20261014',
  topic: 'agriculture',
  confidence: 0.912,
  runnerUp: { topic: 'labor', probability: 0.05 },
  inScope: 0.97,
  draft: false,
};

describe('renderVideoMdx', () => {
  it('matches, byte for byte, the file an editor made in the CMS (apart from the comments)', () => {
    const withoutComments = renderVideoMdx(farmers, provenance)
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join('\n');
    // src/content/videos/agriculture/why-so-many-indian-farmers-want-to-quit.mdx
    expect(withoutComments).toBe(`---
topic: agriculture
title: Why So Many Indian Farmers Want to Quit
youtubeId: lANiSBGrobs
format: short
orientation: vertical
description: Around three out of four Indian farmers say they would leave
  farming if they could, not because they dislike it, but because tiny plots and
  thin margins mean it barely pays. This short explores why no country has grown
  rich with half its workforce on one-hectare farms, and why the answer is
  better jobs outside agriculture rather than trapping more people in it.
order: 1
draft: false
---
`);
  });

  it('opens the frontmatter with provenance comments, and asks for review on a draft', () => {
    const mdx = renderVideoMdx({ ...farmers, draft: true }, { ...provenance, draft: true });
    expect(mdx.split('\n').slice(0, 8)).toEqual([
      '---',
      '# Added by the YouTube sync on 2026-10-22.',
      '# Model: typesafe/jev-1.14-20261014',
      '# Topic: agriculture (confidence 0.912; runner-up labor at 0.05)',
      '# In scope: 0.97',
      '# Basis: title and description, no transcript',
      '# Review the topic before publishing.',
      'topic: agriculture',
    ]);
  });

  it('leaves out the review line on a published file, and says when confidence was not reported', () => {
    const published = renderVideoMdx(farmers, provenance);
    expect(published).not.toContain('Review the topic');
    const unknown = renderVideoMdx(farmers, { ...provenance, confidence: null, runnerUp: null });
    expect(unknown).toContain('# Topic: agriculture (confidence not reported)\n');
  });

  it('writes a regular video as horizontal, with an empty body', () => {
    const mdx = renderVideoMdx({ ...farmers, format: 'video' }, provenance);
    expect(readFrontmatter(mdx)).toMatchObject({ format: 'video', orientation: 'horizontal' });
    expect(mdx.endsWith('draft: false\n---\n')).toBe(true);
  });

  it('keeps a hostile model name on its own comment line', () => {
    const lineSeparator = String.fromCharCode(0x2028);
    const mdx = renderVideoMdx(farmers, {
      ...provenance,
      model: `jev\ntopic: hijacked${lineSeparator}draft: false\r\n---`,
    });
    const fields = readFrontmatter(mdx);
    expect(Object.keys(fields)).toEqual(['topic', 'title', 'youtubeId', 'format', 'orientation', 'description', 'order', 'draft']);
    expect(fields.topic).toBe('agriculture');
    expect(mdx.split('\n').filter((line) => line === '---')).toHaveLength(2);
  });

  it.each([
    ['Budget 2026: What Changed?', 'It\'s "one nation, one market": a ₹20,000 crore question. #GST'],
    ['- dash, [brackets], & ampersand', 'Back\\slash and C# and #tag and key: value'],
    ['No', 'true'],
    ['Emoji 🎉 and देवनागरी', 'x'.repeat(120)],
    ['A title', `${'Long words then a colon: '.repeat(12)}end`],
  ])('round-trips %j through a YAML reader', (title, description) => {
    const fields = readFrontmatter(renderVideoMdx({ ...farmers, title, description }, provenance));
    expect(fields.title).toBe(title);
    expect(fields.description).toBe(description);
    expect(fields.order).toBe(1);
    expect(fields.draft).toBe(false);
  });
});

describe('commitMessage', () => {
  it("uses Decap's own message, then provenance, then the [youtube-sync] tag", () => {
    expect(
      commitMessage({
        topic: 'gst',
        slug: 'why-economists-got-excited-about-a-tax-reform',
        url: 'https://www.youtube.com/shorts/wQ9M95FK6l0',
        model: 'typesafe/jev-1.14-20261014',
        confidence: 0.91,
        draft: true,
      }),
    ).toBe(
      [
        'Create Video “gst/why-economists-got-excited-about-a-tax-reform”',
        '',
        'YouTube: https://www.youtube.com/shorts/wQ9M95FK6l0',
        'Model: typesafe/jev-1.14-20261014',
        'Topic: gst, confidence 0.91',
        'Status: draft',
        '[youtube-sync]',
      ].join('\n'),
    );
  });
});

describe('formatProbability', () => {
  it('rounds down, so a value just under the bar never reads as the bar', () => {
    expect(formatProbability(0.8999)).toBe('0.899');
    expect(formatProbability(0.9)).toBe('0.9');
    expect(formatProbability(0.7999)).toBe('0.799');
    expect(formatProbability(0.29)).toBe('0.29');
    expect(formatProbability(1)).toBe('1');
  });
});
