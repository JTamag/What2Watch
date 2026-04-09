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

// Toggle watchlist
function toggleWatchlist(movie) {
    if (isInWatchlist(movie.id)) {
        watchlist = watchlist.filter(m => m.id !== movie.id);
    } else {
        watchlist.push(movie);
    }
    save();
    refreshCurrentSection();
}
// Toggle watched
function toggleWatched(movie) {
    if (isInWatched(movie.id)) {
        watched = watched.filter(m => m.id !== movie.id);
    } else {
        watched.push(movie);
    }
    save();
    refreshCurrentSection();
}

// Build poster card
function buildPoster(movie) {
    const card = document.createElement("div");
    card.className = "card";

    const isWL = isInWatchlist(movie.id);
    const isWT = isInWatched(movie.id);
    card.innerHTML = `TO DO` 
    card.querySelector(".watchlist-btn").addEventListener("click", e => {
        e.stopPropagation();
        toggleWatchlist(movie);
    });
    card.querySelector(".watched-btn").addEventListener("click", e => {
        e.stopPropagation();
        toggleWatched(movie);
    });
    card.addEventListener("click", () => openModal(movie));

    return card
}

function renderSection(section) {
    currentSection = section;
    // TO DO
}

function refreshCurrentSection() {
    renderSection(currentSection);
}