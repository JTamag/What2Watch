export function normalizeTitle(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function findLocalMatch(title, year, movies) {
    const normalizedTitle = normalizeTitle(title);

    return movies.find(movie => {
        if (normalizeTitle(movie.title) !== normalizedTitle) return false;

        if (year && movie.release_year) {
            return String(movie.release_year).trim() === String(year).trim();
        }

        return true;
    });
}