import { X, LoaderCircle, Inbox } from "lucide-react";
import { useEffect, useRef } from "react";
export const money = (v) =>
  new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(v || 0);
export const number = (v) => new Intl.NumberFormat("en").format(v || 0);
export const stamp = (v) =>
  v
    ? new Date(/[Zz]|[+-]\d\d:\d\d$/.test(v) ? v : v + "Z").toLocaleString(
        "en-GB",
        { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" },
      ) + " GST"
    : "Never";
export function Badge({ children }) {
  return (
    <span className={`badge ${String(children).replaceAll(" ", "_")}`}>
      {String(children).replaceAll("_", " ")}
    </span>
  );
}
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" /> Loading business data…
    </div>
  );
}
export function Empty({ children = "No records to display" }) {
  return (
    <div className="empty">
      <Inbox size={32} />
      {children}
    </div>
  );
}
export function ErrorBox({ children }) {
  return children ? (
    <div role="alert" className="error">
      {children}
    </div>
  ) : null;
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input,select,textarea,button")?.focus();
    return () => {
      document.body.style.overflow = bodyOverflow;
      before?.focus();
    };
  }, []);
  function keys(e) {
    if (e.key === "Escape") onClose();
    if (e.key === "Tab") {
      const elements = [
        ...ref.current.querySelectorAll(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
        ),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={keys}
        className="modal"
      >
        <header>
          <h2>{title}</h2>
          <button
            aria-label="Close dialog"
            className="icon-btn"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Table({ columns, rows, onRow }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i} onClick={() => onRow?.(row)}>
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(row) : (row[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
}
export function Pager({ page, total, size = 20, onChange }) {
  return (
    <div className="pager">
      <span>
        {number(total)} records · Page {page} of{" "}
        {Math.max(1, Math.ceil(total / size))}
      </span>
      <div>
        <button disabled={page === 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button
          disabled={page * size >= total}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
export function DateRange({ start, end, onChange }) {
  return (
    <div className="date-range">
      <input
        aria-label="Start date"
        type="date"
        value={start}
        onChange={(e) => onChange(e.target.value, end)}
      />
      <span>to</span>
      <input
        aria-label="End date"
        type="date"
        value={end}
        min={start}
        onChange={(e) => onChange(start, e.target.value)}
      />
    </div>
  );
}
