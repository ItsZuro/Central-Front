import { useAdminUiStore } from "@/core/stores/admin/admin-ui.store";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { useAdminLogout } from "./useAdminLogout";
import styles from "./AdminShell.module.css";
import {
  ActionIcon, Avatar, Box, Button, Divider, Group, Menu,
  Text, Tooltip, UnstyledButton,
} from "@mantine/core";
import {
  ChevronDown, ExternalLink, LayoutDashboard, LogOut, Menu as MenuIcon,
  Settings2, UserRound,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const sections = [
  { path: "/admin/dashboard", title: "Resumen", subtitle: "Visión general de tu restaurante" },
  { path: "/admin/products", title: "Productos", subtitle: "Administración del menú y catálogo" },
  { path: "/admin/categories", title: "Categorías", subtitle: "Organiza los productos de Central" },
  { path: "/admin/reports", title: "Reportes", subtitle: "Indicadores y resultados de la operación" },
  { path: "/admin/stores", title: "Sucursales y delivery", subtitle: "Ubicaciones y cobertura de reparto" },
  { path: "/admin/users", title: "Usuarios", subtitle: "Accesos y cuentas del sistema" },
  { path: "/admin/profile", title: "Mi perfil", subtitle: "Tu información y seguridad" },
];

export default function AdminHeader() {
  const openSidebar = useAdminUiStore((state) => state.openSidebar);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const { loggingOut, logout } = useAdminLogout();
  const section = sections.find((item) =>
    location.pathname === item.path || location.pathname.startsWith(item.path + "/"))
    || sections[0];

  const fullName = user?.fullName?.trim() || user?.username || "Usuario";
  const role = user?.roles?.includes("ROLE_ADMIN") ? "Administrador" : "Gerente";
  const initials = ((user?.firstName?.[0] || user?.username?.[0] || "A") +
    (user?.lastName?.[0] || "")).toUpperCase();

  return (
    <header className={styles.header}>
      <Group justify="space-between" wrap="nowrap" gap="sm">
        <Group gap="md" wrap="nowrap" style={{ minWidth: 0 }}>
          <Tooltip label="Abrir menú" position="bottom">
            <ActionIcon
              hiddenFrom="md"
              size="lg"
              radius="md"
              variant="light"
              className={styles.mobileMenuButton}
              onClick={openSidebar}
              aria-label="Abrir navegación administrativa"
            >
              <MenuIcon size={21} />
            </ActionIcon>
          </Tooltip>

          <Box style={{ minWidth: 0 }}>
            <Group gap={7} className={styles.breadcrumb} visibleFrom="sm" wrap="nowrap">
              <span>Central</span>
              <span aria-hidden="true">/</span>
              <span>Administración</span>
              <span aria-hidden="true">/</span>
              <span className={styles.breadcrumbCurrent}>{section.title}</span>
            </Group>
            <Text className={styles.headerTitle} mt={4} truncate>{section.title}</Text>
            <Text className={styles.headerDescription} visibleFrom="sm">{section.subtitle}</Text>
          </Box>
        </Group>

        <div className={styles.headerActions}>
          <Button
            component={Link}
            to="/"
            size="sm"
            radius="md"
            variant="subtle"
            className={styles.publicSiteButton}
            leftSection={<ExternalLink size={15} />}
          >
            Ver restaurante
          </Button>

          <Menu
            width={225}
            position="bottom-end"
            withArrow
            shadow="lg"
            radius="md"
            offset={9}
          >
            <Menu.Target>
              <UnstyledButton className={styles.profileTrigger} aria-label="Opciones de mi cuenta">
                <Group gap="xs" wrap="nowrap">
                  <Avatar
                    src={user?.profileImageUrl || undefined}
                    name={fullName}
                    size={36}
                    radius="xl"
                    className={styles.headerAvatar}
                  >
                    {initials}
                  </Avatar>
                  <Box visibleFrom="sm" style={{ maxWidth: 140, minWidth: 0 }}>
                    <Text className={styles.profileName} truncate>{fullName}</Text>
                    <Text className={styles.profileRole}>{role}</Text>
                  </Box>
                  <ChevronDown size={15} color="#99818b" aria-hidden="true"/>
                </Group>
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown className={styles.menuDropdown}>
              <Menu.Label>Cuenta de administración</Menu.Label>
              <Menu.Item
                component={Link}
                to="/admin/profile"
                leftSection={<UserRound size={16} />}
                className={styles.menuItem}
              >
                Mi perfil
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/admin/dashboard"
                leftSection={<LayoutDashboard size={16} />}
                className={styles.menuItem}
              >
                Ir al resumen
              </Menu.Item>
              <Menu.Item
                component={Link}
                to="/admin/stores"
                leftSection={<Settings2 size={16} />}
                className={styles.menuItem}
              >
                Sucursales y delivery
              </Menu.Item>
              <Divider color="#f0e1e0" my={5} />
              <Menu.Item
                leftSection={<LogOut size={16}/>}
                className={styles.menuItem + " " + styles.menuItemDanger}
                disabled={loggingOut}
                onClick={() => void logout()}
              >
                {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </Group>
    </header>
  );
}
