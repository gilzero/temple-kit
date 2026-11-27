// @file: seal-memory.ts
// @desc: keep seals across open tabs
export interface SealMemoryOptions {
  read(key: string): string | null;
  write(key: string, value: string): void;
  /** Whether a saved id still names a landmark in this temple. */
  isLandmark(id: number): boolean;
}

export function createSealMemory({
  read,
  write,
  isLandmark,
}: SealMemoryOptions) {
  function savedSeals() {
    return (read("seals") ?? "")
      .split(",")
      .map(Number)
      .filter((id) => isLandmark(id));
  }

  /** Add a seal while keeping any collected in another tab. */
  function recordSeal(seals: Set<number>, id: number) {
    for (const saved of savedSeals()) seals.add(saved);
    seals.add(id);
    write("seals", [...seals].join(","));
  }

  /** Match the saved seals after another tab changes them. */
  function syncSeals(seals: Set<number>) {
    seals.clear();
    for (const saved of savedSeals()) seals.add(saved);
  }

  return { savedSeals, recordSeal, syncSeals };
}
