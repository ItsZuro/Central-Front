import { useAuthStore } from "@/core/stores/auth/auth.store";
import axios from "axios";
import { toast } from "react-toastify";

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080/api/v1/";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes("login");
    const wasAuthenticated = Boolean(error.config?.headers?.Authorization);

    // Una consulta pública de un invitado puede responder 401 si el endpoint
    // exige permisos. Eso NO debe expulsarlo del menú ni del checkout.
    // Para sesiones vencidas, limpiar las credenciales y dejar que los guards
    // de rutas privadas gestionen el login; no forzar un salto de página.
    if (error.response?.status === 401 && !isLoginRequest && wasAuthenticated) {
      useAuthStore.getState().logout();
      toast.warn("Tu sesión ha expirado. Inicia sesión para continuar.");
    }

    return Promise.reject(error);
  }
);
