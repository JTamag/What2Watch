import { describe, it, expect } from 'vitest';
import { Movie, UserData } from "../src/types";
import { recommend, recommendV1 } from "../src/recommenders/v1";
import { parseCSV } from "../src/importers/letterboxd";
import { findLocalMatch } from "../src/search";
import rawCatalog from "../public/data/movies.json";
import ratingsCsv from "./fixtures/ratings.csv?raw";
import watchlistCsv from "./fixtures/watchlist.csv?raw";

/**
 * Recorded Baseline (Phase 3.2):
 * Date: 2026-11-10
 * Dataset: 208 rated films, 168 favourites (>= 4.0★), 34 hidden in test set
 * Method: recommendV1 (flat weights: 2.5 watchlist, 1.5 watched)
 * Score: 8.8% (3 / 34 hits in Top 50)
 */
export const V1_BASELINE_HIT_RATE = 8.8;

describe('Recommender v1 Evaluation', () => {
    it('measures Hit Rate @ 50 on held-out favourites', () => {
        const catalog: Movie[] = rawCatalog as Movie[];

        interface RatedMovie {
            movie: Movie;
            rating: number;
        }

        const ratingsRows = parseCSV(ratingsCsv).slice(1);
        const ratedMovies: RatedMovie[] = [];

        for (const row of ratingsRows) {
            const [, name, year, , ratingStr] = row;
            if (!name) continue;
            const rating = parseFloat(ratingStr ?? "0");
            const matched = findLocalMatch(name, year ?? "", catalog);
            if (matched) {
                ratedMovies.push({ movie: matched, rating });
            }
        }

        const watchlistMovies: Movie[] = [];
        if (watchlistCsv) {
            const watchlistRows = parseCSV(watchlistCsv).slice(1);
            for (const row of watchlistRows) {
                const [, name, year] = row;
                if (!name) continue;
                const matched = findLocalMatch(name, year ?? "", catalog);
                if (matched) watchlistMovies.push(matched);
            }
        }

        const highlyRated = ratedMovies.filter(item => item.rating >= 4.0);
        const otherRated = ratedMovies.filter(item => item.rating < 4.0);

        function seededShuffle<T>(array: T[], seed = 42): T[] {
            const copy = [...array];
            let s = seed;
            for (let i = copy.length - 1; i > 0; i--) {
                s = (s * 9301 + 49297) % 233280;
                const j = Math.floor((s / 233280) * (i + 1));
                const temp = copy[i]!;
                copy[i] = copy[j]!;
                copy[j] = temp;
            }
            return copy;
        }

        const shuffledHigh = seededShuffle(highlyRated, 42);
        const testCount = Math.max(1, Math.round(shuffledHigh.length * 0.2));

        const testSet = shuffledHigh.slice(0, testCount).map(item => item.movie);
        const trainHigh = shuffledHigh.slice(testCount);
        const trainRated = [...trainHigh, ...otherRated];
        const trainWatched = trainRated.map(item => item.movie);

        const ratingsRecord: Record<number, number> = {};
        for (const item of trainRated) {
            ratingsRecord[item.movie.id] = item.rating * 2;
        }

        const trainUserData: UserData = {
            version: 1,
            watched: trainWatched,
            watchlist: watchlistMovies,
            ratings: ratingsRecord
        };

        const recFn = recommendV1 ?? recommend;
        const top50 = recFn(catalog, trainUserData, { limit: 50 });
        const top50Ids = new Set(top50.map(m => m.id));

        const hits = testSet.filter(movie => top50Ids.has(movie.id));
        const hitRate = (hits.length / testSet.length) * 100;

        console.log("\n=================================================");
        console.log("   What2Watch - Recommender Evaluation Harness   ");
        console.log("=================================================");
        console.log(`Catalogue size:         ${catalog.length} films`);
        console.log(`Matched rated films:    ${ratedMovies.length} films`);
        console.log(`Highly rated (>= 4.0★): ${highlyRated.length} films`);
        console.log(`Training set size:      ${trainWatched.length} watched (${watchlistMovies.length} in watchlist)`);
        console.log(`Hidden test set (20%):  ${testSet.length} films`);
        console.log("-------------------------------------------------");
        console.log(`Hits in Top 50:         ${hits.length} / ${testSet.length}`);
        console.log(`Hit Rate @ 50 (v1):     ${hitRate.toFixed(1)}%`);
        console.log("-------------------------------------------------");
        console.log("Hits found in Top 50:");
        hits.forEach(m => console.log(`  ✓ [Rank #${top50.findIndex(r => r.id === m.id) + 1}] ${m.title} (${m.release_year})`));

        const misses = testSet.filter(movie => !top50Ids.has(movie.id));
        console.log("\nSample misses (not in top 50):");
        misses.slice(0, 5).forEach(m => console.log(`  ✗ ${m.title} (${m.release_year})`));
        console.log("=================================================\n");

        expect(testSet.length).toBeGreaterThan(0);
    });
});