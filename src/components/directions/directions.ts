/**
 * The three homepage directions under review, and which one / serves.
 *
 * Each direction is a complete homepage built on the same data
 * (src/lib/homepage.ts). They live side by side at /preview/<slug>/ until CCS
 * chooses one; choosing is a one-line change to DEFAULT_DIRECTION, and the
 * other two are then deleted along with the /preview/ routes.
 */

export type DirectionSlug = 'reading-room' | 'sector-light' | 'question-deck';

export type Direction = {
  slug: DirectionSlug;
  letter: 'A' | 'B' | 'C';
  name: string;
  /** One sentence for the review page: the idea, not the features. */
  idea: string;
};

export const DIRECTIONS: Direction[] = [
  {
    slug: 'reading-room',
    letter: 'A',
    name: 'The Reading Room',
    idea:
      'An editorial homepage that reads like the opening of a good book: the headline is the list of subjects, the lead question is set as a chapter opening with the real first lines of its answer, and every topic is introduced by a question.',
  },
  {
    slug: 'sector-light',
    letter: 'B',
    name: 'Sector Light',
    idea:
      'A lighthouse lamp shows a different colour in each direction to guide ships; here each colour is a topic and every question is a point of light. Turn the beam to light a topic and read what is there.',
  },
  {
    slug: 'question-deck',
    letter: 'C',
    name: 'Question Deck',
    idea:
      'Curiosity as play: the homepage deals one real question at a time like a deck of cards, and the twelve topics are twelve decks whose thickness is the number of questions in them.',
  },
];

/** What / renders while the directions are under review. */
export const DEFAULT_DIRECTION: DirectionSlug = 'sector-light';
