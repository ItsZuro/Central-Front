import { useAuthStore } from "@/core/stores/auth/auth.store";
import { roleDefaultRoutes } from "@/core/constants/role-routes";
import { Navigate, Outlet } from "react-router-dom";

export default function AuthLayout() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  // No mostrar login ni registro de clientes a personal autenticado.
  if (accessToken && user) {
    const priority = [
      "ROLE_ADMIN", "ROLE_MANAGER", "ROLE_CHEF", "ROLE_CASHIER",
      "ROLE_WAITER", "ROLE_DRIVER", "ROLE_SUPPLIER", "ROLE_CLIENT",
    ];
    const role = priority.find((candidate) => user.roles?.includes(candidate));
    if (role) return <Navigate to={roleDefaultRoutes[role]} replace />;
  }

  return <Outlet />;
}
