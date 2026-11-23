import { createContext, useContext, useEffect, useState } from "react";
import { api, setCsrf } from "../services/api";
const Auth = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  function accept(u) {
    setCsrf(u?.csrf);
    setUser(u);
  }
  useEffect(() => {
    api
      .get("/api/auth/me")
      .then((r) => accept(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  async function login(body, register = false) {
    const { data } = await api.post(
      `/api/auth/${register ? "register" : "login"}`,
      body,
    );
    accept(data);
  }
  async function logout() {
    await api.post("/api/auth/logout");
    accept(null);
  }
  return (
    <Auth.Provider value={{ user, loading, login, logout }}>
      {children}
    </Auth.Provider>
  );
}
export const useAuth = () => useContext(Auth);
