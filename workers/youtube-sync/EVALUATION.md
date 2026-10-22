# How well Jev files Liberty Lighthouse videos

Evaluated 22 October 2026 against `typesafe/jev-1.14` (the snapshot that
answered was `typesafe/jev-1.14-20261014`), using exactly the request the
Worker sends (`buildDecisionRequest`) and exactly the rules it applies
(`decide`). Re-run with `scripts/evaluate.ts`; raw answers are kept in
`scripts/eval-out/` so thresholds can be re-tuned without paying again.

## What was tested

| Set | What it is | Labels |
|---|---|---|
| Site videos | the 18 videos already on the site | the topic CCS editors filed each one under |
| New Shorts | the 12 recent Shorts on @TheCCSAcademy not yet on the site | labelled by hand before seeing Jev's answers ([`scripts/eval-labels.json`](scripts/eval-labels.json)), with an acceptable alternative where a video genuinely spans two topics |
| Question proxies | all 145 published questions, as the question plus the opening of its answer | the topic each question is filed under; not videos, but the same short text against the same taxonomy |
| Negatives | 6 real videos from an unrelated channel that also calls itself "libertylighthouse", plus an announcement, an event recording and a behind-the-scenes upload | must not be filed under any topic |

## Results

| Set | Examples | Right topic | Would publish automatically | …of those, right | Sent to review | Kept out (no file) |
|---|---|---|---|---|---|---|
| Site videos | 18 | 17 (94%) | 9 | 9 (100%) | 9 | 0 |
| New Shorts | 12 | 12 (100%) | 9 | 9 (100%) | 3 | 0 |
| Negatives | 9 | n/a | 0 | n/a | 0 | **9 (100%)** |
| Question proxies | 145 | 135 (93%) | 77 | 76 (98.7%) | 62 | 6 |

"Would publish automatically" means topic confidence ≥ 0.90 and in-scope ≥
0.80, which only takes effect in `auto` mode. In the default `review` mode
every video arrives as a draft, and these columns say which ones a reviewer
can approve at a glance.

Jev is not perfectly deterministic: between two runs about half an hour apart, the
confidence on the same video moved by up to 0.05 (0.75 → 0.70) and
in-scope by 0.04. The thresholds leave room for that.

The one editor-filed video Jev put elsewhere, *How Good Intentions Can Reduce
Jobs for Women* (filed under Labour and manufacturing; Jev chose Feminism),
came back below the confidence bar, so the Worker sends it for review rather
than filing it. Every off-topic video chose "other" and scored at most 0.3 on
the in-scope question.

The question proxies show where the taxonomy itself blurs: questions about
e-rickshaws and street vending (filed under Small entrepreneurs) read as
Urbanism, and questions about farmland ownership read as Property Rights.
These are judgement calls a reviewer would make too.

## Thresholds, and why

Jev's probabilities are not calibrated out of the box, and the cookbook says
to pick thresholds per model from labelled data. Two were set from this run:

- **Auto-publish needs topic confidence ≥ 0.90 and in-scope ≥ 0.80.** Answers
  in the 0.80–0.90 confidence band were right 76% of the time (n = 21),
  against 98–100% at 0.90 and above. On the question proxies, precision of
  "confident" rises from 93.6% at 0.80 to 98.7% (78/79) at 0.90; on real
  videos it is 100% either way (18 of 30 would publish automatically).
  This only matters in `auto` mode: in `review` mode every video is a draft.
- **"Out of scope" (no draft written) means Jev chose "other" or in-scope is
  below 0.20.** Legitimate explainers scored in-scope as low as 0.47, so the
  first floor of 0.50 would have silently dropped a real GST video. Every
  negative chose "other" and scored 0.30 or less.

## Cost

- Measured: 184 classifications cost **$0.0079** in total, a mean of 1,023
  input tokens and **$0.000043 per video** (Jev 1.14 is $0.042 per million
  input tokens; output is free). Most of each request is the twelve topic
  descriptions, not the video.
- At the channel's recent pace (15 Shorts in August 2026) that is about
  **$0.0007 a month**; even 100 videos a month would be under half a cent.
- Each video is classified once. The classification is saved before the file
  is written, so a GitHub failure never pays for a second request.
- Cloudflare: one Worker, a cron every six hours and one KV namespace fit the
  Workers free plan (100,000 requests and 1,000 KV writes a day). The YouTube
  feed and the GitHub API are free.

## Limits

- **No transcripts.** YouTube only lets the channel owner download captions,
  so Jev sees the title and description. CCS's descriptions are good
  summaries, which is why this works; a video with a one-line description
  will land in review more often.
- **Small labelled sample.** 30 real videos is enough to set sensible
  thresholds and not enough to promise an error rate. Re-run the evaluation
  as videos accumulate (`scripts/evaluate.ts`), and re-tune when the model
  snapshot changes: probabilities shift between Jev versions.
- **Labels are judgements.** The new-Shorts labels are one person's reading;
  where two topics were defensible both were accepted, and that is reported
  separately from exact matches.
