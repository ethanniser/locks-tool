import fs from "node:fs";
import type { Cache } from ".";

export class PersistedCache implements Cache {
  private cache: {
    store: Record<string, boolean>;
    synonyms: Record<string, string[]>;
  };
  constructor(private path: string) {
    if (fs.existsSync("./cache.json")) {
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
    const allASynonyms = (this.cache.synonyms[a] || []).concat(a);
    const allBSynonyms = (this.cache.synonyms[b] || []).concat(b);
    for (const aSynonym of allASynonyms) {
      for (const bSynonym of allBSynonyms) {
        const key = this.hash(aSynonym, bSynonym);
        if (this.cache.store[key] !== undefined) {
          return this.cache.store[key];
        }
      }
    }
    return undefined;
  }

  public set(a: string, b: string, value: boolean): void {
    const key = this.hash(a, b);
    this.cache.store[key] = value;

    if (value) {
      const aSynonyms = this.cache.synonyms[a];
      if (aSynonyms === undefined) {
        this.cache.synonyms[a] = [b];
      } else {
        aSynonyms.push(b);
      }

      const bSynonyms = this.cache.synonyms[b];
      if (bSynonyms === undefined) {
        this.cache.synonyms[b] = [a];
      } else {
        bSynonyms.push(a);
      }
    }

    fs.writeFileSync(this.path, JSON.stringify(this.cache));
  }

  private hash(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
  }
}
