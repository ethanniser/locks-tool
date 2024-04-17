import type { Game, Loader, Time } from ".";
import fs from "node:fs";

export class AggregateLoader implements Loader {
  constructor(private path: string) {}
  getGames(): Game[] {
    const contents = fs.readFileSync(this.path, "utf-8");
    return contents
      .trim()
      .split("\n")
      .slice(2)
      .map((line) => line.split(","))
      .map(([rawDate, rawLocation, rawTime, rawAge]) => {
        try {
          const { month, day } = this.parseDate(rawDate);
          const time = this.parseTime(rawTime);
          const age = this.parseAge(rawAge);

          return {
            age,
            day,
            location: rawLocation,
            month,
            time,
          };
        } catch (e) {
          console.error(`ERROR PARSING LINE MANUALLY CHECK`, [
            rawDate,
            rawLocation,
            rawTime,
            rawAge,
          ]);
          return null;
        }
      })
      .filter((game) => game !== null) as Game[];
  }

  private parseDate(date: string): { month: number; day: number } {
    // Split the string on spaces to separate the date and time components
    const datePart = date.split(" ")[0]; // This gets "YYYY-MM-DD"

    // Split the date part to isolate year, month, and day
    const parts = datePart.split("-");

    // The month and day are taken from the split parts and converted to numbers
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);

    return { month, day };
  }

  private parseTime(time: string): Time {
    // Regular expressions to match various time formats
    const simpleTime = /^(?<hour>[0-9]{1,2})(?<minute>[0-9]{2})?$/; // Matches "530" or "8"
    const detailedTime = /^(?<hour>[0-9]{2}):(?<minute>[0-9]{2}):[0-9]{2}$/; // Matches "05:30:00"

    let match = time.match(simpleTime);
    if (match) {
      let hour = parseInt(match.groups!.hour);
      let minute = match.groups!.minute ? parseInt(match.groups!.minute) : 0;
      return {
        hour: hour > 12 ? hour % 12 : hour,
        minute: minute,
        ampm: null,
      };
    }

    match = time.match(detailedTime);
    if (match) {
      let hour = parseInt(match.groups!.hour);
      let minute = parseInt(match.groups!.minute);
      return {
        hour: hour > 12 ? hour % 12 : hour,
        minute: minute,
        ampm: hour >= 12 ? "PM" : "AM",
      };
    }

    throw new Error(`Unsupported time format: ${time}`);
  }

  private parseAge(age: string): number {
    return parseInt(age.split("u")[0]);
  }
}

export class WellsLoader implements Loader {
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

        const time = this.parseTime(rawTime);

        return {
          age: Number(age.substring(0, 1)),
          day,
          location,
          month,
          time,
        };
      });
  }

  private parseTime(date: string): Time {
    // format: "17:30:00"
    const [hour, minute] = date.split(":").map(Number);
    return {
      hour: hour > 12 ? hour % 12 : hour,
      minute,
      ampm: hour >= 12 ? "PM" : "AM",
    };
  }
}

export class OzLoader implements Loader {
  constructor(private path: string) {}
  getGames(): Game[] {
    const contents = fs.readFileSync(this.path, "utf-8");
    return contents
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(","))
      .filter(([_]) => _ !== "")
      .map(([rawLocation, _, rawDate, rawTime, rawAge]) => {
        const age = this.parseAge(rawAge);
        const { month, day } = this.parseDate(rawDate);
        const time = this.parseTime(rawTime);

        return {
          age,
          day,
          location: rawLocation,
          month,
          time,
        };
      });
  }

  private parseAge(age: string): number {
    return parseInt(age.split("u")[0]);
  }
  private parseDate(date: string): { month: number; day: number } {
    const [year, month, day] = date.split("-").map(Number);
    return { month, day };
  }
  private parseTime(date: string): Time {
    // format: "17:30:00"
    const [hour, minute] = date.split(":").map(Number);
    return {
      hour: hour > 12 ? hour % 12 : hour,
      minute,
      ampm: hour >= 12 ? "PM" : "AM",
    };
  }
}

export class HawksLoader implements Loader {
  constructor(private path: string) {}
  getGames(): Game[] {
    const contents = fs.readFileSync(this.path, "utf-8");
    return contents
      .trim()
      .split("\n")
      .map((line) => line.split(","))
      .filter(([_]) => _ !== "")
      .map(([rawDate, rawTime, rawLocation, rawAge]) => {
        const age = this.parseAge(rawAge);
        const { month, day } = this.parseDate(rawDate);
        const time = this.parseTime(rawTime);

        return {
          age,
          day,
          location: rawLocation,
          month,
          time,
        };
      });
  }

  private parseAge(age: string): number {
    return parseInt(age.split("u")[0]);
  }
  private parseDate(date: string): { month: number; day: number } {
    const [year, month, day] = date.split("-").map(Number);
    return { month, day };
  }
  private parseTime(time: string): Time {
    // Regular expressions to match various time formats
    const simpleTime = /^(?<hour>[0-9]{1,2})(?<minute>[0-9]{2})?$/; // Matches "530" or "8"
    const detailedTime = /^(?<hour>[0-9]{2}):(?<minute>[0-9]{2}):[0-9]{2}$/; // Matches "05:30:00"

    let match = time.match(simpleTime);
    if (match) {
      let hour = parseInt(match.groups!.hour);
      let minute = match.groups!.minute ? parseInt(match.groups!.minute) : 0;
      return {
        hour: hour > 12 ? hour % 12 : hour,
        minute: minute,
        ampm: null,
      };
    }

    match = time.match(detailedTime);
    if (match) {
      let hour = parseInt(match.groups!.hour);
      let minute = parseInt(match.groups!.minute);
      return {
        hour: hour > 12 ? hour % 12 : hour,
        minute: minute,
        ampm: hour >= 12 ? "PM" : "AM",
      };
    }

    throw new Error(`Unsupported time format: ${time}`);
  }
}

export class WindyCityLoader implements Loader {
  constructor(private path: string) {}
  getGames(): Game[] {
    const contents = fs.readFileSync(this.path, "utf-8");
    return contents
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(","))
      .filter(([_]) => _ !== "")
      .map(([rawDate, rawTime, rawLocation, rawAge]) => {
        const age = this.parseAge(rawAge);
        const { month, day } = this.parseDate(rawDate);
        const time = this.parseTime(rawTime);

        return {
          age,
          day,
          location: rawLocation,
          month,
          time,
        };
      });
  }

  private parseAge(age: string): number {
    return parseInt(age.split("u")[0]);
  }
  private parseDate(date: string): { month: number; day: number } {
    const [year, month, day] = date.split("-").map(Number);
    return { month, day };
  }
  private parseTime(time: string): Time {
    // Regular expressions to match various time formats
    const simpleTime = /^(?<hour>[0-9]{1,2})(?<minute>[0-9]{2})?$/; // Matches "530" or "8"
    const detailedTime = /^(?<hour>[0-9]{2}):(?<minute>[0-9]{2}):[0-9]{2}$/; // Matches "05:30:00"

    let match = time.match(simpleTime);
    if (match) {
      let hour = parseInt(match.groups!.hour);
      let minute = match.groups!.minute ? parseInt(match.groups!.minute) : 0;
      return {
        hour: hour > 12 ? hour % 12 : hour,
        minute: minute,
        ampm: hour >= 12 ? "PM" : "AM",
      };
    }

    match = time.match(detailedTime);
    if (match) {
      let hour = parseInt(match.groups!.hour);
      let minute = parseInt(match.groups!.minute);
      return {
        hour: hour > 12 ? hour % 12 : hour,
        minute: minute,
        ampm: hour >= 12 ? "PM" : "AM",
      };
    }

    throw new Error(`Unsupported time format: ${time}`);
  }
}
     
