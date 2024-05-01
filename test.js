import { Array, Console, Data, Effect, Either, Equal, pipe } from "effect";
import * as S from "@effect/schema/Schema";
import { ParseResult } from "@effect/schema";
import { Command, Args, Options } from "@effect/cli";

class Game extends S.Class("Game")({
  date: S.Struct({
    year: S.Number.pipe(S.int(), S.greaterThan(2000), S.lessThan(2050)),
    month: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThan(13)),
    day: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThan(32)),
  }),
  time: S.Struct({
    hour: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThan(13)),
    minute: S.Number.pipe(S.int(), S.greaterThan(0), S.lessThan(60)),
    ampm: S.Literal("AM", "PM"),
  }),
  venue: S.String.pipe(S.nonEmpty()),
  umpire: S.String.pipe(S.nonEmpty()),
}) {
  [Equal.symbol](other) {
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
}

const g1 = new Game({
  date: { year: 2024, month: 4, day: 23 },
  time: { hour: 7, minute: 5, ampm: "PM" },
  venue: "Fenway Park",
  umpire: "Joe West",
});
const g2 = new Game({
  date: { year: 2024, month: 4, day: 23 },
  time: { hour: 7, minute: 5, ampm: "PM" },
  venue: "Fenway Park",
  umpire: "Joe West",
});

console.log(Equal.equals(g1, g2));
