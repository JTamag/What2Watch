import { renderMovieGrid } from "./cards";
import { Movie, MovieWithReasons, UserData,PaginationState } from "../types";

const PAGE_SIZE = 36;

export function createViews({ getMovies, getUserData, onToggleWatchlist, onToggleWatched, onOpenMovie, onRecommendations, onSurprise }:{
    getMovies: () => Movie[];
    getUserData: () => UserData;
    onToggleWatchlist: (movie: Movie) => void;
    onToggleWatched: (movie: Movie) => void;
    onOpenMovie: (movie: Movie) => void;
    onRecommendations: () => void;
    onSurprise: () => void;
}) {
    const pagination = new WeakMap<HTMLElement, PaginationState>();
    let currentSection = "popular";
    let searchTimer : ReturnType<typeof setTimeout> | undefined;

    function hideSections() {
        document.querySelectorAll("main > section").forEach(section => section.classList.add("hidden"));
    }

    function removeSearchResults() {
        document.getElementById("search-results")?.remove();
    }

    function renderPaginatedGrid(grid: HTMLElement, movies: MovieWithReasons[], options: Record<string, unknown> = {}) {
        let state = pagination.get(grid);
        if (!state) {
            const controls = document.createElement("div");
            controls.className = "pagination";
            controls.innerHTML = '<button type="button" class="page-prev">Previous</button><div class="page-numbers"></div><span class="page-info"></span><button type="button" class="page-next">Next</button>';
            grid.after(controls);
            const newState = { page: 1, movies: [], options, controls };
            pagination.set(grid, newState);
            state = newState;
            (controls.querySelector(".page-prev") as HTMLButtonElement).addEventListener("click", () => { newState.page--; renderPage(grid, newState); });
            (controls.querySelector(".page-next") as HTMLButtonElement).addEventListener("click", () => { newState.page++; renderPage(grid, newState); });
        }
        state.movies = movies;
        state.options = options;
        renderPage(grid, state);
    }

    function renderPage(grid: HTMLElement, state: PaginationState) {
        const pageCount = Math.max(1, Math.ceil(state.movies.length / PAGE_SIZE));
        state.page = Math.min(Math.max(state.page, 1), pageCount);
        const start = (state.page - 1) * PAGE_SIZE;
        renderMovieGrid(grid, state.movies.slice(start, start + PAGE_SIZE), {
            getUserData,
            onToggleWatchlist,
            onToggleWatched,
            onOpenMovie,
            rankOffset: start,
            ...state.options
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
        (state.controls.querySelector(".page-info") as HTMLElement).textContent = `Page ${state.page} of ${pageCount}`;
        (state.controls.querySelector(".page-prev") as HTMLButtonElement).disabled = state.page === 1;
        (state.controls.querySelector(".page-next") as HTMLButtonElement).disabled = state.page === pageCount;
        state.controls.hidden = state.movies.length <= PAGE_SIZE;

        const numbers = state.controls.querySelector(".page-numbers") as HTMLElement;
        numbers.innerHTML = "";
        const pages = pageCount <= 5
            ? Array.from({ length: pageCount }, (_, index) => index + 1)
            : [1, ...new Set([Math.max(2, Math.min(state.page - 1, pageCount - 3)), Math.max(2, Math.min(state.page - 1, pageCount - 3)) + 1, Math.max(2, Math.min(state.page - 1, pageCount - 3)) + 2]), pageCount];
        let last = 0;
        for (const page of pages) {
            if (page - last > 1) {
                const dots = document.createElement("span");
                dots.className = "page-ellipsis";
                dots.textContent = "…";
                numbers.appendChild(dots);
            }
            const button = document.createElement("button");
            button.type = "button";
            button.className = "page-number";
            button.textContent = String(page);
            button.disabled = page === state.page;
            if (button.disabled) button.setAttribute("aria-current", "page");
            button.addEventListener("click", () => { state.page = page; renderPage(grid, state); });
            numbers.appendChild(button);
            last = page;
        }
    }

    function renderSection(section:string) {
        currentSection = section;
        hideSections();
        removeSearchResults();
        const movies = getMovies();
        if (section === "recommendations") {
            onRecommendations();
        } else if (section === "popular") {
            document.getElementById("popular-section")!.classList.remove("hidden");
            renderPaginatedGrid(document.getElementById("popular-grid")!, movies.filter(movie => movie.is_popular).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)));
        } else if (section === "top-rated") {
            document.getElementById("top-rated-section")!.classList.remove("hidden");
            renderPaginatedGrid(document.getElementById("top-rated-grid")!, movies.filter(movie => movie.is_top_rated).sort((a, b) => b.rating - a.rating), { showRanks: true });
        } else if (section === "watchlist" || section === "watched") {
            document.getElementById(`${section}-section`)!.classList.remove("hidden");
            const list = getUserData()[section as 'watchlist' | 'watched'];
            document.getElementById(`${section}-empty`)!.style.display = list.length ? "none" : "block";
            renderPaginatedGrid(document.getElementById(`${section}-grid`)!, list);
        }
    }

    function refreshCurrentSection() {
        if (currentSection === "recommendations") onRecommendations();
        else renderSection(currentSection);
    }

    function showRecommendations(movies: MovieWithReasons[], topGenres: string[]) {
        currentSection = "recommendations";
        hideSections();
        removeSearchResults();
        const section = document.getElementById("recommendations-section")!;
        section.classList.remove("hidden");
        section.innerHTML = '<div class="recommendations-header"><h2 class="section-title">Recommended for You</h2><p class="recommendations-sub"></p></div><div class="grid" id="recommendations-grid"></div>';
        section.querySelector(".recommendations-sub")!.textContent = topGenres.length ? `Based on your taste in ${topGenres.join(", ")}` : "";
        renderPaginatedGrid(section.querySelector("#recommendations-grid") as HTMLElement, movies, { topGenres });
    }

    function showRecommendationsEmpty(message : string) {
        currentSection = "recommendations";
        hideSections();
        removeSearchResults();
        const section = document.getElementById("recommendations-section")!;
        section.classList.remove("hidden");
        section.innerHTML = '<h2 class="section-title">Recommended for You</h2><p class="empty-message"></p>';
        section.querySelector(".empty-message")!.textContent = message;
    }

    function handleSearch(query:string) {
        removeSearchResults();
        if (!query.trim()) {
            if (currentSection === "recommendations") onRecommendations();
            else renderSection(currentSection);
            return;
        }
        hideSections();
        const normalized = query.toLowerCase();
        const results = getMovies().filter(movie => movie.title.toLowerCase().includes(normalized) || (movie.genres || []).some(genre => genre.toLowerCase().includes(normalized)));
        const section = document.createElement("section");
        section.id = "search-results";
        const title = document.createElement("h2");
        title.className = "section-title";
        title.textContent = `Search results for “${query}” · ${results.length} films`;
        const grid = document.createElement("div");
        grid.className = "grid";
        section.append(title, grid);
        document.querySelector("main")!.insertBefore(section, document.querySelector(".recommend-bar")!.nextSibling);
        renderPaginatedGrid(grid, results);
    }

    function init() {
        document.querySelectorAll<HTMLButtonElement>("nav button").forEach(button => button.addEventListener("click", () => {
            document.querySelectorAll("nav button").forEach(item => item.classList.toggle("active", item === button));
            (document.getElementById("search-input") as HTMLInputElement)!.value = "";
            renderSection(button.dataset.section ?? "popular");
        }));
        document.getElementById("recommend-btn")!.addEventListener("click", onRecommendations);
        document.getElementById("surprise-btn")!.addEventListener("click", onSurprise);
        document.getElementById("search-input")!.addEventListener("input", event => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => handleSearch((event.target as HTMLInputElement).value), 300);
        });
    }

    return { init, renderSection, refreshCurrentSection, showRecommendations, showRecommendationsEmpty };
}
