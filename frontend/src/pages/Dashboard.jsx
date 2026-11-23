import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CalendarDays,
  Ticket,
  Wallet,
  Download,
  RefreshCw,
  CheckCircle2,
  Database,
  ShieldCheck,
  Activity,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api, download, errorMessage } from "../services/api";
import {
  money,
  number,
  stamp,
  Loading,
  ErrorBox,
  Badge,
  Table,
  DateRange,
  Empty,
} from "../components/UI";
const colors = ["#168c82", "#79b8ac", "#b5d8d0", "#d1a666"];
export const bookingColumns = [
  {
    key: "id",
    label: "BOOKING",
    render: (r) => (
      <b className="record-id">BK-{String(r.id).padStart(4, "0")}</b>
    ),
  },
  { key: "customer_name", label: "CUSTOMER" },
  { key: "ticket_name", label: "EXPERIENCE" },
  { key: "visit_date", label: "VISIT DATE" },
  { key: "total", label: "AMOUNT", render: (r) => money(r.total) },
  { key: "status", label: "STATUS", render: (r) => <Badge>{r.status}</Badge> },
];
export default function Dashboard() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [range, setRange] = useState(["", ""]);
  const [integrations, setIntegrations] = useState([]);
  async function load() {
    setError("");
    setBusy(true);
    try {
      const [d, i] = await Promise.all([
        api.get("/api/analytics/dashboard", {
          params: { start: range[0] || undefined, end: range[1] || undefined },
        }),
        api.get("/api/integrations/status"),
      ]);
      setData(d.data);
      setIntegrations(i.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, range);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow teal">BUSINESS INTELLIGENCE</span>
          <h1>Overview</h1>
          <p>
            Your museum, by the numbers. A clear picture of what’s happening.
          </p>
        </div>
        <button
          onClick={() =>
            download(
              "/api/reports/export?kind=bookings&format=csv",
              "bookings.csv",
            ).catch((e) => setError(errorMessage(e)))
          }
        >
          <Download size={16} /> Export report
        </button>
      </div>
      <div className="overview-banner">
        <div>
          <span className="banner-mark">
            <Activity />
          </span>
          <div>
            <b>Good experiences start with good data.</b>
            <p>
              Monitor your performance, keep records clean, and stay connected.
            </p>
          </div>
        </div>
        <span className="banner-label">MUSEUM OPERATIONS</span>
      </div>
      <div className="section-toolbar">
        <div>
          <h2>Performance overview</h2>
          <span className="muted">
            {range[0] || range[1]
              ? "Selected booking period"
              : "All booking activity"}{" "}
            · AED
          </span>
        </div>
        <div>
          <DateRange
            start={range[0]}
            end={range[1]}
            onChange={(s, e) => setRange([s, e])}
          />
          <button
            className="icon-btn"
            aria-label="Refresh dashboard"
            disabled={busy}
            onClick={load}
          >
            <RefreshCw size={17} className={busy ? "spin" : ""} />
          </button>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="kpi-grid">
            {[
              [
                "Total revenue",
                money(data.revenue),
                Wallet,
                "Confirmed bookings",
              ],
              [
                "Bookings",
                number(data.total_bookings),
                CalendarDays,
                `${number(data.pending)} pending bookings`,
              ],
              [
                "Tickets sold",
                number(data.tickets_sold),
                Ticket,
                "Across all experiences",
              ],
              [
                "Customers",
                number(data.total_customers),
                Users,
                "All registered visitors",
              ],
            ].map(([label, value, Icon, note]) => (
              <article className="kpi" key={label}>
                <div>
                  <span>{label}</span>
                  <Icon size={19} />
                </div>
                <strong>{value}</strong>
                <small>{note}</small>
              </article>
            ))}
          </div>
          <div className="chart-grid">
            <section className="panel revenue-panel">
              <div className="panel-head">
                <div>
                  <h2>Revenue performance</h2>
                  <p>Monthly confirmed booking revenue</p>
                </div>
                <span className="legend">
                  <i /> Revenue
                </span>
              </div>
              <div className="chart">
                <ResponsiveContainer width="100%" height={245}>
                  <AreaChart
                    data={data.monthly}
                    margin={{ left: 0, right: 12, top: 16, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#168c82"
                          stopOpacity={0.22}
                        />
                        <stop
                          offset="100%"
                          stopColor="#168c82"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#edf0f3" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "#7b8794" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v / 1000}k`}
                      tick={{ fontSize: 12, fill: "#7b8794" }}
                    />
                    <Tooltip formatter={(v) => money(v)} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#168c82"
                      strokeWidth={3}
                      fill="url(#revenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Ticket mix</h2>
                  <p>Confirmed tickets by experience</p>
                </div>
                <Ticket size={18} />
              </div>
              <div className="donut">
                <ResponsiveContainer width="100%" height={175}>
                  <PieChart>
                    <Pie
                      data={data.categories}
                      dataKey="tickets"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={76}
                      paddingAngle={4}
                      stroke="none"
                    >
                      {data.categories.map((c, i) => (
                        <Cell key={c.name} fill={colors[i % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <b>{number(data.tickets_sold)}</b>
                  <small>tickets sold</small>
                </div>
              </div>
              <div className="mix-legend">
                {data.categories.map((c, i) => (
                  <div key={c.name}>
                    <i style={{ background: colors[i % 4] }} />
                    <span>{c.name}</span>
                    <b>{number(c.tickets)}</b>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="chart-grid secondary">
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Booking activity</h2>
                  <p>Daily bookings in the selected period</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.daily.slice(-30)} margin={{ right: 18 }}>
                  <CartesianGrid vertical={false} stroke="#edf0f3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={25}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="bookings"
                    fill="#73afa7"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="panel health-panel">
              <div className="panel-head">
                <div>
                  <h2>Workspace health</h2>
                  <p>Your data and connected systems</p>
                </div>
                <ShieldCheck size={18} />
              </div>
              <Link to="/quality" className="health-row">
                <span className="health-icon">
                  <ShieldCheck size={19} />
                </span>
                <div>
                  <b>Data quality</b>
                  <small>
                    {data.quality_issues
                      ? `${data.quality_issues} flags in recent unresolved reports`
                      : "No flags in recent unresolved reports"}
                  </small>
                </div>
                <Badge>{data.quality_issues ? "review" : "clear"}</Badge>
              </Link>
              <Link to="/integrations" className="health-row">
                <span className="health-icon">
                  <CheckCircle2 size={19} />
                </span>
                <div>
                  <b>Ticketing sandbox</b>
                  <small>Simulation available</small>
                </div>
                <Badge>simulation</Badge>
              </Link>
              <Link to="/warehouse" className="health-row">
                <span className="health-icon">
                  <Database size={19} />
                </span>
                <div>
                  <b>Data warehouse</b>
                  <small>Last sync: {stamp(data.last_sync)}</small>
                </div>
                <Badge>
                  {integrations.find((i) => i.name === "Google BigQuery")
                    ?.status || "unknown"}
                </Badge>
              </Link>
              <div className="mini-metrics">
                <div>
                  <b>{money(data.average_booking)}</b>
                  <span>Avg. booking value</span>
                </div>
                <div>
                  <b>{data.cancelled}</b>
                  <span>Cancelled bookings</span>
                </div>
              </div>
            </section>
          </div>
          <section className="panel recent">
            <div className="panel-head">
              <div>
                <h2>Recent bookings</h2>
                <p>The latest activity across your museum</p>
              </div>
              <Link className="text-link" to="/bookings">
                View all bookings
              </Link>
            </div>
            <Table columns={bookingColumns} rows={data.recent} />
          </section>
          <div className="chart-grid secondary">
            <section className="panel">
              <div className="panel-head">
                <h2>Most active visitors</h2>
              </div>
              <Table
                columns={[
                  { key: "name", label: "CUSTOMER" },
                  { key: "bookings", label: "BOOKINGS" },
                ]}
                rows={data.customer_activity}
              />
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Data quality alerts</h2>
                <Link to="/quality" className="text-link">
                  Review data
                </Link>
              </div>
              {data.alerts.length ? (
                data.alerts.map((a) => (
                  <div className="alert-row" key={a.id}>
                    <b>{a.source}</b>
                    <Badge>{a.errors} flags</Badge>
                  </div>
                ))
              ) : (
                <Empty>No validation alerts to review</Empty>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
