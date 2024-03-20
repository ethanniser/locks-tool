import fs from "node:fs";

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

function compareAll(master: Loader, remote: Loader) {
  const masterGames = master.getGames();
  const remoteGames = remote.getGames();

  for (const remoteGame of remoteGames) {
    for (const masterGame of masterGames) {
      if (compare(masterGame, remoteGame)) {
        continue;
      }
    }

    console.error("Game not found in master", remoteGame);
  }
}

function compare(a: Game, b: Game): boolean {
  return (
    a.month === b.month &&
    a.day === b.day &&
    a.time === b.time &&
    a.age === b.age &&
    compareLocation(a.location, b.location)
  );
}

function compareLocation(a: string, b: string): boolean {
  return a === b;
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

function main() {
  const master = new LoaderOne("./data/Sheet1.csv");
  const remote = new LoaderTwo("./data/Sheet2.csv");

  compareAll(master, remote);
}

main();
