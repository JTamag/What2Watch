import os
import requests
from dotenv import load_dotenv
import json


JSON = "movies.json"



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
        
        print(f"✓ {movie_info['title']} ({movie_info['year']}) - Rating: {movie_info['rating']}")
        return movie_info
    
    except requests.exceptions.RequestException as e:
        print(f"Request error: {e}")
        return None


