import { describe, expect, it } from "vitest";
import {
  isValidRRule,
  nextOccurrence,
  occurrencesBetween,
  parseRRule,
} from "../src/domain/recurrence";

describe("rrule subset", () => {
  it("validates rules", () => {
    expect(isValidRRule("FREQ=MONTHLY;INTERVAL=1")).toBe(true);
    expect(isValidRRule("RRULE:FREQ=WEEKLY;BYDAY=MO")).toBe(true);
    expect(isValidRRule("INTERVAL=2")).toBe(false);
    expect(isValidRRule("FREQ=HOURLY")).toBe(false);
  });

  it("parses frequency, interval, count and until", () => {
    const parsed = parseRRule("FREQ=MONTHLY;INTERVAL=2;COUNT=3;UNTIL=20241231T000000Z");
    expect(parsed?.freq).toBe("MONTHLY");
    expect(parsed?.interval).toBe(2);
    expect(parsed?.count).toBe(3);
    expect(parsed?.until).toBe("2024-12-31");
  });

  it("generates monthly occurrences strictly after the cursor", () => {
    const occurrences = occurrencesBetween(
      "FREQ=MONTHLY;INTERVAL=1",
      "2024-01-10",
      "2024-02-01",
      "2024-04-30",
    );
    expect(occurrences).toEqual(["2024-02-10", "2024-03-10", "2024-04-10"]);
  });

  it("clamps day 31 to the last day of shorter months", () => {
    const occurrences = occurrencesBetween(
      "FREQ=MONTHLY;INTERVAL=1",
      "2024-01-31",
      "2024-01-01",
      "2024-04-30",
    );
    expect(occurrences).toEqual(["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"]);
  });

  it("respects COUNT", () => {
    const occurrences = occurrencesBetween(
      "FREQ=DAILY;COUNT=3",
      "2024-03-01",
      "2024-02-28",
      "2024-03-31",
    );
    expect(occurrences).toEqual(["2024-03-01", "2024-03-02", "2024-03-03"]);
  });

  it("respects UNTIL", () => {
    const occurrences = occurrencesBetween(
      "FREQ=DAILY;UNTIL=20240303T000000Z",
      "2024-03-01",
      "2024-02-28",
      "2024-03-31",
    );
    expect(occurrences).toEqual(["2024-03-01", "2024-03-02", "2024-03-03"]);
  });

  it("computes the next occurrence", () => {
    expect(nextOccurrence("FREQ=WEEKLY;INTERVAL=1", "2024-03-01", "2024-03-05")).toBe("2024-03-08");
  });
});
