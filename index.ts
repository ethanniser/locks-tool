import { FileSystem } from "@effect/platform";
import { BunContext, BunRuntime } from "@effect/platform-bun";
import { Array, Console, Data, Effect, Either, pipe } from "effect";
import * as S from "@effect/schema/Schema";
import { ParseResult } from "@effect/schema";
import { Command, Args } from "@effect/cli";

type Game = {
  readonly date: {
    readonly year: number;
    readonly month: number;
    readonly day: number;
  };
  readonly time: {
    readonly hour: number;
    readonly minute: number;
    readonly ampm: "AM" | "PM";
  };
  readonly venue: string;
  readonly umpire: string;
};

const Game = S.Struct({
  date: S.Struct({
    year: S.Number,
    month: S.Number,
    day: S.Number,
  }),
  time: S.Struct({
    hour: S.Number,
    minute: S.Number,
    ampm: S.Literal("AM", "PM"),
  }),
  venue: S.String,
  umpire: S.String,
});

// format: 4/23/2024
const DateFromString = S.transform(
  S.String,
  S.Struct({
    year: S.Number,
    month: S.Number,
    day: S.Number,
  }),
  {
    decode: (s) => {
      const [month, day, year] = s.split("/").map(Number);
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

const RowToGame = pipe(
  S.String,
  S.transform(S.Array(S.String), {
    decode: (row) => row.split(","),
    encode: (items) => items.join(","),
  }),
  S.transform(
    S.Struct({
      date: DateFromString,
      time: TimeFromString,
      venue: S.String,
      umpire: S.String,
    }),
    {
      decode: (items) => ({
        date: items[1],
        time: items[2],
        venue: items[3],
        umpire: items[26],
      }),
      encode: (items) => {
        return [items.date, items.time, items.venue, items.umpire];
      },
    }
  )
);

const readGamesFromFile = (path: string) =>
  Effect.gen(function* (_) {
    const fs = yield* FileSystem.FileSystem;
    const string = yield* fs.readFileString(path);

    const lines = string.split("\n");
    const rows = lines.slice(1, -2);
    const decode = pipe(S.decode(RowToGame));
    const games = yield* Effect.all(
      rows.map((row) =>
        decode(row).pipe(
          Effect.tapError(() => Console.error("Error parsing row: ", row))
        )
      ),
      { mode: "either" }
    );

    return games.filter(Either.isRight).map((e) => e.right);
  });

const writeGamesToFile = (path: string, games: readonly Game[]) =>
  Effect.gen(function* (_) {
    const fs = yield* FileSystem.FileSystem;
    const header = "Date,Time,Venue,Umpire\n";
    const encode = pipe(S.encode(RowToGame));
    const rows = yield* Effect.all(games.map((game) => encode(game)));
    const string = header + rows.join("\n") + "\n";

    yield* fs.writeFileString(path, string);
  });

const fileArg = Args.file({ name: "file" });
const outArg = Args.path({ name: "out", exists: "either" }).pipe(
  Args.withDefault("out.csv")
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
      const file_one_games = yield* readGamesFromFile(fileOne);
      const file_two_games = yield* readGamesFromFile(fileTwo);

      const allGames = [...file_one_games, ...file_two_games];
      yield* writeGamesToFile(outPath, allGames);
      yield* Console.log("Merged games written to: ", outPath);
    })
);

const rootCommand = Command.make("balls").pipe(
  Command.withSubcommands([mergeCommand])
);

const cli = Command.run(rootCommand, { name: "baseballs", version: "0.0.1" });

Effect.suspend(() => cli(process.argv)).pipe(
  Effect.provide(BunContext.layer),
  BunRuntime.runMain
);
