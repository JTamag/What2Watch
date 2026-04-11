import requests 
import json 
import os 

API_KEY = os.environ.get("TMDB_API_KEY")

BASE_URL = "https://api.themoviedb.org/3"
IMAGE_URL = "https://image.tmdb.org/t/p/w500"

def get_genres():
    url = f"{BASE_URL}/genre/movie/list?api_key={API_KEY}&language=en-US"
    response = requests.get(url)
    genres = response.json()["genres"]
    return {genre["id"]: genre["name"] for genre in genres}

def get_movies(endpoint, pages, genres_map, source, min_votes=0):
    movies = []
    for page in range(1, pages + 1):
        url = f"{BASE_URL}/movie/{endpoint}?api_key={API_KEY}&language=en-US&page={page}"
        response = requests.get(url)
        results = response.json()["results"]

        for movie in results:
            if not movie.get("poster_path"):
                continue
            if movie["vote_count"] < min_votes:
                continue
            movies.append({
                "id": movie["id"],
                "title": movie["title"],
                "overview": movie["overview"],
                "poster": IMAGE_URL + movie["poster_path"],
                "rating": movie["vote_average"],
                "release_year": movie["release_date"][:4] if movie["release_date"] else None,
                "genres": [genres_map[g] for g in movie["genre_ids"] if g in genres_map],
                "source": source
            })
    return movies

def save_movies(movies):
    os.makedirs("data", exist_ok=True)
    with open("data/movies.json", "w", encoding="utf-8") as f:
        json.dump(movies, f, ensure_ascii=False, indent=2)
    print(f"Saved {len(movies)} movies to data/movies.json")

if __name__ == "__main__":
    genres_map = get_genres()

    popular    = get_movies("popular", pages=15, genres_map=genres_map,source="popular")
    top_rated  = get_movies("top_rated", pages=15, genres_map=genres_map, source="top_rated", min_votes=1000)

    seen = set()
    all_movies = []
    for movie in popular + top_rated :
        if movie["id"] not in seen:
            seen.add(movie["id"])
            all_movies.append(movie)

    save_movies(all_movies)
