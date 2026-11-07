import { mergeById } from "../storage.js";

export function parsePersonalData(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Personal data must be a JSON object");
    }
    return {
        watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
        watched: Array.isArray(data.watched) ? data.watched : [],
        ratings: data.ratings && typeof data.ratings === "object" ? data.ratings : {}
    };
}

export function mergePersonalData(current, incoming) {
    return {
        version: 1,
        watchlist: mergeById(current.watchlist, incoming.watchlist),
        watched: mergeById(current.watched, incoming.watched),
        ratings: { ...(current.ratings || {}), ...(incoming.ratings || {}) }
    };
}

export function exportPersonalData(userData) {
    return JSON.stringify({
        watchlist: userData.watchlist || [],
        watched: userData.watched || [],
        ...(Object.keys(userData.ratings || {}).length ? { ratings: userData.ratings } : {})
    }, null, 2);
}
