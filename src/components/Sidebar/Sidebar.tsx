import { useAdminUiStore } from "@/core/stores/admin/admin-ui.store";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { useAdminLogout } from "@/components/layouts/AdminLayout/useAdminLogout";
import styles from "@/components/layouts/AdminLayout/AdminShell.module.css";
import {
  Avatar, Badge, Box, Button, Drawer, Group, NavLink as MantineNavLink,
  ScrollArea, Stack, Text,
} from "@mantine/core";
import {
  ChartNoAxesCombined, ChevronRight, LayoutDashboard, LogOut,
  MapPin, ShieldCheck, Tags, Truck, UtensilsCrossed, UserRound, UsersRound, UserRoundSearch,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const sections = [
  {
    label: "General",
    links: [
      { label: "Resumen", to: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Reportes", to: "/admin/reports", icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Catálogo",
    links: [
      { label: "Productos", to: "/admin/products", icon: UtensilsCrossed },
      { label: "Categorías", to: "/admin/categories", icon: Tags },
    ],
  },
  {
    label: "Operaciones",
    links: [
      { label: "Sucursales y delivery", to: "/admin/stores", icon: MapPin },
      { label: "Gestión de repartos", to: "/admin/deliveries", icon: Truck },
      { label: "Clientes", to: "/admin/customers", icon: UserRoundSearch },
    ],
  },
  {
    label: "Administración",
    links: [
      { label: "Usuarios", to: "/admin/users", icon: UsersRound, adminOnly: true },
    ],
  },
  {
    label: "Cuenta",
    links: [
      { label: "Mi perfil", to: "/admin/profile", icon: UserRound },
    ],
  },
];

export default function Sidebar() {
  const sidebarOpen = useAdminUiStore((state) => state.sidebarOpen);
  const closeSidebar = useAdminUiStore((state) => state.closeSidebar);
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.roles?.includes("ROLE_ADMIN"));
  const { logout, loggingOut } = useAdminLogout();
  const location = useLocation();
  const displayName = user?.fullName?.trim() || user?.username || "Usuario de gestión";
  const initials = ((user?.firstName?.[0] || user?.username?.[0] || "A") +
    (user?.lastName?.[0] || "")).toUpperCase();

  const content = (
    <div className={styles.sidebarBody}>
      <ScrollArea className={styles.scrollArea} type="auto">
        <Link to="/admin/dashboard" className={styles.brand} onClick={closeSidebar}>
          <span className={styles.brandMark} aria-hidden="true">C</span>
          <span>
            <span className={styles.brandName} style={{ display: "block" }}>Central</span>
            <span className={styles.brandSubtitle} style={{ display: "block" }}>Administración</span>
          </span>
        </Link>

        <Box className={styles.userCard}>
          <Group gap="xs" wrap="nowrap">
            <Avatar
              src={user?.profileImageUrl || undefined}
              name={displayName}
              size={44}
              radius="xl"
              className={styles.userAvatar}
            >
              {initials}
            </Avatar>
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" fw={800} c="#39272f" truncate>{displayName}</Text>
              <Text size="xs" c="#89747e" mt={2} truncate>
                @{user?.username || "usuario"}
              </Text>
            </Box>
            <ShieldCheck size={17} color="#ba4553" aria-label="Acceso de gestión"/>
          </Group>
          <Badge size="sm" mt="sm" color="red" variant="light" radius="sm">
            {isAdmin ? "Administrador" : "Gerente"}
          </Badge>
        </Box>

        <nav aria-label="Navegación de administración">
          {sections.map((section) => {
            const links = section.links.filter((link) => !("adminOnly" in link && link.adminOnly) || isAdmin);
            if (!links.length) return null;
            return (
              <Box key={section.label} className={styles.navSection}>
                <Text className={styles.sectionLabel}>{section.label}</Text>
                <Stack gap={3}>
                  {links.map((link) => {
                    const Icon = link.icon;
                    const active = location.pathname === link.to ||
                      location.pathname.startsWith(link.to + "/");
                    return (
                      <MantineNavLink
                        key={link.to}
                        component={Link}
                        to={link.to}
                        label={link.label}
                        leftSection={<Icon size={18} strokeWidth={1.9} className={styles.navSectionIcon} />}
                        rightSection={active ? <ChevronRight size={15} /> : null}
                        active={active}
                        variant="light"
                        color="red"
                        classNames={{ root: styles.navItem, label: styles.navLabel }}
                        onClick={closeSidebar}
                      />
                    );
                  })}
                </Stack>
              </Box>
            );
          })}
        </nav>
      </ScrollArea>

      <Box className={styles.sidebarFoot}>
        <div className={styles.sidebarHelp}>
          <ShieldCheck size={17} color="#b84957" style={{ flexShrink: 0, marginTop: 2 }} />
          <Box>
            <Text size="xs" fw={750} c="#46373e">Área de gestión interna</Text>
            <Text size="xs" c="#8d7c84" mt={3}>Restaurant Central · Perú</Text>
          </Box>
        </div>
        <Button
          size="sm"
          variant="subtle"
          radius="md"
          leftSection={<LogOut size={16} />}
          className={styles.logoutButton}
          loading={loggingOut}
          onClick={() => void logout()}
        >
          Cerrar sesión
        </Button>
      </Box>
    </div>
  );

  return (
    <>
      <Drawer
        opened={sidebarOpen}
        onClose={closeSidebar}
        hiddenFrom="md"
        position="left"
        size={284}
        withCloseButton={false}
        padding={0}
        styles={{
          content: { background: "#fffcfa" },
          body: { padding: 0, height: "100%" },
        }}
      >
        <Box h="100dvh">{content}</Box>
      </Drawer>

      <Box visibleFrom="md" className={styles.sidebarDesktop}>
        {content}
      </Box>
    </>
  );
}
