import { expect, test } from "bun:test";
import { createPreferenceStore } from "../src/storage";
import { memoryStorage, withGlobals } from "./browser-storage";

const silent = () => {
  const warnings: string[] = [];
  return {
    warnings,
    logger: { warn: (msg: string) => void warnings.push(msg) },
  };
};

test("preferences live under the temple prefix", () => {
  const local = memoryStorage();
  const { logger } = silent();
  withGlobals({ localStorage: local, sessionStorage: memoryStorage() }, () => {
    const store = createPreferenceStore({ prefix: "temple.", logger });
    store.write("language", "zh");
    expect(local.entries.get("temple.language")).toBe("zh");
    expect(store.read("language")).toBe("zh");
    expect(store.storageKey("seals")).toBe("temple.seals");
    expect(store.incrementCount("bows")).toBe(1);
    expect(store.incrementCount("bows", 2)).toBe(3);
    local.entries.set("temple.bows", "-4");
    expect(store.readCount("bows")).toBe(0);
    store.remove("language");
    expect(store.read("language")).toBeNull();
  });
});

test("a refused browser store keeps values for the visit", () => {
  const refused = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
  const { logger, warnings } = silent();
  withGlobals({ localStorage: refused, sessionStorage: refused }, () => {
    const store = createPreferenceStore({ prefix: "temple.", logger });
    store.write("walk", "5", true);
    expect(store.read("walk", true)).toBe("5");
    expect(store.read("walk")).toBeNull();
  });
  expect(warnings).toEqual([
    "Temple preference retained for this visit",
    "Temple storage unavailable",
  ]);
});
