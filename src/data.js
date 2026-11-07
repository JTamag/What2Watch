export async function loadMovies(fetcher = fetch) {
    const response = await fetcher("./data/movies.json");
    if (!response.ok) throw new Error(`Movie catalogue request failed (${response.status})`);
    const movies = await response.json();
    if (!Array.isArray(movies)) throw new Error("Movie catalogue must be a JSON array");

    return {
        movies,
        byId: new Map(movies.map(movie => [movie.id, movie]))
    };
}
