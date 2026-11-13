import { z } from "zod";

export const MovieSchema = z.object({
    id: z.number(),
    title: z.string(),
    overview: z.string(),
    poster: z.string(),
    rating: z.number(),
    vote_count: z.number(),
    popularity: z.number(),
    genres: z.array(z.string()),
    release_year: z.string(),
    is_popular: z.boolean(),
    is_top_rated: z.boolean(),
});

export const MovieArraySchema = z.array(MovieSchema);

export const UserDataSchema = z.object({
    version: z.number(),
    watchlist: z.array(MovieSchema),
    watched: z.array(MovieSchema),
    ratings: z.record(z.coerce.number(), z.number()),
});

// Derive TypeScript types from the Zod schemas:
export type Movie = z.infer<typeof MovieSchema>;
export type UserData = z.infer<typeof UserDataSchema>;
export type MovieWithReasons = Movie & {
    _score?: number;
    reasons?: string[];
};

// Non-Zod runtime types stay as normal interfaces:
export interface Recommendation {
    movie: Movie;
    score: number;
    reasons: string[];
}

export interface PaginationState {
    page: number;
    movies: MovieWithReasons[];
    options: Record<string, unknown>;
    controls: HTMLElement;
}