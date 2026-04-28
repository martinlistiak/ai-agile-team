import axios from "axios";
import { getCurrentInternalPath, getLoginPath } from "@/lib/auth-redirect";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url ?? "");
    const isAuthBootstrapRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/forgot-password") ||
      requestUrl.includes("/auth/reset-password") ||
      requestUrl.includes("/auth/github/callback") ||
      requestUrl.includes("/auth/gitlab/callback") ||
      requestUrl.includes("/auth/github") ||
      requestUrl.includes("/auth/verify-email") ||
      requestUrl.includes("/enterprise/sso");

    const errorCode = error.response?.data?.code;
    const isIntegrationError = errorCode === "INTEGRATION_NOT_CONNECTED";

    if (
      error.response?.status === 401 &&
      !isAuthBootstrapRequest &&
      !isIntegrationError
    ) {
      localStorage.removeItem("token");
      window.location.href = getLoginPath(getCurrentInternalPath());
    }
    return Promise.reject(error);
  },
);

export default api;
