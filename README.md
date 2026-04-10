# What2Watch
A client-side movie discovery and tracking application built with JavaScript and powered by a daily-updated dataset from tmdb API

### Live Demo
- Check out the live app here: [What2Watch](https://jtamag.github.io/What2Watch/) 

---

## Features

### Movie Discovery
- Browse trough popular, top-rated and recent movies
- Curated dataset updated daily
- Display of rating, year, genres and overview
### Watchlist System
- Add and remove movies from a personal watchlist  
- Persistent storage using `localStorage`  
- Prevents duplicate entries  
### Watched System
- Mark movies as watched/unwatched  
- Separate tracking from watchlist  
- Persistent across sessions  
### Search System
- Search movies by title  
- Filter by genre keywords  
- Dynamic rendering of results 
### Modal System
- Detailed movie view with extended metadata  
- Interactive actions (watchlist / watched)  
- Overlay-based UI with keyboard and click controls  
### Import/Export
- Export user data (watchlist + watched) as JSON  
- Import previously saved data  
- Merge logic avoids duplicates  

### Automation
- Daily dataset updates via Github Actions
- Secure API key management using GitHub Secrets

## App Structure
The application is divided into the following main sections:

- Popular Movies  
- Watchlist  
- Watched  
- Search Results (dynamic)  
- Recommendations (WIP) 

## Data Flow

```text
TMDB API → Python Script → movies.json → Frontend (fetch) → User Interaction → localStorage