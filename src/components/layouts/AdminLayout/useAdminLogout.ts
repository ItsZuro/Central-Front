import { logoutFromServer } from "@/core/services/auth/logout";
import { useAdminUiStore } from "@/core/stores/admin/admin-ui.store";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/** Sesión compartida por sidebar y menú del avatar. */
export function useAdminLogout() {
  const [loggingOut, setLoggingOut] = useState(false);
  const closeSidebar = useAdminUiStore((state) => state.closeSidebar);
  const navigate = useNavigate();

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      closeSidebar();
      navigate("/auth/login", { replace: true });
      setLoggingOut(false);
    }
  };

  return { loggingOut, logout };
}
