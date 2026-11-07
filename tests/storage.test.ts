import { describe, it, expect, beforeEach } from 'vitest';
import { loadUserData, saveUserData, mergeById, createEmptyUserData } from '../src/storage';

// ---------------------------------------------------------------------------
// Fake localStorage
// ---------------------------------------------------------------------------
function makeFakeStorage(initial: Record<string, string> = {}): Storage {
    const store: Record<string, string> = { ...initial };
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { for (const k in store) delete store[k]; },
        get length() { return Object.keys(store).length; },
        key: (i: number) => Object.keys(store)[i] ?? null,
    } as Storage;
}

const movieA = { id: 1, title: 'A', genres: ['Action'], release_year: '2000' } as any;
const movieB = { id: 2, title: 'B', genres: ['Drama'],  release_year: '2001' } as any;
const movieC = { id: 3, title: 'C', genres: ['Comedy'], release_year: '2002' } as any;

// ---------------------------------------------------------------------------
// mergeById
// ---------------------------------------------------------------------------
describe('mergeById', () => {
    it('combines two non-overlapping arrays', () => {
        const result = mergeById([movieA], [movieB]);
        expect(result).toHaveLength(2);
    });

    it('deduplicates by id — existing item wins', () => {
        const duplicate = { ...movieA, title: 'A duplicate' };
        const result = mergeById([movieA], [duplicate]);
        expect(result).toHaveLength(1);
        expect(result[0]!.title).toBe('A'); // original kept
    });

    it('handles empty existing array', () => {
        expect(mergeById([], [movieA, movieB])).toHaveLength(2);
    });

    it('handles empty incoming array', () => {
        expect(mergeById([movieA], [])).toHaveLength(1);
    });

    it('handles both arrays empty', () => {
        expect(mergeById([], [])).toHaveLength(0);
    });

    it('skips null/undefined entries in incoming', () => {
        const result = mergeById([movieA], [null as any, movieB]);
        expect(result).toHaveLength(2);
    });
});

// ---------------------------------------------------------------------------
// loadUserData / saveUserData
// ---------------------------------------------------------------------------
describe('loadUserData', () => {
    it('returns empty arrays when storage is empty', () => {
        const storage = makeFakeStorage();
        const data = loadUserData(storage);
        expect(data.watchlist).toEqual([]);
        expect(data.watched).toEqual([]);
        expect(data.ratings).toEqual({});
    });

    it('loads from the unified what2watch_user_data key', () => {
        const storage = makeFakeStorage({
            what2watch_user_data: JSON.stringify({
                version: 1,
                watchlist: [movieA],
                watched: [movieB],
                ratings: { 1: 8 },
            }),
        });
        const data = loadUserData(storage);
        expect(data.watchlist).toHaveLength(1);
        expect(data.watched).toHaveLength(1);
        expect(data.ratings[1]).toBe(8);
    });

    it('migrates legacy per-list keys when no unified key exists', () => {
        const storage = makeFakeStorage({
            watchlist: JSON.stringify([movieA]),
            watched:   JSON.stringify([movieB]),
        });
        const data = loadUserData(storage);
        expect(data.watchlist).toHaveLength(1);
        expect(data.watched).toHaveLength(1);
    });

    it('merges legacy keys on top of unified key (migration safety)', () => {
        // unified has movieA, legacy watchlist has movieB — both should appear
        const storage = makeFakeStorage({
            what2watch_user_data: JSON.stringify({ version: 1, watchlist: [movieA], watched: [], ratings: {} }),
            watchlist: JSON.stringify([movieB]),
        });
        const data = loadUserData(storage);
        expect(data.watchlist).toHaveLength(2);
    });

    it('returns empty data when unified key contains malformed JSON', () => {
        const storage = makeFakeStorage({ what2watch_user_data: 'not-json' });
        const data = loadUserData(storage);
        expect(data.watchlist).toEqual([]);
    });

    it('always returns version: 1', () => {
        const storage = makeFakeStorage();
        expect(loadUserData(storage).version).toBe(1);
    });
});

describe('saveUserData', () => {
    it('writes the unified key', () => {
        const storage = makeFakeStorage();
        saveUserData({ version: 1, watchlist: [movieA], watched: [], ratings: {} }, storage);
        const saved = JSON.parse(storage.getItem('what2watch_user_data')!);
        expect(saved.watchlist).toHaveLength(1);
    });

    it('also writes legacy keys for backwards compatibility', () => {
        const storage = makeFakeStorage();
        saveUserData({ version: 1, watchlist: [movieA], watched: [movieB], ratings: {} }, storage);
        expect(JSON.parse(storage.getItem('watchlist')!)).toHaveLength(1);
        expect(JSON.parse(storage.getItem('watched')!)).toHaveLength(1);
    });

    it('round-trips: save then load returns the same data', () => {
        const storage = makeFakeStorage();
        const original = { version: 1, watchlist: [movieA, movieB], watched: [movieC], ratings: { 3: 9 } };
        saveUserData(original, storage);
        const loaded = loadUserData(storage);
        expect(loaded.watchlist).toHaveLength(2);
        expect(loaded.watched).toHaveLength(1);
        expect(loaded.ratings[3]).toBe(9);
    });
});

// ---------------------------------------------------------------------------
// createEmptyUserData
// ---------------------------------------------------------------------------
describe('createEmptyUserData', () => {
    it('returns a fresh object with empty lists', () => {
        const data = createEmptyUserData();
        expect(data.watchlist).toEqual([]);
        expect(data.watched).toEqual([]);
        expect(data.ratings).toEqual({});
    });

    it('returns a new object each time (not the same reference)', () => {
        const a = createEmptyUserData();
        const b = createEmptyUserData();
        a.watchlist.push(movieA);
        expect(b.watchlist).toHaveLength(0);
    });
});
