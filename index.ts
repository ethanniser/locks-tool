import fs from "node:fs";

import * as readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestionBoolean(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      const trimmedAnswer = answer.trim().toLowerCase();
      if (trimmedAnswer === "y" || trimmedAnswer === "yes") {
        resolve(true);
      } else if (trimmedAnswer === "n" || trimmedAnswer === "no") {
        resolve(false);
      } else if (trimmedAnswer === "q" || trimmedAnswer === "quit") {
        console.log("Exiting...");
        process.exit(0);
      } else {
        console.log(
          "Invalid response. Please answer with 'y', 'n', 'q' or 'quit'."
        );
        resolve(askQuestionBoolean(question));
      }
    });
  });
}

type Game = {
  month: number;
  day: number;
  time: number;
  age: number;
  location: string;
};

interface Loader {
  getGames(): Game[];
}

interface Cache {
  get(a: string, b: string): boolean | undefined;
  set(a: string, b: string, value: boolean): void;
}

async function compareAll(
  master: Loader,
  remote: Loader,
  cache: Cache
): Promise<Game[]> {
  const masterGames = master.getGames();
  const remoteGames = remote.getGames();

  const missingGames: Game[] = [];

  for (const remoteGame of remoteGames) {
    for (const masterGame of masterGames) {
      if (await compare(masterGame, remoteGame, cache)) {
        continue;
      }
    }

    missingGames.push(remoteGame);
  }

  return missingGames;
}

async function compare(a: Game, b: Game, cache: Cache): Promise<boolean> {
  const locationMatch = await compareLocation(a.location, b.location, cache);
  return (
    locationMatch &&
    a.month === b.month &&
    a.day === b.day &&
    a.time === b.time &&
    a.age === b.age
  );
}

async function compareLocation(
  a: string,
  b: string,
  cache: Cache
): Promise<boolean> {
  const cached = cache.get(a, b);
  if (cached !== undefined) {
    return cached;
  } else {
    const result = await askQuestionBoolean(
      `Are these locations the same? "${a}" and "${b}" (y/n/q): `
    );
    cache.set(a, b, result);
    return result;
  }
}

class LoaderOne implements Loader {
  constructor(private path: string) {}
  getGames(): Game[] {
    const contents = fs.readFileSync(this.path, "utf-8");
    return contents
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(","))
      .map(([date, _, rawTime, opponent, homeAway, location, umpire, age]) => {
        const stringDate = date.split(" ")[0];
        const parts = stringDate.split("-");
        const month = Number(parts[1]);
        const day = Number(parts[2]);

        const timeParts = rawTime.split(":");
        const time = Number(timeParts[0] + timeParts[1]);

        return {
          age: Number(age.substring(0, 1)),
          day,
          location,
          month,
          time,
        };
      });
  }
}

class LoaderTwo implements Loader {
  constructor(private path: string) {}
  getGames(): Game[] {
    const contents = fs.readFileSync(this.path, "utf-8");
    return contents
      .trim()
      .split("\n")
      .map((line) => line.split(","))
      .map(([date, location, rawTime, age]) => {
        const stringDate = date.split(" ")[0];
        const parts = stringDate.split("-");
        const month = Number(parts[1]);
        const day = Number(parts[2]);

        const timeParts = rawTime.split(":");
        const time = Number(timeParts[0] + timeParts[1]);

        return {
          age: Number(age.substring(0, 1)),
          day,
          location,
          month,
          time,
        };
      });
  }
}

class PersistedCache implements Cache {
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

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--clean")) {
    if (fs.existsSync("./cache.json")) {
      fs.unlinkSync("./cache.json");
    }
  }

  const master = new LoaderOne("./data/Sheet1.csv");
  const remote = new LoaderTwo("./data/Sheet2.csv");
  const cache = new PersistedCache("./cache.json");

  const missingGames = await compareAll(master, remote, cache);

  for (const game of missingGames) {
    console.log(
      `Missing game: ${game.month}/${game.day} at ${game.time} in ${game.location}`
    );
  }

  rl.close();
  process.exit(0);
}

// main();

class AggregateLoader implements Loader {
  constructor(private path: string) {}
  getGames(): Game[] {
    const contents = fs.readFileSync(this.path, "utf-8");
    return contents
      .trim()
      .split("\n")
      .map((line) => line.split(","))
      .map(([date, location, rawTime, rawAge]) => {
        const stringDate = date.split(" ")[0];
        const parts = stringDate.split("-");
        const month = Number(parts[1]);
        const day = Number(parts[2]);

        const timeParts = rawTime.split(":");
        const time = Number(timeParts[0] + timeParts[1]);
        const age = parseInt(rawAge.split("u")[0]);

        return {
          age,
          day,
          location,
          month,
          time,
        };
      });
  }
}

const aggregate = new AggregateLoader("./data/josh aggregate.csv");
console.log(aggregate.getGames());
