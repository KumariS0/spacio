import { describe, expect, it } from "vitest";
import { occupancyLabel, occupancyLevel, occupancyPercent } from "@/lib/occupancy";
import { codeFrom, friendlyError, messageFor } from "@/lib/errors";
import { campusDate, campusWeekday, durationLabel, formatClock, greeting, minutesBetween, upcomingDates } from "@/lib/time";

describe("occupancy", () => {
  it("computes percent used from capacity and available", () => {
    expect(occupancyPercent(100, 100)).toBe(0);
    expect(occupancyPercent(100, 25)).toBe(75);
    expect(occupancyPercent(24, 0)).toBe(100);
    expect(occupancyPercent(10, 12)).toBe(0);
    expect(occupancyPercent(0, 0)).toBeNull();
    expect(occupancyPercent(null, 3)).toBeNull();
  });

  it("uses the agreed thresholds", () => {
    expect(occupancyLevel(0)).toBe("plenty");
    expect(occupancyLevel(39)).toBe("plenty");
    expect(occupancyLevel(40)).toBe("moderate");
    expect(occupancyLevel(75)).toBe("moderate");
    expect(occupancyLevel(76)).toBe("busy");
    expect(occupancyLevel(100)).toBe("full");
    expect(occupancyLevel(null)).toBe("none");
    expect(occupancyLabel.plenty).toBe("Plenty of space");
  });
});

describe("error mapping", () => {
  it("maps database codes to friendly copy", () => {
    expect(friendlyError({ message: "SEAT_TAKEN" })).toMatch(/Someone just booked/);
    expect(friendlyError({ message: "CAPACITY_FULL" })).toMatch(/filled up/);
  });

  it("never leaks internal error text", () => {
    const msg = friendlyError({ message: 'duplicate key value violates unique constraint "x"' });
    expect(msg).toBe("Something went wrong. Please try again.");
    expect(codeFrom({ message: "relation public.secret does not exist" })).toBeNull();
  });

  it("recognises network failures", () => {
    expect(codeFrom({ message: "TypeError: fetch failed" })).toBe("NETWORK");
    expect(messageFor("UNKNOWN_CODE", "fallback")).toBe("fallback");
  });
});

describe("campus time helpers (Asia/Kolkata)", () => {
  // 2026-11-05 20:00 UTC = 2026-11-06 01:30 IST
  const lateUtc = new Date("2026-11-05T20:00:00Z");

  it("uses the campus calendar date, not the server's", () => {
    expect(campusDate(lateUtc)).toBe("2026-11-06");
    expect(campusWeekday(lateUtc)).toBe(5); // Friday
  });

  it("lists upcoming days starting today", () => {
    const days = upcomingDates(3, lateUtc);
    expect(days.map((d) => d.iso)).toEqual(["2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(days[0].label).toBe("Today");
    expect(days[1].label).toBe("Tomorrow");
  });

  it("formats durations and clock times", () => {
    expect(durationLabel(30)).toBe("30 min");
    expect(durationLabel(60)).toBe("1 hour");
    expect(durationLabel(150)).toBe("2 h 30 min");
    // Times use a narrow no-break space so "8 am" never wraps.
    const plain = (t: string) => t.replace(/ /g, " ");
    expect(plain(formatClock("08:00:00"))).toBe("8 am");
    expect(plain(formatClock("13:30:00"))).toBe("1:30 pm");
    expect(formatClock("24:00:00")).toBe("midnight");
    expect(minutesBetween("2026-11-05T10:00:00Z", "2026-11-05T11:30:00Z")).toBe(90);
  });

  it("greets by campus time of day", () => {
    expect(greeting(new Date("2026-11-05T03:00:00Z"))).toBe("Good morning"); // 08:30 IST
    expect(greeting(new Date("2026-11-05T08:00:00Z"))).toBe("Good afternoon"); // 13:30 IST
    expect(greeting(new Date("2026-11-05T14:00:00Z"))).toBe("Good evening"); // 19:30 IST
  });
});
