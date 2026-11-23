import { useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Ticket,
  ShieldCheck,
  Database,
  Zap,
  ChartNoAxesCombined,
  History,
  Settings,
  LogOut,
  Menu,
  Search,
  Building2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "./context/Auth";
import { Loading, ErrorBox, Field } from "./components/UI";
import { errorMessage } from "./services/api";
import Dashboard from "./pages/Dashboard";
import Automation from "./components/Automation";
import Records from "./pages/Records";
import Quality from "./pages/Quality";
import {
  Warehouse,
  Integrations,
  Reports,
  Activity,
  SettingsPage,
  Tickets,
} from "./pages/Operations";

const nav = [
  ["/", "Dashboard", LayoutDashboard],
  ["/customers", "Customers / CRM", Users],
  ["/bookings", "Bookings", CalendarDays],
  ["/tickets", "Ticket management", Ticket],
  ["/quality", "Data quality", ShieldCheck],
  ["/warehouse", "Data warehouse", Database],
  ["/integrations", "Integrations", Zap],
  ["/reports", "Reports", ChartNoAxesCombined],
  ["/activity", "Activity logs", History],
  ["/settings", "Settings", Settings],
];

export function Login() {
  const { login } = useAuth();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(e.target));
    try {
      await login(form, register);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-art">
        <div className="brand">
          <Building2 /> Museum<span>OS</span>
        </div>
        <div>
          <span className="eyebrow">THE BUSINESS BEHIND THE EXPERIENCE</span>
          <h1>
            A clearer view.
            <br />A better experience.
          </h1>
          <p>
            Bring your visitors, operations and business intelligence together
            in one connected workspace.
          </p>
          <div className="art-rings">
            <span />
            <span />
            <span />
            <div>
              Discover
              <br />
              <b>what’s possible.</b>
            </div>
          </div>
        </div>
        <small>Fictional museum · Real data workflows</small>
      </section>
      <section className="login-form">
        <div className="login-inner">
          <span className="eyebrow teal">YOUR OPERATIONS, CONNECTED</span>
          <h2>{register ? "Create your account" : "Welcome back"}</h2>
          <p className="muted">
            {register
              ? "Join the workspace as a staff member."
              : "Sign in to your MuseumOS workspace."}
          </p>
          <ErrorBox>{error}</ErrorBox>
          <form onSubmit={submit}>
            {register && (
              <Field label="Full name">
                <input name="name" required minLength={2} />
              </Field>
            )}
            <Field label="Email address">
              <input
                name="email"
                type="email"
                required
                defaultValue="demo@museum.example"
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                minLength={register ? 12 : 1}
                required
                defaultValue={register ? "" : "MuseumDemo2026!"}
              />
            </Field>
            <button className="primary full" disabled={busy}>
              {busy
                ? "Signing in…"
                : register
                  ? "Create account"
                  : "Sign in to workspace"}
            </button>
          </form>
          <button
            className="text-btn"
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register
              ? "Already have an account? Sign in"
              : "Create a staff account"}
          </button>
          <div className="demo-note">
            <ShieldCheck size={22} />
            <div>
              <b>Take a look around</b>
              <p>
                Demo: demo@museum.example
                <br />
                Password: MuseumDemo2026!
                <br />
                All visitor and booking data is fictional.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const { user, loading, logout } = useAuth();
  const [menu, setMenu] = useState(false),
    [error, setError] = useState("");
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Login />;
  const title = nav.find((n) => n[0] === location.pathname)?.[1] || "Workspace";
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <Building2 /> Museum<span>OS</span>
        </div>
        <div className="workspace">
          <span className="workspace-icon">M</span>
          <div>
            <b>Museum workspace</b>
            <small>Business operations</small>
          </div>
          <ChevronDown size={16} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {nav.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sandbox-label">
            <span /> Fictional business sandbox
          </div>
          <div className="user-block">
            <span className="avatar">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <b>{user.name}</b>
              <small>{user.role}</small>
            </div>
            <button
              aria-label="Sign out"
              onClick={() => logout().catch((e) => setError(errorMessage(e)))}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-btn mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <span className="muted">Workspace</span>
            <span className="crumb">/</span>
            <b>{title}</b>
          </div>
          <div>
            <span className="demo-pill">DEMO WORKSPACE</span>
            <span className="avatar light">
              {user.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main>
          <ErrorBox>{error}</ErrorBox>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Records kind="customers" />} />
            <Route path="/bookings" element={<Records kind="bookings" />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/quality" element={<Quality />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/activity" element={<Activity />} />
            <Route
              path="/settings"
              element={
                <>
                  <SettingsPage />
                  <Automation />
                </>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="page-footer">
            MuseumOS{" "}
            <span>
              Business data & systems management · Fictional portfolio
              environment
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
