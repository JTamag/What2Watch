// ── State ──
let allMovies = [];
let watchlist = JSON.parse(localStorage.getItem("watchlist") || "[]");
let watched   = JSON.parse(localStorage.getItem("watched")   || "[]");
let currentSection = "popular";
let searchTimeout = null;


// Load movies
async function loadMovies() {
    try {
        const response = await fetch("./data/movies.json");
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
        if(isInWatchlist(movie.id)) watchlist = watchlist.filter(m => m.id !== movie.id);
        watched.push(movie);
    }
    save();
    refreshCurrentSection();
}

// Build poster card
function buildCard(movie) {
    const card = document.createElement("div");
    card.className = "card";

    const isWL = isInWatchlist(movie.id);
    const isWT = isInWatched(movie.id);
    //////////////////////////////////////////////////// TODO 
    card.innerHTML = `
        <img src="${movie.poster}" alt="${movie.title} poster" loading="lazy"
            onerror="this.style.display='none'">
        <div class="card-content">
            <div class="card-title">${movie.title}</div>
            <div class="card-meta">
                <span>${movie.release_year|| '-'}</span>
                <span class="card-rating">★ ${movie.rating.toFixed(1) || '-'}</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="watchlist-btn ${isWL ? 'active' : ''}" title="${isWL ? 'In Watchlist' : 'Add to Watchlist'}">
                ${isWL ? 'In Watchlist' : 'Add to Watchlist'}
            </button>
            <button class="watched-btn ${isWT ? 'active' : ''}" title="${isWT ? 'Watched' : 'Mark as Watched'}">
                ${isWT ? 'Watched' : 'Mark as Watched'}
            </button>
        </div>
    `;
    /////////////////////////////////////////////////////////
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
// Grid rendering
function renderGrid(gridEl, movies) {
    gridEl.innerHTML = "";
    movies.forEach(movie => {
        gridEl.appendChild(buildCard(movie));
    });
}

// Grid rendering for top-rated
function renderGridTop(gridEl, movies) {
    gridEl.innerHTML = "";
    movies.forEach((movie, index) => {
        gridEl.appendChild(buildCardTop(movie, index + 1));
    });
}
// Build card for top-rated
function buildCardTop(movie,rank = null) {
    const card = document.createElement("div");
    card.className = "card";

    const isWL = isInWatchlist(movie.id);
    const isWT = isInWatched(movie.id);
    card.innerHTML = `
        <img src="${movie.poster}" alt="${movie.title} poster" loading="lazy"
            onerror="this.style.display='none'">
        <div class="card-content">
            ${rank ? `<div class="card-rank">#${rank}</div>` : ''}
            <div class="card-title">${movie.title}</div>
            <div class="card-meta">
                <span>${movie.release_year|| '-'}</span>
                <span class="card-rating">★ ${movie.rating.toFixed(1) || '-'}</span>
            </div>
        </div>
        <div class="card-actions">
            <button class="watchlist-btn ${isWL ? 'active' : ''}" title="${isWL ? 'In Watchlist' : 'Add to Watchlist'}">
                ${isWL ? 'In Watchlist' : 'Add to Watchlist'}
            </button>
            <button class="watched-btn ${isWT ? 'active' : ''}" title="${isWT ? 'Watched' : 'Mark as Watched'}">
                ${isWT ? 'Watched' : 'Mark as Watched'}
            </button>
        </div>
    `;
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
    
    // hide sections
    document.querySelectorAll("main > section").forEach(s => s.classList.add("hidden"));

    // make sure there are no present search results
    const searchResults = document.getElementById("search-results");
    if (searchResults) searchResults.remove();
    if (section === "popular") {
        document.getElementById("popular-section").classList.remove("hidden");
        renderGrid(document.getElementById("popular-grid"), allMovies.filter(m=> m.is_popular));
    }   else if (section === "top-rated") {
        document.getElementById("top-rated-section").classList.remove("hidden");
        renderGridTop(document.getElementById("top-rated-grid"), allMovies.filter(m => m.is_top_rated).sort((a, b) => b.rating - a.rating));
    }   else if (section === "watchlist") {
        document.getElementById("watchlist-section").classList.remove("hidden");
        document.getElementById("watchlist-empty").style.display = watchlist.length  ? "none" : "block";
        renderGrid(document.getElementById("watchlist-grid"), watchlist);
    } else if (section === "watched") {
        document.getElementById("watched-section").classList.remove("hidden");
        document.getElementById("watched-empty").style.display = watched.length  ? "none" : "block";
        renderGrid(document.getElementById("watched-grid"), watched);
    }
}

function refreshCurrentSection() {
    if (currentSection === "recommendations") {
        getRecommendations(); // changes the recommendations based on user interaction
    } else {
        renderSection(currentSection);
    }
}

// Search
function handleSearch(query) {
    const existingResults = document.getElementById("search-results");
    if (existingResults) existingResults.remove();

    if (!query.trim()){
        renderSection(currentSection);
        return;
    }

    const q = query.toLowerCase();
    const results = allMovies.filter(movie => movie.title.toLowerCase().includes(q) || (movie.genres && movie.genres.some(g => g.toLowerCase().includes(q))));

    // hide other sections
    document.querySelectorAll("main > section").forEach(s => s.classList.add("hidden"));
    document.getElementById("recommendations-section").classList.add("hidden");

    const container = document.createElement("section");
    container.id = "search-results";

    const title = document.createElement("h2");
    title.className = "section-title";
    title.innerHTML = `Search results for "<span>${query} - ${results.length} films</span>"`;

    const grid = document.createElement("div");
    grid.className = "grid";

    container.appendChild(title);
    container.appendChild(grid);
    document.querySelector("main").insertBefore(container, document.querySelector(".recommend-bar").nextSibling);

    renderGrid(grid, results);
}

// Modal 
function openModal(movie) {
    const overlay = document.getElementById("modal-overlay");
    const content = overlay.querySelector("#modal-body");
    
    const WT = isInWatched(movie.id);
    const WL = isInWatchlist(movie.id);

    content.innerHTML = ` 
        <div class="modal-layout">
            ${movie.poster ? `<img class="modal-poster" src="${movie.poster}" alt="${movie.title} poster" onerror="this.style.display='none'">` : ''}
            <div class="modal-info">
                <div class = "modal-title">${movie.title}</div>
                <div class="modal-meta">
                    <span>${movie.release_year || '-'}</span>
                    <span class="modal-rating">★ ${movie.rating.toFixed(1) || '-'} / 10</span>
                </div>
                <div class= "modal-genres">
                    ${movie.genres ? movie.genres.map(genre => `<span class="modal-genre">${genre}</span>`).join('') : ''}
                </div>
                <p class="modal-overview">${movie.overview || 'No overview available.'}</p>
                <div class="modal-actions">
                    <button id="modal-wl" class="${WL ? 'active' : ''}">
                        ${WL ? 'In Watchlist' : 'Add to Watchlist'}
                    </button>
                    <button id="modal-wt" class="${WT ? 'active' : ''}">
                        ${WT ? 'Watched' : 'Mark as Watched'}
                    </button>
                </div> 
            </div>
        </div>
    `;

    document.getElementById("modal-wt").addEventListener("click", () => {
        toggleWatched(movie);
        openModal(movie);
    });
    document.getElementById("modal-wl").addEventListener("click", () => {
        toggleWatchlist(movie);
        openModal(movie);
    });
    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}
function closeModal() {
    const modalOverlay = document.getElementById("modal-overlay")
    const modalContent = document.getElementById("modal");
    if(modalContent) {
        modalContent.scrollTo({ top: 0, behavior: "instant" });
    }
    modalOverlay.classList.add("hidden");
    document.body.style.overflow = "";
}

// settings menu
function openSettings(){
    document.getElementById("watched-count").textContent = `Watched: ${watched.length} films`;
    document.getElementById("watchlist-count").textContent = `Watchlist: ${watchlist.length} films`;
    document.getElementById("settings-overlay").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}
function closeSettings(){
    document.getElementById("settings-overlay").classList.add("hidden");
    document.body.style.overflow = "";
}

// Events
document.querySelectorAll("nav button").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("search-input").value = "";
        renderSection(btn.dataset.section);
    });
});
document.getElementById("recommend-btn").addEventListener("click", getRecommendations);

document.getElementById("search-input").addEventListener("input", e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => handleSearch(e.target.value), 300);
});

// specific events to close modal

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-overlay")) closeModal();
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        if (!document.getElementById("settings-overlay").classList.contains("hidden")) {
            closeSettings();
        } else {
            closeModal();
        }
    }
});

// settings events
document.getElementById("settings-btn").addEventListener("click", openSettings);
document.getElementById("settings-close").addEventListener("click", closeSettings);
document.getElementById("settings-overlay").addEventListener("click", e => {
    if (e.target === document.getElementById("settings-overlay")) closeSettings();
});

document.getElementById("export-btn").addEventListener("click", exportData);
document.getElementById("import-btn").addEventListener("click", () => document.getElementById("import-input").click());
document.getElementById("import-input").addEventListener("change", e => {
    if(e.target.files[0]) {
        importData(e.target.files[0]);
        e.target.value = "";
    }
});

// Import files
function importData(file) {
    const reader = new FileReader();
    reader.onload  = function(event) {
        try {
            const data = JSON.parse(event.target.result);

            let currentWL=JSON.parse(localStorage.getItem("watchlist") || "[]");
            let currentWT=JSON.parse(localStorage.getItem("watched")   || "[]");

            if (data.watchlist ) {
                data.watchlist.forEach(movie => {
                    if (!currentWL.some(m => m.id === movie.id)) {
                        currentWL.push(movie);
                    }
                });
            }
            if(data.watched) {
                data.watched.forEach(movie => {
                    if (!currentWT.some(m => m.id === movie.id)) {
                        currentWT.push(movie);
                    }
                });
            }


            if (data.watchlist ) localStorage.setItem("watchlist",JSON.stringify(currentWL));
            if (data.watched   ) localStorage.setItem("watched",  JSON.stringify(currentWT));
            
            watchlist = currentWL;
            watched   = currentWT;
            
            alert("Data imported successfully!");
            refreshCurrentSection();
        } catch (error) {
            alert("Invalid file format. Please select a valid JSON file.");
             console.error("Error parsing JSON:", error);
        }
    }
    reader.readAsText(file);
}


/// STILL NEED TO DO TMDB REQUEST OR OTHER OPTIONS TO GET MOVIE IDS 
/// thinking how to do this rn
async function importLetterboxd(file) {
    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        const lines = text.split("\n");

        let imported = 0;
        let localMatches = 0;
        let apiMatches = 0;
        let failed = 0;
        
        for(let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",");

            const title = cols[0].trim();
            const year = cols[1].trim();

            if(!title) continue;

            imported++;

            let match = findLocalMatch(title, year);
            if(!match){
                try{ 
                    ///
                } catch(e) {
                    console.error(`Error searching TMDB for "${title} (${year})":`, e);
                }
            } else {
                localMatches++;
            }

            // not actually working ofc
        }
        save();
        refreshCurrentSection();

        alert(`Import complete! ${imported} entries processed.\n${localMatches} matched locally, ${apiMatches} matched via API, ${failed} failed.`);
    }
}

// Auxiliary functions to match existing movies in the database and look for new ones
function normalizeTitle(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function findLocalMatch(title, year) {
    return allMovies.find(movie => 
        normalizeTitle(movie.title) === normalizeTitle(title) &&
        String(movie.release_year) === String(year)
    );
}
async function searchTMDB(title, year) {
    // TODO
}
// // Export files
function exportData() {
    const data = {
        watchlist : JSON.parse(localStorage.getItem("watchlist") || "[]"),
        watched   : JSON.parse(localStorage.getItem("watched")   || "[]")
    };

    const jsonStr = JSON.stringify(data, null, 2);

    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "what2watch_personal_data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

//////////// Recommendations
function getRecommendations() {
    currentSection = "recommendations";
    // watched -> 2 ; watchlist ->1
    const userMovies = [
        ...watched.map(m=>({...m, weight:2})),
        ...watchlist.map(m=>({...m, weight:1})) // posso colocar 1.5?
    ];


    //// maybe add a prepare_rendering function
    // hide sections
    document.querySelectorAll("main > section").forEach(s => s.classList.add("hidden"));

    // make sure there are no present search results
    const searchResults = document.getElementById("search-results");
    if (searchResults) searchResults.remove();

    document.getElementById("recommendations-section").classList.remove("hidden");

    if(userMovies.length === 0){
        renderRecommendationsEmpty("Add films to your Watchlist or films that you've watched to get personalised recommendations.");
        return;
    }

    // weighed sums of genres 
    const genreCounts = {};
    let totalGenreWeight = 0;
    userMovies.forEach(({genres,weight}) => {
        (genres || []).forEach(g=> {
            genreCounts[g] = (genreCounts[g] || 0) + weight;
            totalGenreWeight += weight;
        });
    });
    const genreAffinityy = {};
    Object.keys(genreCounts).forEach(g => {
        genreAffinityy[g] = genreCounts[g] / totalGenreWeight;
    });


    // Era
    const  weightSum = userMovies.reduce((s,m) => s +m.weight,0);
    const avgYear = userMovies.reduce((s,m) => s + (m.release_year || 2000)*m.weight,0)/weightSum; // fallback using the year 2000

    // Exclude movies that were previously watched
    const excludeIds = new Set(watched.map(m=>m.id));
    const candidates = allMovies.filter(m => !excludeIds.has(m.id));

    // Movie scores
    const scored = candidates.map(movie => {
        const genreRaw = (movie.genres || []).reduce((s,g)=>
        s + (genreAffinityy[g] || 0 ),0);

        const ratingScore = (movie.rating || 0) / 10;

        const yearScore = Math.exp(-Math.abs((movie.release_year || 2000)- avgYear)/20);

        //Presence in top-rated
        const bonus = movie.is_top_rated ? 1:0;
        return {movie,genreRaw,ratingScore,yearScore,bonus};
    });

    const maxGenre = Math.max(...scored.map(s => s.genreRaw),1e-6);

    const results  =scored.map(({movie,genreRaw,ratingScore,yearScore,bonus})=> ({
        ...movie,
        _score:
            (genreRaw/maxGenre) * 0.50 +
            ratingScore * 0.35 +
            yearScore * 0.1 + 
            bonus * 0.05
    })).sort((a, b) => b._score - a._score).slice(0, 20);
    const topGenres = Object.entries(genreAffinityy).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([g])=>g)
    renderRecommendations(results, topGenres);
}
function renderRecommendations(movies, topGenres = []){
    const section = document.getElementById("recommendations-section");

    section.innerHTML = `
    <div class = "recommendations-header">
        <h2 class= "section-title">Recommended for You</h2>
        ${topGenres.length ? `
            <p class = "recommendations-sub">
                Based on your taste in
                ${topGenres.map(g=> `<span class = "genre-tag">${g}</span>`).join("")}
                </p>`:""}
    </div>
    <div class = "grid" id = "recommendations-grid"></div>
    `;
    const grid = section.querySelector("#recommendations-grid");

    movies.forEach(movie => {
        const card = buildCard(movie);

        const matchedGenres = (movie.genres || []).filter(g=>topGenres.includes(g));
        if(matchedGenres.length>0){
            const badge = document.createElement("div");
            badge.className ="rec-badge";
            badge.textContent = matchedGenres.slice(0,2).join(" · ");
            card.querySelector(".card-content").appendChild(badge);
        }
        grid.appendChild(card);
    });
}
function renderRecommendationsEmpty(message){
    document.getElementById("recommendations-section").innerHTML = 
    `
    <h2 class= "section-title">Recommended for You</h2>
    <p class = "empty-message">${message}</p>
    `;
}
// Init
loadMovies();