import { Movie } from "./types";

export function normalizeTitle(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function findLocalMatch(title: string, year: string, movies: Movie[]) {
    const normalizedTitle = normalizeTitle(title);

    return movies.find((movie: Movie) => {
        if (normalizeTitle(movie.title) !== normalizedTitle) return false;

        if (year && movie.release_year) {
            return String(movie.release_year).trim() === String(year).trim();
        }

        return true;
    });
}