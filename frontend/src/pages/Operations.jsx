import { useEffect, useState } from "react";
import {
  Database,
  RefreshCw,
  Play,
  Download,
  Plus,
  ShieldCheck,
  Server,
  Wifi,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { api, download, errorMessage } from "../services/api";
import { useAuth } from "../context/Auth";
import {
  Table,
  Badge,
  ErrorBox,
  Loading,
  stamp,
  money,
  Modal,
  Field,
  DateRange,
} from "../components/UI";
function useRemote(path) {
  const [data, setData] = useState(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setData((await api.get(path)).data);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    load();
  }, [path]);
  return { data, error, setError, load };
}
function Heading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow teal">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
export function Warehouse() {
  const { data, error, setError, load } = useRemote(
    "/api/integrations/bigquery",
  );
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function sync() {
    setBusy(true);
    try {
      const r = await api.post("/api/integrations/bigquery/sync");
      setNotice(r.data.message);
      await load();
    } catch (e) {
      setError(errorMessage(e));
      await load();
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="ANALYTICAL INFRASTRUCTURE"
        title="Data warehouse"
        description="One reliable source for deeper business insights."
      >
        <div className="button-group">
          <button onClick={load}>
            <RefreshCw size={16} />
            Refresh history
          </button>
          <button className="primary" disabled={busy} onClick={sync}>
            <Database size={16} />
            Sync to BigQuery
          </button>
        </div>
      </Heading>
      <ErrorBox>{error}</ErrorBox>
      {notice && <div className="notice">{notice}</div>}
      {data ? (
        <>
          <div className="warehouse-card">
            <span className="warehouse-symbol">
              <Database size={42} />
            </span>
            <div>
              <h2>Google BigQuery</h2>
              <p>Managed analytical warehouse</p>
              <Badge>{data.status}</Badge>
            </div>
          </div>
          <div className="kpi-grid three">
            <div className="kpi">
              <span>Dataset</span>
              <strong className="small-value">{data.dataset}</strong>
              <small>Project: {data.project || "Not configured"}</small>
            </div>
            <div className="kpi">
              <span>Last successful load</span>
              <strong className="small-value">
                {data.last_success
                  ? stamp(data.last_success.created_at)
                  : "No successful loads"}
              </strong>
              <small>Table: {data.table}</small>
            </div>
            <div className="kpi">
              <span>Records synchronised</span>
              <strong>{data.last_success?.records || 0}</strong>
              <small>Verified by completed Google load job</small>
            </div>
          </div>
          {!data.project && (
            <div className="notice">
              <b>PostgreSQL mode</b>
              <p>
                Business operations are available without BigQuery. Configure
                BIGQUERY_PROJECT and protected Google service account
                credentials on the backend to enable live loads. See the
                deployment guide for permissions.
              </p>
            </div>
          )}
          <section className="panel">
            <div className="panel-head">
              <h2>Synchronisation history</h2>
              <span className="muted">
                Full snapshot · Repeat loads replace the analytical table
              </span>
            </div>
            <Table
              rows={data.history}
              columns={[
                { key: "id", label: "LOAD" },
                {
                  key: "created_at",
                  label: "REQUESTED",
                  render: (r) => stamp(r.created_at),
                },
                {
                  key: "status",
                  label: "STATUS",
                  render: (r) => <Badge>{r.status}</Badge>,
                },
                { key: "records", label: "RECORDS" },
                { key: "message", label: "DETAILS" },
              ]}
            />
          </section>
        </>
      ) : (
        <Loading />
      )}
    </>
  );
}
export function Integrations() {
  const { data, error, setError, load } = useRemote("/api/integrations/status");
  const logs = useRemote("/api/integrations/logs");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function simulate() {
    setBusy(true);
    try {
      const { data } = await api.post("/api/integrations/ticketing/simulate");
      setNotice(
        `Simulation accepted. Booking BK-${data.booking_id} persisted in the database.`,
      );
      await Promise.all([load(), logs.load()]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="CONNECTED OPERATIONS"
        title="Integrations"
        description="Monitor the flow of data across your business systems."
      >
        <button disabled={busy} className="primary" onClick={simulate}>
          <Play size={16} />
          Simulate booking webhook
        </button>
      </Heading>
      <ErrorBox>{error || logs.error}</ErrorBox>
      {notice && <div className="notice">{notice}</div>}
      <div className="integration-grid">
        {data?.map((i) => (
          <section className="panel integration-card" key={i.name}>
            <span className="health-icon">
              {i.name.includes("BigQuery") ? <Database /> : <Wifi />}
            </span>
            <h2>{i.name}</h2>
            <p>{i.mode}</p>
            <Badge>{i.status}</Badge>
            <div className="mini-metrics">
              <div>
                <b>{i.successes}</b>
                <span>Successful requests</span>
              </div>
              <div>
                <b>{i.failures}</b>
                <span>Failed requests</span>
              </div>
            </div>
            <small>Last success: {stamp(i.last_success)}</small>
            <small>Last failure: {stamp(i.last_failure)}</small>
          </section>
        ))}
      </div>
      <div className="notice">
        The ticketing integration is an explicitly labelled simulation. The
        simulation button validates a webhook payload and persists a real
        fictional booking through the same service used by the authenticated
        webhook endpoint.
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Integration events</h2>
          <button
            onClick={() => {
              load();
              logs.load();
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
        {logs.data ? (
          <Table
            rows={logs.data}
            columns={[
              {
                key: "created_at",
                label: "TIME",
                render: (r) => stamp(r.created_at),
              },
              { key: "integration", label: "INTEGRATION" },
              {
                key: "status",
                label: "RESULT",
                render: (r) => <Badge>{r.status}</Badge>,
              },
              { key: "message", label: "DETAILS" },
            ]}
          />
        ) : (
          <Loading />
        )}
      </section>
    </>
  );
}
export function Reports() {
  const [range, setRange] = useState(["", ""]),
    [kind, setKind] = useState("revenue"),
    [error, setError] = useState("");
  const remote = useRemote(
    `/api/analytics/dashboard?${new URLSearchParams(
      Object.fromEntries(
        [
          ["start", range[0]],
          ["end", range[1]],
        ].filter(([, v]) => v),
      ),
    )}`,
  );
  async function exportReport(format) {
    try {
      const params = new URLSearchParams({
        kind,
        format,
        ...(range[0] ? { start: range[0] } : {}),
        ...(range[1] ? { end: range[1] } : {}),
      });
      await download(`/api/reports/export?${params}`, `${kind}.${format}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <Heading
        eyebrow="BUSINESS INTELLIGENCE"
        title="Reports"
        description="Turn business records into useful decisions."
      />
      <ErrorBox>{error || remote.error}</ErrorBox>
      <section className="panel report-controls">
        <Field label="Report type">
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {["revenue", "customers", "tickets", "bookings", "quality"].map(
              (s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)} report
                </option>
              ),
            )}
          </select>
        </Field>
        <Field label="Booking date range">
          <DateRange
            start={range[0]}
            end={range[1]}
            onChange={(s, e) => setRange([s, e])}
          />
        </Field>
        <div className="button-group">
          <button onClick={() => exportReport("csv")}>
            <Download size={16} />
            CSV
          </button>
          <button className="primary" onClick={() => exportReport("xlsx")}>
            <Download size={16} />
            Excel
          </button>
        </div>
      </section>
      <p className="muted">
        Date ranges apply to booking, revenue and ticket reports. Customer and
        data quality exports include their complete history.
      </p>
      {remote.data ? (
        <>
          <div className="kpi-grid three">
            {[
              ["Confirmed revenue", money(remote.data.revenue)],
              ["Average booking value", money(remote.data.average_booking)],
              ["Tickets sold", remote.data.tickets_sold.toLocaleString()],
            ].map(([n, v]) => (
              <div className="kpi" key={n}>
                <span>{n}</span>
                <strong>{v}</strong>
                <small>Selected booking period</small>
              </div>
            ))}
          </div>
          <div className="chart-grid">
            <section className="panel">
              <div className="panel-head">
                <h2>Experience performance</h2>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart
                  data={remote.data.categories}
                  margin={{ right: 20, bottom: 55 }}
                >
                  <CartesianGrid vertical={false} stroke="#edf0f3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    angle={-15}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => money(v)} />
                  <Bar dataKey="revenue" fill="#168c82" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
            <section className="panel">
              <div className="panel-head">
                <h2>Booking status distribution</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={remote.data.statuses}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={85}
                    label
                  >
                    {remote.data.statuses.map((s, i) => (
                      <Cell
                        key={s.name}
                        fill={["#9aa7b5", "#168c82", "#d4a75f"][i % 3]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="status-legend">
                {remote.data.statuses.map((s) => (
                  <div key={s.name}>
                    <Badge>{s.name}</Badge>
                    <b>{s.value}</b>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="panel">
            <div className="panel-head">
              <h2>Ticket sales and revenue</h2>
            </div>
            <Table
              rows={remote.data.categories}
              columns={[
                { key: "name", label: "EXPERIENCE" },
                { key: "tickets", label: "TICKETS SOLD" },
                {
                  key: "revenue",
                  label: "CONFIRMED REVENUE",
                  render: (r) => money(r.revenue),
                },
              ]}
            />
          </section>
        </>
      ) : (
        <Loading />
      )}
    </>
  );
}
export function Activity() {
  const { data, error, load } = useRemote("/api/activity");
  return (
    <>
      <Heading
        eyebrow="ACCOUNTABILITY & TRACEABILITY"
        title="Activity logs"
        description="A record of the actions that shape your workspace."
      >
        <button onClick={load}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </Heading>
      <ErrorBox>{error}</ErrorBox>
      <section className="panel">
        {data ? (
          <Table
            rows={data}
            columns={[
              { key: "id", label: "EVENT" },
              {
                key: "created_at",
                label: "TIME",
                render: (r) => stamp(r.created_at),
              },
              {
                key: "user_id",
                label: "USER",
                render: (r) => (r.user_id ? `User ${r.user_id}` : "System"),
              },
              { key: "action", label: "ACTION" },
              {
                key: "details",
                label: "DETAILS",
                render: (r) => (
                  <code className="log-details">
                    {JSON.stringify(r.details)}
                  </code>
                ),
              },
            ]}
          />
        ) : (
          <Loading />
        )}
      </section>
    </>
  );
}
export function SettingsPage() {
  const { user } = useAuth();
  const { data, error, setError, load } = useRemote("/api/system/status");
  const [users, setUsers] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user.role === "administrator")
      api
        .get("/api/users")
        .then((r) => setUsers(r.data))
        .catch((e) => setError(errorMessage(e)));
  }, []);
  async function change(u, role, active) {
    try {
      await api.put(`/api/users/${u.id}`, { role, active });
      setUsers((await api.get("/api/users")).data);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <>
      <Heading
        eyebrow="WORKSPACE CONFIGURATION"
        title="Settings"
        description="Your account, system health and access controls."
      >
        <button onClick={load}>
          <Server size={16} />
          Check system health
        </button>
      </Heading>
      <ErrorBox>{error}</ErrorBox>
      <div className="chart-grid">
        <section className="panel settings-card">
          <h2>Your account</h2>
          <dl className="details">
            <div>
              <dt>Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Access role</dt>
              <dd>
                <Badge>{user.role}</Badge>
              </dd>
            </div>
            <div>
              <dt>Environment</dt>
              <dd>Fictional museum sandbox</dd>
            </div>
          </dl>
        </section>
        <section className="panel settings-card">
          <h2>System health</h2>
          {data ? (
            <dl className="details">
              {Object.entries(data).map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Loading />
          )}
        </section>
      </div>
      {user.role === "administrator" && (
        <section className="panel">
          <div className="panel-head">
            <h2>User management</h2>
          </div>
          <Table
            rows={users || []}
            columns={[
              { key: "name", label: "USER" },
              { key: "email", label: "EMAIL" },
              {
                key: "role",
                label: "ROLE",
                render: (u) => (
                  <select
                    disabled={u.demo || u.id === user.id}
                    value={u.role}
                    onChange={(e) => change(u, e.target.value, u.active)}
                  >
                    <option value="staff">Staff</option>
                    <option value="administrator">Administrator</option>
                  </select>
                ),
              },
              {
                key: "active",
                label: "ACCESS",
                render: (u) => (
                  <button
                    disabled={u.demo || u.id === user.id}
                    onClick={() => change(u, u.role, !u.active)}
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                ),
              },
            ]}
          />
        </section>
      )}
      <div className="notice">
        <ShieldCheck size={20} />
        <div>
          <b>Protected configuration</b>
          <p>
            Database URLs, BigQuery credentials, CORS origins and scheduler
            settings are managed through backend environment variables. See the
            deployment guide for configuration and administrator bootstrap
            instructions.
          </p>
        </div>
      </div>
    </>
  );
}
export function Tickets() {
  const { user } = useAuth();
  const { data, error, setError, load } = useRemote("/api/tickets");
  const [edit, setEdit] = useState(null),
    [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const body = Object.fromEntries(new FormData(e.target));
    body.price = Number(body.price);
    body.active = body.active === "on";
    try {
      await api[edit.id ? "put" : "post"](
        `/api/tickets${edit.id ? `/${edit.id}` : ""}`,
        body,
      );
      setEdit(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="EXPERIENCE CATALOGUE"
        title="Ticket management"
        description="The experiences your visitors come for."
      >
        {user.role === "administrator" && (
          <button className="primary" onClick={() => setEdit({})}>
            <Plus size={16} />
            Add ticket product
          </button>
        )}
      </Heading>
      <ErrorBox>{error}</ErrorBox>
      <div className="ticket-grid">
        {data?.map((t, i) => (
          <section className="panel ticket-card" key={t.id}>
            <div className={`ticket-art art-${i % 4}`}>
              <span>
                {["EXPLORE", "TOGETHER", "DISCOVER", "IMMERSE"][i % 4]}
              </span>
              <div className="ticket-circle" />
            </div>
            <div className="ticket-info">
              <Badge>{t.active ? "active" : "inactive"}</Badge>
              <h2>{t.name}</h2>
              <strong>{money(t.price)}</strong>
              <p>Per booking unit · AED</p>
              {user.role === "administrator" && (
                <button onClick={() => setEdit(t)}>Edit product</button>
              )}
            </div>
          </section>
        ))}
      </div>
      {!data && <Loading />}
      <div className="notice">
        Ticket prices are captured at booking time. Updating a product preserves
        historical booking values. Product changes require administrator access.
      </div>
      {edit && (
        <Modal
          title={edit.id ? "Edit ticket product" : "New ticket product"}
          onClose={() => setEdit(null)}
        >
          <form onSubmit={save}>
            <ErrorBox>{error}</ErrorBox>
            <Field label="Product name">
              <input
                name="name"
                required
                minLength={2}
                defaultValue={edit.name}
              />
            </Field>
            <Field label="Price (AED)">
              <input
                name="price"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                required
                defaultValue={edit.price}
              />
            </Field>
            <label className="checkbox">
              <input
                type="checkbox"
                name="active"
                defaultChecked={edit.active ?? true}
              />
              Available for new bookings
            </label>
            <div className="form-actions">
              <button type="button" onClick={() => setEdit(null)}>
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save product
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
