const DAY_MS = 86_400_000;
const SYNODIC_DAYS = 29.530588853;
const J1970 = 2_440_588;
const J2000 = 2_451_545;
const RAD = Math.PI / 180;
const OBLIQUITY = RAD * 23.4397;
const SUN_DISTANCE_KM = 149_598_000;
const ZONE = "Europe/Warsaw";
/** Białystok: 53°7'55" N, 23°10'8" E. */
const LAT = 53 + 7 / 60 + 55 / 3600;
const LNG = 23 + 10 / 60 + 8 / 3600;
/** Upper limb of the Sun, with standard atmospheric refraction. */
const SUNRISE_ALTITUDE = RAD * -0.833;

export type MoonNow = {
  phase: number;
  fraction: number;
  name: string;
  dateLabel: string;
  detailLabel: string;
  sunriseLabel: string;
  sunsetLabel: string;
  sunriseIso: string;
  sunsetIso: string;
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

function solarMeanAnomaly(days: number): number {
  return RAD * (357.5291 + 0.98560028 * days);
}

function eclipticLongitude(anomaly: number): number {
  const center = RAD * (1.9148 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly) + 0.0003 * Math.sin(3 * anomaly));
  return anomaly + center + RAD * 102.9372 + Math.PI;
}

function sunCoords(days: number): { ra: number; dec: number } {
  const lon = eclipticLongitude(solarMeanAnomaly(days));
  return { ra: rightAscension(lon, 0), dec: declination(lon, 0) };
}

function wrap360(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const century = Math.floor(y / 100);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + 2 - century + Math.floor(century / 4) - 1524.5;
}

function sunDeclination(centuries: number): number {
  const anomaly = RAD * (357.52911 + centuries * (35999.05029 - 0.0001537 * centuries));
  const center =
    Math.sin(anomaly) * (1.914602 - centuries * (0.004817 + 0.000014 * centuries)) +
    Math.sin(2 * anomaly) * (0.019993 - 0.000101 * centuries) +
    Math.sin(3 * anomaly) * 0.000289;
  const omega = RAD * (125.04 - 1934.136 * centuries);
  const longitude = RAD * (wrap360(280.46646 + centuries * (36000.76983 + centuries * 0.0003032)) + center - 0.00569 - 0.00478 * Math.sin(omega));
  const seconds = 21.448 - centuries * (46.815 + centuries * (0.00059 - centuries * 0.001813));
  const obliquity = RAD * (23 + (26 + seconds / 60) / 60 + 0.00256 * Math.cos(omega));
  return Math.asin(Math.sin(obliquity) * Math.sin(longitude));
}

function equationOfTime(centuries: number): number {
  const obliquity = RAD * (23 + (26 + (21.448 - centuries * (46.815 + centuries * (0.00059 - centuries * 0.001813))) / 60) / 60);
  const omega = RAD * (125.04 - 1934.136 * centuries);
  const corrected = obliquity + RAD * 0.00256 * Math.cos(omega);
  const meanLongitude = RAD * wrap360(280.46646 + centuries * (36000.76983 + centuries * 0.0003032));
  const eccentricity = 0.016708634 - centuries * (0.000042037 + 0.0000001267 * centuries);
  const anomaly = RAD * (357.52911 + centuries * (35999.05029 - 0.0001537 * centuries));
  const y = Math.tan(corrected / 2) ** 2;
  const minutes =
    y * Math.sin(2 * meanLongitude) -
    2 * eccentricity * Math.sin(anomaly) +
    4 * eccentricity * y * Math.sin(anomaly) * Math.cos(2 * meanLongitude) -
    0.5 * y * y * Math.sin(4 * meanLongitude) -
    1.25 * eccentricity * eccentricity * Math.sin(2 * anomaly);
  return (minutes / RAD) * 4;
}

/** Minutes after 00:00 UTC. A second pass uses the event time, not noon. */
function solarEventMinutes(julian: number, rising: boolean): number {
  const centuries = (julian - J2000) / 36525;
  const declination = sunDeclination(centuries);
  const latitude = LAT * RAD;
  const hourAngle = Math.acos(
    Math.cos(Math.PI / 2 - SUNRISE_ALTITUDE) / (Math.cos(latitude) * Math.cos(declination)) -
      Math.tan(latitude) * Math.tan(declination),
  );
  const longitudeDelta = LNG + (rising ? 1 : -1) * (hourAngle / RAD);
  return 720 - 4 * longitudeDelta - equationOfTime(centuries);
}

/** Sunrise and sunset for the Warsaw calendar day of `date`, at Białystok. */
function sunTimes(date: Date): { sunrise: Date; sunset: Date } {
  const [year, month, day] = warsawDay(date).split("-").map(Number);
  const noon = julianDay(year, month, day);
  const rise = solarEventMinutes(noon + solarEventMinutes(noon, true) / 1440, true);
  const set = solarEventMinutes(noon + solarEventMinutes(noon, false) / 1440, false);
  const midnight = Date.UTC(year, month - 1, day);
  return { sunrise: new Date(midnight + rise * 60_000), sunset: new Date(midnight + set * 60_000) };
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
  if (p < 0.5) return "Przybywający";
  return "Ubywający";
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

function clockLabel(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const { sunrise, sunset } = sunTimes(date);
  return {
    phase,
    fraction,
    name: phaseName(phase),
    dateLabel,
    detailLabel: `Oświetlenie ${illumination}% · ${ageLabel(phase)}`,
    sunriseLabel: clockLabel(sunrise),
    sunsetLabel: clockLabel(sunset),
    sunriseIso: sunrise.toISOString(),
    sunsetIso: sunset.toISOString(),
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

/**
 * Lit limb for the northern hemisphere: waxing moon is bright on the right.
 * Exact new and full moons are special-cased. A semicircle arc (rx = radius)
 * is ambiguous in SVG and some engines fill the opposite disk, so nów and pełnia swap.
 */
export function moonLitPath(phase: number, cx = 50, cy = 50, radius = 46): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.005 || p > 0.995) return "";
  if (Math.abs(p - 0.5) < 0.005) {
    return `M ${cx - radius} ${cy} a ${radius} ${radius} 0 1 1 ${radius * 2} 0 a ${radius} ${radius} 0 1 1 ${-radius * 2} 0 Z`;
  }

  const steps = 64;
  const waxing = p < 0.5;
  const side = waxing ? 1 : -1;
  const terminator = Math.cos(p * 2 * Math.PI);
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / steps;
    const y = cy + radius * Math.sin(t);
    const limb = cx + side * radius * Math.cos(t);
    points.push(`${limb.toFixed(2)} ${y.toFixed(2)}`);
  }
  for (let i = steps; i >= 0; i--) {
    const t = -Math.PI / 2 + (Math.PI * i) / steps;
    const y = cy + radius * Math.sin(t);
    const edge = cx + side * terminator * radius * Math.cos(t);
    points.push(`${edge.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `M ${points.join(" L ")} Z`;
}
