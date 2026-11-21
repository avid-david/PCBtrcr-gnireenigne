/**
 * Disjoint sets over string ids (union by size, path halving). Mutable by design: it is a
 * local working structure inside net derivation, never part of the model.
 */
export class UnionFind {
  private readonly parent = new Map<string, string>();
  private readonly size = new Map<string, number>();

  /** Adds an element as its own set (no-op if present). */
  add(id: string): void {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
      this.size.set(id, 1);
    }
  }

  /** Representative of the element's set (adds unknown elements). */
  find(id: string): string {
    this.add(id);
    let current = id;
    let parent = this.parentOf(current);
    while (parent !== current) {
      const grandparent = this.parentOf(parent);
      this.parent.set(current, grandparent);
      current = parent;
      parent = grandparent;
    }
    return current;
  }

  /** Merges the sets of `a` and `b`. */
  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) {
      return;
    }
    const [big, small] = this.sizeOf(ra) >= this.sizeOf(rb) ? [ra, rb] : [rb, ra];
    this.parent.set(small, big);
    this.size.set(big, this.sizeOf(big) + this.sizeOf(small));
  }

  // Every element is added before use, so these lookups always hit.
  private parentOf(id: string): string {
    return this.parent.get(id) ?? id;
  }

  private sizeOf(id: string): number {
    return this.size.get(id) ?? 1;
  }
}
