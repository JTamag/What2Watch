import { Movie, UserData } from "./types";

function buildTasteProfile(userData: UserData) {
    const weightedMovies = [
        ...(userData.watched || []).map(movie => ({ ...movie, weight: 1.5 })),
        ...(userData.watchlist || []).map(movie => ({ ...movie, weight: 2.5 }))
    ];
    const genreWeights: Record<string, number> = {};
    let totalGenreWeight = 0;

    for (const movie of weightedMovies) {
        for (const genre of movie.genres || []) {
            genreWeights[genre] = (genreWeights[genre] || 0) + movie.weight;
            totalGenreWeight += movie.weight;
        }
    }

    const genres = Object.fromEntries(
        Object.entries(genreWeights).map(([genre, weight]: [string, number]) => [genre, totalGenreWeight ? weight / totalGenreWeight : 0])
    );
    const totalMovieWeight = weightedMovies.reduce((sum, movie) => sum + movie.weight, 0);
    const averageYear = totalMovieWeight
        ? weightedMovies.reduce((sum, movie) => sum + (Number(movie.release_year) || 2000) * movie.weight, 0) / totalMovieWeight
        : 2000;

    return { genres, averageYear };
}

export function getTopGenres(userData: UserData, limit = 3) {
    const { genres } = buildTasteProfile(userData);
    return Object.entries(genres).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([genre]) => genre);
}

export function recommend(catalog: Movie[], userData: UserData, { limit = 20 } = {}) {
    const { genres, averageYear } = buildTasteProfile(userData);
    const watchedIds = new Set((userData.watched || []).map(movie => movie.id));
    const candidates = catalog.filter(movie => !watchedIds.has(movie.id));
    const scored = candidates.map(movie => {
        const genreScore = (movie.genres || []).reduce((sum, genre) => sum + (genres[genre] || 0), 0);
        const ratingScore = (Number(movie.rating) || 0) / 10;
        const yearScore = Math.exp(-Math.abs((Number(movie.release_year) || 2000) - averageYear) / 20);
        const topRatedBonus = movie.is_top_rated ? 1 : 0;
        return { movie, genreScore, ratingScore, yearScore, topRatedBonus };
    });
    const maxGenreScore = Math.max(...scored.map(item => item.genreScore), 1e-6);

    return scored.map(({ movie, genreScore, ratingScore, yearScore, topRatedBonus }) => {
        const matchingGenres = (movie.genres || []).filter(genre => (genres[genre] ?? 0) > 0);
        const reasons = [];
        if (matchingGenres.length) reasons.push(`Matches your interest in ${matchingGenres.slice(0, 2).join(" and ")}`);
        if (movie.is_top_rated) reasons.push("Included in the top-rated collection");
        if (ratingScore >= 0.8) reasons.push("Highly rated by TMDB users");
        return {
            ...movie,
            _score: (genreScore / maxGenreScore) * 0.5 + ratingScore * 0.35 + yearScore * 0.1 + topRatedBonus * 0.05,
            reasons
        };
    }).sort((a, b) => b._score - a._score).slice(0, limit);
}
