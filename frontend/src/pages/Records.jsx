import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  Download,
  Search,
  Pencil,
  Trash2,
  Eye,
  Upload,
} from "lucide-react";
import { api, download, errorMessage } from "../services/api";
import {
  money,
  stamp,
  Table,
  Badge,
  Pager,
  Modal,
  Field,
  ErrorBox,
  Loading,
  DateRange,
} from "../components/UI";
import { bookingColumns } from "./Dashboard";
export function CustomerForm({ record, onSave, onCancel }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSave(Object.fromEntries(new FormData(e.target)));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <ErrorBox>{error}</ErrorBox>
      <Field label="Full name">
        <input
          required
          minLength={2}
          maxLength={160}
          name="name"
          defaultValue={record?.name}
        />
      </Field>
      <Field label="Email address">
        <input
          required
          type="email"
          name="email"
          defaultValue={record?.email}
        />
      </Field>
      <Field label="Phone number">
        <input
          name="phone"
          defaultValue={record?.phone}
          placeholder="+971 50 000 0000"
        />
      </Field>
      <Field label="Status">
        <select name="status" defaultValue={record?.status || "active"}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </Field>
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save customer"}
        </button>
      </div>
    </form>
  );
}
export function BookingForm({ record, customers, tickets, onSave, onCancel }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ticket, setTicket] = useState(record?.ticket_id || tickets[0]?.id || ""),
    [qty, setQty] = useState(record?.quantity || 1);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const data = Object.fromEntries(new FormData(e.target));
    data.customer_id = Number(data.customer_id);
    data.ticket_id = Number(data.ticket_id);
    data.quantity = Number(data.quantity);
    data.waiver_signed = data.waiver_signed === "on";
    try {
      await onSave(data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <ErrorBox>{error}</ErrorBox>
      <Field label="Customer">
        <select
          required
          name="customer_id"
          defaultValue={record?.customer_id || ""}
        >
          <option value="" disabled>
            Select a customer
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.email}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Experience">
        <select
          required
          name="ticket_id"
          value={ticket}
          onChange={(e) => setTicket(Number(e.target.value))}
        >
          {tickets
            .filter((t) => t.active || t.id === record?.ticket_id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {money(t.price)}
              </option>
            ))}
        </select>
      </Field>
      <div className="form-grid">
        <Field label="Visit date">
          <input
            required
            name="visit_date"
            type="date"
            defaultValue={record?.visit_date}
          />
        </Field>
        <Field label="Ticket quantity">
          <input
            required
            name="quantity"
            type="number"
            min="1"
            max="1000"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </Field>
      </div>
      <Field label="Booking status">
        <select name="status" defaultValue={record?.status || "confirmed"}>
          {["confirmed", "pending", "cancelled"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          name="waiver_signed"
          defaultChecked={record?.waiver_signed}
        />{" "}
        Waiver signed
      </label>
      <div className="booking-total">
        <span>Booking total</span>
        <b>
          {money(
            qty *
              (record?.ticket_id === Number(ticket)
                ? record.price
                : tickets.find((t) => t.id === Number(ticket))?.price),
          )}
        </b>
      </div>
      <div className="form-actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save booking"}
        </button>
      </div>
    </form>
  );
}
export default function Records({ kind }) {
  const isCustomer = kind === "customers";
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [profile, setProfile] = useState(null),
    [customers, setCustomers] = useState([]),
    [tickets, setTickets] = useState([]),
    [range, setRange] = useState(["", ""]),
    [visit, setVisit] = useState("");
  async function load() {
    try {
      const r = await api.get(`/api/${kind}`, {
        params: {
          page,
          q,
          status,
          start: range[0] || undefined,
          end: range[1] || undefined,
          visit: visit || undefined,
        },
      });
      setData(r.data);
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  useEffect(() => {
    setData(null);
    setPage(1);
    setQ("");
    setStatus("");
  }, [kind]);
  useEffect(() => {
    load();
  }, [kind, page, q, status, range, visit]);
  async function openEdit(record = {}) {
    try {
      if (!isCustomer) {
        const [c, t] = await Promise.all([
          api.get("/api/customers?size=200"),
          api.get("/api/tickets"),
        ]);
        let all = c.data.items;
        for (let p = 2; p <= Math.ceil(c.data.total / 200); p++) {
          all = all.concat(
            (await api.get(`/api/customers?size=200&page=${p}`)).data.items,
          );
        }
        setCustomers(all);
        setTickets(t.data);
      }
      setEdit(record);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function save(body) {
    if (edit.id) await api.put(`/api/${kind}/${edit.id}`, body);
    else await api.post(`/api/${kind}`, body);
    setEdit(null);
    load();
  }
  async function showProfile(r) {
    try {
      setProfile((await api.get(`/api/${kind}/${r.id}`)).data);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const actions = {
    key: "actions",
    label: "ACTIONS",
    render: (r) => (
      <div className="row-actions">
        <button aria-label={`View ${r.id}`} onClick={() => showProfile(r)}>
          <Eye size={16} />
        </button>
        <button aria-label={`Edit ${r.id}`} onClick={() => openEdit(r)}>
          <Pencil size={16} />
        </button>
        <button
          aria-label={`${isCustomer ? "Delete" : "Cancel"} ${r.id}`}
          onClick={() => setRemove(r)}
        >
          <Trash2 size={16} />
        </button>
      </div>
    ),
  };
  const columns = isCustomer
    ? [
        {
          key: "name",
          label: "CUSTOMER",
          render: (r) => (
            <div className="person-cell">
              <span className="avatar light">{r.name.slice(0, 2)}</span>
              <div>
                <b>{r.name}</b>
                <small>CUS-{String(r.id).padStart(4, "0")}</small>
              </div>
            </div>
          ),
        },
        { key: "email", label: "EMAIL ADDRESS" },
        { key: "phone", label: "PHONE" },
        { key: "total_bookings", label: "BOOKINGS" },
        {
          key: "status",
          label: "STATUS",
          render: (r) => <Badge>{r.status}</Badge>,
        },
        actions,
      ]
    : [...bookingColumns, actions];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow teal">
            {isCustomer ? "VISITOR RELATIONSHIPS" : "EXPERIENCE OPERATIONS"}
          </span>
          <h1>{isCustomer ? "Customers" : "Bookings"}</h1>
          <p>
            {isCustomer
              ? "A connected view of every visitor and their journey."
              : "Manage visits, tickets and the details that make them happen."}
          </p>
        </div>
        <div className="button-group">
          <button
            onClick={() =>
              download(
                `/api/reports/export?kind=${kind}&format=csv`,
                `${kind}.csv`,
              ).catch((e) => setError(errorMessage(e)))
            }
          >
            <Download size={16} />
            Export
          </button>
          <button className="primary" onClick={() => openEdit()}>
            <Plus size={17} />
            {isCustomer ? "Add customer" : "Create booking"}
          </button>
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>
      <div className="tabs">
        <span className="selected">All {kind}</span>
        {isCustomer && (
          <Link to="/quality">
            <Upload size={16} />
            Imports & validation
          </Link>
        )}
      </div>
      <section className="panel">
        <div className="filter-bar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label={`Search ${kind}`}
              placeholder={
                isCustomer
                  ? "Search by name or email…"
                  : "Search booking ID or customer…"
              }
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {(isCustomer
              ? ["active", "inactive"]
              : ["confirmed", "pending", "cancelled"]
            ).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        {!isCustomer && (
          <div className="filter-bar">
            <span>Booked</span>
            <DateRange
              start={range[0]}
              end={range[1]}
              onChange={(s, e) => {
                setRange([s, e]);
                setPage(1);
              }}
            />
            <label>
              Visit date{" "}
              <input
                type="date"
                value={visit}
                onChange={(e) => {
                  setVisit(e.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
        )}
        {data ? (
          <>
            <Table columns={columns} rows={data.items} />
            <Pager page={page} total={data.total} onChange={setPage} />
          </>
        ) : (
          <Loading />
        )}
      </section>
      {edit && (
        <Modal
          title={
            edit.id
              ? `Edit ${isCustomer ? "customer" : "booking"}`
              : `New ${isCustomer ? "customer" : "booking"}`
          }
          onClose={() => setEdit(null)}
        >
          {isCustomer ? (
            <CustomerForm
              record={edit}
              onSave={save}
              onCancel={() => setEdit(null)}
            />
          ) : (
            <BookingForm
              record={edit}
              customers={customers}
              tickets={tickets}
              onSave={save}
              onCancel={() => setEdit(null)}
            />
          )}
        </Modal>
      )}
      {remove && (
        <Modal
          title={isCustomer ? "Delete customer?" : "Cancel booking?"}
          onClose={() => setRemove(null)}
        >
          <p>
            {isCustomer
              ? "Customers with bookings must be set inactive to retain their history."
              : "The booking will be marked cancelled and retained for reporting."}
          </p>
          <div className="form-actions">
            <button onClick={() => setRemove(null)}>Keep record</button>
            <button
              className="danger"
              onClick={async () => {
                try {
                  await api.delete(`/api/${kind}/${remove.id}`);
                  setRemove(null);
                  load();
                } catch (e) {
                  setError(errorMessage(e));
                  setRemove(null);
                }
              }}
            >
              Confirm {isCustomer ? "delete" : "cancellation"}
            </button>
          </div>
        </Modal>
      )}
      {profile && (
        <Modal
          title={isCustomer ? profile.name : `Booking BK-${profile.id}`}
          onClose={() => setProfile(null)}
        >
          <dl className="details">
            {Object.entries(profile)
              .filter(([k, v]) => !Array.isArray(v))
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>{String(v ?? "—")}</dd>
                </div>
              ))}
          </dl>
          {isCustomer && (
            <>
              <h3>Booking history</h3>
              <Table columns={bookingColumns} rows={profile.bookings} />
            </>
          )}
        </Modal>
      )}
    </>
  );
}
