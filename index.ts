import { FileSystem, Path } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import {
  Array,
  Console,
  Data,
  Effect,
  Either,
  Equal,
  Hash,
  pipe,
} from "effect";
import * as S from "@effect/schema/Schema";
import { ParseResult } from "@effect/schema";
import { Command, Args, Options } from "@effect/cli";
import { CsvError, parse } from "csv-parse/sync";
import type { ParseError } from "@effect/schema/ParseResult";
import type { PlatformError } from "@effect/platform/Error";

class Game
  extends S.Class<Game>("Game")({
    date: S.Struct({
      year: S.Number.pipe(S.int(), S.greaterThan(2000), S.lessThan(2050)),
      month: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThan(13)),
      day: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThan(32)),
    }),
    time: S.Struct({
      hour: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThan(13)),
      minute: S.Number.pipe(S.int(), S.greaterThan(-1), S.lessThan(60)),
      ampm: S.Literal("AM", "PM"),
    }),
    venue: S.String.pipe(S.nonEmpty()),
    umpire: S.String,
  })
  implements Equal.Equal, Hash.Hash
{
  // best score is 4
  static compare(a: Game, b: Game): number {
    let i = 0;
    if (
      a.date.year === b.date.year &&
      a.date.month === b.date.month &&
      a.date.day === b.date.day
    ) {
      i++;
    }
    if (
      a.time.hour === b.time.hour &&
      a.time.minute === b.time.minute &&
      a.time.ampm === b.time.ampm
    ) {
      i++;
    }
    if (a.venue === b.venue) {
      i++;
    }
    if (a.umpire === b.umpire) {
      i++;
    }
    return i;
  }

  [Equal.symbol](other: Equal.Equal): boolean {
    return (
      other instanceof Game &&
      this.date.year === other.date.year &&
      this.date.month === other.date.month &&
      this.date.day === other.date.day &&
      this.time.hour === other.time.hour &&
      this.time.minute === other.time.minute &&
      this.time.ampm === other.time.ampm &&
      this.venue === other.venue &&
      this.umpire === other.umpire
    );
  }
  [Hash.symbol](): number {
    return pipe(
      Hash.number(this.date.year),
      Hash.combine(Hash.number(this.date.month)),
      Hash.combine(Hash.number(this.date.day)),
      Hash.combine(Hash.number(this.time.hour)),
      Hash.combine(Hash.number(this.time.minute)),
      Hash.combine(Hash.string(this.time.ampm)),
      Hash.combine(Hash.string(this.venue)),
      Hash.combine(Hash.string(this.umpire))
    );
  }

  prettyPrint() {
    return `${this.date.month}/${this.date.day}/${this.date.year} ${
      this.time.hour
    }:${this.time.minute === 0 ? "00" : this.time.minute} ${this.time.ampm} - ${
      this.venue
    } - ${this.umpire}`;
  }
}

const DateFromString = S.transform(
  S.String,
  S.Struct({
    year: S.Number,
    month: S.Number,
    day: S.Number,
  }),
  {
    decode: (s) => {
      // const [month, day, year] = s.split("/").map(Number);
      let month: number, day: number, year: number;
      if (s.includes("/")) {
        // format: 4/23/2024
        [month, day, year] = s.split("/").map(Number);
      } else if (s.includes("-")) {
        // format: 2024-06-30
        [year, month, day] = s.split("-").map(Number);
      } else {
        throw new Error("Invalid date format: " + s);
      }
      return { year, month, day };
    },
    encode: (date) => `${date.month}/${date.day}/${date.year}`,
  }
);

// format: 7:05 PM
const TimeFromString = S.transform(
  S.String,
  S.Struct({
    hour: S.Number,
    minute: S.Number,
    ampm: S.Literal("AM", "PM"),
  }),
  {
    decode: (s) => {
      const [numbers, ampm] = s.split(" ");
      const [hour, minute] = numbers.split(":").map(Number);
      return { hour, minute, ampm };
    },
    encode: (time) => `${time.hour}:${time.minute} ${time.ampm}`,
    strict: false,
  }
);

const AssignerRow = S.Struct({
  Date: S.String,
  "Start Time": S.String,
  Venue: S.String,
  "Official 1": S.String,
}).pipe(
  S.transform(
    S.Struct({
      date: S.String,
      time: S.String,
      venue: S.String,
      umpire: S.String,
    }),
    {
      decode: (row) => ({
        date: row.Date,
        time: row["Start Time"],
        venue: row.Venue,
        umpire: row["Official 1"],
      }),
      encode: (game) => ({
        Date: game.date,
        "Start Time": game.time,
        Venue: game.venue,
        "Official 1": game.umpire,
      }),
    }
  )
);

const MyRow = S.Struct({
  Date: S.String,
  Time: S.String,
  Venue: S.String,
  Umpire: S.String,
}).pipe(
  S.transform(
    S.Struct({
      date: S.String,
      time: S.String,
      venue: S.String,
      umpire: S.String,
    }),
    {
      decode: (row) => ({
        date: row.Date,
        time: row.Time,
        venue: row.Venue,
        umpire: row.Umpire,
      }),
      encode: (game) => ({
        Date: game.date,
        Time: game.time,
        Venue: game.venue,
        Umpire: game.umpire,
      }),
    }
  )
);

const RowToGame = S.transform(
  S.Union(AssignerRow, MyRow),
  S.Struct({
    date: DateFromString,
    time: TimeFromString,
    venue: S.String,
    umpire: S.String,
  }),
  {
    decode: (row) => row,
    encode: (game) => game,
  }
).pipe(
  S.transform(Game, {
    decode: (game) => new Game(game),
    encode: (game) => game,
  })
);

class CsvParseError extends Data.TaggedError("CsvParseError")<{
  readonly file: string;
  readonly error: CsvError;
}> {}

function normalizeString(s: string): string {
  let rows = s.replace(/\r\n/g, "\n").split("\n");
  // remove empty rows
  rows = rows.filter((row) => row.trim() !== "");
  // remove possible non data row
  rows = rows.filter((row) => !row.includes("TOTALS"));
  // make sure to add final newline
  return rows.join("\n") + "\n";
}

const readGamesFromFile = (
  path: string
): Effect.Effect<
  readonly Game[],
  ParseError | PlatformError | CsvParseError,
  FileSystem.FileSystem
> =>
  Effect.gen(function* (_) {
    const fs = yield* FileSystem.FileSystem;
    const rawString = yield* fs.readFileString(path);
    const string = normalizeString(rawString);
    const rawGames = yield* Effect.try({
      try: () =>
        parse(string, {
          columns: true,
          quote: '"',
          relax_column_count: true,
        }) as unknown,
      catch: (e) => {
        if (!(e instanceof CsvError)) {
          throw e;
        }
        return new CsvParseError({ error: e, file: path });
      },
    });

    const games = yield* S.decodeUnknown(S.Array(RowToGame))(rawGames);
    return games;
  });

const writeGamesToFile = (path: string, games: readonly Game[]) =>
  Effect.gen(function* (_) {
    const fs = yield* FileSystem.FileSystem;
    const p = yield* Path.Path;
    const header = "Date,Time,Venue,Umpire\n";
    function gameToRow(game: Game) {
      return `${
        game.date.month
      }/${game.date.day}/${game.date.year},${game.time.hour}:${game.time.minute === 0 ? "00" : game.time.minute} ${game.time.ampm},${game.venue},"${game.umpire}"`;
    }
    const rows = games.map((game) => gameToRow(game));
    const string = header + rows.join("\n") + "\n";
    if (yield* fs.exists(path)) {
      yield* fs.remove(path);
    } else if (!(yield* fs.exists(p.dirname(path)))) {
      yield* fs.makeDirectory(p.dirname(path));
    }
    yield* fs.writeFileString(path, string);
  });

const checkIfGameIsPresent = (
  gameToCheck: Game,
  games: readonly Game[],
  sourceOfTruth: "local" | "remote"
) =>
  Effect.gen(function* () {
    const matchedGame = games.find((game) => Equal.equals(game, gameToCheck));
    if (!matchedGame) {
      yield* handleUnmatchedGame(gameToCheck, games, sourceOfTruth);
      return false;
    }
    return true;
  });

const handleUnmatchedGame = (
  unamtchedGame: Game,
  games: readonly Game[],
  sourceOfTruth: "local" | "remote"
) =>
  Effect.gen(function* () {
    const scores = games.map(
      (game) => [Game.compare(unamtchedGame, game), game] as const
    );
    const sortedScores = scores.sort(([a], [b]) => b - a);
    const topMatches = sortedScores.slice(0, 3).filter(([score]) => score > 2);

    const message =
      sourceOfTruth === "local"
        ? "Game in local NOT matched in remote: "
        : "Game in remote NOT matched in local: ";
    yield* Console.error(message, unamtchedGame.prettyPrint());

    if (topMatches.length > 0) {
      console.log(
        `${topMatches.length} close match${
          topMatches.length > 1 ? "es" : ""
        } found:`
      );
      for (const [score, game] of topMatches) {
        console.log(`Items Different: ${4 - score} - ${game.prettyPrint()}`);
      }
    } else {
      console.log("No close matches found.");
    }
    console.log();
  });

const compareGames = (
  masterGames: readonly Game[],
  newGames: readonly Game[],
  sourceOfTruth: "local" | "remote"
) =>
  Effect.gen(function* (_) {
    let counter = 0;
    for (const mGame of masterGames) {
      const wasFound = yield* checkIfGameIsPresent(
        mGame,
        newGames,
        sourceOfTruth
      );
      if (!wasFound) {
        counter++;
      }
    }
    return counter;
  });

class PathDoesNotExistError extends Data.TaggedError("PathDoesNotExistError")<{
  readonly path: string;
}> {}

const normalizeRelativePath = (path: string) =>
  Effect.gen(function* (_) {
    const p = yield* Path.Path;
    let finalPath: string;
    if (!p.isAbsolute(path)) {
      finalPath = p.join(process.cwd(), path);
    } else {
      finalPath = path;
    }

    const fs = yield* FileSystem.FileSystem;
    if (!fs.exists(finalPath)) {
      yield* new PathDoesNotExistError({ path: finalPath });
    }

    return finalPath;
  });

const fileArg = Args.file({ name: "file", exists: "either" }).pipe(
  Args.withDescription("Path to a file containing games data")
);
const outArg = Options.file("output", { exists: "either" }).pipe(
  Options.withDefault("out/merged.csv"),
  Options.withDescription("Output file path"),
  Options.withAlias("o")
);

const mergeCommand = Command.make(
  "merge",
  {
    fileOne: fileArg,
    fileTwo: fileArg,
    outPath: outArg,
  },
  ({ fileOne, fileTwo, outPath }) =>
    Effect.gen(function* () {
      fileOne = yield* normalizeRelativePath(fileOne);
      fileTwo = yield* normalizeRelativePath(fileTwo);
      const file_one_games = yield* readGamesFromFile(fileOne);
      const file_two_games = yield* readGamesFromFile(fileTwo);

      const allGames = [...file_one_games, ...file_two_games];
      const dedupedGames = Array.dedupe(allGames);
      yield* writeGamesToFile(outPath, dedupedGames);
      yield* Console.log("Merged games written to: ", outPath);
    })
);

const localOptions = Options.file("local", { exists: "either" }).pipe(
  Options.withDescription(
    "Path to the local file (the one to be compared against)"
  ),
  Options.withAlias("l")
);

const remoteOption = Options.file("remote", { exists: "either" }).pipe(
  Options.withDescription(
    "Path to the remote file (the one that was generated)"
  ),
  Options.withAlias("r")
);

const compareCommand = Command.make(
  "compare",
  {
    localFilePath: localOptions,
    remoteFilePath: remoteOption,
  },
  ({ localFilePath, remoteFilePath }) =>
    Effect.gen(function* () {
      localFilePath = yield* normalizeRelativePath(localFilePath);
      remoteFilePath = yield* normalizeRelativePath(remoteFilePath);
      const localGames = yield* readGamesFromFile(localFilePath);
      const remoteGames = yield* readGamesFromFile(remoteFilePath);

      const missingFromLocal = yield* compareGames(
        remoteGames,
        localGames,
        "remote"
      );
      const missingFromRemote = yield* compareGames(
        localGames,
        remoteGames,
        "local"
      );
      yield* Console.log("\n----------------------");
      yield* Console.log("Comparison complete.");

      const total = missingFromLocal + missingFromRemote;

      if (total === 0) {
        yield* Console.log("All games sucessfully accounted for.");
      } else {
        if (missingFromLocal > 0) {
          yield* Console.log(
            `${missingFromLocal} game${
              missingFromRemote > 1 ? "s" : ""
            } unmatched from local file.`
          );
        }
        if (missingFromRemote > 0) {
          yield* Console.log(
            `${missingFromRemote} game${
              missingFromRemote > 1 ? "s" : ""
            } unmatched from remote file.`
          );
        }
      }
    })
);

const rootCommand = Command.make("balls").pipe(
  Command.withSubcommands([mergeCommand, compareCommand])
);

const cli = Command.run(rootCommand, { name: "baseballs", version: "0.0.1" });

Effect.suspend(() => cli(process.argv)).pipe(
  Effect.catchTag("CsvParseError", (e) =>
    Console.error(
      `There was an error parsing the CSV file '${e.file}':\n`,
      e.error.message,
      e.error.code
    )
  ),
  Effect.catchTag("PathDoesNotExistError", (e) =>
    Console.error(`The path '${e.path}' does not exist.`)
  ),
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
);
