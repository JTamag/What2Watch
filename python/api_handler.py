import os
import requests
from dotenv import load_dotenv
import json
from update import update_movies

JSON = "movies.json"
USERFILE = "user_data.json"


load_dotenv()
API_KEY = os.getenv("OMDB_API_KEY")
url = "http://www.omdbapi.com/"


def movie_info(movie_title):

    if not API_KEY:
        print("API_KEY error")
        return None


    params = {
            "apikey": API_KEY,
            "t": movie_title,
            "type": "movie" 
        }
    
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get("Response") == "False":
            print(f"ERROR")
            return None
        
        movie_info = {
            "title": data.get("Title"),
            "year": data.get("Year"),
            "genres": [g.strip().lower() for g in data.get("Genre", "").split(",")],
            "director": data.get("Director"),
            "rating": float(data.get("imdbRating", "0")) if data.get("imdbRating") != "N/A" else 0.0,
            "plot": data.get("Plot")
        }
        
        print(f"{movie_info['title']}-({movie_info['year']}) | Rating: {movie_info['rating']}")
        return movie_info
    
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None

def main():
    if not os.path.exists(JSON):
        print("movies.json not found. Downloading from GitHub...")
        movie_db, movie_titles = update_movies()
    else:
        # Carrega movies.json existente
        with open(JSON, "r", encoding="utf-8") as f:
            movie_db = json.load(f)
        movie_titles = [movie["title"].lower() for movie in movie_db]

    if os.path.exists(USERFILE):
        with open(USERFILE, "r", encoding="utf-8") as f:
            user_data = json.load(f)
    else:
        user_data = {"watched": []}

    while True:
        print("\nOptions: \n")
        print("1 - Update movie database\n")
        print("2 - Mark a movie as watched\n")
        print("3 - Get recommendations\n")
        print("4 - Exit\n")
        choice = input("Choose an option: ").strip()

        if choice == "1":
            movie_db, movie_titles = update_movies()
        elif choice == "2":
            movie_watched = input("Enter the title of the movie you watched: ").strip()
            if movie_watched.lower() not in movie_titles:
                print("Movie not found in database.")
            else:
                if movie_watched not in user_data["watched"]:
                    user_data["watched"].append(movie_watched)
                    with open(USERFILE, "w", encoding="utf-8") as f:
                        json.dump(user_data, f, indent=2, ensure_ascii=False)
                    print(f"'{movie_watched}' added to your watched list!")
                else:
                    print(f"'{movie_watched}' is already in your watched list.")  
        elif choice == "3":
            movie = input("Enter movie title: ").strip()   ##FIXME : add recommendation system
        elif choice == "4":
            break
        else:
            print("Invalid option. Please try again.")


if __name__ == "__main__":
    main()