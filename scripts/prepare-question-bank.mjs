// Explicit reviewed decisions only; fetching never modifies the playable bank.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const queue = JSON.parse(await readFile("content/review/opentdb.json", "utf8"));
const decisions = JSON.parse(
  await readFile("content/review/decisions.json", "utf8"),
);
const normalize = (s) =>
  s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const category = (c) =>
  ({
    "Entertainment: Video Games": "Games",
    "Entertainment: Board Games": "Games",
    "Entertainment: Japanese Anime & Manga": "Animation",
    "Entertainment: Cartoon & Animations": "Animation",
    "Entertainment: Comics": "Comics",
    "Entertainment: Books": "Books",
    "Entertainment: Film": "Movies & TV",
    "Entertainment: Television": "Movies & TV",
    "Entertainment: Music": "Music",
    "Entertainment: Musicals & Theatres": "Music",
    "Science & Nature": "Science",
    "Science: Computers": "Technology",
    "Science: Mathematics": "Numbers & Comparisons",
    "Science: Gadgets": "Technology",
    "General Knowledge": "General Knowledge",
    Celebrities: "People",
    Vehicles: "Technology",
    Mythology: "Mythology",
  })[c] ?? c;
const approved = queue.flatMap((q) => {
  const d = decisions[q.id];
  if (!d || d.status !== "approved") return [];
  const answer = d.answer ?? q.answer;
  const options = (d.options ?? q.options).map((a) =>
    a.trim() === q.answer.trim() ? answer : a.trim(),
  );
  return [
    {
      id: q.id,
      type: "choice",
      difficulty: d.difficulty,
      category: category(q.category),
      prompt: d.prompt ?? q.prompt,
      answer,
      options,
      source: q.source,
    },
  ];
});
const rows = (await readFile("data/foundations.tsv", "utf8"))
  .trim()
  .split("\n");
const foundations = rows.map((row) => {
  const [tier, cat, prompt, answer, ...other] = row.split("|");
  return {
    id:
      "mf-" +
      createHash("sha256").update(normalize(prompt)).digest("hex").slice(0, 16),
    difficulty: Number(tier),
    category: cat,
    type: "choice",
    prompt,
    answer,
    options: [answer, ...other],
  };
});
for (const q of [...approved, ...foundations]) {
  if (
    q.options.length !== 4 ||
    new Set(q.options).size !== 4 ||
    !q.options.includes(q.answer) ||
    !Number.isInteger(q.difficulty) ||
    q.difficulty < 1 ||
    q.difficulty > 7
  )
    throw Error("Invalid reviewed question " + q.id);
}
await writeFile(
  "data/community.json",
  JSON.stringify(approved, null, 2) + "\n",
);
await writeFile(
  "data/foundations.json",
  JSON.stringify(foundations, null, 2) + "\n",
);
console.log(
  `${approved.length} reviewed community questions; ${foundations.length} authored foundation questions`,
);

await mkdir("public", { recursive: true });
await writeFile(
  "public/community-questions.json",
  JSON.stringify(
    {
      source: "https://opentdb.com/",
      attribution: "Open Trivia Database, PIXELTAIL GAMES LLC and contributors",
      license: "https://creativecommons.org/licenses/by-sa/4.0/",
      modifications:
        "Editorial filtering, difficulty reassignment and selected wording/spelling corrections",
      questions: approved,
    },
    null,
    2,
  ) + "\n",
);
