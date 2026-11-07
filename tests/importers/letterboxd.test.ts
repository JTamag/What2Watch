import { describe, it, expect } from 'vitest';
import { parseCSV, detectLetterboxdTarget, importLetterboxdCSV } from '../../src/importers/letterboxd';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const catalog = [
    { id: 1,  title: 'Star Wars',       release_year: '1977', genres: ['Action']    },
    { id: 2,  title: 'Finding Nemo',    release_year: '2003', genres: ['Animation'] },
    { id: 3,  title: 'The Godfather',   release_year: '1972', genres: ['Drama']     },
    { id: 4,  title: "Schindler's List",release_year: '1993', genres: ['Drama']     },
] as any[];

function csv(...rows: string[]): string {
    return rows.join('\n');
}

// ---------------------------------------------------------------------------
// parseCSV
// ---------------------------------------------------------------------------
describe('parseCSV', () => {
    it('parses a simple CSV', () => {
        const result = parseCSV('a,b,c\n1,2,3');
        expect(result).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    });

    it('handles quoted fields containing commas', () => {
        const result = parseCSV('"Hello, World",foo');
        expect(result[0]![0]).toBe('Hello, World');
    });

    it('handles escaped quotes inside quoted fields (doubled)', () => {
        const result = parseCSV('"She said ""hi""",ok');
        expect(result[0]![0]).toBe('She said "hi"');
    });

    it('handles \\r\\n line endings (Windows)', () => {
        const result = parseCSV('a,b\r\n1,2');
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual(['1', '2']);
    });

    it('skips blank lines', () => {
        const result = parseCSV('a,b\n\n1,2\n');
        expect(result).toHaveLength(2);
    });

    it('trims whitespace from fields', () => {
        const result = parseCSV(' hello , world ');
        expect(result[0]).toEqual(['hello', 'world']);
    });

    it('throws on an unclosed quoted field', () => {
        expect(() => parseCSV('"unclosed')).toThrow('unclosed');
    });

    it('returns an empty array for an empty string', () => {
        expect(parseCSV('')).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// detectLetterboxdTarget
// ---------------------------------------------------------------------------
describe('detectLetterboxdTarget', () => {
    it('detects "watchlist" from filename', () => {
        expect(detectLetterboxdTarget('watchlist.csv')).toBe('watchlist');
        expect(detectLetterboxdTarget('letterboxd_watchlist_2024.csv')).toBe('watchlist');
    });

    it('defaults to "watched" when filename does not say watchlist', () => {
        expect(detectLetterboxdTarget('watched_films.csv')).toBe('watched');
        expect(detectLetterboxdTarget('diary.csv')).toBe('watched');
        expect(detectLetterboxdTarget('ratings.csv')).toBe('watched');
    });

    it('respects forcedTarget over filename', () => {
        expect(detectLetterboxdTarget('watchlist.csv', 'watched')).toBe('watched');
        expect(detectLetterboxdTarget('diary.csv', 'watchlist')).toBe('watchlist');
    });

    it('is case-insensitive on filename', () => {
        expect(detectLetterboxdTarget('WATCHLIST_Export.CSV')).toBe('watchlist');
    });
});

// ---------------------------------------------------------------------------
// importLetterboxdCSV
// ---------------------------------------------------------------------------
describe('importLetterboxdCSV', () => {
    const watchlistCSV = csv(
        'Name,Year,Letterboxd URI',
        'Star Wars,1977,https://letterboxd.com/film/star-wars/',
        'Finding Nemo,2003,https://letterboxd.com/film/finding-nemo/',
    );

    it('matches films by title+year and returns correct counts', () => {
        const result = importLetterboxdCSV(watchlistCSV, 'watchlist.csv', catalog);
        expect(result.matchedCount).toBe(2);
        expect(result.importedCount).toBe(2);
        expect(result.failedCount).toBe(0);
    });

    it('detects target list from filename', () => {
        const result = importLetterboxdCSV(watchlistCSV, 'watchlist.csv', catalog);
        expect(result.target).toBe('watchlist');
    });

    it('reports unmatched films in failedCount', () => {
        const withUnknown = csv(
            'Name,Year',
            'Star Wars,1977',
            'Unknown Film,2099',
        );
        const result = importLetterboxdCSV(withUnknown, 'watched.csv', catalog);
        expect(result.failedCount).toBe(1);
        expect(result.matchedCount).toBe(1);
    });

    it('deduplicates against an existing list', () => {
        const existing = [catalog[0]!]; // Star Wars already in list
        const result = importLetterboxdCSV(watchlistCSV, 'watchlist.csv', catalog, existing);
        // Star Wars + Finding Nemo, but Star Wars is already there → still 2 unique
        expect(result.movies).toHaveLength(2);
    });

    it('handles the Title column header as well as Name', () => {
        const withTitleHeader = csv(
            'Title,Year',
            'Star Wars,1977',
        );
        const result = importLetterboxdCSV(withTitleHeader, 'watched.csv', catalog);
        expect(result.matchedCount).toBe(1);
    });

    it("matches films with punctuation in their title (Schindler's List)", () => {
        const withPunct = csv(
            'Name,Year',
            "Schindler's List,1993",
        );
        const result = importLetterboxdCSV(withPunct, 'watched.csv', catalog);
        expect(result.matchedCount).toBe(1);
    });

    it('throws when the CSV has fewer than 2 rows', () => {
        expect(() => importLetterboxdCSV('Name,Year', 'w.csv', catalog)).toThrow();
    });

    it('throws when no Name or Title column exists', () => {
        expect(() =>
            importLetterboxdCSV(csv('Foo,Bar', 'a,b'), 'w.csv', catalog)
        ).toThrow('Name or Title');
    });

    it('respects forcedTarget parameter', () => {
        const result = importLetterboxdCSV(watchlistCSV, 'diary.csv', catalog, [], 'watchlist');
        expect(result.target).toBe('watchlist');
    });
});
