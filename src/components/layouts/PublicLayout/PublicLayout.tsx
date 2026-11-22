import PublicFooter from "@/components/Footer/PublicFooter";
import PublicHeader from "@/components/Header/PublicHeader";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { Navigate, Outlet } from "react-router-dom";

export default function PublicLayout() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);

  // Un ADMIN tiene su propia interfaz, incluso si escribe manualmente la URL pública.
  if (accessToken && user?.roles?.includes("ROLE_ADMIN")) {
    return <Navigate to="/admin/dashboard" replace />;
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
