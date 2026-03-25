// ── State ──
let allMovies = [];
let watchlist = JSON.parse(localStorage.getItem("watchlist") || "[]");
let watched   = JSON.parse(localStorage.getItem("watched")   || "[]");
let currentSection = "popular";
let searchTimeout = null;


// Load movies
async function loadMovies() {
    try {
        const response = await fetch(".../data/movies.json");
        allMovies = await response.json();
        renderSection("popular");
    } catch (error) {
        console.error("Could not load movies.json please check the file path.", error);
    }
}

// Save to localStorage
function save() {
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
    localStorage.setItem("watched", JSON.stringify(watched));
}

// Presence check
function isInWatchlist(movieId) {
    return watchlist.some(movie => movie.id === movieId);
}
function isInWatched(movieId) {
    return watched.some(movie => movie.id === movieId);
}


function refreshCurrentSection() {
    renderSection(currentSection);
}

function renderSection(section) {
    currentSection = section;
    // TO DO
}