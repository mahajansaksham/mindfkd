"use client";
import { useEffect, useRef, useState } from "react";
export default function Timer({
  deadline,
  onExpire,
  delta,
}: {
  deadline: number;
  onExpire: () => void;
  delta: number | null;
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadline - performance.now()),
  );
  const expired = useRef(false);
  useEffect(() => {
    expired.current = false;
    let frame: number;
    function tick() {
      const left = Math.max(0, deadline - performance.now());
      setRemaining(left);
      if (left <= 0) {
        if (!expired.current) {
          expired.current = true;
          onExpire();
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [deadline, onExpire]);
  return (
    <div
      className={`timer ${remaining < 15000 ? "urgent" : ""} ${remaining < 7000 ? "critical" : ""}`}
    >
      <div className="timer-number" aria-hidden="true">
        {(remaining / 1000).toFixed(2)}
        <span
          className={`time-delta ${delta && delta < 0 ? "negative" : ""}`}
          key={deadline}
        >
          {delta === null ? "" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
        </span>
      </div>
      <span className="sr-only">
        Time remaining: {Math.ceil(remaining / 1000)} seconds
      </span>
      <div className="eyebrow">SECONDS LEFT</div>
      <div className="time-track">
        <div
          style={{ transform: `scaleX(${Math.min(1, remaining / 60000)})` }}
        />
      </div>
    </div>
  );
}
