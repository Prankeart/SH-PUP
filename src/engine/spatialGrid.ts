export class SpatialGrid<T extends { x: number; y: number }> {
  private readonly cellSize: number;
  private readonly buckets = new Map<number, T[]>();
  private readonly pool: T[][] = [];
  private readonly activeLists: T[][] = [];

  constructor(cellSize = 110) {
    this.cellSize = cellSize;
  }

  private hash(cx: number, cy: number): number {
    return ((cx + 32768) << 16) | ((cy + 32768) & 0xffff);
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
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
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
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

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
}
