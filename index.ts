import { FileSystem } from "@effect/platform";
import { BunContext } from "@effect/platform-bun";
import { Data, Effect, pipe } from "effect";
import * as S from "@effect/schema/Schema";
import { ParseResult } from "@effect/schema";

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

const RowToGame = pipe(
  S.String,
  S.transform(S.Array(S.String), {
    decode: (row) => row.split(","),
    encode: (items) => items.join(","),
  })
);

const main = Effect.gen(function* () {
  const path = "data/oz_games.csv";
  const fs = yield* FileSystem.FileSystem;
  const string = yield* fs.readFileString(path);

  const lines = string.split("\n");
  const rows = lines.slice(1).map((line) => line.split(","));
});

Effect.runFork(main.pipe(Effect.provide(BunContext.layer)));
