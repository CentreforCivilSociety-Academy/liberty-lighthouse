/**
 * Validate: turn Jev's answers into an outcome, or reject them.
 *
 * This is the only place the model's output is interpreted, and it is a
 * pure function so that every rule can be tested without a network. The
 * model proposes and this code disposes. A response is used only if it has
 * exactly the shape we asked for, names a topic that exists on the branch,
 * and gives probabilities that are real numbers between 0 and 1. Anything
 * else is "invalid": it counts as a failed attempt, and the video is asked
 * about again on a later run.
 *
 * Valid answers become one of two outcomes:
 *
 *   confident     topic confidence at least AUTO_CONFIDENCE (0.9 unless
 *                 configured) and in-scope at least 0.8. The only outcome
 *                 that may be published, and only when PUBLISH_MODE is "auto".
 *
 *   needs_review  everything else, with a reason:
 *                 out_of_scope    Jev chose "other", or in-scope is below
 *                                 0.2. No file is written; a person decides.
 *                 no_confidence   no confidence was reported, so we cannot
 *                                 tell how sure it was. Written as a draft
 *                                 under the chosen topic.
 *                 low_confidence  below either bar. Written as a draft
 *                                 under the chosen topic.
 *
 * The in-scope floor is calibrated, on jev-1.14-20261014 against 30 of the
 * channel's videos and 9 off-topic uploads. It sits at 0.2 rather than 0.5
 * because genuine explainers scored as low as 0.47 (a GST video), 0.57 and
 * 0.58: a floor of 0.5 would have dropped the GST one without even a draft.
 * Every off-topic upload (six liquor-brand videos from an unrelated channel,
 * plus an announcement, an event recording and a behind-the-scenes clip)
 * scored 0.3 or less, mostly 0.02, and chose "other" as well, so 0.2 still
 * keeps them out. Anything in between is written as a draft, never published.
 */

import { isRecord } from './http';

/** The extra choice for a video that fits no topic. Never a topic slug (repo.ts refuses it). */
export const OTHER = 'other';
/** Below this the video is treated as not a policy explainer at all. Calibrated; see above. */
export const IN_SCOPE_FLOOR = 0.2;
/** At or above this (with enough topic confidence) the video counts as confident. */
export const IN_SCOPE_CONFIDENT = 0.8;

export type ReviewReason = 'out_of_scope' | 'no_confidence' | 'low_confidence';

export interface RunnerUp {
  topic: string;
  probability: number;
}

export interface Verdict {
  outcome: 'confident' | 'needs_review';
  reason: ReviewReason | null;
  /** False only for out_of_scope: those are recorded in the ledger, never in the repo. */
  writeFile: boolean;
  /** The chosen topic slug, or "other". */
  topic: string;
  confidence: number | null;
  probabilities: Record<string, number> | null;
  /** The likeliest topic after the chosen one, for the reviewer's notes. */
  runnerUp: RunnerUp | null;
  inScope: number;
}

export type Decision = Verdict | { outcome: 'invalid'; reason: string };

export interface DecideOptions {
  topicSlugs: readonly string[];
  autoConfidence: number;
}

export function decide(response: unknown, options: DecideOptions): Decision {
  const allowed = new Set([...options.topicSlugs, OTHER]);
  const invalid = (reason: string): Decision => ({ outcome: 'invalid', reason });

  if (!isRecord(response) || !isRecord(response.answers)) return invalid('the response has no answers object');
  const topic = response.answers.topic;
  const inScopeAnswer = response.answers.in_scope;

  if (!isRecord(topic)) return invalid('answers.topic is missing');
  if (topic.type !== 'choice') return invalid('answers.topic.type is not "choice"');
  if (typeof topic.choice !== 'string') return invalid('answers.topic.choice is not a string');
  if (!allowed.has(topic.choice)) {
    return invalid(`answers.topic.choice ${quote(topic.choice)} is not one of the listed topics`);
  }

  // Optional fields may be absent or null; if present they must be right.
  let probabilities: Record<string, number> | null = null;
  if (topic.probabilities !== undefined && topic.probabilities !== null) {
    if (!isRecord(topic.probabilities)) return invalid('answers.topic.probabilities is not an object');
    probabilities = {};
    for (const [key, value] of Object.entries(topic.probabilities)) {
      if (!allowed.has(key)) return invalid(`answers.topic.probabilities names an unknown topic ${quote(key)}`);
      if (!isProbability(value)) {
        return invalid(`answers.topic.probabilities[${quote(key)}] is not a number between 0 and 1`);
      }
      probabilities[key] = value;
    }
  }

  let confidence: number | null = null;
  if (topic.confidence !== undefined && topic.confidence !== null) {
    if (!isProbability(topic.confidence)) return invalid('answers.topic.confidence is not a number between 0 and 1');
    confidence = topic.confidence;
  }

  if (!isRecord(inScopeAnswer)) return invalid('answers.in_scope is missing');
  if (inScopeAnswer.type !== 'noul') return invalid('answers.in_scope.type is not "noul"');
  if (!isProbability(inScopeAnswer.noul)) return invalid('answers.in_scope.noul is not a number between 0 and 1');
  const inScope = inScopeAnswer.noul;

  const chosen = topic.choice;
  const facts = {
    topic: chosen,
    confidence,
    probabilities,
    runnerUp: probabilities ? runnerUpOf(probabilities, chosen) : null,
    inScope,
  };

  if (chosen === OTHER || inScope < IN_SCOPE_FLOOR) {
    return { ...facts, outcome: 'needs_review', reason: 'out_of_scope', writeFile: false };
  }
  if (confidence === null) {
    return { ...facts, outcome: 'needs_review', reason: 'no_confidence', writeFile: true };
  }
  if (confidence >= options.autoConfidence && inScope >= IN_SCOPE_CONFIDENT) {
    return { ...facts, outcome: 'confident', reason: null, writeFile: true };
  }
  return { ...facts, outcome: 'needs_review', reason: 'low_confidence', writeFile: true };
}

function isProbability(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Highest probability other than the chosen topic; ties go to the alphabetically first slug. */
function runnerUpOf(probabilities: Record<string, number>, chosen: string): RunnerUp | null {
  let best: RunnerUp | null = null;
  for (const [topic, probability] of Object.entries(probabilities)) {
    if (topic === chosen) continue;
    if (!best || probability > best.probability || (probability === best.probability && topic < best.topic)) {
      best = { topic, probability };
    }
  }
  return best;
}

/** Model-supplied text goes into the ledger, so it is quoted and kept short. */
function quote(value: string): string {
  return JSON.stringify(value.slice(0, 60));
}
