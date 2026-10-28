"""TMDB scraper for What2Watch.

Builds data/movies.json from three sources:
  1. /movie/popular
  2. /movie/top_rated (with a minimum vote count)
  3. /discover/movie per genre, sorted by vote count (this is what adds breadth)

Output schema is unchanged, so app.js keeps working.
"""
import json
import os
import sys
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API_KEY = os.environ.get("TMDB_API_KEY")
BASE_URL = "https://api.themoviedb.org/3"
IMAGE_URL = "https://image.tmdb.org/t/p/w500"
OUTPUT = "data/movies.json"

# ---- Tuning knobs -------------------------------------------------------
POPULAR_PAGES = 15          # 20 movies per page
TOP_RATED_PAGES = 15
TOP_RATED_MIN_VOTES = 1000
GENRE_PAGES = 5             # discover pages per genre
GENRE_MIN_VOTES = 500       # keeps obscure/low-signal titles out
MAX_MOVIES = 2500           # hard cap on the final catalogue size
MIN_EXPECTED_RATIO = 0.5    # abort if the new catalogue is < 50% of the old one
REQUEST_DELAY = 0.05        # ~20 req/s at most, well under TMDB's soft ceiling


def make_session():
    """Session with connection reuse and automatic retry/backoff on 429/5xx."""
    session = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
        respect_retry_after_header=True,
    )
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


def tmdb_get(session, path, **params):
    params.update(api_key=API_KEY, language="en-US")
    response = session.get(f"{BASE_URL}{path}", params=params, timeout=15)
    response.raise_for_status()
    time.sleep(REQUEST_DELAY)
    return response.json()


def get_genres(session):
    data = tmdb_get(session, "/genre/movie/list")
    return {genre["id"]: genre["name"] for genre in data["genres"]}


def to_record(movie, genres_map):
    """Convert a TMDB result to our schema, or None if it should be skipped."""
    poster = movie.get("poster_path")
    if not poster:
        return None
    release = movie.get("release_date") or ""
    return {
        "id": movie["id"],
        "title": movie["title"],
        "overview": movie.get("overview", ""),
        "poster": IMAGE_URL + poster,
        "rating": movie.get("vote_average", 0),
        "release_year": release[:4] or None,
        "genres": [genres_map[g] for g in movie.get("genre_ids", []) if g in genres_map],
        "is_popular": False,
        "is_top_rated": False,
    }


def fetch_list(session, path, pages, genres_map, min_votes=0, **params):
    """Fetch up to `pages` pages from a list endpoint."""
    records = []
    for page in range(1, pages + 1):
        data = tmdb_get(session, path, page=page, **params)
        for movie in data.get("results", []):
            if movie.get("vote_count", 0) < min_votes:
                continue
            record = to_record(movie, genres_map)
            if record:
                records.append(record)
        if page >= data.get("total_pages", page):
            break
    return records


def build_catalogue(session):
    genres_map = get_genres(session)
    catalogue = {}  # id -> record (insertion order = priority order)

    def add(records, flag=None):
        for record in records:
            existing = catalogue.setdefault(record["id"], record)
            if flag:
                existing[flag] = True

    add(fetch_list(session, "/movie/popular", POPULAR_PAGES, genres_map), "is_popular")
    add(
        fetch_list(session, "/movie/top_rated", TOP_RATED_PAGES, genres_map,
                   min_votes=TOP_RATED_MIN_VOTES),
        "is_top_rated",
    )

    # Page-major loop: if MAX_MOVIES truncates the list, every genre loses its
    # deepest pages equally instead of the last genres disappearing entirely.
    for page in range(1, GENRE_PAGES + 1):
        for genre_id in genres_map:
            data = tmdb_get(
                session, "/discover/movie",
                with_genres=genre_id,
                sort_by="vote_count.desc",
                **{"vote_count.gte": GENRE_MIN_VOTES},
                include_adult="false",
                page=page,
            )
            for movie in data.get("results", []):
                record = to_record(movie, genres_map)
                if record:
                    add([record])

    return list(catalogue.values())[:MAX_MOVIES]


def previous_count():
    try:
        with open(OUTPUT, encoding="utf-8") as f:
            return len(json.load(f))
    except (OSError, ValueError):
        return 0


def save_movies(movies):
    movies = sorted(movies, key=lambda m: m["id"])  # stable order = clean git diffs
    # One compact record per line: small file, still readable in git diffs.
    body = ",\n".join(json.dumps(m, ensure_ascii=False, separators=(",", ":")) for m in movies)
    text = f"[\n{body}\n]\n"

    try:
        with open(OUTPUT, encoding="utf-8") as f:
            if f.read() == text:
                print("No changes, movies.json left untouched.")
                return
    except OSError:
        pass

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    tmp = OUTPUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, OUTPUT)  # atomic: a crash never leaves a half-written file
    print(f"Saved {len(movies)} movies to {OUTPUT} ({len(text) / 1024:.0f} KB)")


def main():
    if not API_KEY:
        sys.exit("TMDB_API_KEY is not set")

    movies = build_catalogue(make_session())

    old = previous_count()
    if old and len(movies) < old * MIN_EXPECTED_RATIO:
        sys.exit(f"Refusing to overwrite: got {len(movies)} movies, previously {old}")

    save_movies(movies)


if __name__ == "__main__":
    main()