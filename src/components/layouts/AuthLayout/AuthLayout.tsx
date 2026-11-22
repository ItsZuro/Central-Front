import { useAuthStore } from "@/core/stores/auth/auth.store";
import { Navigate, Outlet } from "react-router-dom";

export default function AuthLayout() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  if (accessToken && user?.roles?.includes("ROLE_ADMIN")) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}
