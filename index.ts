import fs from "node:fs";
import * as readline from "readline";
import { AggregateLoader, HawksLoader, OzLoader, WellsLoader } from "./loaders";
import { PersistedCache } from "./cache";
import levenshtein from "fast-levenshtein";

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
  ampm: "AM" | "PM" | null;
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

function formatGame(game: Game): string {
  return `${game.month}/${game.day} at ${game.time.hour}:${
    game.time.minute === 0 ? "00" : game.time.minute
  }${game.time.ampm !== null ? ` ${game.time.ampm}` : ""} in ${
    game.location
  } - ${game.age}u`;
}

async function compareAll(
  master: Loader,
  remote: Loader,
  cache: Cache
): Promise<Game[]> {
  const masterGames = master.getGames();
  const remoteGames = remote.getGames();

  const missingGames: Game[] = [];

  outer: for (const remoteGame of remoteGames) {
    for (const masterGame of masterGames) {
      const match = await compare(masterGame, remoteGame, cache);
      if (match[0]) {
        if (match[1] !== "") {
          console.error(match[1]);
        }
        continue outer;
      }
    }

    missingGames.push(remoteGame);
  }

  return missingGames;
}

async function compare(
  a: Game,
  b: Game,
  cache: Cache
): Promise<[result: boolean, message: string]> {
  // console.log(a, b);
  const locationMatch = await compareLocation(a.location, b.location, cache);
  // console.log(locationMatch);
  let timeMatch = false;
  let message = "";
  if (a.time.hour === b.time.hour && a.time.minute === b.time.minute) {
    if (a.time.ampm === b.time.ampm) {
      timeMatch = true;
    } else {
      if (a.time.ampm === null) {
        message = `GAME: ${formatGame(
          a
        )} does not specify AM/PM - MANUAL CHECK REQUIRED`;

        timeMatch = true;
      } else if (b.time.ampm === null) {
        message = `GAME: ${formatGame(
          b
        )} does not specify AM/PM - MANUAL CHECK REQUIRED`;

        timeMatch = true;
      }
    }
  }
  return [
    locationMatch &&
      timeMatch &&
      a.month === b.month &&
      a.day === b.day &&
      a.age === b.age,
    message,
  ];
}

async function compareLocation(
  a: string,
  b: string,
  cache: Cache
): Promise<boolean> {
  const cached = cache.get(a, b);
  // console.log(`Comparing locations: "${a}" and "${b}" - cached: ${cached}`);
  if (cached !== undefined) {
    return cached;
  } else {
    if (!areSimilar(a, b)) {
      cache.set(a, b, false);
      return false;
    } else {
      // they are close enough, ask the user
      const result = await askQuestionBoolean(
        `Are these locations the same? "${a}" and "${b}" (y/n/q): `
      );
      cache.set(a, b, result);
      return result;
    }
  }
}

function areSimilar(a: string, b: string): boolean {
  const normalizedA = normalizeString(a);
  const normalizedB = normalizeString(b);
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    return true;
  }
  const distance = levenshtein.get(normalizedA, normalizedB);
  const threshold = Math.max(normalizedA.length, normalizedB.length) * 0.2; // 20% of the length of the longer string
  // console.log(
  //   `Distance between ${normalizedA} and ${normalizedB}: ${distance} (threshold: ${threshold})`
  // );
  return distance <= threshold;
}

function normalizeString(input: string): string {
  return input.toLowerCase().trim();
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--clean")) {
    if (fs.existsSync("./cache.json")) {
      fs.unlinkSync("./cache.json");
    }
  }

  const master = new AggregateLoader("./data/josh aggregate.csv");
  const remote = new WellsLoader("./data/welles .csv");
  const cache = new PersistedCache("./cache.json");

  const missingGames = await compareAll(master, remote, cache);

  if (missingGames.length > 0) {
    console.log("--- THERE MAY BE FALSE POSITIVES ---");
    for (const game of missingGames) {
      console.log(`Missing game: ${formatGame(game)}`);
    }
    console.log("--- THERE MAY BE FALSE POSITIVES ---");
  } else {
    console.log("No missing games found!");
  }

  rl.close();
  process.exit(0);
}

main();
