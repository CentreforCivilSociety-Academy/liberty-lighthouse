// Stub for `astro:content`. Vitest uses this alias so modules that
// dynamically import `astro:content` (e.g. src/lib/markdown-export.ts)
// can be statically analyzed without erroring on the unresolved virtual
// module. Tests that actually exercise content collections must mock
// this themselves; this stub exists only to satisfy module resolution.
export const getCollection = async () => {
  throw new Error('astro:content stub: getCollection is not implemented');
};
export type CollectionEntry<_T> = unknown;
