import axios from "axios";
const url = import.meta.env.VITE_API_URL;
if (import.meta.env.PROD && url && /localhost|127\.0\.0\.1/.test(url))
  throw new Error("Production API cannot use localhost");
export const api = axios.create({ baseURL: url || "", withCredentials: true });
let csrf = "";
export function setCsrf(token) {
  csrf = token || "";
}
api.interceptors.request.use((config) => {
  if (csrf) config.headers["X-CSRF-Token"] = csrf;
  return config;
});
export function errorMessage(error) {
  const d = error.response?.data?.detail;
  return typeof d === "string"
    ? d
    : Array.isArray(d)
      ? d.map((e) => `${e.loc?.at(-1)}: ${e.msg}`).join("; ")
      : d?.message || error.message || "Request failed";
}
export async function download(path, name) {
  const { data } = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
