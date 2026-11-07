import { Movie, UserData } from "./types";

const emptyUserData = (): UserData => ({version: 1, watchlist: [], watched: [], ratings: {} });

function readArray(storage: Storage, key: string): Movie[] {
    try {
        const value:unknown = JSON.parse(storage.getItem(key) ?? "[]");
        return Array.isArray(value) ? (value as Movie[]) : [];
    } catch {
        return [];
    }
}

export function loadUserData(storage: Storage = localStorage): UserData {
    const legacyWatchlist = readArray(storage, "watchlist");
    const legacyWatched = readArray(storage, "watched");
    try {
        const current = JSON.parse(storage.getItem("what2watch_user_data") || "null");
        if (current && typeof current === "object") {
            const currentWatchlist = Array.isArray(current.watchlist) ? current.watchlist : [];
            const currentWatched = Array.isArray(current.watched) ? current.watched : [];
            return {
                version: 1,
                // Merge the original keys during migration so an older or interrupted
                // save cannot hide movies that are still present in legacy storage.
                watchlist: mergeById(currentWatchlist, legacyWatchlist),
                watched: mergeById(currentWatched, legacyWatched),
                ratings: current.ratings && typeof current.ratings === "object" ? current.ratings : {}
            };
        }
    } catch {
        // Fall back to the original per-list keys.
    }

    return {
        version: 1,
        watchlist: legacyWatchlist,
        watched: legacyWatched,
        ratings: {}
    };
}

export function saveUserData(userData: UserData, storage = localStorage) {
    const data = {
        version: 1,
        watchlist: Array.isArray(userData.watchlist) ? userData.watchlist : [],
        watched: Array.isArray(userData.watched) ? userData.watched : [],
        ratings: userData.ratings && typeof userData.ratings === "object" ? userData.ratings : {}
    };
    storage.setItem("what2watch_user_data", JSON.stringify(data));
    // Keep the original keys in sync so older app versions can still read the lists.
    storage.setItem("watchlist", JSON.stringify(data.watchlist));
    storage.setItem("watched", JSON.stringify(data.watched));
}

export function mergeById(existing: Movie[] = [], incoming: Movie[] = []) {
    const merged = [...existing];
    const ids = new Set(merged.map(movie => movie.id));
    for (const movie of incoming) {
        if (movie && !ids.has(movie.id)) {
            merged.push(movie);
            ids.add(movie.id);
        }
    }
    return merged;
}

export function createEmptyUserData() {
    return emptyUserData();
}
