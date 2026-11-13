import { Movie, UserData } from "../types";

export function createModalController({ getUserData, onToggleWatchlist, onRate,onToggleWatched, isSettingsOpen, closeSettings }:{
    getUserData: () => UserData;
    onToggleWatchlist: (movie: Movie) => void;
    onToggleWatched: (movie: Movie) => void;
    onRate: (movie: Movie, rating: number | undefined) => void;
    isSettingsOpen: () => boolean;
    closeSettings: () => void;
}) {
    const overlay = document.getElementById("modal-overlay")!;

    function close() {
        overlay.classList.add("hidden");
        document.body.style.overflow = "";
        document.getElementById("modal")!.scrollTo({ top: 0, behavior: "instant" });
    }

    function open(movie: Movie) {
        const data = getUserData();
        const inWatchlist = data.watchlist.some(item => item.id === movie.id);
        const isWatched = data.watched.some(item => item.id === movie.id);
        const userRating: number | undefined = data.ratings[movie.id];
        const reasons = "reasons" in movie && Array.isArray(movie.reasons)
            ? movie.reasons.filter((reason): reason is string => typeof reason === "string")
            : [];
        const body = overlay.querySelector("#modal-body")!;
        body.innerHTML = `
            <div class="modal-layout">
                ${movie.poster ? `<img class="modal-poster" src="${movie.poster}" alt="${movie.title} poster" onerror="this.style.display='none'">` : ""}
                <div class="modal-info">
                    <div class="modal-title"></div>
                    <div class="modal-meta"><span>${movie.release_year || "-"}</span><span class="modal-rating">★ ${(Number(movie.rating) || 0).toFixed(1)} / 10</span></div>
                    <div class="modal-genres">${(movie.genres || []).map(genre => `<span class="modal-genre"></span>`).join("")}</div>
                    <p class="modal-overview"></p>
                    <div class="modal-reasons${reasons.length ? "" : " hidden"}">
                        <div class="modal-reasons-title">Why this was recommended</div>
                        <ul class="modal-reasons-list"></ul>
                    </div>
                    <div class="modal-user-rating">
                        <span class="modal-user-rating-label">Your rating</span>
                        <div class="stars" id="modal-stars" aria-label="Your rating">${starsMarkup(userRating)}</div>
                        <span class="modal-user-rating-value">${userRating === undefined ? "Not rated" : `${userRating} / 5`}</span>
                        ${userRating === undefined ? "" : `<button id="modal-clear-rating" class="link-button">Clear</button>`}
                    </div>
                    <div class="modal-actions">
                        <button id="modal-wl" class="${inWatchlist ? "active" : ""}">${inWatchlist ? "In Watchlist" : "Add to Watchlist"}</button>
                        <button id="modal-wt" class="${isWatched ? "active" : ""}">${isWatched ? "Watched" : "Mark as Watched"}</button>
                    </div>
                </div>
            </div>`;
        body.querySelector(".modal-title")!.textContent = movie.title;
        body.querySelector(".modal-overview")!.textContent = movie.overview || "No overview available.";
        const reasonsList = body.querySelector(".modal-reasons-list");
        if (reasonsList) {
            for (const reason of reasons) {
                const item = document.createElement("li");
                item.textContent = reason;
                reasonsList.appendChild(item);
            }
        }
        body.querySelectorAll(".modal-genre").forEach((element, index) => {
            element.textContent = movie.genres[index] ?? '';
        });
        const poster = body.querySelector<HTMLImageElement>(".modal-poster");
        if (poster) poster.alt = `${movie.title} poster`;
        body.querySelector("#modal-stars")!.addEventListener("click", event => {
            const star = (event.target as HTMLElement).closest<HTMLElement>(".star");
            if (!star) return;
            const index = Number(star.dataset.index);
            const rect = star.getBoundingClientRect();
            const isLeftHalf = (event as MouseEvent).clientX - rect.left < rect.width / 2;
            const value = index - (isLeftHalf ? 0.5 : 0);

            // Clicking the current rating again clears it
            if (value === userRating) {
                onRate(movie, undefined);
            } else {
                // A rated film counts as watched (same rule as the Letterboxd import)
                if (!getUserData().watched.some(item => item.id === movie.id)) onToggleWatched(movie);
                onRate(movie, value);
            }
            open(movie);
        });
        body.querySelector("#modal-clear-rating")?.addEventListener("click", () => {
            onRate(movie, undefined);
            open(movie);
        });
        body.querySelector("#modal-wl")!.addEventListener("click", () => {
            onToggleWatchlist(movie);
            open(movie);
        });
        body.querySelector("#modal-wt")!.addEventListener("click", () => {
            onToggleWatched(movie);
            open(movie);
        });
        overlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    document.getElementById("modal-close")!.addEventListener("click", close);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (isSettingsOpen()) closeSettings();
            else close();
        }
    });

    return { open, close };
}



function starsMarkup(rating: number | undefined) : string {
    let markup = "";
    for (let i = 1; i <= 5; i++) {
        // How much of star i is filled: 0, 0.5 or 1
        const fill = rating === undefined ? 0 : Math.max(0, Math.min(1, rating - (i - 1))) * 100;
        markup += `<span class="star" data-index="${i}"><span class="star-fill" style="width:${fill}%">★</span>★</span>`;
    }
    return markup;
}