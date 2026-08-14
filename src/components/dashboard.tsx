"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CATEGORIES,
  DATASET_END,
  DATASET_SIZE,
  Filters,
  PERIODS,
  Period,
  TEAMS,
  Ticket,
  buildSnapshot,
  generateTickets,
  ticketToCsv,
} from "@/lib/analytics";

type LoadStatus = "loading" | "ready" | "error";
export type DemoState = "live" | "empty" | "error";
type SortKey = "date" | "team" | "category" | "firstResponseMinutes" | "resolutionMinutes" | "csat";
type SortDirection = "ascending" | "descending";

const DEFAULT_FILTERS: Filters = { period: 30, team: "all", category: "all" };
const PAGE_SIZE = 10;

interface DashboardProps {
  initialRecords?: Ticket[];
  initialError?: string;
  initialFilters?: Filters;
  initialDemoState?: DemoState;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function deltaLabel(current: number, previous: number | undefined, suffix = "") {
  if (previous === undefined) return "No prior window";
  const delta = current - previous;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${suffix} vs prior`;
}

function AppIcon({ name }: { name: "download" | "link" | "refresh" | "github" | "arrow" }) {
  const paths = {
    download: <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />,
    link: <path d="M9.5 14.5l5-5m-7.8 8.8l-1 .9a3.5 3.5 0 010-5l2.2-2.2a3.5 3.5 0 014.9 0m-1.6-4l1.9-1.9a3.5 3.5 0 015 5l-2.2 2.2a3.5 3.5 0 01-4.9 0" />,
    refresh: <path d="M19 7v5h-5M5 17v-5h5m8.2-.8A7 7 0 006.4 7.3L5 9m.8 3.8a7 7 0 0011.8 3.9L19 15" />,
    github: <path d="M9 19c-4 .9-4-2-5-2.5m10 5v-3.9c0-1.1.1-1.5-.5-2.1 2.8-.3 5.7-1.4 5.7-6.2A4.9 4.9 0 0018 5.9a4.5 4.5 0 00-.1-3.4s-1-.3-3.6 1.3a12.5 12.5 0 00-6.5 0C5.3 2.2 4.2 2.5 4.2 2.5a4.5 4.5 0 00-.1 3.4A4.9 4.9 0 003 9.3c0 4.8 2.9 5.9 5.7 6.2-.5.5-.6 1.2-.5 2.1V22" />,
    arrow: <path d="M5 12h14m-5-5l5 5-5 5" />,
  };
  return (
    <svg aria-hidden="true" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {paths[name]}
    </svg>
  );
}

function LoadingState() {
  return (
    <main className="dashboard-shell" aria-busy="true" aria-label="Generating synthetic dataset">
      <section className="loading-state">
        <div className="loader-mark" aria-hidden="true"><span /><span /><span /></div>
        <p className="eyebrow">Preparing the workspace</p>
        <h1>Generating 100,000 synthetic tickets.</h1>
        <p>Fixed seed. No customer records. No network request.</p>
        <div className="loading-track"><span /></div>
      </section>
    </main>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="dashboard-shell state-shell">
      <section className="empty-card" role="alert">
        <span className="state-code">DATA / 503</span>
        <h1>The synthetic workspace could not be prepared.</h1>
        <p>No partial results are shown. Retry the deterministic generator to restore the dashboard.</p>
        <button className="primary-button" onClick={onRetry}><AppIcon name="refresh" /> Retry generation</button>
      </section>
    </main>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <section className="empty-card compact-empty" aria-live="polite">
      <span className="state-code">0 matching records</span>
      <h2>No tickets in this view.</h2>
      <p>The dashboard preserves the filters but suppresses metrics that would otherwise be misleading.</p>
      <button className="secondary-button" onClick={onReset}><AppIcon name="refresh" /> Restore live data</button>
    </section>
  );
}

function TrendChart({ points }: { points: ReturnType<typeof buildSnapshot>["trend"] }) {
  if (points.length === 0) return null;
  const width = 760;
  const height = 260;
  const chartTop = 26;
  const chartBottom = 214;
  const chartHeight = chartBottom - chartTop;
  const maxVolume = Math.max(...points.map((point) => point.volume));
  const step = width / points.length;
  const line = points
    .map((point, index) => {
      const x = index * step + step / 2;
      const y = chartTop + ((100 - Math.max(50, point.slaRate)) / 50) * chartHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const summary = `${formatNumber(points.reduce((sum, point) => sum + point.volume, 0))} tickets across ${points.length} days. SLA ranges from ${Math.min(...points.map((point) => point.slaRate))}% to ${Math.max(...points.map((point) => point.slaRate))}%.`;

  return (
    <div className="chart-wrap">
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}>
        <title>{summary}</title>
        {[60, 80, 100].map((tick) => {
          const y = chartTop + ((100 - tick) / 50) * chartHeight;
          return <line key={tick} x1="0" x2={width} y1={y} y2={y} className={tick === 80 ? "target-line" : "grid-line"} />;
        })}
        {points.map((point, index) => {
          const barHeight = (point.volume / maxVolume) * chartHeight;
          return (
            <rect
              className="volume-bar"
              key={point.date}
              x={index * step + 1}
              y={chartBottom - barHeight}
              width={Math.max(1.5, step - 2)}
              height={barHeight}
              rx="1.5"
            />
          );
        })}
        <path d={line} className="sla-line" />
        {points.map((point, index) => (
          <circle
            key={`point-${point.date}`}
            className="sla-point"
            cx={index * step + step / 2}
            cy={chartTop + ((100 - Math.max(50, point.slaRate)) / 50) * chartHeight}
            r={points.length <= 30 ? 2.8 : 1.4}
          />
        ))}
      </svg>
      <div className="chart-axis" aria-hidden="true">
        <span>{formatDate(points[0].date)}</span>
        <span>{formatDate(points[Math.floor(points.length / 2)].date)}</span>
        <span>{formatDate(points.at(-1)!.date)}</span>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  target,
  detail,
  status,
}: {
  label: string;
  value: string;
  target: string;
  detail: string;
  status: "good" | "watch" | "neutral";
}) {
  return (
    <article className="metric-card">
      <div className="metric-heading"><span>{label}</span><span className={`metric-status ${status}`}><span className="sr-only">{status === "good" ? "On target" : status === "watch" ? "Needs attention" : "Informational"}</span></span></div>
      <strong>{value}</strong>
      <p>{detail}</p>
      <div className="target-row"><span>Target</span><b>{target}</b></div>
    </article>
  );
}

function TeamBoard({ teams }: { teams: ReturnType<typeof buildSnapshot>["teams"] }) {
  return (
    <div className="team-board">
      {teams.map((team) => (
        <div className="team-row" key={team.team}>
          <div className="team-label"><strong>{team.team}</strong><span>{formatNumber(team.volume)} tickets</span></div>
          <div className="team-bar" aria-label={`${team.team}: ${team.slaRate}% SLA`}>
            <span style={{ width: `${team.slaRate}%` }} />
            <i style={{ left: "80%" }} title="80% target" />
          </div>
          <strong className="team-score">{team.slaRate}%</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard({ initialRecords, initialError, initialFilters = DEFAULT_FILTERS, initialDemoState = "live" }: DashboardProps) {
  const [status, setStatus] = useState<LoadStatus>(initialError ? "error" : initialRecords ? "ready" : "loading");
  const [tickets, setTickets] = useState<Ticket[]>(initialRecords ?? []);
  const [generationMs, setGenerationMs] = useState(0);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [demoState, setDemoState] = useState<DemoState>(initialError ? "error" : initialDemoState);
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const [shareMessage, setShareMessage] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("descending");
  const [page, setPage] = useState(1);
  const shareTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initialRecords || initialError || demoState === "error" || tickets.length > 0) return;
    const timer = window.setTimeout(() => {
      try {
        const started = performance.now();
        const generated = generateTickets();
        setTickets(generated);
        setGenerationMs(Math.round((performance.now() - started) * 10) / 10);
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    }, 90);
    return () => window.clearTimeout(timer);
  }, [demoState, generationAttempt, initialError, initialRecords, tickets.length]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.period !== DEFAULT_FILTERS.period) params.set("period", String(filters.period));
    if (filters.team !== "all") params.set("team", filters.team);
    if (filters.category !== "all") params.set("category", filters.category);
    if (demoState !== "live") params.set("demo", demoState);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [demoState, filters]);

  useEffect(() => () => {
    if (shareTimer.current) clearTimeout(shareTimer.current);
  }, []);

  const snapshot = useMemo(
    () => buildSnapshot(demoState === "empty" ? [] : tickets, filters),
    [demoState, filters, tickets],
  );

  const sortedRecords = useMemo(() => {
    const direction = sortDirection === "ascending" ? 1 : -1;
    return [...snapshot.records].sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];
      return typeof leftValue === "number" && typeof rightValue === "number"
        ? (leftValue - rightValue) * direction
        : String(leftValue).localeCompare(String(rightValue)) * direction;
    });
  }, [snapshot.records, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));
  const visibleRecords = sortedRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const metrics = snapshot.metrics;
  const previous = snapshot.previousMetrics ?? undefined;

  function updateFilter<Key extends keyof Filters>(key: Key, value: Filters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function resetView() {
    setFilters(DEFAULT_FILTERS);
    setDemoState("live");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === "ascending" ? "descending" : "ascending"));
    } else {
      setSortKey(key);
      setSortDirection("ascending");
    }
    setPage(1);
  }

  function showDemoState(nextState: DemoState) {
    setDemoState(nextState);
    setPage(1);
  }

  function retryGeneration() {
    setTickets([]);
    setStatus("loading");
    setDemoState("live");
    setGenerationAttempt((current) => current + 1);
  }

  async function copyViewLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareMessage("View link copied");
    } catch {
      setShareMessage("Copy the current URL to share this view");
    }
    if (shareTimer.current) clearTimeout(shareTimer.current);
    shareTimer.current = setTimeout(() => setShareMessage(""), 2400);
  }

  function exportCurrentView() {
    const csv = ticketToCsv(snapshot.records);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `signaldesk-${filters.period}d-${filters.team}-${filters.category}.csv`.toLowerCase();
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (status === "loading") return <LoadingState />;
  if (status === "error" || demoState === "error") return <ErrorState onRetry={retryGeneration} />;

  return (
    <div className="app-frame">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="SignalDesk home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>SignalDesk</span>
        </a>
        <div className="topbar-meta">
          <span className="live-pill"><i /> Deterministic snapshot</span>
          <a href="https://github.com/jord-andrade/support-ops-analytics" target="_blank" rel="noreferrer"><AppIcon name="github" /> Source</a>
        </div>
      </header>

      <main className="dashboard-shell" id="overview">
        <section className="hero">
          <div>
            <p className="eyebrow">Support operations / performance workspace</p>
            <h1>See the queue.<br /><span>Act on the signal.</span></h1>
          </div>
          <div className="hero-note">
            <span className="synthetic-chip">100% synthetic</span>
            <p>A product-grade dashboard running entirely in your browser. No customer, agent, or company data.</p>
            <dl>
              <div><dt>Snapshot</dt><dd>{DATASET_END}</dd></div>
              <div><dt>Rows</dt><dd>{formatNumber(DATASET_SIZE)}</dd></div>
            </dl>
          </div>
        </section>

        <section className="filter-panel" aria-label="Dashboard filters">
          <div className="filter-group">
            <label htmlFor="period">Period</label>
            <select id="period" value={filters.period} onChange={(event) => updateFilter("period", Number(event.target.value) as Period)}>
              {PERIODS.map((period) => <option key={period} value={period}>Last {period} days</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="team">Team</label>
            <select id="team" value={filters.team} onChange={(event) => updateFilter("team", event.target.value as Filters["team"])}>
              <option value="all">All teams</option>
              {TEAMS.map((team) => <option key={team} value={team}>{team}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="category">Category</label>
            <select id="category" value={filters.category} onChange={(event) => updateFilter("category", event.target.value as Filters["category"])}>
              <option value="all">All categories</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </div>
          <div className="filter-actions">
            <button className="ghost-button" onClick={resetView}><AppIcon name="refresh" /> Reset</button>
            <button className="secondary-button" onClick={copyViewLink}><AppIcon name="link" /> Copy view</button>
          </div>
          <span className="sr-only" aria-live="polite">{shareMessage}</span>
        </section>

        {snapshot.records.length === 0 ? <EmptyState onReset={resetView} /> : (
          <>
            <section className="section-heading" aria-labelledby="pulse-title">
              <div><p className="eyebrow">Current pulse</p><h2 id="pulse-title">Performance against explicit targets</h2></div>
              <p>{formatNumber(metrics.volume)} matching rows aggregated in {snapshot.elapsedMs} ms</p>
            </section>

            <section className="metric-grid" aria-label="Key performance indicators">
              <MetricCard label="15m SLA" value={`${metrics.slaRate}%`} target="≥ 80%" detail={deltaLabel(metrics.slaRate, previous?.slaRate, " pts")} status={metrics.slaRate >= 80 ? "good" : "watch"} />
              <MetricCard label="First-contact resolution" value={`${metrics.fcrRate}%`} target="≥ 75%" detail={deltaLabel(metrics.fcrRate, previous?.fcrRate, " pts")} status={metrics.fcrRate >= 75 ? "good" : "watch"} />
              <MetricCard label="Customer satisfaction" value={`${metrics.csat} / 5`} target="≥ 4.20" detail={deltaLabel(metrics.csat, previous?.csat)} status={metrics.csat >= 4.2 ? "good" : "watch"} />
              <MetricCard label="Median resolution" value={`${metrics.medianResolution} min`} target="≤ 90 min" detail={previous ? `${(metrics.medianResolution - previous.medianResolution).toFixed(1)} min vs prior` : "No prior window"} status={metrics.medianResolution <= 90 ? "good" : "watch"} />
            </section>

            <section className="analysis-grid">
              <article className="panel trend-panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">Demand + service</p><h2>Daily trend</h2></div>
                  <div className="legend"><span><i className="legend-bar" /> Tickets</span><span><i className="legend-line" /> SLA</span></div>
                </div>
                <TrendChart points={snapshot.trend} />
              </article>
              <article className="panel teams-panel">
                <div className="panel-heading"><div><p className="eyebrow">Team comparison</p><h2>SLA attainment</h2></div><span className="target-badge">Target 80%</span></div>
                <TeamBoard teams={snapshot.teams} />
                <p className="method-note">The marker is the shared target; bar length is the observed 15-minute SLA rate.</p>
              </article>
            </section>

            <section className="insight-section" aria-labelledby="insights-title">
              <div className="section-heading">
                <div><p className="eyebrow">What deserves attention</p><h2 id="insights-title">Three decisions supported by this view</h2></div>
                <span className="decision-chip">Computed, not hard-coded</span>
              </div>
              <div className="insight-grid">
                {snapshot.insights.map((insight, index) => (
                  <article className="insight-card" key={insight.eyebrow}>
                    <span className="insight-index">0{index + 1}</span>
                    <p className="eyebrow">{insight.eyebrow}</p>
                    <h3>{insight.title}</h3>
                    <p>{insight.detail}</p>
                    <span className="insight-link">Evidence in current filter <AppIcon name="arrow" /></span>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel table-panel" aria-labelledby="tickets-title">
              <div className="panel-heading table-heading">
                <div><p className="eyebrow">Audit the underlying rows</p><h2 id="tickets-title">Ticket evidence</h2></div>
                <button className="secondary-button" onClick={exportCurrentView}><AppIcon name="download" /> Export current view</button>
              </div>
              <div className="table-scroll">
                <table>
                  <caption className="sr-only">Synthetic support tickets matching the current dashboard filters</caption>
                  <thead>
                    <tr>
                      <th scope="col">Ticket</th>
                      {([
                        ["date", "Date"],
                        ["team", "Team"],
                        ["category", "Category"],
                        ["firstResponseMinutes", "First response"],
                        ["resolutionMinutes", "Resolution"],
                        ["csat", "CSAT"],
                      ] as const).map(([key, label]) => (
                        <th key={key} scope="col" aria-sort={sortKey === key ? sortDirection : "none"}>
                          <button onClick={() => toggleSort(key)}>{label}<span aria-hidden="true">{sortKey === key ? (sortDirection === "ascending" ? " ↑" : " ↓") : " ↕"}</span></button>
                        </th>
                      ))}
                      <th scope="col">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((ticket) => (
                      <tr key={ticket.id}>
                        <th scope="row">{ticket.id}</th>
                        <td>{formatDate(ticket.date)}</td>
                        <td>{ticket.team}</td>
                        <td><span className="category-pill">{ticket.category}</span></td>
                        <td>{ticket.firstResponseMinutes} min</td>
                        <td>{ticket.resolutionMinutes} min</td>
                        <td>{ticket.csat.toFixed(1)}</td>
                        <td><span className={`outcome ${ticket.firstContactResolved ? "resolved" : "followup"}`}>{ticket.firstContactResolved ? "First contact" : "Follow-up"}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <p>Rows {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedRecords.length)} of {formatNumber(sortedRecords.length)}</p>
                <div>
                  <button className="ghost-button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
                  <span aria-live="polite">Page {page} of {formatNumber(totalPages)}</span>
                  <button className="ghost-button" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
                </div>
              </div>
            </section>
          </>
        )}

        <section className="data-contract">
          <div>
            <p className="eyebrow">Transparent by design</p>
            <h2>Every number has a definition.</h2>
          </div>
          <div className="contract-grid">
            <p><strong>15m SLA</strong><span>Share of tickets receiving a first response in 15 minutes or less.</span></p>
            <p><strong>FCR</strong><span>Share marked resolved during the first customer contact.</span></p>
            <p><strong>CSAT</strong><span>Mean synthetic score on a 1–5 scale; missing values are never imputed.</span></p>
            <p><strong>Resolution</strong><span>Median minutes from creation to final resolution.</span></p>
          </div>
          <div className="contract-footer">
            <p>Seeded generation: {formatNumber(DATASET_SIZE)} rows in {generationMs} ms. Aggregation and CSV export stay in-browser.</p>
            <details>
              <summary>Preview resilience states</summary>
              <button onClick={() => showDemoState("empty")}>Empty</button>
              <button onClick={() => showDemoState("error")}>Error</button>
              <button onClick={() => showDemoState("live")}>Live</button>
            </details>
          </div>
        </section>
      </main>

      <footer>
        <span>SignalDesk / public engineering case study</span>
        <span>Built by <a href="https://jord-andrade.dev">Jordan Andrade</a> · <a href="https://github.com/jord-andrade/support-ops-analytics">Source and methodology</a></span>
      </footer>
    </div>
  );
}
