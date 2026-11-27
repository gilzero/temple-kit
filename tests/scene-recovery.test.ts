import { expect, test } from "bun:test";
import {
  compareBuild,
  createSceneRecovery,
  moduleEntry,
} from "../src/scene-recovery";
import { memoryStorage, withGlobals } from "./browser-storage";

const page = (src: string) =>
  `<script>1</script><script type="module" crossorigin src="${src}"></script>`;

test("a replaced build differs from the running entry", () => {
  expect(moduleEntry(page("/assets/index-a.js"))).toBe("/assets/index-a.js");
  expect(compareBuild("/assets/index-a.js", page("/assets/index-a.js"))).toBe(
    "current",
  );
  expect(compareBuild("/assets/index-a.js", page("/assets/index-b.js"))).toBe(
    "replaced",
  );
  expect(compareBuild(undefined, page("/assets/index-a.js"))).toBe(
    "unreachable",
  );
  expect(compareBuild("/assets/index-a.js", "<p>Sign in</p>")).toBe(
    "unreachable",
  );
});

test("automatic recovery reloads once and retains the destination", () => {
  const slots = memoryStorage();
  let reloads = 0;
  const recovery = createSceneRecovery({
    session: {
      get: (key) => slots.getItem("t." + key),
      set: (key, value) => slots.setItem("t." + key, value),
      remove: (key) => slots.removeItem("t." + key),
    },
    logger: { warn: () => undefined },
  });
  withGlobals({ location: { reload: () => reloads++ } }, () => {
    expect(recovery.reloadWalk("5", true)).toBe(true);
    expect(slots.entries.get("t.resume-walk")).toBe("5");
    expect(recovery.takeResume()).toBe("5");
    expect(recovery.takeResume()).toBeUndefined();
    expect(recovery.reloadWalk("5", true)).toBe(false);
    expect(recovery.reloadWalk("", false)).toBe(true);
    expect(recovery.takeResume()).toBe("last-stop");
    recovery.sceneLoaded();
    expect(recovery.reloadWalk("", true)).toBe(true);
  });
  expect(reloads).toBe(3);
});

test("refused session storage stops automatic reloads", () => {
  const warnings: string[] = [];
  let reloads = 0;
  const refuse = () => {
    throw new Error("denied");
  };
  const recovery = createSceneRecovery({
    session: { get: refuse, set: refuse, remove: refuse },
    logger: { warn: (msg) => warnings.push(msg) },
  });
  withGlobals({ location: { reload: () => reloads++ } }, () => {
    expect(recovery.reloadWalk("5", true)).toBe(false);
    expect(recovery.reloadWalk("5", false)).toBe(true);
    expect(recovery.takeResume()).toBeUndefined();
  });
  expect(reloads).toBe(1);
  expect(warnings).toHaveLength(3);
});
