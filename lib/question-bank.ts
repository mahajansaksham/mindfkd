import { questionsForGenre, type Question } from "./game";
import type { Genre } from "./genres";
// Keep the answer catalog out of the landing route's initial JavaScript.
let catalog: Promise<Question[]> | undefined;
export function loadQuestionBank(genre: Genre) {
  catalog ??= import("../data/questions")
    .then((m) => m.questions)
    .catch((error) => {
      catalog = undefined;
      throw error;
    });
  return catalog.then((bank) => questionsForGenre(bank, genre));
}
