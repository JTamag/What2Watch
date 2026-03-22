// ── State ──
let allMovies = [];
let watchlist = JSON.parse(localStorage.getItem("watchlist") || "[]");
let watched   = JSON.parse(localStorage.getItem("watched")   || "[]");
let currentSection = "popular";
let searchTimeout = null;