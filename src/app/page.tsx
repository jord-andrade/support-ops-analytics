import Dashboard, { DemoState } from "@/components/dashboard";
import { CATEGORIES, Filters, PERIODS, Period, TEAMS } from "@/lib/analytics";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const periodValue = Number(first(params.period));
  const teamValue = first(params.team);
  const categoryValue = first(params.category);
  const demoValue = first(params.demo);
  const initialFilters: Filters = {
    period: PERIODS.includes(periodValue as Period) ? (periodValue as Period) : 30,
    team: TEAMS.includes(teamValue as (typeof TEAMS)[number]) ? (teamValue as Filters["team"]) : "all",
    category: CATEGORIES.includes(categoryValue as (typeof CATEGORIES)[number])
      ? (categoryValue as Filters["category"])
      : "all",
  };
  const initialDemoState: DemoState = demoValue === "empty" || demoValue === "error" ? demoValue : "live";

  return <Dashboard initialFilters={initialFilters} initialDemoState={initialDemoState} />;
}
