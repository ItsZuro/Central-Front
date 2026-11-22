import PublicFooter from "@/components/Footer/PublicFooter";
import PublicHeader from "@/components/Header/PublicHeader";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { roleDefaultRoutes } from "@/core/constants/role-routes";
import { Navigate, Outlet } from "react-router-dom";

export default function PublicLayout() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  // Las páginas públicas del cliente se reservan a clientes e invitados.
  // Cada trabajador autenticado vuelve a su propio panel incluso si escribe
  // manualmente /, /menu, /checkout, /profile o /my-orders.
  if (accessToken && user) {
    const priority = ["ROLE_ADMIN", "ROLE_MANAGER", "ROLE_CHEF", "ROLE_CASHIER", "ROLE_WAITER", "ROLE_SUPPLIER"];
    const staffRole = priority.find((role) => user.roles?.includes(role));
    if (staffRole) return <Navigate to={roleDefaultRoutes[staffRole]} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
