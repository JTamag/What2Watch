import { loadMovies } from "./data.js";
import { loadUserData, saveUserData } from "./storage.js";
import { recommendV2, getTopGenres } from "./recommenders/recommender";
import { parsePersonalData, mergePersonalData, exportPersonalData } from "./importers/default_importers.js";
import { importLetterboxdCSV } from "./importers/letterboxd.js";
import { createViews } from "./ui/views.js";
import { createModalController } from "./ui/modal.js";
import { initSettings } from "./ui/settings.js";
import '../styling.css';
import { Movie } from "./types";

let catalog: Movie[] = [];
let userData = loadUserData();
let views: ReturnType<typeof createViews>;

function save() {
    saveUserData(userData);
}

function refresh() {
    views?.refreshCurrentSection();
}

function toggleWatchlist(movie: Movie) {
    const exists = userData.watchlist.some(item => item.id === movie.id);
    userData.watchlist = exists
        ? userData.watchlist.filter(item => item.id !== movie.id)
        : [...userData.watchlist, movie];
    save();
    refresh();
}

function toggleWatched(movie: Movie) {
    const exists = userData.watched.some(item => item.id === movie.id);
    userData.watched = exists
        ? userData.watched.filter(item => item.id !== movie.id)
        : [...userData.watched, movie];
    if (!exists) userData.watchlist = userData.watchlist.filter(item => item.id !== movie.id);
    if (exists && userData.ratings) delete userData.ratings[movie.id];
    save();
    refresh();
}

function rateMovie(movie: Movie, rating: number | undefined) {
    userData.ratings ??= {};
    if(rating === undefined) {
        if(userData.watched.some(item => item.id === movie.id)) {
            toggleWatched(movie);
        } else {
            delete userData.ratings[movie.id];
        }
        return;
    }
    userData.ratings[movie.id] = rating;
    save();
    refresh();
}

async function importFile(file: File) {
    try {
        const text = await file.text();
        if (file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel") {
            const target = /watchlist/i.test(file.name) ? "watchlist" : "watched";
            const result = importLetterboxdCSV(text, file.name, catalog, userData[target]);
            userData[target] = result.movies;
            if(result.ratings){
                userData.ratings = {...userData.ratings, ...result.ratings};
            }
            save();
            refresh();
            alert(`Import complete!\nList updated: ${result.target.toUpperCase()}\nRows processed: ${result.importedCount}\nMatched with catalogue: ${result.matchedCount}\nNot found: ${result.failedCount}`);
            return;
        }

        const incoming = parsePersonalData(text);
        userData = mergePersonalData(userData, incoming);
        save();
        refresh();
        alert("Data imported successfully!");
    } catch (error) {
        console.error("Import failed:", error);
        alert(error instanceof Error ? error.message : "Could not import the selected file.");
    }
}

const settings = initSettings({
    getUserData: () => userData,
    onImport: importFile,
    onExport: () => exportPersonalData(userData)
});

const modal = createModalController({
    getUserData: () => userData,
    onToggleWatchlist: toggleWatchlist,
    onToggleWatched: toggleWatched,
    onRate: rateMovie,
    isSettingsOpen: settings.isOpen,
    closeSettings: settings.close
});

function showRecommendations() {
    if (!userData.watchlist.length && !userData.watched.length) {
        views.showRecommendationsEmpty("Add films to your Watchlist or mark films as watched to get personalised recommendations.");
        return;
    }
    const results = recommendV2(catalog, userData);
    views.showRecommendations(results, getTopGenres(userData));
}

function surpriseMe() {
    const pool = userData.watchlist.length
        ? userData.watchlist
        : catalog.filter(movie => movie.is_popular).length
            ? catalog.filter(movie => movie.is_popular)
            : catalog;
    if (!pool.length) return;
    const randomMovie = pool[Math.floor(Math.random() * pool.length)];
    if (randomMovie) modal.open(randomMovie);
}

views = createViews({
    getMovies: () => catalog,
    getUserData: () => userData,
    onToggleWatchlist: toggleWatchlist,
    onToggleWatched: toggleWatched,
    onOpenMovie: (movie: Movie) => modal.open(movie),
    onRecommendations: showRecommendations,
    onSurprise: surpriseMe
});

views.init();

loadMovies()
    .then(data => {
        catalog = data.movies;
        views.renderSection("popular");
    })
    .catch(error => {
        console.error("Could not load the movie catalogue:", error);
        alert("Could not load the movie catalogue. Please refresh and try again.");
    });
