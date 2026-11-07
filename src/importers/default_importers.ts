import { mergeById } from "../storage";
import { UserData } from "../types";

export function parsePersonalData(text:string):UserData {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Personal data must be a JSON object");
    }
    return {
        version: 1,
        watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
        watched: Array.isArray(data.watched) ? data.watched : [],
        ratings: data.ratings && typeof data.ratings === "object" ? data.ratings : {}
    };
}

export function mergePersonalData(current: UserData, incoming: UserData) {
    return {
        version: 1,
        watchlist: mergeById(current.watchlist, incoming.watchlist),
        watched: mergeById(current.watched, incoming.watched),
        ratings: { ...(current.ratings || {}), ...(incoming.ratings || {}) }
    };
}

export function exportPersonalData(userData: UserData) {
    return JSON.stringify({
        version: userData.version,
        watchlist: userData.watchlist || [],
        watched: userData.watched || [],
        ...(Object.keys(userData.ratings || {}).length ? { ratings: userData.ratings } : {})
    }, null, 2);
}
