import requests
import json

GITHUB_URL = "https://github.com/JTamag/What2Watch/filmes.json"
LOCAL_FILE = "movies.json"

def update_movies():
    try:
        r = requests.get(GITHUB_URL)
        r.raise_for_status()
        with open(LOCAL_FILE, "w", encoding="utf-8") as f:
            f.write(r.text)
        print("Movie list updated successfully.")
        with open(LOCAL_FILE, "r", encoding="utf-8") as f:
            movie_db = json.load(f)

        movie_titles = [movie["title"].lower() for movie in movie_db]

        return movie_db, movie_titles
    except Exception as e:
        print(f"Error updating try to update manually by accessing: {GITHUB_URL}\nError details: {e}")


update_movies()