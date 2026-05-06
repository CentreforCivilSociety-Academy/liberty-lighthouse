/**
 * search handler.
 *
 * Validates inputs, calls agent-search.search(), packages hits into a
 * SearchPayload. Throws AgentError on bad inputs.
 *
 * See docs/agents-api.md §5.2.
 */
import { search } from '../../agent-search/search.js';
import { AgentError } from '../errors.js';
import type { SearchInput, SearchPayload } from '../types.js';

const MAX_K = 25;

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
      k: input.k !== undefined ? Math.min(MAX_K, input.k) : undefined,
      kinds: input.kinds,
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('invalid kind')) {
      throw new AgentError(
        'VALIDATION_ERROR',
        err.message,
        input.kinds ? { kinds: input.kinds } : undefined,
      );
    }
    throw err;
  }

  return { query, hits };
}
