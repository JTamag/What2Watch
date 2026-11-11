import { findLocalMatch } from "../search";
import { mergeById } from "../storage";
import { Movie } from "../types";

export function parseCSV(text : string):string[][] {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                field += '"';
                index++;
            } else if (character === '"') {
                quoted = false;
            } else {
                field += character;
            }
        } else if (character === '"') {
            quoted = true;
        } else if (character === ",") {
            row.push(field.trim());
            field = "";
        } else if (character === "\n" || character === "\r") {
            if (character === "\r" && text[index + 1] === "\n") index++;
            row.push(field.trim());
            if (row.some(value => value !== "")) rows.push(row);
            row = [];
            field = "";
        } else {
            field += character;
        }
    }

    row.push(field.trim());
    if (row.some(value => value !== "")) rows.push(row);
    if (quoted) throw new Error("CSV contains an unclosed quoted field");
    return rows;
}

export function detectLetterboxdTarget(filename: string, forcedTarget: 'watchlist' | 'watched' | null = null): 'watchlist' | 'watched' {
    if (forcedTarget === "watchlist" || forcedTarget === "watched") return forcedTarget;
    const name = filename.toLowerCase();
    if (name.includes("watchlist")) return "watchlist";
    // ratings.csv, watched.csv, diary.csv: a rated or logged film counts as watched
    return "watched";
}

export function isLetterboxdRatingsFile(filename: string): boolean {
    return filename.toLowerCase().includes("ratings");
}

export function importLetterboxdCSV(text : string, filename : string, catalog : Movie[], existing : Movie[] = [], forcedTarget : 'watchlist' | 'watched' | null = null) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error("The selected CSV appears to be empty.");

    const headers = rows[0]!.map(value => value.toLowerCase());
    const titleIndex = headers.includes("name") ? headers.indexOf("name") : headers.indexOf("title");
    const yearIndex = headers.indexOf("year");
    const ratingIndex = headers.indexOf("rating");
    if (titleIndex < 0) throw new Error("Could not find a Name or Title column in the CSV.");

    const target = detectLetterboxdTarget(filename, forcedTarget );
    const readRatings = target === "watched" && isLetterboxdRatingsFile(filename) && ratingIndex >= 0;

    const matched = [];
    const ratings: Record<number, number> = {};
    let importedCount = 0;
    let failedCount = 0;
    for (const columns of rows.slice(1)) {
        const title = columns[titleIndex];
        if (!title) continue;
        importedCount++;
        const movie = findLocalMatch(title, yearIndex < 0 ? "" : (columns[yearIndex] ?? ""),catalog);
        if (movie) {
            matched.push(movie);
            if(readRatings){
                const rating = parseFloat(columns[ratingIndex] ?? "");
                if(!Number.isNaN(rating)) ratings[movie.id] = rating;
            }
        }
        else failedCount++;
    }

    return {
        target,
        movies: mergeById(existing, matched),
        importedCount,
        matchedCount: matched.length,
        failedCount,
        ratings,
    };
}
