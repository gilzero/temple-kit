// @file: walking-obstacles.ts
// @desc: index static temple walking obstacles
/** A position on the ground plane. */
export interface Point {
  x: number;
  z: number;
}

type Rectangle = readonly [number, number, number, number];
type Disc = readonly [number, number, number];
interface Cell {
  walls: Rectangle[];
  posts: Disc[];
}
const size = 6,
  reach = 1;
const cellKey = (x: number, z: number) =>
  Math.floor(z / size) * 64 + Math.floor(x / size);

export function walkingObstacles(
  footprints: readonly Rectangle[],
  posts: readonly Disc[],
  clearance: number,
) {
  const cells = new Map<number, Cell>();
  const empty: Cell = { walls: [], posts: [] };
  const walls = footprints.map(
    ([x, z, w, d]) => [x, z, w / 2 + clearance, d / 2 + clearance] as const,
  );
  function index(
    x: number,
    z: number,
    rx: number,
    rz: number,
    add: (cell: Cell) => void,
  ) {
    for (
      let col = Math.floor((x - rx) / size);
      col <= Math.floor((x + rx) / size);
      col++
    ) {
      for (
        let row = Math.floor((z - rz) / size);
        row <= Math.floor((z + rz) / size);
        row++
      ) {
        const key = row * 64 + col;
        let cell = cells.get(key);
        if (!cell) {
          cell = { walls: [], posts: [] };
          cells.set(key, cell);
        }
        add(cell);
      }
    }
  }
  // Padding covers both ends of a short segment queried from its midpoint.
  for (const wall of walls)
    index(wall[0], wall[1], wall[2] + reach, wall[3] + reach, (cell) =>
      cell.walls.push(wall),
    );
  for (const post of posts)
    index(post[0], post[1], post[2], post[2], (cell) => cell.posts.push(post));
  function occupied(x: number, z: number) {
    const cell = cells.get(cellKey(x, z)) ?? empty;
    return (
      cell.walls.some(
        ([cx, cz, rx, rz]) => Math.abs(cx - x) < rx && Math.abs(cz - z) < rz,
      ) ||
      cell.posts.some(([cx, cz, r]) => (x - cx) ** 2 + (z - cz) ** 2 < r * r)
    );
  }
  function crossesWall(a: Point, b: Point) {
    const dx = (b.x - a.x) / 2,
      dz = (b.z - a.z) / 2,
      mx = a.x + dx,
      mz = a.z + dz,
      vx = Math.abs(dx),
      vz = Math.abs(dz);
    const candidates =
      vx <= reach && vz <= reach
        ? (cells.get(cellKey(mx, mz)) ?? empty).walls
        : walls;
    // Test the two box axes and the axis perpendicular to the segment.
    return candidates.some(([x, z, rx, rz]) => {
      const ox = mx - x,
        oz = mz - z;
      return (
        Math.abs(ox) < rx + vx &&
        Math.abs(oz) < rz + vz &&
        ((dx === 0 && dz === 0) ||
          Math.abs(ox * dz - oz * dx) < rx * vz + rz * vx)
      );
    });
  }
  return { occupied, crossesWall };
}
