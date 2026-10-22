import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULTS, detectionOf, modeOf, publicConfig, readConfig, readSecrets } from '../src/config';
import wranglerConfig from '../wrangler.jsonc?raw';
import { API_KEY, BRANCH, REPO } from './helpers';

// The vars exactly as wrangler.jsonc sets them.
const vars = {
  CHANNEL_ID: 'UCF5Yih_yIqBwO0LX_qcdQgA',
  GITHUB_REPO: REPO,
  TARGET_BRANCH: BRANCH,
  PUBLISH_MODE: 'review',
  JEV_MODEL: 'typesafe/jev-1.14',
  AUTO_CONFIDENCE: '0.9',
  MAX_VIDEOS_PER_RUN: '4',
  ALLOW_MAIN: 'false',
};

describe('readConfig', () => {
  it('reads the wrangler.jsonc vars', () => {
    expect(readConfig(vars)).toEqual({
      config: {
        channelId: 'UCF5Yih_yIqBwO0LX_qcdQgA',
        githubRepo: REPO,
        targetBranch: BRANCH,
        publishMode: 'review',
        jevModel: 'typesafe/jev-1.14',
        autoConfidence: 0.9,
        maxVideosPerRun: 4,
        allowMain: false,
      },
      warnings: [],
    });
  });

  it('falls back to the cautious defaults, with a warning, when an optional value is wrong', () => {
    const { config, warnings } = readConfig({ ...vars, PUBLISH_MODE: 'yolo', AUTO_CONFIDENCE: '90', MAX_VIDEOS_PER_RUN: 'lots' });
    expect(config).toMatchObject({ publishMode: 'review', autoConfidence: 0.9, maxVideosPerRun: 4 });
    expect(warnings).toEqual([
      'PUBLISH_MODE "yolo" is not "review" or "auto"; using "review"',
      'AUTO_CONFIDENCE "90" is not a number between 0 and 1; using 0.9',
      'MAX_VIDEOS_PER_RUN "lots" is not a whole number of at least 1; using 4',
    ]);
  });

  it('uses the defaults when optional values are absent', () => {
    const { config, warnings } = readConfig({ CHANNEL_ID: vars.CHANNEL_ID, GITHUB_REPO: REPO, TARGET_BRANCH: BRANCH });
    expect(config).toMatchObject({ publishMode: 'review', jevModel: 'typesafe/jev-1.14', autoConfidence: 0.9, maxVideosPerRun: 4, allowMain: false });
    expect(warnings).toEqual([]);
  });

  it('keeps the calibrated default and wrangler.jsonc in step', () => {
    const configured = /"AUTO_CONFIDENCE":\s*"([^"]+)"/.exec(wranglerConfig)?.[1];
    expect(DEFAULTS.autoConfidence).toBe(0.9);
    expect(Number(configured)).toBe(DEFAULTS.autoConfidence);
  });

  it('allows main only for exactly "true"', () => {
    expect(readConfig({ ...vars, ALLOW_MAIN: 'true' }).config.allowMain).toBe(true);
    for (const value of ['TRUE', 'yes', '1', '']) expect(readConfig({ ...vars, ALLOW_MAIN: value }).config.allowMain).toBe(false);
  });

  it.each(['CHANNEL_ID', 'GITHUB_REPO', 'TARGET_BRANCH'])('refuses to run without %s', (name) => {
    expect(() => readConfig({ ...vars, [name]: ' ' })).toThrow(ConfigError);
  });

  it.each(['owner', 'owner/repo/extra', 'owner/re po'])('refuses the repository %j', (repo) => {
    expect(() => readConfig({ ...vars, GITHUB_REPO: repo })).toThrow(ConfigError);
  });

  it.each(['/leading', 'trailing/', 'two..dots', 'has space', 'semi;colon'])('refuses the branch %j', (branch) => {
    expect(() => readConfig({ ...vars, TARGET_BRANCH: branch })).toThrow(ConfigError);
  });
});

describe('secrets', () => {
  it('treats missing and empty secrets as unset', () => {
    expect(readSecrets({ OPENROUTER_API_KEY: '  ', GITHUB_TOKEN: '', YOUTUBE_API_KEY: '' })).toEqual({
      openrouterApiKey: undefined,
      githubToken: undefined,
      adminToken: undefined,
      youtubeApiKey: undefined,
    });
    expect(readSecrets({ OPENROUTER_API_KEY: 42 })).toMatchObject({ openrouterApiKey: undefined });
    expect(readSecrets({ YOUTUBE_API_KEY: ` ${API_KEY} ` })).toMatchObject({ youtubeApiKey: API_KEY });
  });

  it('picks the mode from GITHUB_TOKEN alone, and the detection path from YOUTUBE_API_KEY alone', () => {
    expect(modeOf(readSecrets({ OPENROUTER_API_KEY: 'k' }))).toBe('stage');
    expect(modeOf(readSecrets({ OPENROUTER_API_KEY: 'k', GITHUB_TOKEN: 't' }))).toBe('commit');
    expect(detectionOf(readSecrets({ OPENROUTER_API_KEY: 'k' }))).toBe('rss');
    expect(detectionOf(readSecrets({ OPENROUTER_API_KEY: 'k', YOUTUBE_API_KEY: API_KEY }))).toBe('api');
  });

  it('keeps secrets out of the public config, showing only what they switch on', () => {
    const secrets = readSecrets({
      OPENROUTER_API_KEY: 'sk-or-must-not-appear',
      GITHUB_TOKEN: 'github-must-not-appear',
      ADMIN_TOKEN: 'admin-must-not-appear',
      YOUTUBE_API_KEY: API_KEY,
    });
    const shown = JSON.stringify(publicConfig(readConfig(vars).config, secrets));
    expect(shown).toContain('"mode":"commit"');
    expect(shown).toContain('"detection":"api"');
    expect(shown).not.toMatch(/must-not-appear|AIza|OPENROUTER|GITHUB_TOKEN|ADMIN_TOKEN|apiKey|token/i);
  });
});
