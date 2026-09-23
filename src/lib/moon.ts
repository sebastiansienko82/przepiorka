const DAY_MS = 86_400_000;
const SYNODIC_DAYS = 29.530588853;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const RAD = Math.PI / 180;
const OBLIQUITY = RAD * 23.4397;
const SUN_DISTANCE_KM = 149_598_000;
const ZONE = "Europe/Warsaw";

export type MoonNow = {
  phase: number;
  fraction: number;
  name: string;
  dateLabel: string;
  detailLabel: string;
};

export type MoonEvent = {
  name: string;
  phase: number;
  at: Date;
  whenLabel: string;
  iso: string;
};

const PRINCIPAL = [
  { phase: 0, name: "Nów" },
  { phase: 0.25, name: "Pierwsza kwadra" },
  { phase: 0.5, name: "Pełnia" },
  { phase: 0.75, name: "Ostatnia kwadra" },
] as const;

function toDays(date: Date): number {
  return date.getTime() / DAY_MS - 0.5 + J1970 - J2000;
}

function rightAscension(eclipticLon: number, eclipticLat: number): number {
  return Math.atan2(
    Math.sin(eclipticLon) * Math.cos(OBLIQUITY) - Math.tan(eclipticLat) * Math.sin(OBLIQUITY),
    Math.cos(eclipticLon),
  );
}

function declination(eclipticLon: number, eclipticLat: number): number {
  return Math.asin(
    Math.sin(eclipticLat) * Math.cos(OBLIQUITY) + Math.cos(eclipticLat) * Math.sin(OBLIQUITY) * Math.sin(eclipticLon),
  );
}

function sunCoords(days: number): { ra: number; dec: number } {
  const anomaly = RAD * (357.5291 + 0.98560028 * days);
  const center = RAD * (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly));
  const lon = anomaly + center + RAD * 102.9372 + Math.PI;
  return { ra: rightAscension(lon, 0), dec: declination(lon, 0) };
}

function moonCoords(days: number): { ra: number; dec: number; dist: number } {
  const lon = RAD * (218.316 + 13.176396 * days);
  const anomaly = RAD * (134.963 + 0.518491 * days);
  const latitudeArg = RAD * (93.272 + 13.22935 * days);
  const eclipticLon = lon + RAD * 6.289 * Math.sin(anomaly);
  const eclipticLat = RAD * 5.128 * Math.sin(latitudeArg);
  return {
    ra: rightAscension(eclipticLon, eclipticLat),
    dec: declination(eclipticLon, eclipticLat),
    dist: 385001 - 20905 * Math.cos(anomaly),
  };
}

/** Phase in [0, 1): 0 nów, 0.25 pierwsza kwadra, 0.5 pełnia, 0.75 ostatnia kwadra. */
export function moonPhase(date: Date): { phase: number; fraction: number } {
  const days = toDays(date);
  const sun = sunCoords(days);
  const moon = moonCoords(days);
  const elongation = Math.acos(
    Math.sin(sun.dec) * Math.sin(moon.dec) +
      Math.cos(sun.dec) * Math.cos(moon.dec) * Math.cos(sun.ra - moon.ra),
  );
  const incidence = Math.atan2(SUN_DISTANCE_KM * Math.sin(elongation), moon.dist - SUN_DISTANCE_KM * Math.cos(elongation));
  const angle = Math.atan2(
    Math.cos(sun.dec) * Math.sin(sun.ra - moon.ra),
    Math.sin(sun.dec) * Math.cos(moon.dec) - Math.cos(sun.dec) * Math.sin(moon.dec) * Math.cos(sun.ra - moon.ra),
  );
  let phase = 0.5 + (0.5 * incidence * (angle < 0 ? -1 : 1)) / Math.PI;
  phase = ((phase % 1) + 1) % 1;
  return { phase, fraction: (1 + Math.cos(incidence)) / 2 };
}

export function phaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  const near = (target: number) => {
    const delta = Math.abs(p - target);
    return Math.min(delta, 1 - delta) < 0.03;
  };
  if (near(0)) return "Nów";
  if (near(0.25)) return "Pierwsza kwadra";
  if (near(0.5)) return "Pełnia";
  if (near(0.75)) return "Ostatnia kwadra";
  if (p < 0.25) return "Sierp przybywający";
  if (p < 0.5) return "Księżyc garbaty przybywający";
  if (p < 0.75) return "Księżyc garbaty ubywający";
  return "Sierp ubywający";
}

function ageLabel(phase: number): string {
  const days = Math.round(phase * SYNODIC_DAYS);
  if (days === 0) return "dzień nowiu";
  if (days === 1) return "1 dzień od nowiu";
  return `${days} dni od nowiu`;
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("pl-PL") + value.slice(1);
}

function warsawDay(date: Date, shift = 0): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.UTC(year, month - 1, day + shift, 12)),
  );
}

function whenLabel(at: Date, now: Date): string {
  const day = warsawDay(at);
  if (day === warsawDay(now)) return "dziś";
  if (day === warsawDay(now, 1)) return "jutro";
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(at);
}

function signedPhase(phase: number, target: number): number {
  let delta = phase - target;
  if (delta > 0.5) delta -= 1;
  if (delta < -0.5) delta += 1;
  return delta;
}

function nextInstant(from: Date, target: number): Date {
  const start = moonPhase(from).phase;
  let ahead = (target - start + 1) % 1;
  if (ahead < 0.0001) ahead = 1;
  const guess = from.getTime() + ahead * SYNODIC_DAYS * DAY_MS;
  let lo = guess - 2 * DAY_MS;
  let hi = guess + 2 * DAY_MS;
  if (signedPhase(moonPhase(new Date(lo)).phase, target) > 0) lo -= 2 * DAY_MS;
  if (signedPhase(moonPhase(new Date(hi)).phase, target) < 0) hi += 2 * DAY_MS;
  for (let i = 0; i < 48; i += 1) {
    const mid = (lo + hi) / 2;
    if (signedPhase(moonPhase(new Date(mid)).phase, target) < 0) lo = mid;
    else hi = mid;
  }
  return new Date((lo + hi) / 2);
}

export function moonNow(date = new Date()): MoonNow {
  const { phase, fraction } = moonPhase(date);
  const dateLabel = capitalize(
    new Intl.DateTimeFormat("pl-PL", {
      timeZone: ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
  );
  const illumination = Math.round(fraction * 100);
  return {
    phase,
    fraction,
    name: phaseName(phase),
    dateLabel,
    detailLabel: `Oświetlenie ${illumination}% · ${ageLabel(phase)}`,
  };
}

export function upcomingPhases(date = new Date()): MoonEvent[] {
  return PRINCIPAL.map((item) => {
    const at = nextInstant(date, item.phase);
    return {
      name: item.name,
      phase: item.phase,
      at,
      whenLabel: capitalize(whenLabel(at, date)),
      iso: at.toISOString(),
    };
  }).sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Lit limb for the northern hemisphere: waxing moon is bright on the right. */
export function moonLitPath(phase: number, cx = 50, cy = 50, radius = 46): string {
  const p = ((phase % 1) + 1) % 1;
  const rx = Math.max(Math.abs(Math.cos(p * 2 * Math.PI)) * radius, 0.01);
  const top = `${cx} ${cy - radius}`;
  const bottom = `${cx} ${cy + radius}`;
  if (p <= 0.5) {
    const sweep = p <= 0.25 ? 0 : 1;
    return `M ${top} A ${radius} ${radius} 0 0 1 ${bottom} A ${rx} ${radius} 0 0 ${sweep} ${top} Z`;
  }
  const sweep = p <= 0.75 ? 1 : 0;
  return `M ${top} A ${radius} ${radius} 0 0 0 ${bottom} A ${rx} ${radius} 0 0 ${sweep} ${top} Z`;
}
