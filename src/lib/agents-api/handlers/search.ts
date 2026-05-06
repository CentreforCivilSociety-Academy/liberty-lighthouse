/**
 * search handler.
 *
 * Validates inputs, calls agent-search.search(), packages hits into a
 * SearchPayload. Throws AgentError on bad inputs.
 *
 * See docs/agents-api.md §5.2.
 */
import { search, InvalidKindError } from '../../agent-search/index.js';
import { AgentError } from '../errors.js';
import type { SearchInput, SearchPayload } from '../types.js';

export async function handleSearch(
  input: SearchInput,
): Promise<SearchPayload> {
  const query = (input.query ?? '').trim();
  if (!query) {
    throw new AgentError('BAD_REQUEST', 'query parameter "q" is required');
  }

  if (input.k !== undefined) {
    if (!Number.isInteger(input.k) || input.k < 1) {
      throw new AgentError(
        'BAD_REQUEST',
        '"k" must be a positive integer',
        { k: input.k },
      );
    }
  }

  let hits;
  try {
    hits = await search(query, {
      k: input.k,
      kinds: input.kinds,
    });
  } catch (err) {
    if (err instanceof InvalidKindError) {
      throw new AgentError(
        'VALIDATION_ERROR',
        err.message,
        { kind: err.kind, valid_kinds: err.validKinds },
      );
    }
    throw err;
  }

  return { query, hits };
}
