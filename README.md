# What2Watch

A client-side movie discovery, recommendation, and tracking web application built with vanilla JavaScript, powered by a daily-updated movie dataset from [The Movie Database (TMDB)](https://www.themoviedb.org/).

**[Live Demo](https://jtamag.github.io/What2Watch/)** · **[Source Code](https://github.com/JTamag/What2Watch)**

## Features

### Movie Discovery & Browsing

- **Popular Films:** Browse a regularly updated catalogue of popular movies.
- **Top Rated:** Explore highly rated films ranked by TMDB score, with a minimum vote-count threshold.
- **Movie Cards:** View posters, release years, ratings, genres, and quick-action buttons.
- **Movie Details:** Open a detailed modal with movie metadata, overviews, and ratings, with support for Escape-key and backdrop-click dismissal.

### Personalised Recommendation Engine

Generates personalised recommendations using your watchlist and watched history.

- **Genre Affinity (50%):** Analyses your genre preferences, assigning a weight of 2.5 to watchlist titles and 1.5 to watched titles.
- **TMDB Rating (35%):** Factors in user ratings to favour highly rated films.
- **Release-Era Proximity (10%):** Uses exponential decay to account for how closely a film's release year matches your preferred era.
- **Top-Rated Bonus (5%):** Gives an additional boost to films included in the top-rated catalogue.
- **Smart Filtering:** Excludes films you have already watched.
- **Taste Breakdown:** Highlights your leading genre preferences and matching tags on recommendation cards.
- **Personalised Feed:** Generates a ranked selection of 20 recommendations from the available catalogue.

### Surprise Me!

- Picks a random film and opens its details.
- Prioritises your watchlist, falling back to popular films when your watchlist is empty.

### Watchlist & Watched History

- **Watchlist:** Save films to watch later while preventing duplicate entries.
- **Watched History:** Track films you've seen; marking a film as watched automatically removes it from your watchlist.
- **Persistent Storage:** Saves your lists in browser `localStorage`, retaining them across sessions on the same browser.
- **Empty States:** Provides contextual guidance when your lists are empty.

### Search & Filtering

- Search by movie title and genre keywords, with a 300 ms debounce.
- Display matching results and result counts dynamically.
- Preserve the previous browsing state when leaving search results.

### Data Portability & Letterboxd Import

- **JSON Export / Import:** Back up and restore personal data using `what2watch_personal_data.json`, with deduplication and merge logic.
- **Letterboxd CSV Import:** Import supported Letterboxd exports, including watchlist, watched history, and ratings files.
  - Detects the target list based on the imported filename.
  - Matches titles and release years against the local movie catalogue using title normalisation.
  - Reports processed, matched, and unmatched entries.
- **Settings:** View film counters and manage import and export operations in one place.

### Automated Movie Dataset Pipeline

- **Python Scraper:** Fetches up to 15 pages each of popular and top-rated movies from TMDB, applying a minimum vote threshold of 1,000 and deduplicating records.
- **Data Processing:** Normalises movie metadata and genre information into a structured JSON dataset.
- **GitHub Actions:** Automatically refreshes `data/movies.json` daily at 06:00 UTC, with support for manual workflow dispatch.
- **Static Deployment:** Updates the dataset without requiring a separate backend or frontend build process.

## Data Flow

```text
                    TMDB API
                        |
                        v
                 Python Scraper
                        |
                        v
                 data/movies.json
                        |
                        v
              Frontend (JavaScript)
                        |
             +----------+-----------+
             |          |           |
             v          v           v
          Browsing    Search   Recommendations
                                    ^
                                    |
                              localStorage
                              /          \
                         Watchlist      Watched

                 JSON / Letterboxd
                   Import & Export

          Scheduled updates via GitHub Actions
```

## Tech Stack

| Component | Technologies |
|---|---|
| Frontend | Vanilla JavaScript (ES6+), HTML5, CSS3 |
| Styling | CSS Variables, Flexbox, CSS Grid |
| Data & Ingestion | Python 3, Requests, TMDB API |
| Automation | GitHub Actions |
| Client-Side Storage | Browser `localStorage` |
| Data Formats | JSON, CSV |
| Hosting | GitHub Pages |
| Typography | Bebas Neue, DM Sans |

## Local Development

### Prerequisites

- Python 3 for the local HTTP server and optional scraper.
- A modern web browser.
- A TMDB API key only if running the data scraper manually.

### 1. Clone the repository

```bash
git clone https://github.com/JTamag/What2Watch.git
cd What2Watch
```

### 2. Run the application

The frontend loads `data/movies.json` using the Fetch API, so serve the project over HTTP rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

Alternatively, with Node.js installed:

```bash
npx serve . -l 8000
```

### 3. Run the scraper (optional)

Install the Python dependency:

```bash
python -m pip install requests
```

Set your TMDB API key as an environment variable.

**Linux / macOS**

```bash
export TMDB_API_KEY="your_api_key_here"
python scraper/scraper.py
```

**Windows PowerShell**

```powershell
$env:TMDB_API_KEY = "your_api_key_here"
python scraper/scraper.py
```

The scraper updates `data/movies.json`. Do not commit API credentials to the repository.

## Credits & Attribution

Movie metadata and ratings are provided by [The Movie Database (TMDB)](https://www.themoviedb.org/).

This product uses the TMDB API but is not endorsed or certified by TMDB.

See the [TMDB API documentation](https://developer.themoviedb.org/docs) for more information about the data source.