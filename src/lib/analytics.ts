export const DATASET_SIZE = 100_000;
export const DATASET_DAYS = 180;
export const DATASET_END = "2026-08-13";
export const DATASET_SEED = 20_260_814;

export const TEAMS = ["Atlas", "Beacon", "Comet", "Delta"] as const;
export const CATEGORIES = ["Access", "Billing", "Playback", "Profile"] as const;
export const CHANNELS = ["Chat", "Email", "Phone"] as const;
export const PERIODS = [7, 30, 90, 180] as const;

export type Team = (typeof TEAMS)[number];
export type Category = (typeof CATEGORIES)[number];
export type Channel = (typeof CHANNELS)[number];
export type Period = (typeof PERIODS)[number];

export interface Ticket {
  id: string;
  day: number;
  date: string;
  team: Team;
  category: Category;
  channel: Channel;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  csat: number;
  firstContactResolved: boolean;
  reopened: boolean;
}

export interface Filters {
  period: Period;
  team: Team | "all";
  category: Category | "all";
}

export interface Metrics {
  volume: number;
  slaRate: number;
  fcrRate: number;
  csat: number;
  medianResolution: number;
}

export interface TrendPoint {
  date: string;
  volume: number;
  slaRate: number;
}

export interface TeamSummary extends Metrics {
  team: Team;
}

export interface Insight {
  eyebrow: string;
  title: string;
  detail: string;
}

export interface AnalyticsSnapshot {
  records: Ticket[];
  metrics: Metrics;
  previousMetrics: Metrics | null;
  trend: TrendPoint[];
  teams: TeamSummary[];
  insights: Insight[];
  elapsedMs: number;
}

const TEAM_WEIGHTS = [0.28, 0.25, 0.25, 0.22] as const;
const CATEGORY_WEIGHTS = [0.27, 0.22, 0.31, 0.2] as const;
const CHANNEL_WEIGHTS = [0.56, 0.29, 0.15] as const;
const END_UTC = Date.parse(`${DATASET_END}T00:00:00Z`);

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pickWeighted<T>(values: readonly T[], weights: readonly number[], random: () => number): T {
  const needle = random();
  let total = 0;
  for (let index = 0; index < values.length; index += 1) {
    total += weights[index];
    if (needle <= total) return values[index];
  }
  return values.at(-1)!;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, precision = 0): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}

function dateForDay(day: number): string {
  const daysFromEnd = DATASET_DAYS - 1 - day;
  return new Date(END_UTC - daysFromEnd * 86_400_000).toISOString().slice(0, 10);
}

export function generateTickets(count = DATASET_SIZE, seed = DATASET_SEED): Ticket[] {
  const random = mulberry32(seed);
  const rows: Ticket[] = new Array(count);
  const teamResponseBias: Record<Team, number> = { Atlas: -1.6, Beacon: 0.3, Comet: -0.4, Delta: 3 };
  const teamFcrBias: Record<Team, number> = { Atlas: 0.06, Beacon: 0.01, Comet: 0.03, Delta: -0.05 };
  const categoryResponseBias: Record<Category, number> = { Access: 1.1, Billing: 0.2, Playback: 2, Profile: -0.8 };
  const categoryResolutionBias: Record<Category, number> = { Access: 18, Billing: 24, Playback: 31, Profile: 8 };

  for (let index = 0; index < count; index += 1) {
    const day = Math.floor(random() * DATASET_DAYS);
    const team = pickWeighted(TEAMS, TEAM_WEIGHTS, random);
    const category = pickWeighted(CATEGORIES, CATEGORY_WEIGHTS, random);
    const channel = pickWeighted(CHANNELS, CHANNEL_WEIGHTS, random);
    const date = dateForDay(day);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekendPenalty = weekday === 0 || weekday === 6 ? 3.4 : 0;
    const recentImprovement = day >= 150 ? -1.2 : day >= 120 ? -0.5 : 0;
    const responseNoise = (random() + random() + random()) * 4;
    const firstResponseMinutes = Math.max(
      1,
      Math.round(
        4.2 +
          teamResponseBias[team] +
          categoryResponseBias[category] +
          weekendPenalty +
          recentImprovement +
          responseNoise,
      ),
    );
    const firstContactProbability = clamp(
      0.77 + teamFcrBias[team] - categoryResolutionBias[category] / 500 + recentImprovement * -0.008,
      0.52,
      0.9,
    );
    const firstContactResolved = random() < firstContactProbability;
    const reopened = random() < (firstContactResolved ? 0.035 : 0.13);
    const resolutionMinutes = Math.round(
      12 +
        categoryResolutionBias[category] +
        firstResponseMinutes * 1.7 +
        (firstContactResolved ? 0 : 38) +
        (reopened ? 44 : 0) +
        random() * 48,
    );
    const csat = round(
      clamp(
        4.82 - firstResponseMinutes * 0.018 - (firstContactResolved ? 0 : 0.26) - (reopened ? 0.34 : 0) +
          (random() - 0.5) * 0.52,
        1,
        5,
      ),
      1,
    );

    rows[index] = {
      id: `SO-${String(index + 1).padStart(6, "0")}`,
      day,
      date,
      team,
      category,
      channel,
      firstResponseMinutes,
      resolutionMinutes,
      csat,
      firstContactResolved,
      reopened,
    };
  }

  return rows;
}

export function filterTickets(tickets: Ticket[], filters: Filters): Ticket[] {
  const firstDay = DATASET_DAYS - filters.period;
  return tickets.filter(
    (ticket) =>
      ticket.day >= firstDay &&
      (filters.team === "all" || ticket.team === filters.team) &&
      (filters.category === "all" || ticket.category === filters.category),
  );
}

function previousTickets(tickets: Ticket[], filters: Filters): Ticket[] {
  const currentStart = DATASET_DAYS - filters.period;
  const previousStart = currentStart - filters.period;
  if (previousStart < 0) return [];
  return tickets.filter(
    (ticket) =>
      ticket.day >= previousStart &&
      ticket.day < currentStart &&
      (filters.team === "all" || ticket.team === filters.team) &&
      (filters.category === "all" || ticket.category === filters.category),
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function calculateMetrics(tickets: Ticket[]): Metrics {
  if (tickets.length === 0) {
    return { volume: 0, slaRate: 0, fcrRate: 0, csat: 0, medianResolution: 0 };
  }
  let slaCount = 0;
  let fcrCount = 0;
  let csatTotal = 0;
  const resolutionTimes = new Array<number>(tickets.length);

  tickets.forEach((ticket, index) => {
    if (ticket.firstResponseMinutes <= 15) slaCount += 1;
    if (ticket.firstContactResolved) fcrCount += 1;
    csatTotal += ticket.csat;
    resolutionTimes[index] = ticket.resolutionMinutes;
  });

  return {
    volume: tickets.length,
    slaRate: round((slaCount / tickets.length) * 100, 1),
    fcrRate: round((fcrCount / tickets.length) * 100, 1),
    csat: round(csatTotal / tickets.length, 2),
    medianResolution: round(median(resolutionTimes), 1),
  };
}

function buildTrend(tickets: Ticket[]): TrendPoint[] {
  const daily = new Map<string, { volume: number; sla: number }>();
  tickets.forEach((ticket) => {
    const current = daily.get(ticket.date) ?? { volume: 0, sla: 0 };
    current.volume += 1;
    if (ticket.firstResponseMinutes <= 15) current.sla += 1;
    daily.set(ticket.date, current);
  });
  return [...daily.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({
      date,
      volume: value.volume,
      slaRate: round((value.sla / value.volume) * 100, 1),
    }));
}

function buildTeamSummaries(tickets: Ticket[]): TeamSummary[] {
  return TEAMS.map((team) => ({ team, ...calculateMetrics(tickets.filter((ticket) => ticket.team === team)) })).filter(
    (summary) => summary.volume > 0,
  );
}

function buildInsights(tickets: Ticket[], teams: TeamSummary[]): Insight[] {
  if (tickets.length === 0) return [];

  const byCategory = CATEGORIES.map((category) => ({
    category,
    count: tickets.filter((ticket) => ticket.category === category).length,
  })).sort((left, right) => right.count - left.count);
  const topCategory = byCategory[0];
  const representedCategories = byCategory.filter((item) => item.count > 0).length;
  const byChannel = CHANNELS.map((channel) => ({
    channel,
    count: tickets.filter((ticket) => ticket.channel === channel).length,
  })).sort((left, right) => right.count - left.count);
  const topChannel = byChannel[0];
  const opportunityTeam = [...teams].sort((left, right) => left.slaRate - right.slaRate)[0];
  const slaGap = round(80 - opportunityTeam.slaRate, 1);
  const weekend = tickets.filter((ticket) => {
    const weekday = new Date(`${ticket.date}T00:00:00Z`).getUTCDay();
    return weekday === 0 || weekday === 6;
  });
  const weekday = tickets.filter((ticket) => {
    const day = new Date(`${ticket.date}T00:00:00Z`).getUTCDay();
    return day !== 0 && day !== 6;
  });
  const weekendResponse = weekend.reduce((sum, ticket) => sum + ticket.firstResponseMinutes, 0) / weekend.length;
  const weekdayResponse = weekday.reduce((sum, ticket) => sum + ticket.firstResponseMinutes, 0) / weekday.length;

  const demandInsight: Insight = representedCategories > 1
    ? {
        eyebrow: "Demand mix",
        title: `${topCategory.category} leads volume`,
        detail: `${round((topCategory.count / tickets.length) * 100, 1)}% of the selected tickets. Capacity planning should start with this queue.`,
      }
    : {
        eyebrow: "Channel mix",
        title: `${topChannel.channel} carries the selected queue`,
        detail: `${round((topChannel.count / tickets.length) * 100, 1)}% of these tickets arrived through ${topChannel.channel.toLowerCase()}.`,
      };

  return [
    demandInsight,
    {
      eyebrow: "Team opportunity",
      title: slaGap > 0 ? `${opportunityTeam.team} is below the SLA target` : `${opportunityTeam.team} has the narrowest SLA margin`,
      detail:
        slaGap > 0
          ? `${opportunityTeam.slaRate}% met the 15-minute target, a ${slaGap}-point gap to close.`
          : `${opportunityTeam.slaRate}% met the 15-minute target, ${Math.abs(slaGap)} points above the threshold.`,
    },
    {
      eyebrow: "Coverage pattern",
      title: "Weekends carry a response penalty",
      detail: `Average first response is ${round(weekendResponse - weekdayResponse, 1)} minutes slower on weekends than weekdays.`,
    },
  ];
}

export function buildSnapshot(tickets: Ticket[], filters: Filters): AnalyticsSnapshot {
  const start = typeof performance === "undefined" ? Date.now() : performance.now();
  const records = filterTickets(tickets, filters);
  const previous = previousTickets(tickets, filters);
  const teams = buildTeamSummaries(records);
  const end = typeof performance === "undefined" ? Date.now() : performance.now();

  return {
    records,
    metrics: calculateMetrics(records),
    previousMetrics: previous.length > 0 ? calculateMetrics(previous) : null,
    trend: buildTrend(records),
    teams,
    insights: buildInsights(records, teams),
    elapsedMs: round(end - start, 1),
  };
}

export function ticketToCsv(tickets: Ticket[]): string {
  const header = [
    "ticket_id",
    "date",
    "team",
    "category",
    "channel",
    "first_response_minutes",
    "resolution_minutes",
    "csat",
    "first_contact_resolved",
    "reopened",
  ];
  const rows = tickets.map((ticket) => [
    ticket.id,
    ticket.date,
    ticket.team,
    ticket.category,
    ticket.channel,
    ticket.firstResponseMinutes,
    ticket.resolutionMinutes,
    ticket.csat,
    ticket.firstContactResolved,
    ticket.reopened,
  ]);
  return [header, ...rows].map((row) => row.join(",")).join("\n");
}
