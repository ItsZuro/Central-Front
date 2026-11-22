import type { LoginRequest, SignupRequest } from "@/core/types/auth/auth.model";
import { useMutation } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { roleDefaultRoutes } from "../../constants/role-routes";
import {
  authService,
  type LoginResponse,
} from "../../services/auth/auth.service";
import { useAuthStore } from "../../stores/auth/auth.store";
import type { ApiError, ApiResponse } from "../../types/base/api-response";

export function useLoginMutation() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation<LoginResponse, AxiosError<ApiError>, LoginRequest>({
    mutationFn: (data) => authService.login(data),
    onSuccess: (data) => {
      setAuth(data);

      // Las cuentas de personal pueden tener varios roles: elegir por prioridad,
      // sin depender del orden no determinista del Set devuelto por el backend.
      const priority = [
        "ROLE_ADMIN", "ROLE_MANAGER", "ROLE_CHEF",
        "ROLE_CASHIER", "ROLE_WAITER", "ROLE_DRIVER", "ROLE_SUPPLIER", "ROLE_CLIENT",
      ];
      const userRole = priority.find((role) => data.user.roles?.includes(role));
      const redirectPath = userRole ? roleDefaultRoutes[userRole] || "/" : "/";

      // Solo restaurar páginas internas permitidas para una cuenta de cliente.
      const context = location.state as {
        from?: string;
        checkoutDraft?: unknown;
        reservationDraft?: unknown;
      } | null;
      const returnTo = userRole === "ROLE_CLIENT" &&
        (context?.from === "/checkout" || context?.from === "/reservations")
        ? context.from
        : null;
      if (returnTo) {
        navigate(returnTo, {
          replace: true,
          state: {
            checkoutDraft: context?.checkoutDraft,
            reservationDraft: context?.reservationDraft,
          },
        });
      } else {
        navigate(redirectPath, { replace: true });
      }
    },
    onError: (error) => {
      console.error("Error en login:", error);

      let message = "Error de autenticación";

      // Lógica personalizada para mensajes de error
      if (error.response?.status === 401) {
        message = "Credenciales inválidas. Verifica tu usuario y contraseña.";
      } else if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message === "Network Error") {
        message = "No se pudo conectar con el servidor.";
      }

      toast.error(message);
    },
  });
}

export function useSignupMutation() {
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation<ApiResponse<number>, AxiosError<ApiError>, SignupRequest>({
    mutationFn: (data) => authService.signup(data),
    onSuccess: () => {
      // El registro actual habilita al cliente sin requerir correo de verificación.
      toast.success("Cuenta de cliente registrada. Ya puedes iniciar sesión.");

      navigate("/auth/login", { state: location.state, replace: true });
    },
    onError: (error) => {
      console.error(error);
      const message =
        error.response?.data?.message ||
        (error.response?.data?.errors
          ? error.response.data.errors[0].defaultMessage
          : "Error al registrarse");

      toast.error(message);
    },
  });
}
