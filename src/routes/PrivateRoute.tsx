import { useAuthStore } from "@/core/stores/auth/auth.store";
import { roleDefaultRoutes } from "@/core/constants/role-routes";
import { Navigate, Outlet, useLocation } from "react-router-dom";

interface PrivateRouteProps {
  allowedRoles?: string[];
}

const PrivateRoute = ({ allowedRoles }: PrivateRouteProps) => {
  const { accessToken, user } = useAuthStore();
  const location = useLocation();

  if (!accessToken || !user) {
    return (
      <Navigate
        to="/auth/login"
        state={{ from: location }}
        replace
      />
    );
  }

  if (allowedRoles && !user.roles.some((role) => allowedRoles.includes(role))) {
    // No enviar personal no autorizado al inicio del cliente.
    const priority = [
      "ROLE_ADMIN", "ROLE_MANAGER", "ROLE_CHEF", "ROLE_CASHIER",
      "ROLE_WAITER", "ROLE_DRIVER", "ROLE_SUPPLIER", "ROLE_CLIENT",
    ];
    const primaryRole = priority.find((role) => user.roles.includes(role));
    const home = primaryRole ? roleDefaultRoutes[primaryRole] : "/auth/login";
    return <Navigate to={home} replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
