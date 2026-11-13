"""TMDB scraper for What2Watch.

Builds public/data/movies.json from three sources and enriches each movie with:
  1. /movie/popular
  2. /movie/top_rated (with a minimum vote count)
  3. /discover/movie per genre, sorted by vote count (this is what adds breadth)
  4. /discover/movie popularity and vote-average pools
  5. /discover/movie decade pools for older and niche films

Detail responses are cached by TMDB ID so later runs only fetch new movies.
"""
import json
import math
import os
import sys
import time
from datetime import datetime

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

API_KEY = os.environ.get("TMDB_API_KEY")
BASE_URL = "https://api.themoviedb.org/3"
IMAGE_URL = "https://image.tmdb.org/t/p/w500"
OUTPUT = "public/data/movies.json"
DETAILS_CACHE = "data/details-cache.json"

# ---- Tuning knobs -------------------------------------------------------
POPULAR_PAGES = 25          # 20 movies per page
TOP_RATED_PAGES = 25
TOP_RATED_MIN_VOTES = 1000
GENRE_PAGES = 12            # discover pages per genre
GENRE_MIN_VOTES = 250       # keeps very obscure/low-signal titles out
LONG_TAIL_PAGES = 30
LONG_TAIL_MIN_VOTES = 100
DECADE_PAGES = 3
MAX_MOVIES = 5000           # hard cap on the final catalogue size
MIN_CATALOGUE_SIZE = 4000   # fail rather than silently publishing a thin catalogue
MIN_EXPECTED_RATIO = 0.5    # abort if the new catalogue is < 50% of the old one
REQUEST_DELAY = 0.05        # ~20 req/s at most, well under TMDB's soft ceiling
DETAILS_CAST_LIMIT = 5


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
        "popularity": movie.get("popularity",0),
        "vote_count": movie.get("vote_count", 0),
        "keywords": [],
        "director": None,
        "cast": [],
        "original_language": movie.get("original_language", ""),
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

    add(fetch_list(
        session,
        "/discover/movie",
        LONG_TAIL_PAGES,
        genres_map,
        min_votes=LONG_TAIL_MIN_VOTES,
        sort_by="popularity.desc",
        include_adult="false",
        **{"vote_count.gte": LONG_TAIL_MIN_VOTES},
    ))

    current_year = datetime.utcnow().year
    for start_year in range(1930, current_year + 1, 10):
        end_year = min(start_year + 9, current_year)
        add(fetch_list(
            session,
            "/discover/movie",
            DECADE_PAGES,
            genres_map,
            min_votes=LONG_TAIL_MIN_VOTES,
            sort_by="vote_average.desc",
            include_adult="false",
            **{
                "vote_count.gte": LONG_TAIL_MIN_VOTES,
                "primary_release_date.gte": f"{start_year}-01-01",
                "primary_release_date.lte": f"{end_year}-12-31",
            },
        ))

    return list(catalogue.values())[:MAX_MOVIES]


def load_details_cache():
    try:
        with open(DETAILS_CACHE, encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("details cache must be an object")
        return data
    except (OSError, ValueError):
        return {}


def save_details_cache(cache):
    os.makedirs(os.path.dirname(DETAILS_CACHE), exist_ok=True)
    tmp = DETAILS_CACHE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    os.replace(tmp, DETAILS_CACHE)


def enrich_catalogue(session, movies):
    cache = load_details_cache()
    changed = False

    for movie in movies:
        cache_key = str(movie["id"])
        details = cache.get(cache_key)
        if details is None:
            details = tmdb_get(
                session,
                f"/movie/{movie['id']}",
                append_to_response="credits,keywords",
            )
            cache[cache_key] = details
            save_details_cache(cache)
            changed = True

        keywords = details.get("keywords", {}).get("keywords", [])
        crew = details.get("credits", {}).get("crew", [])
        cast = details.get("credits", {}).get("cast", [])
        directors = [
            person.get("name")
            for person in crew
            if person.get("job") == "Director" and person.get("name")
        ]
        movie["keywords"] = [
            keyword["name"]
            for keyword in keywords
            if keyword.get("name")
        ]
        movie["director"] = directors[0] if directors else None
        movie["cast"] = [
            person["name"]
            for person in cast[:DETAILS_CAST_LIMIT]
            if person.get("name")
        ]
        movie["original_language"] = details.get(
            "original_language",
            movie.get("original_language", ""),
        )

    if changed:
        save_details_cache(cache)
    return movies


def validate_catalogue(movies):
    ids = set()
    required_fields = ("id", "title", "overview", "poster", "rating", "vote_count", "popularity", "genres")
    for movie in movies:
        missing = [field for field in required_fields if field not in movie]
        if missing:
            raise ValueError(f"Movie {movie.get('id', '<unknown>')} is missing fields: {', '.join(missing)}")
        if movie["id"] in ids:
            raise ValueError(f"Duplicate movie ID: {movie['id']}")
        ids.add(movie["id"])
        if not isinstance(movie["id"], int) or not isinstance(movie["title"], str):
            raise ValueError(f"Invalid identity fields for movie {movie['id']}")
        if not math.isfinite(float(movie["rating"])) or float(movie["vote_count"]) < 0:
            raise ValueError(f"Invalid rating or vote count for movie {movie['id']}")
        if not isinstance(movie["genres"], list):
            raise ValueError(f"Invalid genres for movie {movie['id']}")
    if not movies:
        raise ValueError("Movie catalogue is empty")
    if len(movies) < MIN_CATALOGUE_SIZE:
        raise ValueError(
            f"Movie catalogue has only {len(movies)} movies; "
            f"expected at least {MIN_CATALOGUE_SIZE}"
        )


def print_coverage(movies):
    decades = {}
    genres = {}
    vote_buckets = {"0-99": 0, "100-499": 0, "500-999": 0, "1000+": 0}
    for movie in movies:
        year = str(movie.get("release_year") or "")
        if len(year) == 4 and year.isdigit():
            decade = f"{year[:3]}0s"
            decades[decade] = decades.get(decade, 0) + 1
        for genre in movie.get("genres", []):
            genres[genre] = genres.get(genre, 0) + 1
        votes = int(movie.get("vote_count", 0))
        if votes < 100:
            vote_buckets["0-99"] += 1
        elif votes < 500:
            vote_buckets["100-499"] += 1
        elif votes < 1000:
            vote_buckets["500-999"] += 1
        else:
            vote_buckets["1000+"] += 1

    print(f"Catalogue coverage: {len(movies)} movies")
    print(f"Decades: {dict(sorted(decades.items()))}")
    print(f"Vote-count buckets: {vote_buckets}")
    print(f"Genres: {dict(sorted(genres.items(), key=lambda item: (-item[1], item[0])))}")


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

    session = make_session()
    movies = build_catalogue(session)
    enrich_catalogue(session, movies)
    validate_catalogue(movies)
    print_coverage(movies)

    old = previous_count()
    if old and len(movies) < old * MIN_EXPECTED_RATIO:
        sys.exit(f"Refusing to overwrite: got {len(movies)} movies, previously {old}")

    save_movies(movies)


if __name__ == "__main__":
    main()