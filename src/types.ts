export interface Movie {
    id: number;
    title: string;
    overview: string;
    poster: string;               
    rating: number;              
    vote_count: number;          
    popularity: number;
    genres: string[];             
    release_year: string;         
    is_popular: boolean;
    is_top_rated: boolean;
}

export interface UserData {
    version: number;
    watchlist: Movie[];
    watched: Movie[];
    ratings: Record<number, number>;
}

export interface Recommendation {
    movie: Movie;
    score: number;
    reasons: string[];
}