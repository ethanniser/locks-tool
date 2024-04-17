import fs from "node:fs";
import type { Cache } from ".";

export class PersistedCache implements Cache {
  private cache: {
    store: Record<string, boolean>;
    synonyms: Record<string, string[]>;
  };
  constructor(private path: string) {
    if (fs.existsSync(this.path)) {
      const contents = fs.readFileSync(this.path, "utf-8");
      this.cache = JSON.parse(contents);
    } else {
      this.cache = {
        store: {},
        synonyms: {},
      };
    }
  }

  public get(a: string, b: string): boolean | undefined {
    const key = this.hash(a, b);
    // never seen this pair before, return undefined
    if (this.cache.store[key] === undefined) {
      return this.cache.store[key];
    }

    // Use BFS to check if there is a path from 'a' to 'b'
    const queue: string[] = [a];
    const visited: Set<string> = new Set();

    while (queue.length > 0) {
      const current = queue.shift()!;
      visited.add(current);

      if (current === b) {
        return true; // Found a path to 'b'
      }

      const neighbors = this.cache.synonyms[current];
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor);
          }
        }
      }
    }
    return false; // No path found
  }

  public set(a: string, b: string, value: boolean): void {
    const key = this.hash(a, b);
    this.cache.store[key] = value;

    if (value) {
      this.linkSynonyms(a, b);
      this.linkSynonyms(b, a);
    }

    fs.writeFileSync(this.path, JSON.stringify(this.cache));
  }

  private hash(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }

  private linkSynonyms(a: string, b: string): void {
    const synonyms = this.cache.synonyms[a] || [];
    if (!synonyms.includes(b)) {
      synonyms.push(b);
      this.cache.synonyms[a] = synonyms;
    }
  }
}
