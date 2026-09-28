export const GENRES = [
  { id: "mixed", label: "Mixed", description: "A little of everything." },
  {
    id: "sports",
    label: "Sports",
    description: "Know the game behind the game.",
  },
  {
    id: "politics",
    label: "Politics",
    description: "Power, systems and world affairs.",
  },
  { id: "history", label: "History", description: "Put the past to the test." },
  {
    id: "geography",
    label: "Geography",
    description: "How well do you know the world?",
  },
  {
    id: "science",
    label: "Science",
    description: "Nature, numbers and discoveries.",
  },
] as const;
export type Genre = (typeof GENRES)[number]["id"];
export type LeaderboardGenre = Genre | "overall";
export function isGenre(value: unknown): value is Genre {
  return GENRES.some((g) => g.id === value);
}
export const genreLabel = (value: string) =>
  GENRES.find((g) => g.id === value)?.label ??
  (value === "overall" ? "Overall" : "Mixed");
export function categoryGenre(category: string): Genre {
  if (category === "Sports") return "sports";
  if (category === "Politics") return "politics";
  if (category === "History") return "history";
  if (category === "Geography" || category === "World") return "geography";
  if (
    ["Science", "Animals", "Technology", "Numbers & Comparisons"].includes(
      category,
    )
  )
    return "science";
  return "mixed";
}
