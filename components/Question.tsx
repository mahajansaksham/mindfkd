"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical } from "lucide-react";
import { Question as Q, Run } from "../lib/game";
export default function Question({
  question: q,
  feedback,
  onAnswer,
  disabled = false,
  pendingAnswer = null,
  pendingLabel = "Answer selected. Checking…",
}: {
  disabled?: boolean;
  pendingAnswer?: string | string[] | null;
  pendingLabel?: string;
  question: Q;
  feedback: Run["feedback"];
  onAnswer: (a: string | string[]) => void;
}) {
  const [order, setOrder] = useState(q.options),
    [drag, setDrag] = useState<number | null>(null);
  const locked = !!feedback || disabled;
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (locked || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (
        q.type !== "order" &&
        /^[1-4]$/.test(e.key) &&
        q.options[Number(e.key) - 1]
      ) {
        e.preventDefault();
        onAnswer(q.options[Number(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [q, locked, onAnswer]);
  function move(from: number, to: number) {
    if (locked || to < 0 || to >= order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setOrder(next);
  }
  const state = (a: string) =>
    !feedback
      ? pendingAnswer === a
        ? "pending"
        : ""
      : a === q.answer
        ? "correct"
        : a === feedback.selected
          ? "wrong"
          : "";
  return (
    <section className="question" aria-labelledby="question-prompt">
      <div className="eyebrow category">
        {q.category}
        <span> / </span>
        {
          {
            choice: "Pick one",
            binary: "This or that",
            higher: "Higher or lower",
            order: "Set the sequence",
            boolean: "True or false",
            number: "Find the number",
            visual: "Visual check",
          }[q.type]
        }
      </div>
      <h2 id="question-prompt">{q.prompt}</h2>
      {q.type === "order" ? (
        <div className="ordering">
          {order.map((item, i) => (
            <div
              className="order-row"
              key={item}
              draggable={!locked}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (drag !== null) move(drag, i);
                setDrag(null);
              }}
            >
              <GripVertical size={16} />
              <span className="order-index">0{i + 1}</span>
              <span className="order-text">{item}</span>
              <button
                disabled={locked || i === 0}
                aria-label={`Move ${item} up`}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                disabled={locked || i === order.length - 1}
                aria-label={`Move ${item} down`}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={17} />
              </button>
            </div>
          ))}
          <button
            className="primary submit"
            disabled={locked}
            onClick={() => onAnswer(order)}
          >
            LOCK IN ORDER <Check size={18} />
          </button>
        </div>
      ) : (
        <div className={`answers ${q.type === "visual" ? "visual" : ""}`}>
          {q.options.map((a, i) => (
            <button
              key={a}
              className={`answer ${state(a)}`}
              disabled={locked}
              onClick={() => onAnswer(a)}
            >
              <kbd>{i + 1}</kbd>
              <span>
                {q.type === "visual" ? (
                  <span role="img" aria-label={visualDescription(a)}>
                    {a.split(" ")[0]}
                  </span>
                ) : (
                  a
                )}
              </span>
              <span className="answer-mark">
                {feedback && a === q.answer ? "✓" : "↗"}
              </span>
            </button>
          ))}
        </div>
      )}
      <div
        className={`feedback ${feedback ? (feedback.correct ? "success" : "failure") : ""}`}
        role="status"
      >
        {feedback ? (
          <>
            <strong>{feedback.correct ? "✓ CORRECT" : "✕ WRONG"}</strong>
            <span>
              {feedback.correct
                ? `+${feedback.points.toLocaleString()} points`
                : `Correct: ${Array.isArray(q.answer) ? q.answer.join(" → ") : q.answer}`}
            </span>
          </>
        ) : pendingAnswer !== null ? (
          <span className="input-hint">{pendingLabel}</span>
        ) : (
          <span className="input-hint">
            {q.type === "order"
              ? "Drag to reorder, or use the arrows"
              : "Tap a choice to answer."}
          </span>
        )}
      </div>
    </section>
  );
}

function visualDescription(option: string): string {
  const emoji = option.split(" ")[0];
  const descriptions: Record<string, string> = {
    "🇮🇹": "Vertical green, white and red stripes",
    "🇫🇷": "Vertical blue, white and red stripes",
    "🇮🇪": "Vertical green, white and orange stripes",
    "🇲🇽": "Vertical green, white and red with an eagle emblem",
    "🇰🇷": "White flag with a red-blue circle and four black trigrams",
    "🇯🇵": "White flag with a red circle",
    "🇨🇳": "Red flag with five yellow stars",
    "🇻🇳": "Red flag with one yellow star",
    "🇳🇵": "Two red triangular pennants with a blue border",
    "🇧🇹": "Yellow and orange flag with a white dragon",
    "🇱🇰": "Maroon flag with a golden lion and green-orange stripes",
    "🇲🇳": "Red-blue-red vertical stripes with a yellow symbol",
    "🇺🇾": "White and blue horizontal stripes with a sun",
    "🇦🇷": "Light blue-white-light blue stripes with a sun",
    "🇵🇾": "Red-white-blue stripes with a central seal",
    "🇪🇨": "Yellow-blue-red stripes with a coat of arms",
    "🇲🇲": "Yellow-green-red stripes with a white star",
    "🇰🇭": "Blue-red-blue stripes with a white temple",
    "🇲🇿": "Green-black-yellow stripes, a red triangle, star and crossed rifle and hoe",
    "🇿🇲": "Green with an orange eagle and red-black-orange stripes",
    "🇿🇼": "Green-yellow-red-black stripes and a white triangle with a bird",
    "🇦🇴": "Red and black with a yellow gear, machete and star",
  };
  return descriptions[emoji] ?? option.slice(emoji.length).trim();
}
