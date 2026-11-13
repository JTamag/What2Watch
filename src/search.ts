import { Movie } from "./types";

export function normalizeTitle(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function findLocalMatch(title: string, year: string, movies: Movie[]) {
    const normalizedTitle = normalizeTitle(title);
    const titleMatches = movies.filter(movie => normalizeTitle(movie.title) === normalizedTitle);

    if (!titleMatches.length) return undefined;
    if (!year) return titleMatches[0];

    const requestedYear = Number.parseInt(year.trim(), 10);
    const exactMatch = titleMatches.find(movie =>
        String(movie.release_year).trim() === year.trim()
    );
    if (exactMatch || !Number.isFinite(requestedYear)) return exactMatch;

    const nearbyMatches = titleMatches.filter(movie => {
        const movieYear = Number.parseInt(String(movie.release_year), 10);
        return Number.isFinite(movieYear) && Math.abs(movieYear - requestedYear) <= 1;
    });

    
    return nearbyMatches.length === 1 ? nearbyMatches[0] : undefined;
}