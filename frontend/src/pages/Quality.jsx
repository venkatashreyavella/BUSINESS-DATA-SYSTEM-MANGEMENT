import { useEffect, useState } from "react";
import { Upload, ShieldCheck, Play, Download, FileCheck2 } from "lucide-react";
import { api, download, errorMessage } from "../services/api";
import {
  Table,
  Badge,
  Modal,
  ErrorBox,
  stamp,
  Loading,
} from "../components/UI";
export default function Quality() {
  const [history, setHistory] = useState(null),
    [error, setError] = useState(""),
    [kind, setKind] = useState("customers"),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState(null),
    [json, setJson] = useState(""),
    [report, setReport] = useState(null),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(false);
  async function load() {
    try {
      setHistory((await api.get("/api/data/quality-report")).data);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function action(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    await action(async () => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post(`/api/data/import?kind=${kind}`, form);
      setReview(data);
      setJson(JSON.stringify(data.original, null, 2));
      setReport(data.report);
      setNotice(
        "File staged for review. No business records have been changed.",
      );
    });
    e.target.value = "";
  }
  async function open(r) {
    await action(async () => {
      const { data } = await api.get(`/api/data/imports/${r.id}`);
      setReview(data);
      setJson(JSON.stringify(data.original, null, 2));
      setReport(data.report);
    });
  }
  async function check(commit = false) {
    await action(async () => {
      const records = JSON.parse(json);
      if (!Array.isArray(records))
        throw new Error("Enter a JSON array of records");
      const { data } = await api.post(`/api/data/imports/${review.id}/review`, {
        records,
        confirm: commit,
      });
      setReport(commit ? data.report : data);
      if (commit) {
        setReview(null);
        setConfirm(false);
        setNotice(data.message);
      } else setNotice("Review validation completed.");
    });
  }
  const total = history?.reduce((n, r) => n + r.report.total, 0) || 0;
  const issues =
    history
      ?.filter((r) => !r.applied)
      .reduce((n, r) => n + r.report.validation_errors, 0) || 0;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow teal">TRUST YOUR DATA</span>
          <h1>Data quality</h1>
          <p>Find the gaps. Review the details. Keep your records reliable.</p>
        </div>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await api.post("/api/data/validate");
              setNotice("Database validation completed.");
            })
          }
        >
          <Play size={16} />
          Run data validation
        </button>
      </div>
      <ErrorBox>{error}</ErrorBox>
      {notice && (
        <div role="status" className="notice">
          {notice}
        </div>
      )}
      <div className="kpi-grid three">
        <div className="kpi">
          <span>Records processed in history</span>
          <strong>{total.toLocaleString()}</strong>
          <small>Across retained validation runs</small>
        </div>
        <div className="kpi">
          <span>Unresolved report flags</span>
          <strong>{issues.toLocaleString()}</strong>
          <small>Includes repeated checks of the same records</small>
        </div>
        <div className="kpi">
          <span>Validation runs</span>
          <strong>{history?.length || 0}</strong>
          <small>Latest 50 runs</small>
        </div>
      </div>
      <section className="panel upload-panel">
        <span className="upload-icon">
          <Upload size={28} />
        </span>
        <div>
          <h2>Import, inspect, then confirm.</h2>
          <p>
            Upload CSV or Excel. Original files stay preserved as records;
            corrections require your approval.
          </p>
          <div className="button-group">
            <select
              aria-label="Import record type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="customers">Customer records</option>
              <option value="bookings">Booking records</option>
            </select>
            <label className="button primary">
              {busy ? "Processing…" : "Choose file"}
              <input
                aria-label="Upload records"
                type="file"
                accept=".csv,.xlsx"
                hidden
                disabled={busy}
                onChange={upload}
              />
            </label>
          </div>
          <small>
            CSV or XLSX · Up to 5 MB and 10,000 rows · Sample files are in the
            repository’s data folder.
          </small>
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>Validation history</h2>
          <span className="muted">Original uploads are never overwritten</span>
        </div>
        {history ? (
          <Table
            rows={history}
            columns={[
              { key: "id", label: "RUN", render: (r) => `DQ-${r.id}` },
              { key: "source", label: "SOURCE" },
              { key: "kind", label: "TYPE" },
              {
                key: "created_at",
                label: "PROCESSED",
                render: (r) => stamp(r.created_at),
              },
              { key: "total", label: "RECORDS", render: (r) => r.report.total },
              {
                key: "invalid",
                label: "INVALID",
                render: (r) => r.report.invalid,
              },
              {
                key: "applied",
                label: "STATUS",
                render: (r) => (
                  <Badge>
                    {r.applied
                      ? "imported"
                      : r.report.invalid
                        ? "review"
                        : "validated"}
                  </Badge>
                ),
              },
              {
                key: "review",
                label: "ACTIONS",
                render: (r) => (
                  <div className="button-group">
                    <button onClick={() => open(r)}>Review</button>
                    <button
                      aria-label={`Download report ${r.id}`}
                      onClick={() =>
                        download(
                          `/api/data/imports/${r.id}/report`,
                          `quality-${r.id}.csv`,
                        ).catch((e) => setError(errorMessage(e)))
                      }
                    >
                      <Download size={15} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        ) : (
          <Loading />
        )}
      </section>
      {review && (
        <Modal
          title={`Review ${review.source}`}
          onClose={() => {
            setReview(null);
            setConfirm(false);
          }}
        >
          <ErrorBox>{error}</ErrorBox>
          <div className="quality-summary">
            {[
              "total",
              "valid",
              "invalid",
              "duplicates",
              "missing_values",
              "validation_errors",
            ].map((k) => (
              <div key={k}>
                <b>{report?.[k] || 0}</b>
                <span>{k.replaceAll("_", " ")}</span>
              </div>
            ))}
          </div>
          <Table
            rows={report?.flagged || []}
            columns={[
              { key: "row", label: "ROW" },
              { key: "category", label: "CATEGORY" },
              { key: "error", label: "DESCRIPTION" },
              {
                key: "proposed",
                label: "PROPOSED",
                render: (r) => JSON.stringify(r.proposed),
              },
            ]}
          />
          {review.source !== "Database validation" && !review.applied && (
            <>
              <label className="field">
                <span>Reviewed records (editable JSON)</span>
                <textarea
                  className="json-editor"
                  aria-label="Reviewed records"
                  value={json}
                  onChange={(e) => {
                    setJson(e.target.value);
                    setConfirm(false);
                  }}
                  rows={14}
                />
              </label>
              <p className="muted">
                Correct or remove flagged rows here. The original upload remains
                unchanged. IDs and emails must be unique; existing records will
                never be overwritten.
              </p>
              <div className="form-actions">
                <button disabled={busy} onClick={() => check()}>
                  Validate corrections
                </button>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => setConfirm(true)}
                >
                  Import reviewed records
                </button>
              </div>
              {confirm && (
                <div className="confirm-box">
                  <b>Confirm database import?</b>
                  <p>
                    This adds the reviewed records in one transaction after a
                    fresh validation.
                  </p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => check(true)}
                  >
                    Confirm import
                  </button>
                  <button onClick={() => setConfirm(false)}>Go back</button>
                </div>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
