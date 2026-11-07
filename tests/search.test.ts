import { describe, it, expect } from 'vitest';
import { normalizeTitle, findLocalMatch } from '../src/search';

// ---------------------------------------------------------------------------
// normalizeTitle
// ---------------------------------------------------------------------------
describe('normalizeTitle', () => {
    it('lowercases the input', () => {
        expect(normalizeTitle('Star Wars')).toBe('starwars');
    });

    it('strips spaces', () => {
        expect(normalizeTitle('The Dark Knight')).toBe('thedarkknight');
    });

    it('strips punctuation', () => {
        expect(normalizeTitle("Schindler's List")).toBe('schindlerslist');
    });

    it('strips colons and dashes', () => {
        expect(normalizeTitle('Mad Max: Fury Road')).toBe('madmaxfuryroad');
    });

    it('strips leading and trailing whitespace', () => {
        expect(normalizeTitle('  Alien  ')).toBe('alien');
    });

    it('keeps digits', () => {
        expect(normalizeTitle('2001: A Space Odyssey')).toBe('2001aspaceoddyssey'.replace('oddyssey', 'odyssey'));
        expect(normalizeTitle('2001: A Space Odyssey')).toBe('2001aspaceodyssey');
    });

    it('treats "The" prefix as part of the title (no special stripping)', () => {
        // normalizeTitle does NOT strip "the" — matching is symmetric so both
        // sides get normalized the same way.
        expect(normalizeTitle('The Godfather')).toBe('thegodfather');
        expect(normalizeTitle('Godfather, The')).toBe('godfatherthe');
    });

    it('returns an empty string for an empty input', () => {
        expect(normalizeTitle('')).toBe('');
    });
});

// ---------------------------------------------------------------------------
// findLocalMatch
// ---------------------------------------------------------------------------
const catalog = [
    { id: 1, title: 'Star Wars', release_year: '1977', genres: ['Action'] },
    { id: 2, title: 'Finding Nemo', release_year: '2003', genres: ['Animation'] },
    { id: 3, title: "Schindler's List", release_year: '1993', genres: ['Drama'] },
    { id: 4, title: 'Alien', release_year: '1979', genres: ['Horror'] },
    { id: 5, title: 'Alien', release_year: '1986', genres: ['Action'] }, // duplicate title, different year
] as any[];

describe('findLocalMatch', () => {
    it('finds a movie by exact title', () => {
        expect(findLocalMatch('Star Wars', '', catalog)?.id).toBe(1);
    });

    it('matches case-insensitively', () => {
        expect(findLocalMatch('star wars', '', catalog)?.id).toBe(1);
        expect(findLocalMatch('STAR WARS', '', catalog)?.id).toBe(1);
    });

    it('matches despite punctuation differences', () => {
        expect(findLocalMatch('Schindlers List', '', catalog)?.id).toBe(3);
    });

    it('returns undefined when no match', () => {
        expect(findLocalMatch('Inception', '', catalog)).toBeUndefined();
    });

    it('uses year to disambiguate duplicate titles', () => {
        expect(findLocalMatch('Alien', '1979', catalog)?.id).toBe(4);
        expect(findLocalMatch('Alien', '1986', catalog)?.id).toBe(5);
    });

    it('falls back to title-only match when year is omitted', () => {
        // Returns the first match when no year is given
        const match = findLocalMatch('Alien', '', catalog);
        expect([4, 5]).toContain(match?.id);
    });

    it('returns undefined for an empty title', () => {
        expect(findLocalMatch('', '', catalog)).toBeUndefined();
    });
});
