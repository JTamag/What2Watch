import { Movie, UserData } from "../types";

export function getRatingWeight(rating:number | undefined): number{
    if(rating === undefined || Number.isNaN(rating)) return 1.0;

    if (rating >= 4.5) return 3.5;   // loved
    if (rating >= 4.0) return 2.5;   // liked
    if (rating >= 3.0) return 1.0;   // mildly liked
    if (rating >= 2.5) return 0.0;   // indifferent
    if (rating >= 1.5) return -1.5;  // disliked
    return -2.5;                     // hated
}

export interface RecommendWeights {
    genre: number;
    tmdb: number;
    era: number;
    topRated: number;
    diversity: number;
}

export const DEFAULT_WEIGHTS: RecommendWeights = {
    genre: 0.40,
    tmdb: 0.20,
    era: 0.15,
    topRated: 0.05,
    diversity: 0.20,
};

export interface RecommendOptions {
    limit?: number;
    weights?: Partial<RecommendWeights>;
    excludeWatchlist?: boolean;
}

function jaccard(a: Set<string>, b: Set<string>): number {
    if(a.size === 0 && b.size === 0) return 0;
    
    let shared = 0;

    for(const genre of a){
        if(b.has(genre)) shared++;
    }

    return shared / (a.size + b.size - shared);
}
export function buildTasteProfile(userData: UserData) {
    const ratings = userData.ratings || {};

    const weightedMovies = [
        ...(userData.watched || []).map(movie => ({ ...movie, weight: getRatingWeight(ratings[movie.id]) })),
        ...(userData.watchlist || []).map(movie => ({ ...movie, weight: 2.5 }))
    ];
    const genreWeights: Record<string, number> = {};
    let totalGenreWeight = 0;

    for (const movie of weightedMovies) {
        for (const genre of movie.genres || []) {
            genreWeights[genre] = (genreWeights[genre] || 0) + movie.weight;
            if(movie.weight>0) totalGenreWeight += movie.weight;
        }
    }

    const genres = Object.fromEntries(
        Object.entries(genreWeights).map(([genre, weight]: [string, number]) => [genre, totalGenreWeight ? weight / totalGenreWeight : 0])
    );
    const positiveMovies = weightedMovies.filter(m => m.weight > 0);
    const totalMovieWeight = positiveMovies.reduce((sum, movie) => sum + movie.weight, 0);
    const averageYear = totalMovieWeight
        ? positiveMovies.reduce((sum, movie) => sum + (Number(movie.release_year) || 2000) * movie.weight, 0) / totalMovieWeight
        : 2000;

    return { genres, averageYear };
}

export function getTopGenres(userData: UserData, limit = 3): string[] {
   const { genres } = buildTasteProfile(userData);
   return Object.entries(genres).filter(([,weight]) => weight > 0)
   .sort((a, b) => b[1] - a[1])
   .slice(0, limit)
   .map(([genre]) => genre);
}

// Bayesian shrinkage: WR = v/(v+m)*R + m/(v+m)*C, on TMDB's 0-10 scale. 

export function bayesianScore(rating:number, vote_count:number, catalogAverage:number,m = 500): number {
    const R = Number(rating) || 0;
    const v = Number(vote_count);
    const votes = Number.isFinite(v) && v > 0 ? v : 0;
    return (votes / (votes + m)) * R + (m / (votes + m)) * catalogAverage;
}


function recommend(catalog: Movie[], userData: UserData, options: RecommendOptions = {}) {
    const { limit = 36, excludeWatchlist = false } = options;
    const w: RecommendWeights = { ...DEFAULT_WEIGHTS, ...options.weights };

    const { genres, averageYear } = buildTasteProfile(userData);

    const watchedIds = new Set((userData.watched || []).map(movie => movie.id));
    const watchlistIds = new Set((userData.watchlist || []).map(movie => movie.id));
    const candidates = catalog.filter(movie =>
        !watchedIds.has(movie.id) &&
        (!excludeWatchlist || !watchlistIds.has(movie.id))
    );


    // Catalog mean Rating
    const ratedValues = catalog.map(movie => Number(movie.rating) || 0).filter(r => r > 0);
    const catalogAverage = ratedValues.length  ? ratedValues.reduce((sum, r) => sum + r, 0) / ratedValues.length : 6.8;
    const hasVotes = catalog.some(movie => Number(movie.vote_count) > 0);
    const tmdbScore = (movie: Movie) => hasVotes ? bayesianScore(Number(movie.rating), Number(movie.vote_count), catalogAverage) : Number(movie.rating) || 0;


    const scored = candidates.map(movie => {
        const genreSet = new Set(movie.genres || []);
        const genreScore = [...genreSet].reduce((sum, genre) => sum + (genres[genre] || 0), 0);

        const wr = tmdbScore(movie);
        const yearScore = Math.exp(-Math.abs((Number(movie.release_year) || 2000) - averageYear) / 20);
        const topRatedBonus = movie.is_top_rated ? 1 : 0;
        return { movie,genreSet, genreScore, wr , yearScore, topRatedBonus };
    });

    const maxGenreScore = Math.max(...scored.map(item => item.genreScore), 1e-6);

    const ranked = scored.map(item => ({
        ...item,
        relevance:
            w.genre * (item.genreScore / maxGenreScore) +
            w.tmdb * (item.wr / 10) +
            w.era * item.yearScore +
            w.topRated * item.topRatedBonus
        })).sort((a, b) => b.relevance - a.relevance);;

    const remaining = ranked.slice(0,Math.max(limit*5,100));

    const maxSim = new Map<Movie["id"], number>();

    const results: (Movie & { _score: number; reasons: string[] })[] = [];

    while( results.length < limit && remaining.length > 0){
        let bestIndex = 0;
        let bestScore = -Infinity;

        remaining.forEach((candidate, index) => {
            const sim = maxSim.get(candidate.movie.id) ?? 0;

            const score = candidate.relevance + w.diversity * (1-sim);
            if(score > bestScore){
                bestScore = score;
                bestIndex = index;
            }

        });
        const chosen = remaining.splice(bestIndex, 1)[0]!;
        const matchingGenres = (chosen.movie.genres || []).filter(
            genre => (genres[genre] ?? 0) > 0
        );
        const simToPicked = maxSim.get(chosen.movie.id) ?? 0;
        const reasons: string[] = [];

        if (matchingGenres.length) {
            reasons.push(`Matches your interest in ${matchingGenres.slice(0, 2).join(" and ")}`);
        }
        if (chosen.wr >= 7.5) {
            reasons.push("Highly rated by TMDB users");
        }
        if (results.length >= 3 && simToPicked <= 0.25) {
            reasons.push("Adds variety to your recommendations");
        }
        if (watchlistIds.has(chosen.movie.id)) {
            reasons.push("Already on your watchlist");
        }

        results.push({
            ...chosen.movie,
            _score: bestScore,
            reasons: reasons.slice(0, 3)
        });

        for(const other of remaining){
            const sim = jaccard(chosen.genreSet, other.genreSet);
            if(sim> (maxSim.get(other.movie.id) ?? 0)){
                maxSim.set(other.movie.id, sim);
            }
        }
    }

    return results;
}

export { recommend as recommendV2 };