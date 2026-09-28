import { test } from "node:test";
import assert from "node:assert/strict";
import { shareRun } from "../lib/share";
import { emptyRun } from "../lib/game";
test("sharing reports only successful native/clipboard operations; cancellation and failure are not success", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  try {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        share: async () => {},
        clipboard: {
          writeText: async () => {
            throw Error("must not copy");
          },
        },
      },
    });
    assert.equal(await shareRun(emptyRun), "Shared");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        share: async () => {
          throw new DOMException("cancel", "AbortError");
        },
        clipboard: {
          writeText: async () => {
            throw Error("must not copy");
          },
        },
      },
    });
    assert.equal(await shareRun(emptyRun), "");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { clipboard: { writeText: async () => {} } },
    });
    assert.equal(await shareRun(emptyRun), "Copied to clipboard");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        clipboard: {
          writeText: async () => {
            throw Error("denied");
          },
        },
      },
    });
    await assert.rejects(shareRun(emptyRun));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else Reflect.deleteProperty(globalThis, "navigator");
  }
});
