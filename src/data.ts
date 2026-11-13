import { MovieArraySchema } from "./types";

export async function loadMovies(fetcher = fetch) {
    const response = await fetcher(`${import.meta.env.BASE_URL}data/movies.json`);
    if (!response.ok) throw new Error(`Movie catalogue request failed (${response.status})`);
    const movies = await response.json();
    const parsedMovies = MovieArraySchema.parse(movies);
    const ids = new Set<number>();
    for (const movie of parsedMovies) {
        if (ids.has(movie.id)) throw new Error(`Movie catalogue contains duplicate ID ${movie.id}`);
        ids.add(movie.id);
    }

    return {
        movies: parsedMovies,
        byId: new Map(parsedMovies.map(movie => [movie.id, movie]))
    };
}
