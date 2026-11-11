import { describe, it, expect } from 'vitest';
import { Movie, UserData } from "../src/types";
import { recommendV1 } from "../src/recommenders/v1";
import { recommendV2 } from "../src/recommenders/recommender";
import { parseCSV } from "../src/importers/letterboxd";
import { findLocalMatch } from "../src/search";
import rawCatalog from "../public/data/movies.json";
import ratingsCsv from "./fixtures/ratings.csv?raw";
import watchlistCsv from "./fixtures/watchlist.csv?raw";

// --- Pseudo-random Number Generator (Mulberry32) ---
function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffled<T>(items: T[], rand: () => number): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const temp = copy[i]!;
        copy[i] = copy[j]!;
        copy[j] = temp;
    }
    return copy;
}

interface RatedMovie {
    movie: Movie;
    rating: number;
}

interface EvalMetrics {
    hitRate50: number;
    recall100: number;
    ndcg50: number;
    medianRank: number;
}

describe('Airtight Recommender Evaluation (Leak-Free, 50 Seeds)', () => {
    it('runs 50-seed cross-validation with zero leakage and watchlist exclusion', () => {
        const catalog: Movie[] = rawCatalog as Movie[];

        // 1. Parse Datasets
        const ratingsRows = parseCSV(ratingsCsv).slice(1);
        const ratedMovies: RatedMovie[] = [];
        for (const row of ratingsRows) {
            const [, name, year, , ratingStr] = row;
            if (!name) continue;
            const rating = parseFloat(ratingStr ?? "0");
            const matched = findLocalMatch(name, year ?? "", catalog);
            if (matched) ratedMovies.push({ movie: matched, rating });
        }

        const rawWatchlistMovies: Movie[] = [];
        if (watchlistCsv) {
            const watchlistRows = parseCSV(watchlistCsv).slice(1);
            for (const row of watchlistRows) {
                const [, name, year] = row;
                if (!name) continue;
                const matched = findLocalMatch(name, year ?? "", catalog);
                if (matched) rawWatchlistMovies.push(matched);
            }
        }

        const highlyRated = ratedMovies.filter(item => item.rating >= 4.0);
        const otherRated = ratedMovies.filter(item => item.rating < 4.0);

        const SEEDS = 50;
        const v1Metrics: EvalMetrics[] = [];
        const v2Metrics: EvalMetrics[] = [];
        const popularMetrics: EvalMetrics[] = [];
        const randomMetrics: EvalMetrics[] = [];

        const popularRanking = [...catalog].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

        for (let seed = 1; seed <= SEEDS; seed++) {
            const rand = mulberry32(seed);
            const shuffledHigh = shuffled(highlyRated, rand);
            const testCount = Math.max(1, Math.round(shuffledHigh.length * 0.2));

            // Define Test Set
            const testSet = shuffledHigh.slice(0, testCount).map(item => item.movie);
            const testIds = new Set(testSet.map(m => m.id));

            // --- ZERO LEAKAGE ENFORCEMENT ---
            // 1. Remove test set items from training highly-rated
            const trainHigh = shuffledHigh.slice(testCount);
            const trainRated = [...trainHigh, ...otherRated].filter(item => !testIds.has(item.movie.id));
            const trainWatched = trainRated.map(item => item.movie);

            // 2. Build clean ratings record (strictly omitting test items)
            const ratingsRecord: Record<number, number> = {};
            for (const item of trainRated) {
                ratingsRecord[item.movie.id] = item.rating * 2;
            }

            // 3. Purge watchlist of any items present in test set or already watched
            const watchedIds = new Set(trainWatched.map(m => m.id));
            const cleanWatchlist = rawWatchlistMovies.filter(m => !testIds.has(m.id) && !watchedIds.has(m.id));

            const trainUserData: UserData = {
                version: 1,
                watched: trainWatched,
                watchlist: cleanWatchlist,
                ratings: ratingsRecord
            };

            // Evaluate V1 (with excludeWatchlist option if supported)
            const v1List = recommendV1(catalog, trainUserData, { limit: 100, excludeWatchlist: true });
            v1Metrics.push(computeMetrics(testSet, v1List));

            // Evaluate V2
            const v2List = recommendV2(catalog, trainUserData, { limit: 100, excludeWatchlist: true });
            v2Metrics.push(computeMetrics(testSet, v2List));

            // Baselines (Candidates exclude watched and clean watchlist)
            const excludedIds = new Set([...trainWatched, ...cleanWatchlist].map(m => m.id));
            const popFiltered = popularRanking.filter(m => !excludedIds.has(m.id));
            popularMetrics.push(computeMetrics(testSet, popFiltered));

            const randomList = shuffled(catalog.filter(m => !excludedIds.has(m.id)), rand);
            randomMetrics.push(computeMetrics(testSet, randomList));
        }

        // Aggregate results
        console.log("\n=================================================");
        console.log(` Airtight Eval Results (${SEEDS} Seeds, Leak-Free) `);
        console.log("=================================================");
        printSummary("Random Baseline", randomMetrics);
        printSummary("Most Popular Baseline", popularMetrics);
        printSummary("Recommender V1", v1Metrics);
        printSummary("Recommender V2", v2Metrics);
        console.log("=================================================\n");

        expect(highlyRated.length).toBeGreaterThan(0);
    });
});

// --- Metric Calculation Helpers ---
function computeMetrics(testSet: Movie[], rankedList: Movie[]): EvalMetrics {
    const top50 = rankedList.slice(0, 50);
    const top100 = rankedList.slice(0, 100);
    const top50Ids = new Set(top50.map(m => m.id));
    const top100Ids = new Set(top100.map(m => m.id));

    const hits50 = testSet.filter(m => top50Ids.has(m.id)).length;
    const hitRate50 = (hits50 / testSet.length) * 100;

    const hits100 = testSet.filter(m => top100Ids.has(m.id)).length;
    const recall100 = (hits100 / testSet.length) * 100;

    let dcg = 0;
    let idcg = 0;
    for (let i = 0; i < Math.min(50, testSet.length); i++) {
        idcg += 1 / Math.log2(i + 2);
    }
    for (let i = 0; i < top50.length; i++) {
        if (testSet.some(m => m.id === top50[i]?.id)) {
            dcg += 1 / Math.log2(i + 2);
        }
    }
    const ndcg50 = idcg === 0 ? 0 : (dcg / idcg) * 100;

    const ranks = testSet.map(movie => {
        const idx = rankedList.findIndex(m => m.id === movie.id);
        return idx === -1 ? rankedList.length + 1 : idx + 1;
    }).sort((a, b) => a - b);

    const mid = Math.floor(ranks.length / 2);
    const medianRank = ranks.length % 2 !== 0 ? ranks[mid]! : (ranks[mid - 1]! + ranks[mid]!) / 2;

    return { hitRate50, recall100, ndcg50, medianRank };
}

function stats(values: number[]) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
    return { mean, std };
}

function printSummary(name: string, metrics: EvalMetrics[]) {
    const h50 = stats(metrics.map(m => m.hitRate50));
    const r100 = stats(metrics.map(m => m.recall100));
    const n50 = stats(metrics.map(m => m.ndcg50));
    const med = stats(metrics.map(m => m.medianRank));

    console.log(`\n--- ${name} ---`);
    console.log(` Hit@50:     ${h50.mean.toFixed(1)}% ± ${h50.std.toFixed(1)}%`);
    console.log(` Recall@100: ${r100.mean.toFixed(1)}% ± ${r100.std.toFixed(1)}%`);
    console.log(` NDCG@50:    ${n50.mean.toFixed(1)}% ± ${n50.std.toFixed(1)}%`);
    console.log(` Median Rk:  ${med.mean.toFixed(1)} ± ${med.std.toFixed(1)}`);
}