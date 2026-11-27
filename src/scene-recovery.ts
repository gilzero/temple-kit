// @file: scene-recovery.ts
// @desc: recover visits after scene failures
import type { TempleLogger } from "./logger";

export type PublishedBuild = "current" | "replaced" | "unreachable";

/** Session storage for recovery state; any method may throw when refused. */
export interface SessionSlots {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface SceneRecoveryOptions {
  session: SessionSlots;
  logger: TempleLogger;
}

const resumeKey = "resume-walk";
const attemptKey = "scene-reload";

export function moduleEntry(html: string) {
  for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) {
    if (!/\btype="module"/.test(tag)) continue;
    const source = /\bsrc="([^"]+)"/.exec(tag)?.[1];
    if (source) return source;
  }
  return undefined;
}

export function compareBuild(
  running: string | undefined,
  html: string,
): PublishedBuild {
  const published = moduleEntry(html);
  if (!published || !running) return "unreachable";
  return published === running ? "current" : "replaced";
}

export function createSceneRecovery({ session, logger }: SceneRecoveryOptions) {
  async function publishedBuild(): Promise<PublishedBuild> {
    const running = document
      .querySelector('script[type="module"][src]')
      ?.getAttribute("src");
    try {
      const response = await fetch(location.pathname, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return "unreachable";
      return compareBuild(running ?? undefined, await response.text());
    } catch (error) {
      logger.warn("Published build unavailable", { error });
      return "unreachable";
    }
  }

  /** Reload into the walk. Automatic attempts run once until the scene loads. */
  function reloadWalk(stop: string, automatic: boolean) {
    try {
      if (automatic && session.get(attemptKey)) return false;
      session.set(attemptKey, "1");
      session.set(resumeKey, stop || "last-stop");
    } catch (error) {
      logger.warn("The walk cannot resume after a reload", { error });
      if (automatic) return false;
    }
    location.reload();
    return true;
  }

  function takeResume() {
    try {
      const stop = session.get(resumeKey) ?? undefined;
      session.remove(resumeKey);
      return stop;
    } catch (error) {
      logger.warn("Resumed walk unavailable", { error });
      return undefined;
    }
  }

  function sceneLoaded() {
    try {
      session.remove(attemptKey);
    } catch (error) {
      logger.warn("Scene recovery state unavailable", { error });
    }
  }

  return { publishedBuild, reloadWalk, takeResume, sceneLoaded };
}
