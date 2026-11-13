import { describe, it, expect } from 'vitest';
import { recommendV1, getTopGenres } from '../src/recommenders/v1';
import { recommendV2, bayesianScore } from '../src/recommenders/v2';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeMovie(overrides: Record<string, unknown>) {
    return {
        id: Math.floor(Math.random() * 1_000_000),
        title: 'Test Movie',
        overview: '',
        poster: '',
        rating: 7,
        vote_count: 100,
        popularity: 10,
        genres: [] as string[],
        release_year: '2000',
        is_popular: false,
        is_top_rated: false,
        ...overrides,
    };
}

const actionMovie  = makeMovie({ id: 1, title: 'Action A', genres: ['Action'], rating: 7 });
const dramaMovie   = makeMovie({ id: 2, title: 'Drama B',  genres: ['Drama'],  rating: 7 });
const actionMovie2 = makeMovie({ id: 3, title: 'Action C', genres: ['Action'], rating: 8 });
const topRated     = makeMovie({ id: 4, title: 'Top D',    genres: ['Drama'],  rating: 9, is_top_rated: true });

const catalog = [actionMovie, dramaMovie, actionMovie2, topRated];

// ---------------------------------------------------------------------------
// recommend()
// ---------------------------------------------------------------------------
describe('recommend', () => {
    it('excludes films the user has already watched', () => {
        const userData = {
            version: 1 as const,
            watched: [actionMovie],
            watchlist: [],
            ratings: {},
        };
        const results = recommendV1(catalog, userData);
        const ids = results.map((r: any) => r.id);
        expect(ids).not.toContain(actionMovie.id);
    });

    it('does not crash on empty userData', () => {
        const userData = { version: 1 as const, watched: [], watchlist: [], ratings: {} };
        expect(() => recommendV1(catalog, userData)).not.toThrow();
    });

    it('returns an empty array when every catalog film is watched', () => {
        const userData = { version: 1 as const, watched: catalog, watchlist: [], ratings: {} };
        const results = recommendV1(catalog, userData);
        expect(results).toHaveLength(0);
    });

    it('scores genre-matching films higher when watchlist is genre-heavy', () => {
        // Watchlist full of Action films → Action recommendations should rank above Drama
        const userData = {
            version: 1 as const,
            watched: [],
            watchlist: [
                makeMovie({ id: 10, genres: ['Action'] }),
                makeMovie({ id: 11, genres: ['Action'] }),
                makeMovie({ id: 12, genres: ['Action'] }),
            ],
            ratings: {},
        };
        const results = recommendV1(catalog, userData) as any[];
        const topResult = results[0];
        expect(topResult.genres).toContain('Action');
    });

    it('respects the limit option', () => {
        const bigCatalog = Array.from({ length: 50 }, (_, i) =>
            makeMovie({ id: 100 + i, title: `Film ${i}` })
        );
        const userData = { version: 1 as const, watched: [], watchlist: [], ratings: {} };
        const results = recommendV1(bigCatalog, userData, { limit: 10 });
        expect(results).toHaveLength(10);
    });

    it('returns reasons for each recommendation', () => {
        const userData = {
            version: 1 as const,
            watched: [],
            watchlist: [makeMovie({ id: 20, genres: ['Action'] })],
            ratings: {},
        };
        const results = recommendV1(catalog, userData) as any[];
        // Every result should have a reasons array (may be empty for unrelated films)
        for (const r of results) {
            expect(Array.isArray(r.reasons)).toBe(true);
        }
    });

    it('includes a _score on each result', () => {
        const userData = { version: 1 as const, watched: [], watchlist: [], ratings: {} };
        const results = recommendV1(catalog, userData) as any[];
        for (const r of results) {
            expect(typeof r._score).toBe('number');
        }
    });

    it('results are sorted descending by _score', () => {
        const userData = {
            version: 1 as const,
            watched: [],
            watchlist: [makeMovie({ id: 30, genres: ['Action'] })],
            ratings: {},
        };
        const results = recommendV1(catalog, userData) as any[];
        for (let i = 1; i < results.length; i++) {
            expect(results[i - 1]._score).toBeGreaterThanOrEqual(results[i]._score);
        }
    });
});

// ---------------------------------------------------------------------------
// getTopGenres()
// ---------------------------------------------------------------------------
describe('getTopGenres', () => {
    it('returns the most represented genres from watchlist', () => {
        const userData = {
            version: 1 as const,
            watched: [],
            watchlist: [
                makeMovie({ genres: ['Action'] }),
                makeMovie({ genres: ['Action'] }),
                makeMovie({ genres: ['Drama'] }),
            ],
            ratings: {},
        };
        const top = getTopGenres(userData, 1);
        expect(top[0]).toBe('Action');
    });

    describe('recommendV2', () => {
        it('uses personal ratings to distinguish liked and disliked genres', () => {
            const action = makeMovie({ id: 50, genres: ['Action'] });
            const drama = makeMovie({ id: 51, genres: ['Drama'] });
            const userData = {
                version: 1 as const,
                watched: [
                    makeMovie({ id: 52, genres: ['Action'] }),
                    makeMovie({ id: 53, genres: ['Drama'] }),
                ],
                watchlist: [],
                ratings: { 52: 5, 53: 1 },
            };

            const results = recommendV2([action, drama], userData, { limit: 2 });
            expect(results[0]?.id).toBe(action.id);
        });

        it('excludes watchlist items when requested', () => {
            const watchlisted = makeMovie({ id: 54 });
            const available = makeMovie({ id: 55 });
            const userData = {
                version: 1 as const,
                watched: [],
                watchlist: [watchlisted],
                ratings: {},
            };

            const results = recommendV2([watchlisted, available], userData, {
                limit: 2,
                excludeWatchlist: true,
            });
            expect(results.map(movie => movie.id)).not.toContain(watchlisted.id);
        });

        it('uses vote count in Bayesian TMDB scoring', () => {
            expect(bayesianScore(10, 1, 6, 500)).toBeLessThan(bayesianScore(10, 10000, 6, 500));
        });

        it('explains the signals used for recommendations', () => {
            const action = makeMovie({ id: 56, genres: ['Action'], rating: 8, vote_count: 10000 });
            const drama = makeMovie({ id: 57, genres: ['Drama'], rating: 9, vote_count: 10000 });
            const watchlisted = makeMovie({ id: 58, genres: ['Action'], rating: 8, vote_count: 10000 });
            const userData = {
                version: 1 as const,
                watched: [makeMovie({ id: 59, genres: ['Action'] })],
                watchlist: [watchlisted],
                ratings: { 59: 5 },
            };

            const results = recommendV2([action, drama, watchlisted], userData, { limit: 3 });
            const actionResult = results.find(movie => movie.id === action.id);
            const dramaResult = results.find(movie => movie.id === drama.id);
            const watchlistResult = results.find(movie => movie.id === watchlisted.id);

            expect(actionResult?.reasons).toContain('Matches your interest in Action');
            expect(dramaResult?.reasons).toContain('Highly rated by TMDB users');
            expect(watchlistResult?.reasons).toContain('Already on your watchlist');
            for (const result of results) {
                expect(result.reasons.length).toBeLessThanOrEqual(3);
            }
        });
    });

    it('respects the limit parameter', () => {
        const userData = {
            version: 1 as const,
            watched: [],
            watchlist: [
                makeMovie({ genres: ['Action', 'Drama', 'Comedy', 'Horror'] }),
            ],
            ratings: {},
        };
        expect(getTopGenres(userData, 2)).toHaveLength(2);
    });

    it('does not crash on empty userData', () => {
        expect(() => getTopGenres({ version: 1, watched: [], watchlist: [], ratings: {} })).not.toThrow();
    });

    it('returns an empty array when both lists are empty', () => {
        expect(getTopGenres({ version: 1, watched: [], watchlist: [], ratings: {} })).toEqual([]);
    });
});
