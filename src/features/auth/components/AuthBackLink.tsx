import { Button } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Salida explícita del flujo de autenticación.
 * No depende del historial del navegador: funciona también al entrar por URL directa.
 */
export default function AuthBackLink() {
  return (
    <Button
      component={Link}
      to="/"
      variant="subtle"
      color="gray"
      size="sm"
      leftSection={<ArrowLeft size={17} />}
      styles={{
        root: { color: "#e5e7eb", paddingInline: 8 },
        section: { color: "#f87171" },
      }}
    >
      Volver a la página principal
    </Button>
  );
}
