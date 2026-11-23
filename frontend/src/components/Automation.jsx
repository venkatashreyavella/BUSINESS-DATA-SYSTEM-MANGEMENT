import { useEffect, useState } from "react";
import { Play, RefreshCw, Server } from "lucide-react";
import { api, errorMessage } from "../services/api";
import { Table, Badge, ErrorBox, stamp } from "./UI";
export default function Automation() {
  const [jobs, setJobs] = useState([]),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setJobs((await api.get("/api/system/jobs")).data);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function run(path, method, label) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api[method](path);
      setResult({
        label,
        time: new Date().toISOString(),
        message:
          data.message ||
          (data.reports
            ? `Validated ${data.reports.reduce((n, r) => n + r.total, 0)} records; ${data.reports.reduce((n, r) => n + r.invalid, 0)} invalid.`
            : `Database: ${data.database}; response ${data.response_ms} ms`),
      });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Automation & monitoring</h2>
          <p>Daily processing at 06:00 Dubai when the scheduler is enabled</p>
        </div>
        <button onClick={load}>
          <RefreshCw size={16} />
          Refresh runs
        </button>
      </div>
      <div className="filter-bar">
        <button
          disabled={busy}
          onClick={() => run("/api/data/validate", "post", "Data validation")}
        >
          <Play size={16} />
          Run data validation
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(
              "/api/integrations/bigquery/sync",
              "post",
              "Data synchronisation",
            )
          }
        >
          <RefreshCw size={16} />
          Run data synchronisation
        </button>
        <button
          disabled={busy}
          onClick={() => run("/api/system/status", "get", "System health")}
        >
          <Server size={16} />
          Check system health
        </button>
      </div>
      <div style={{ padding: "0 22px" }}>
        <ErrorBox>{error}</ErrorBox>
        {result && (
          <div className="notice">
            <div>
              <b>
                {result.label} · {stamp(result.time)}
              </b>
              <p>{result.message}</p>
            </div>
          </div>
        )}
      </div>
      <Table
        rows={jobs}
        columns={[
          { key: "name", label: "SCHEDULED JOB" },
          { key: "day", label: "UTC DATE" },
          {
            key: "status",
            label: "STATUS",
            render: (r) => <Badge>{r.status}</Badge>,
          },
          {
            key: "completed_at",
            label: "COMPLETED",
            render: (r) => stamp(r.completed_at),
          },
        ]}
      />
    </section>
  );
}
