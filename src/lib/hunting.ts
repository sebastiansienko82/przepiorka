import {
  CONDITIONS,
  SPECIES,
  type Condition,
  type Icon,
  type Method,
  type Season,
  type Span,
  type Species,
} from "../data/hunting-calendar";

const LAST_DAY = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface MonthPart {
  who?: string;
  text: string;
  condition?: Condition;
  icons: Icon[];
}

export interface MonthRow {
  id: string;
  name: string;
  detail?: string;
  icons: Icon[];
  parts: MonthPart[];
}

export interface TodayCard {
  name: string;
  detail?: string;
  icons: Icon[];
  lines: string[];
  extended: boolean;
}

interface Clip {
  fromDay: number;
  toDay: number;
}

function spanKey(span: Span): number {
  const day = span.day === "end" ? 31 : span.day;
  return span.month * 40 + day;
}

function crossesYear(season: Season): boolean {
  return spanKey(season.from) > spanKey(season.to);
}

function clipMonth(season: Season, month: number): Clip | null {
  const fromKey = spanKey(season.from);
  const toKey = spanKey(season.to);
  const start = season.from.month;
  const end = season.to.month;
  const inside = fromKey <= toKey ? month >= start && month <= end : month >= start || month <= end;
  if (!inside) return null;
  const fromDay = month === start ? (season.from.day === "end" ? LAST_DAY[month] : season.from.day) : 1;
  const toDay = month === end ? (season.to.day === "end" ? LAST_DAY[month] : season.to.day) : LAST_DAY[month];
  return { fromDay, toDay };
}

function phrase(clip: Clip, month: number, method: Method): string {
  const last = LAST_DAY[month];
  const whole = clip.fromDay === 1 && clip.toDay >= last;
  const fromStart = clip.fromDay === 1;
  const toEnd = clip.toDay >= last;
  if (method === "trapping") {
    if (whole) return "odłów przez cały miesiąc";
    if (fromStart) return `odłów do ${clip.toDay}.`;
    if (toEnd) return `odłów od ${clip.fromDay}.`;
    return `odłów od ${clip.fromDay}. do ${clip.toDay}.`;
  }
  if (whole) return "cały miesiąc";
  if (fromStart) return `do ${clip.toDay}.`;
  if (toEnd) return `od ${clip.fromDay}.`;
  return `od ${clip.fromDay}. do ${clip.toDay}.`;
}

function sameClip(a: Clip, b: Clip): boolean {
  return a.fromDay === b.fromDay && a.toDay === b.toDay;
}

function combine(hunt: Clip | undefined, trap: Clip | undefined, month: number): string {
  if (hunt && trap) {
    if (sameClip(hunt, trap)) {
      const base = phrase(hunt, month, "hunt");
      return base === "cały miesiąc" ? "cały miesiąc, także odłów" : `${base}, także odłów`;
    }
    return `${phrase(hunt, month, "hunt")}, ${phrase(trap, month, "trapping")}`;
  }
  if (hunt) return phrase(hunt, month, "hunt");
  return phrase(trap!, month, "trapping");
}

function uniqueIcons(icons: Icon[]): Icon[] {
  const seen = new Set<string>();
  return icons.filter((icon) => {
    if (seen.has(icon.src)) return false;
    seen.add(icon.src);
    return true;
  });
}

export function rowsForMonth(month: number): MonthRow[] {
  return SPECIES.flatMap((species) => {
    const groups = new Map<string, Season[]>();
    for (const season of species.seasons) {
      const key = `${season.who ?? ""}|${season.condition ?? ""}`;
      const list = groups.get(key) ?? [];
      list.push(season);
      groups.set(key, list);
    }
    const parts: MonthPart[] = [];
    for (const seasons of groups.values()) {
      const hunt = seasons.find((season) => (season.method ?? "hunt") === "hunt");
      const trap = seasons.find((season) => season.method === "trapping");
      const huntClip = hunt ? clipMonth(hunt, month) : null;
      const trapClip = trap ? clipMonth(trap, month) : null;
      if (!huntClip && !trapClip) continue;
      const sample = hunt ?? trap!;
      parts.push({
        who: sample.who,
        text: combine(huntClip ?? undefined, trapClip ?? undefined, month),
        condition: sample.condition,
        icons: uniqueIcons(seasons.flatMap((season) => season.icons ?? species.icons)),
      });
    }
    if (!parts.length) return [];
    return [
      {
        id: species.id,
        name: species.name,
        detail: species.detail,
        icons: uniqueIcons(parts.flatMap((part) => part.icons)),
        parts,
      },
    ];
  });
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function stamp(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function holidayStamps(year: number): Set<string> {
  const fixed = [
    [1, 1],
    [1, 6],
    [5, 1],
    [5, 3],
    [8, 15],
    [11, 1],
    [11, 11],
    [12, 25],
    [12, 26],
  ];
  const stamps = new Set(fixed.map(([month, day]) => stamp(new Date(year, month - 1, day))));
  const easter = easterSunday(year);
  stamps.add(stamp(easter));
  stamps.add(stamp(addDays(easter, 1)));
  stamps.add(stamp(addDays(easter, 49)));
  stamps.add(stamp(addDays(easter, 60)));
  return stamps;
}

const holidays = new Map<number, Set<string>>();

function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  let set = holidays.get(year);
  if (!set) {
    set = holidayStamps(year);
    holidays.set(year, set);
  }
  return set.has(stamp(date));
}

function isDayOff(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6 || isHoliday(date);
}

function extendStart(start: Date): Date {
  if (!isDayOff(addDays(start, -1))) return start;
  let cursor = addDays(start, -1);
  while (isDayOff(addDays(cursor, -1))) cursor = addDays(cursor, -1);
  return cursor;
}

function extendEnd(end: Date): Date {
  if (!isDayOff(addDays(end, 1))) return end;
  let cursor = addDays(end, 1);
  while (isDayOff(addDays(cursor, 1))) cursor = addDays(cursor, 1);
  return cursor;
}

function resolve(span: Span, year: number): Date {
  const day = span.day === "end" ? new Date(year, span.month, 0).getDate() : span.day;
  return new Date(year, span.month - 1, day);
}

function covers(date: Date, season: Season, startYear: number): "nominal" | "extended" | null {
  const nominalStart = resolve(season.from, startYear);
  const nominalEnd = resolve(season.to, crossesYear(season) ? startYear + 1 : startYear);
  const value = stamp(date);
  if (value >= stamp(nominalStart) && value <= stamp(nominalEnd)) return "nominal";
  const start = extendStart(nominalStart);
  const end = extendEnd(nominalEnd);
  if (value >= stamp(start) && value <= stamp(end)) return "extended";
  return null;
}

interface OpenSlice {
  who?: string;
  method: Method;
  condition?: Condition;
  extended: boolean;
  icons: Icon[];
}

function openSlices(date: Date, species: Species): OpenSlice[] {
  const year = date.getFullYear();
  const slices: OpenSlice[] = [];
  for (const season of species.seasons) {
    const status = covers(date, season, year) ?? covers(date, season, year - 1);
    if (!status) continue;
    slices.push({
      who: season.who,
      method: season.method ?? "hunt",
      condition: season.condition,
      extended: status === "extended",
      icons: season.icons ?? species.icons,
    });
  }
  return slices;
}

function joinWho(whos: Array<string | undefined>): string {
  const names = whos.filter((who): who is string => !!who);
  if (!names.length) return "";
  if (names.some((name) => name.includes(" i "))) return names.join(", ");
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} i ${names[names.length - 1]}`;
}

function line(whos: Array<string | undefined>, suffix: string): string {
  const who = joinWho(whos);
  if (who && suffix) return `${who} — ${suffix}`;
  return who || suffix;
}

export function openToday(date: Date): TodayCard[] {
  return SPECIES.flatMap((species) => {
    const slices = openSlices(date, species);
    if (!slices.length) return [];
    const plain = slices.filter((slice) => !slice.condition);
    const plainWho = new Set(plain.map((slice) => slice.who ?? ""));
    const lines: string[] = [];
    const hunt = plain.filter((slice) => slice.method === "hunt");
    const trap = plain.filter((slice) => slice.method === "trapping");
    const huntWho = new Set(hunt.map((slice) => slice.who ?? ""));
    const trapWho = new Set(trap.map((slice) => slice.who ?? ""));
    const both = [...huntWho].filter((who) => trapWho.has(who));
    const huntOnly = [...huntWho].filter((who) => !trapWho.has(who));
    const trapOnly = [...trapWho].filter((who) => !huntWho.has(who));
    if (both.length) lines.push(line(both, "polowanie i odłów"));
    if (huntOnly.length) {
      const text = line(huntOnly, "");
      if (text) lines.push(text);
    }
    if (trapOnly.length) lines.push(line(trapOnly, "tylko odłów"));
    for (const condition of ["grouse", "grouse-or-restock", "ohz-pheasant"] as const) {
      const extra = slices.filter((slice) => slice.condition === condition && !plainWho.has(slice.who ?? ""));
      if (!extra.length) continue;
      lines.push(line(extra.map((slice) => slice.who), CONDITIONS[condition]));
    }
    return [
      {
        name: species.name,
        detail: species.detail,
        icons: uniqueIcons(slices.flatMap((slice) => slice.icons)),
        lines,
        extended: slices.some((slice) => slice.extended && !slice.condition),
      },
    ];
  });
}
