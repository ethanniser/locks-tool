import fs from "node:fs";
import * as readline from "readline";
import { AggregateLoader, OzLoader, WellsLoader } from "./loaders";
import { PersistedCache } from "./cache";

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

export type Time = {
  hour: number;
  minute: number;
  ampm: "AM" | "PM";
};

export type Game = {
  month: number;
  day: number;
  time: Time;
  age: number;
  location: string;
};

export interface Loader {
  getGames(): Game[];
}

export interface Cache {
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

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--clean")) {
    if (fs.existsSync("./cache.json")) {
      fs.unlinkSync("./cache.json");
    }
  }

  const master = new AggregateLoader("./data/josh aggregate.csv");
  const remote = new OzLoader("./data/oz.csv");
  const cache = new PersistedCache("./cache.json");

  const missingGames = await compareAll(master, remote, cache);

  for (const game of missingGames) {
    console.log(
      `Missing game: ${game.month}/${game.day} at ${game.time.hour}:${game.time.minute} ${game.time.ampm} in ${game.location}`
    );
  }

  rl.close();
  process.exit(0);
}

main();
