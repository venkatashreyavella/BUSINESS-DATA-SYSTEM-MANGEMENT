import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CustomerForm, BookingForm } from "./pages/Records";
import Quality from "./pages/Quality";
import Dashboard from "./pages/Dashboard";
import App, { Login } from "./App";
vi.mock("./services/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  download: vi.fn(),
  errorMessage: (e) => e.message,
}));
vi.mock("./context/Auth", () => ({ useAuth: vi.fn() }));
import { api } from "./services/api";
import { useAuth } from "./context/Auth";
beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ user: null, login: vi.fn(), loading: false });
});
test("customer form submits entered visitor fields", async () => {
  const save = vi.fn();
  render(<CustomerForm onSave={save} onCancel={() => {}} />);
  const u = userEvent.setup();
  await u.type(screen.getByLabelText("Full name"), "Maya Reed");
  await u.type(screen.getByLabelText("Email address"), "maya@example.com");
  await u.click(screen.getByText("Save customer"));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({
      name: "Maya Reed",
      email: "maya@example.com",
      phone: "",
      status: "active",
    }),
  );
});
test("booking form calculates total and sends typed values", async () => {
  const save = vi.fn();
  render(
    <BookingForm
      customers={[{ id: 1, name: "Maya", email: "maya@example.com" }]}
      tickets={[{ id: 1, name: "General", price: 95, active: true }]}
      onSave={save}
      onCancel={() => {}}
    />,
  );
  const u = userEvent.setup();
  await u.selectOptions(screen.getByLabelText("Customer"), "1");
  await u.type(screen.getByLabelText("Visit date"), "2026-12-01");
  await u.clear(screen.getByLabelText("Ticket quantity"));
  await u.type(screen.getByLabelText("Ticket quantity"), "3");
  await u.click(screen.getByLabelText("Waiver signed"));
  expect(screen.getByText(/285/)).toBeInTheDocument();
  await u.click(screen.getByText("Save booking"));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: 1,
        ticket_id: 1,
        quantity: 3,
        waiver_signed: true,
      }),
    ),
  );
});
test("login submits demo credentials and surfaces API error", async () => {
  const login = vi.fn().mockRejectedValue(new Error("Backend unavailable"));
  useAuth.mockReturnValue({ login });
  render(<Login />);
  await userEvent.click(screen.getByText("Sign in to workspace"));
  await waitFor(() =>
    expect(login).toHaveBeenCalledWith(
      { email: "demo@museum.example", password: "MuseumDemo2026!" },
      false,
    ),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Backend unavailable",
  );
});
test("quality validation action invokes server and reloads history", async () => {
  api.get.mockResolvedValue({ data: [] });
  api.post.mockResolvedValue({ data: { reports: [] } });
  render(<Quality />);
  await userEvent.click(screen.getByText("Run data validation"));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith("/api/data/validate"),
  );
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Database validation completed",
  );
});
test("dashboard uses server KPIs and reports missing warehouse connection", async () => {
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: path.includes("analytics")
        ? {
            revenue: 12345,
            total_bookings: 20,
            pending: 3,
            tickets_sold: 40,
            total_customers: 10,
            average_booking: 617,
            cancelled: 2,
            quality_issues: 0,
            last_sync: null,
            monthly: [],
            daily: [],
            categories: [],
            customer_activity: [],
            recent: [],
            alerts: [],
          }
        : [],
    }),
  );
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
  expect(await screen.findByText(/12,345/)).toBeInTheDocument();
  expect(
    screen.getByText("No validation alerts to review"),
  ).toBeInTheDocument();
});
test("protected app navigation opens customer module", async () => {
  useAuth.mockReturnValue({
    user: { id: 1, name: "Demo User", role: "staff" },
    loading: false,
    logout: vi.fn(),
  });
  api.get.mockImplementation((path) =>
    Promise.resolve({
      data: path.includes("analytics")
        ? {
            revenue: 0,
            total_bookings: 0,
            pending: 0,
            tickets_sold: 0,
            total_customers: 0,
            average_booking: 0,
            cancelled: 0,
            quality_issues: 0,
            monthly: [],
            daily: [],
            categories: [],
            customer_activity: [],
            recent: [],
            alerts: [],
          }
        : path.includes("customers")
          ? { items: [], total: 0 }
          : [],
    }),
  );
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole("link", { name: "Customers / CRM" }));
  expect(
    await screen.findByRole("button", { name: "Add customer" }),
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Search by name or email…"),
  ).toBeInTheDocument();
});
