import { Movie, MovieWithReasons, UserData } from "../types";

export function renderMovieGrid(grid: HTMLElement, movies: MovieWithReasons[], {
    getUserData,
    onToggleWatchlist,
    onToggleWatched,
    onOpenMovie,
    rankOffset = 0,
    showRanks = false,
    topGenres = []
}: {
    getUserData: () => UserData;
    onToggleWatchlist: (movie: Movie) => void;
    onToggleWatched: (movie: Movie) => void;
    onOpenMovie: (movie: Movie) => void;
    rankOffset?: number;
    showRanks?: boolean;
    topGenres?: string[];
}) {
    grid.innerHTML = "";
    const data = getUserData();
    const watchlistIds = new Set(data.watchlist.map(movie => movie.id));
    const watchedIds = new Set(data.watched.map(movie => movie.id));

    movies.forEach((movie, index) => {
        const card = document.createElement("article");
        card.className = "card";
        const rank = showRanks ? `<div class="card-rank">#${rankOffset + index + 1}</div>` : "";
        const matchedGenres = (movie.genres || []).filter(genre => topGenres.includes(genre));
        card.innerHTML = `
            <img src="${movie.poster || ""}" alt="${movie.title} poster" loading="lazy" onerror="this.style.display='none'">
            <div class="card-content">
                ${rank}
                <div class="card-title"></div>
                <div class="card-meta"><span>${movie.release_year || "-"}</span><span class="card-rating">★ ${(Number(movie.rating) || 0).toFixed(1)}</span></div>
                ${matchedGenres.length ? `<div class="rec-badge">${matchedGenres.slice(0, 2).join(" · ")}</div>` : ""}
            </div>
            <div class="card-actions">
                <button type="button" class="watchlist-btn ${watchlistIds.has(movie.id) ? "active" : ""}">${watchlistIds.has(movie.id) ? "In Watchlist" : "Add to Watchlist"}</button>
                <button type="button" class="watched-btn ${watchedIds.has(movie.id) ? "active" : ""}">${watchedIds.has(movie.id) ? "Watched" : "Mark as Watched"}</button>
            </div>`;
        card.querySelector(".card-title")!.textContent = movie.title;
        (card.querySelector(".watchlist-btn")as HTMLButtonElement).addEventListener("click", event => {
            event.stopPropagation();
            onToggleWatchlist(movie);
        });
        (card.querySelector(".watched-btn")as HTMLButtonElement).addEventListener("click", event => {
            event.stopPropagation();
            onToggleWatched(movie);
        });
        card.addEventListener("click", () => onOpenMovie(movie));
        grid.appendChild(card);
    });
}
