import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { toast } from "react-toastify";

/** Revoke session on the server first, then clear the browser session. */
export async function logoutFromServer(): Promise<void> {
  const state = useAuthStore.getState();
  try {
    if (state.accessToken && state.sessionId) {
      await api.post("auth/logout", { sessionId: state.sessionId });
    }
  } catch {
    toast.warn("Sesión cerrada en el navegador; no se pudo confirmar su revocación en el servidor.");
  } finally {
    useAuthStore.getState().logout();
  }
}
