# YouTube sync

A Cloudflare Worker that notices new uploads on the Centre for Civil Society's
YouTube channel and files each one under the right topic on Liberty Lighthouse,
as a video entry at `src/content/videos/<topic>/<slug>.mdx`.

Which topic a video belongs to is decided by Jev, TypeSafe's decision model,
through OpenRouter's Decisions API. Jev only *proposes*. Deterministic code
checks the answer against the topics that actually exist on the branch, decides
whether the result is safe to use, and writes the file. In the default mode
every file arrives as a draft, so an editor reviews it in the CMS before
anything is published.

## How a run works

The cron trigger runs every six hours (`0 */6 * * *`); `POST /run` runs it on
demand.

1. **Detect.** List the channel's 15 latest uploads.
   - **With a `YOUTUBE_API_KEY`**, through the YouTube Data API v3 (see
     [Detection](#detection)): `playlistItems.list` on the channel's uploads
     playlist, keeping only public videos, then `videos.list` to tell Shorts
     (vertical, at most three minutes) from regular videos. If the API is
     unusable this run (a bad key, the quota spent, the API not enabled), the
     run logs why and reads the RSS feed instead.
   - **Without a key**, through the public Atom feed. It is unreliable: once
     only 20–30% of requests got a 200, and in later live runs it failed 20
     times in 20. So it is retried up to eight times with short jittered
     pauses, under 15 seconds of waiting in all. If every attempt fails, the
     run records that and stops; the next run reads the same uploads.
2. **Filter.** Skip every video the ledger has already settled. When nothing is
   new, the run ends here, having made no GitHub or OpenRouter calls at all.
3. **Interlock.** In commit mode, refuse to write to a production branch (see
   [The safety interlock](#the-safety-interlock)).
4. **Snapshot.** One recursive tree listing of the target branch gives every
   existing video file and every topic file. What is learned from each file
   (a video's `youtubeId`, a topic's title, slug and description) is cached in
   KV under the file's blob SHA, so it is read from GitHub only once.
5. **Dedupe.** A new video the branch already holds (an editor added it by
   hand, say) is settled as `exists`. Jev is never asked about it.
6. **Classify.** One Decisions API request per video, oldest first, at most
   `MAX_VIDEOS_PER_RUN` per run.
7. **Validate.** `src/decide.ts` turns the answers into an outcome, or rejects
   them as malformed.
8. **Persist.** In stage mode, keep the would-be file in the ledger. In commit
   mode, create the file on the target branch with a create-only write (no
   `sha`), so an existing file can never be overwritten.

The classification is saved before the write is attempted. If GitHub fails,
the next run writes the file from the saved answer without paying Jev again.

### The ledger

Everything the sync knows lives in the `LEDGER` KV namespace. Each video has a
record under `video:<youtubeId>` with one of these statuses:

| Status | Meaning |
| --- | --- |
| `pending` | Work remains: the video is new, or waiting to retry after a failure. |
| `staged` | Stage mode: the would-be file (path and full MDX) is kept in the record. |
| `committed` | The file was created on the target branch. |
| `exists` | The branch already had the video. |
| `needs_review` | Out of scope, or Jev kept giving malformed answers. No file; a person decides. |
| `failed` | Five attempts failed. A person has to look (`lastError` says why). |

A transient failure (a 5xx, a rate limit, a timeout) leaves the video pending
and waits 1, 2, 4, then 8 hours before trying again; the fifth failure marks it
`failed`. A failure that would repeat for every video (a rejected API key, no
OpenRouter credits, a missing repository) stops the run instead, and does not
count against any video. The ledger also holds `run:last`, the last 20 run
summaries under `run:history`, the blob caches, and `lock:run` while a run is in
progress.

## What Jev is asked, and what is done with the answer

Each request has a `state` (the title, the description cleaned of hashtags and
links and cut to about 1,200 characters, the format and the upload date) and
two questions:

- **topic** (a choice): which topic page the video should be filed under. The
  choices are the `slug`s of the topic files on the branch, each described by
  that topic's own title and description, plus `other` for a video that fits
  none of them.
- **in_scope** (a probability): whether the video is a short explainer about an
  Indian economic, legal or public-policy question.

Transcripts are not used: YouTube only lets the channel owner download
captions. Every classification records its basis as `title+description`.

`src/decide.ts` accepts an answer only if it has exactly the expected shape,
names a topic that exists (or `other`), and every probability is a real number
between 0 and 1. Anything else is malformed: it counts as a failed attempt, and
after five the video goes to `needs_review` with reason `malformed_response`.
Valid answers become:

| Outcome | When | File |
| --- | --- | --- |
| `confident` | topic confidence ≥ `AUTO_CONFIDENCE` (0.9) and in-scope ≥ 0.8 | Published in `auto` mode; a draft otherwise |
| `needs_review` / `out_of_scope` | Jev chose `other`, or in-scope < 0.2 | None. Recorded in the ledger only |
| `needs_review` / `no_confidence` | no confidence reported | Draft under the chosen topic |
| `needs_review` / `low_confidence` | anything else | Draft under the chosen topic |

Both thresholds were calibrated on `typesafe/jev-1.14-20261014` against 30 of
the channel's videos, 145 FAQ texts standing in for videos, and 9 off-topic
uploads:

- **In-scope floor 0.2.** Genuine explainers scored in-scope as low as 0.47 (a
  GST video), 0.57 and 0.58, so a floor of 0.5 would have dropped real videos
  without even a draft. Every off-topic upload (six liquor-brand videos from an
  unrelated channel, plus an announcement, an event recording and a
  behind-the-scenes clip) scored 0.3 or less, mostly 0.02, and chose `other`.
- **AUTO_CONFIDENCE 0.9.** Answers between 0.8 and 0.9 were right 76% of the
  time (21 of them), against 98–100% at 0.9 and above. On the FAQ texts the
  precision of `confident` rises from 93.6% to 98.7% (78 of 79); on the real
  videos it stays at 100% (18 of 18 at 0.9, 21 of 21 at 0.8).

`JEV_MODEL` is pinned for this reason. Probabilities shift between Jev
versions, so moving to a new one means re-checking both numbers.

[EVALUATION.md](EVALUATION.md) has the full evaluation these numbers come
from. To repeat it (about $0.008, key in the environment, never on the
command line):

```sh
OPENROUTER_API_KEY=… ../../node_modules/.bin/tsx scripts/evaluate.ts
```

To evaluate a model or threshold in your own code, import the Worker's own
functions; neither touches the network, the clock or the environment:

```ts
import { buildDecisionRequest } from './src/jev';
import { decide } from './src/decide';

const body = buildDecisionRequest(
  { title, description, format: 'short', published: '2026-10-22' },
  topics, // [{ slug, title, description }], as in src/content/topics
  'typesafe/jev-1.14',
);
// POST body to https://openrouter.ai/api/alpha/decisions, then:
const verdict = decide(responseJson, { topicSlugs: topics.map((t) => t.slug), autoConfidence: 0.9 });
```

### The file

The frontmatter matches the files editors create in Decap CMS field for field
(`topic`, `title`, `youtubeId`, `format`, `orientation`, `description`,
`order: 1`, `draft`), written the way Decap writes YAML. The filename follows
Decap's slug settings, with apostrophes dropped ("Can't" becomes `cant`). Two
videos with the same title get `<slug>` and `<slug>-2`; a third needs a person.
Provenance goes in YAML comments at the top of the frontmatter:

```yaml
---
# Added by the YouTube sync on 2026-10-22.
# Model: typesafe/jev-1.14-20261014
# Topic: education (confidence 0.93)
# In scope: 0.95
# Basis: title and description, no transcript
# Review the topic before publishing.
topic: education
title: Why More School Funding Hasn't Fixed Indian Education
...
draft: true
---
```

Decap drops comments the first time an editor saves the entry, and that save is
the review. A file with `draft: true` stays off every public page (topic and
video pages, search, the homepage, `llms-full.txt`) until an editor publishes
it. Commits use Decap's own message (`Create Video “<topic>/<slug>”`) plus a few
provenance lines, end with `[youtube-sync]`, and are made as
`liberty-lighthouse-bot`, the identity the repository's other bots use.

## Configuration

Settings are `vars` in `wrangler.jsonc`, so a change is a reviewed commit.

| Variable | Value | Meaning |
| --- | --- | --- |
| `CHANNEL_ID` | `UCF5Yih_yIqBwO0LX_qcdQgA` | The YouTube channel to watch. |
| `GITHUB_REPO` | `CentreforCivilSociety-Academy/liberty-lighthouse` | Where the content lives. |
| `TARGET_BRANCH` | `feat/liberty-lighthouse-redesign-automation` | The branch read and written. |
| `PUBLISH_MODE` | `review` | `review`: every file is a draft. `auto`: confident files are published. |
| `JEV_MODEL` | `typesafe/jev-1.14` | Pinned; see calibration above. |
| `AUTO_CONFIDENCE` | `0.9` | Topic confidence needed for `confident`. |
| `MAX_VIDEOS_PER_RUN` | `4` | Videos classified or written per run. |
| `ALLOW_MAIN` | `false` | Must be `true` to write to `main` or the default branch. |

A missing or invalid `CHANNEL_ID`, `GITHUB_REPO` or `TARGET_BRANCH` stops the
run. An invalid optional value falls back to its default, which is always the
cautious one, and the run summary says so.

Secrets are set with `npx wrangler secret put <NAME>` and are never logged,
stored or returned by `/status`:

| Secret | Needed | Without it |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Yes | A run stops before doing anything else. |
| `YOUTUBE_API_KEY` | Recommended | New uploads are found through the RSS feed, which has been failing for this channel. |
| `GITHUB_TOKEN` | No | Stage mode: nothing is written to GitHub. |
| `ADMIN_TOKEN` | No | No HTTP surface: every request gets a 404. |

For `GITHUB_TOKEN`, use a fine-grained token limited to this repository with
**Contents: Read and write** and nothing else.

For `YOUTUBE_API_KEY`, create an API key in a Google Cloud project with the
**YouTube Data API v3** enabled, and under *API restrictions* limit it to that
API. Leave *Application restrictions* at none: Cloudflare's outbound addresses
are not fixed. The Worker sends the key in the `X-Goog-Api-Key` header, never
in a URL; it never logs a URL either, keeps only Google's reason code from an
error, and blanks any `key=` value an error message might quote.

## Modes

| Mode | Set by | What happens |
| --- | --- | --- |
| **stage** | no `GITHUB_TOKEN` | Classifies and keeps each would-be file (path and MDX) in the ledger. Writes nothing. The dev deployment runs like this, though from Cloudflare GitHub often refuses its unauthenticated reads (see [Limitations](#limitations)). |
| **review** | `GITHUB_TOKEN` set, `PUBLISH_MODE` `review` | Creates every file on the branch as `draft: true`. |
| **auto** | `GITHUB_TOKEN` set, `PUBLISH_MODE` `auto` | Creates `confident` files as `draft: false`; everything else is still a draft. |

Moving between them:

- **stage → review:** `npx wrangler secret put GITHUB_TOKEN`. The next run
  writes every staged video, using its saved classification, so Jev is not
  asked (or paid) twice.
- **review → auto:** set `PUBLISH_MODE` to `"auto"` in `wrangler.jsonc` and
  deploy.
- **back to stage:** `npx wrangler secret delete GITHUB_TOKEN`.

### Detection

| Path | Set by | What happens |
| --- | --- | --- |
| **api** | `YOUTUBE_API_KEY` set | `playlistItems.list` on the uploads playlist (the channel id with `UC` changed to `UU`), public videos only, then `videos.list` for duration and player shape. Two requests a run; a 5xx or a timeout gets one quick retry. |
| **rss** | no `YOUTUBE_API_KEY` | The public Atom feed, retried up to eight times. |

With a key, a run whose API calls cannot work (a 400 or 403 such as
`keyInvalid`, `quotaExceeded` or `accessNotConfigured`, or Google failing
twice) logs the reason and reads the RSS feed instead, in the same run, so a
broken key costs a warning rather than a run. If `videos.list` alone fails, the
uploads are still used, but a video counts as a Short only when its title or
description says `#shorts`, and the log says so. Either way the run summary
records the path used as `feed.source` (`"api"` or `"rss"`), and `/status`
shows the configured path as `config.detection`.

Switch with `npx wrangler secret put YOUTUBE_API_KEY` or
`npx wrangler secret delete YOUTUBE_API_KEY`; nothing else changes.

## The safety interlock

In commit mode the sync refuses to write to `main`, or to whatever the
repository's default branch is, unless `ALLOW_MAIN` is `"true"`. The check runs
before any classification, so a refused run costs nothing. If the default
branch cannot be looked up, the run stops: the interlock fails closed.
Production activation is therefore an explicit, reviewed change to
`wrangler.jsonc` that sets both `TARGET_BRANCH` and `ALLOW_MAIN`.

## Deploying

```sh
cd workers/youtube-sync
npm install

# The dev KV namespace already exists and its id is in wrangler.jsonc.
# For another account or a production copy, create one and put its id there:
#   npx wrangler kv namespace create LEDGER

npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put YOUTUBE_API_KEY      # recommended: the RSS feed has been failing
npx wrangler secret put ADMIN_TOKEN          # optional: e.g. the output of `openssl rand -base64 32`
# npx wrangler secret put GITHUB_TOKEN       # optional: leave unset for stage mode

npm run deploy
```

`wrangler secret put` offers to create the Worker if it has not been deployed
yet; deploying first and adding secrets afterwards works too.

## Inspecting a deployment

```sh
# Settings (no secrets; config.detection is "api" or "rss"), the last run
# (lastRun.feed.source says which path it used), counts by status, and every video record
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://liberty-lighthouse-youtube-sync-dev.<subdomain>.workers.dev/status
# ...including the full MDX of staged files
curl -H "Authorization: Bearer $ADMIN_TOKEN" "https://.../status?full=1"
# Run now (409 if a run is already in progress)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" https://.../run

# Live logs: one JSON line per step (run.start, feed.retry, video.classified, ...)
npx wrangler tail

# One video's record, or make the sync forget a video so it is tried afresh
npx wrangler kv key get --binding LEDGER --remote "video:<youtubeId>"
npx wrangler kv key delete --binding LEDGER --remote "video:<youtubeId>"

# The sync's commits
git log --grep '\[youtube-sync\]'
```

Workers Logs are enabled, so the same lines are searchable in the Cloudflare
dashboard.

## Costs

- **Jev:** $0.042 per million input tokens; output is free (verified
  2026-10-22 from
  `https://openrouter.ai/api/v1/models?output_modalities=decisions`).
  Measured on the channel's real videos with today's 12 topics: about 1,000
  input tokens, **$0.000043 a video**, so well under a cent a month at the
  channel's pace (see [EVALUATION.md](EVALUATION.md)). Each run summary
  records the cost OpenRouter reports.
- **YouTube Data API:** no charge. A run uses two quota units (one per list
  call; a retry costs one more), so four runs a day use 8 of the free 10,000
  units a day.
- **Cloudflare:** runs on the Workers free plan. Cron triggers are free, and a
  run is designed to stay inside the free plan's 50 subrequests per invocation:
  every fetch is counted, and a video is only started if the worst case for it
  still fits. Detection takes 2 subrequests through the API (at most 4 with
  retries, plus up to 8 more if it falls back to the feed). A run makes about
  20 KV reads and a handful of writes, far inside the free tier (100,000 reads
  and 1,000 writes a day).
- **GitHub:** nothing.

## Limitations

- **No transcripts.** Classification sees only the title and description.
- **Without an API key, detection depends on a flaky feed.** A run whose eight
  feed attempts all fail does nothing; the next one catches up. Set
  `YOUTUBE_API_KEY` and the feed is only the fallback.
- **The window is the 15 latest uploads**, through either path. A video that
  drops out of it before it is processed is not seen again. That would take
  weeks of failed runs at the channel's pace.
- **Shorts by hashtag, sometimes.** When `videos.list` fails, a video counts as
  a Short only if it says `#shorts`; this channel's descriptions do not, so its
  Shorts would be filed as regular, horizontal videos until an editor fixes the
  draft. The log flags every such run.
- **KV is eventually consistent.** The run lock is best-effort, so two runs
  that start within a minute of each other can overlap. The create-only write
  is the real guard against duplicate files, and the saved classification
  limits duplicate Jev calls.
- **Stage mode reads GitHub without a token, and from Cloudflare that often
  fails.** GitHub allows 60 unauthenticated requests an hour per IP address,
  and a Worker shares its outbound addresses with every other Worker. In the
  dev Worker's first run that got past detection (22 October 2026), GitHub
  refused the very first call with a rate-limit 403. A refused run stops
  before Jev is asked and before any video is recorded, so it costs nothing
  and the next run starts afresh, but a deployed Worker only works dependably
  with `GITHUB_TOKEN`; stage mode is most useful under `wrangler dev` on an
  ordinary connection. When it does get through, the first run reads about 30
  files; after that the caches keep it to one call per run that has new
  videos.
- **The first runs are slow on purpose.** A cold start spends much of the
  subrequest budget reading the repository, so the first run may classify only
  a video or two. The backlog clears over the following runs.
- **The tree listing covers the whole branch** (about 1,900 entries and 700 KB
  today, roughly a millisecond of CPU against the free plan's 10 ms). If the
  repository grows several times larger, list `src/content` subtrees instead.
- **A wrong `CHANNEL_ID` cannot be detected from the feed.** The unrelated
  `@libertylighthouse` channel's feed parses like any other
  (`test/fixtures/unrelated-channel-feed.xml`). What keeps such uploads off the
  site is the out-of-scope rule: in calibration all of them chose `other`.
- Dates in provenance comments are UTC.

## Development

```sh
npm test            # vitest in Node; KV, YouTube, GitHub and OpenRouter are all fakes, so no network
npm run typecheck   # regenerates worker-configuration.d.ts, then runs tsc
npm run types       # just the regeneration, e.g. after editing wrangler.jsonc
npm run dev         # wrangler dev; copy .dev.vars.example to .dev.vars first
```

`worker-configuration.d.ts` is generated by `wrangler types` and not committed.
It takes the secret names from `.dev.vars.example` only, so generating types
never reads a real `.dev.vars`. To run the cron handler locally, start
`npx wrangler dev --test-scheduled` and request `/__scheduled`; that run makes
real requests to YouTube, GitHub and OpenRouter.

| File | Role |
| --- | --- |
| `src/index.ts` | The cron and HTTP entry points, admin auth, `/status` |
| `src/run.ts` | One run, start to finish |
| `src/youtube-api.ts` | Detection through the YouTube Data API v3 |
| `src/feed.ts` | The RSS feed: retries and a small parser |
| `src/repo.ts` | What the branch holds: videos for dedupe, topics for the taxonomy |
| `src/jev.ts` | The Decisions API request and its retry policy |
| `src/decide.ts` | Validation and the outcome rules (pure) |
| `src/mdx.ts` | Slug, frontmatter and commit message |
| `src/github.ts` | The five GitHub calls |
| `src/ledger.ts` | KV records, run summaries, the lock |
| `src/http.ts` | Subrequest budget, timeouts, upstream errors |
| `src/config.ts` | Settings and secrets |
| `src/text.ts` | Text clean-up |
