export function createModalController({ getUserData, onToggleWatchlist, onToggleWatched, isSettingsOpen, closeSettings }) {
    const overlay = document.getElementById("modal-overlay");

    function close() {
        overlay.classList.add("hidden");
        document.body.style.overflow = "";
        document.getElementById("modal").scrollTo({ top: 0, behavior: "instant" });
    }

    function open(movie) {
        const data = getUserData();
        const inWatchlist = data.watchlist.some(item => item.id === movie.id);
        const isWatched = data.watched.some(item => item.id === movie.id);
        const body = overlay.querySelector("#modal-body");
        body.innerHTML = `
            <div class="modal-layout">
                ${movie.poster ? `<img class="modal-poster" src="${movie.poster}" alt="${movie.title} poster" onerror="this.style.display='none'">` : ""}
                <div class="modal-info">
                    <div class="modal-title"></div>
                    <div class="modal-meta"><span>${movie.release_year || "-"}</span><span class="modal-rating">★ ${(Number(movie.rating) || 0).toFixed(1)} / 10</span></div>
                    <div class="modal-genres">${(movie.genres || []).map(genre => `<span class="modal-genre"></span>`).join("")}</div>
                    <p class="modal-overview"></p>
                    <div class="modal-actions">
                        <button id="modal-wl" class="${inWatchlist ? "active" : ""}">${inWatchlist ? "In Watchlist" : "Add to Watchlist"}</button>
                        <button id="modal-wt" class="${isWatched ? "active" : ""}">${isWatched ? "Watched" : "Mark as Watched"}</button>
                    </div>
                </div>
            </div>`;
        body.querySelector(".modal-title").textContent = movie.title;
        body.querySelector(".modal-overview").textContent = movie.overview || "No overview available.";
        body.querySelectorAll(".modal-genre").forEach((element, index) => {
            element.textContent = movie.genres[index];
        });
        body.querySelector("#modal-wl").addEventListener("click", () => {
            onToggleWatchlist(movie);
            open(movie);
        });
        body.querySelector("#modal-wt").addEventListener("click", () => {
            onToggleWatched(movie);
            open(movie);
        });
        overlay.classList.remove("hidden");
        document.body.style.overflow = "hidden";
    }

    document.getElementById("modal-close").addEventListener("click", close);
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
