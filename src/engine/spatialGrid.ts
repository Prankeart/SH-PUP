export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly cellSize: number;
  private readonly invCellSize: number;
  private readonly buckets = new Map<number, T[]>();
  private readonly pool: T[][] = [];
  private readonly activeLists: T[][] = [];

  constructor(cellSize = 110) {
    this.cellSize = cellSize;
    this.invCellSize = 1 / cellSize;
  }

  private hash(cx: number, cy: number): number {
    // Safe unique 2D integer hash within IEEE-754 53-bit exact integer space
    return (cx + 524288) * 1048576 + (cy + 524288);
  }

  public clear(): void {
    for (let i = 0; i < this.activeLists.length; i++) {
      const arr = this.activeLists[i];
      arr.length = 0;
      this.pool.push(arr);
    }
    this.activeLists.length = 0;
    this.buckets.clear();
  }

  public insert(item: T): void {
    const cx = Math.floor(item.x * this.invCellSize);
    const cy = Math.floor(item.y * this.invCellSize);
    const key = this.hash(cx, cy);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = this.pool.pop() ?? [];
      this.buckets.set(key, bucket);
      this.activeLists.push(bucket);
    }
    bucket.push(item);
  }

  public queryRadius(x: number, y: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const minCx = Math.floor((x - radius) * this.invCellSize);
    const maxCx = Math.floor((x + radius) * this.invCellSize);
    const minCy = Math.floor((y - radius) * this.invCellSize);
    const maxCy = Math.floor((y + radius) * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.buckets.get(this.hash(cx, cy));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            out.push(bucket[i]);
          }
        }
      }
    }
    return out;
  }

  /**
   * Bounded neighborhood query starting from the query center cell so dense
   * unit blobs stay strictly O(maxResults) instead of degrading to O(N^2).
   */
  public queryRadiusCapped(
    x: number,
    y: number,
    radius: number,
    out: T[],
    maxResults: number
  ): T[] {
    out.length = 0;
    if (maxResults <= 0) return out;

    const ccx = Math.floor(x * this.invCellSize);
    const ccy = Math.floor(y * this.invCellSize);
    const minCx = Math.floor((x - radius) * this.invCellSize);
    const maxCx = Math.floor((x + radius) * this.invCellSize);
    const minCy = Math.floor((y - radius) * this.invCellSize);
    const maxCy = Math.floor((y + radius) * this.invCellSize);

    // Center cell first
    const centerBucket = this.buckets.get(this.hash(ccx, ccy));
    if (centerBucket) {
      for (let i = 0; i < centerBucket.length; i++) {
        out.push(centerBucket[i]);
        if (out.length >= maxResults) return out;
      }
    }

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        if (cx === ccx && cy === ccy) continue;
        const bucket = this.buckets.get(this.hash(cx, cy));
        if (bucket) {
          for (let i = 0; i < bucket.length; i++) {
            out.push(bucket[i]);
            if (out.length >= maxResults) return out;
          }
        }
      }
    }
    return out;
  }

  /**
   * Zero-allocation nearest neighbor search within maxRadius using squared distances.
   */
  public queryNearest(
    x: number,
    y: number,
    maxRadius: number,
    predicate?: (item: T) => boolean
  ): { item: T | null; distSq: number } {
    let best: T | null = null;
    let bestDistSq = maxRadius * maxRadius;

    const minCx = Math.floor((x - maxRadius) * this.invCellSize);
    const maxCx = Math.floor((x + maxRadius) * this.invCellSize);
    const minCy = Math.floor((y - maxRadius) * this.invCellSize);
    const maxCy = Math.floor((y + maxRadius) * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.buckets.get(this.hash(cx, cy));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const item = bucket[i];
          if (predicate && !predicate(item)) continue;
          const dx = item.x - x;
          const dy = item.y - y;
          const dSq = dx * dx + dy * dy;
          if (dSq < bestDistSq) {
            bestDistSq = dSq;
            best = item;
          }
        }
      }
    }

    return { item: best, distSq: bestDistSq };
  }
}
