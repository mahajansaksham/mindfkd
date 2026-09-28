// Imports candidates only. Nothing in content/review is served to players.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const batches = Number(process.argv[2] ?? 3);
if (!Number.isInteger(batches) || batches < 1 || batches > 30)
  throw Error("Use 1–30 batches of 50");
const target = "content/review/opentdb.json";
const existing = JSON.parse(await readFile(target, "utf8").catch(() => "[]"));
const approved = JSON.parse(
  await readFile("data/community.json", "utf8").catch(() => "[]"),
);
const normalize = (text) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const known = new Set(
  [...existing, ...approved].map((q) => normalize(q.prompt)),
);
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Trivia source HTTP ${response.status}`);
  return response.json();
}
const tokenResult = await get(
  "https://opentdb.com/api_token.php?command=request",
);
if (tokenResult.response_code !== 0)
  throw Error("Could not obtain import session");
const token = tokenResult.token;
await mkdir("content/review", { recursive: true });
for (let batch = 0; batch < batches; batch++) {
  await new Promise((resolve) => setTimeout(resolve, 5500));
  const difficulty = ["easy", "medium", "hard"][batch % 3];
  const result = await get(
    `https://opentdb.com/api.php?amount=50&type=multiple&encode=url3986&difficulty=${difficulty}&token=${encodeURIComponent(token)}`,
  );
  if (result.response_code !== 0)
    throw Error(
      `Trivia import code ${result.response_code}; existing queue preserved`,
    );
  let added = 0;
  for (const q of result.results) {
    const prompt = decodeURIComponent(q.question).trim();
    const answer = decodeURIComponent(q.correct_answer).trim();
    const options = [answer, ...q.incorrect_answers.map(decodeURIComponent)];
    if (
      known.has(normalize(prompt)) ||
      new Set(options.map(normalize)).size !== 4
    )
      continue;
    known.add(normalize(prompt));
    existing.push({
      id:
        "ot-" +
        createHash("sha256")
          .update(normalize(prompt))
          .digest("hex")
          .slice(0, 16),
      source: "https://opentdb.com/",
      license: "CC-BY-SA-4.0",
      importedAt: new Date().toISOString().slice(0, 10),
      sourceDifficulty: difficulty,
      category: decodeURIComponent(q.category),
      prompt,
      answer,
      options,
      status: "pending",
    });
    added++;
  }
  await writeFile(target, JSON.stringify(existing, null, 2) + "\n");
  console.log(
    `Batch ${batch + 1}/${batches}: ${added} candidates; ${existing.length} queued, zero published`,
  );
}
