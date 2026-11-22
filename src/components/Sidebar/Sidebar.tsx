import { logoutFromServer } from "@/core/services/auth/logout";
import { useAdminUiStore } from "@/core/stores/admin/admin-ui.store";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { ActionIcon, Avatar, Badge, Box, Button, Divider, Drawer, Group, NavLink as MantineNavLink, Paper, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { ChartNoAxesCombined, ChevronRight, LayoutDashboard, LogOut, Menu as MenuIcon, ShieldCheck, Tags, UtensilsCrossed, UserRound, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const navigation = [
  { label: "Resumen", to: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Productos", to: "/admin/products", icon: UtensilsCrossed },
  { label: "Categorías", to: "/admin/categories", icon: Tags },
  { label: "Reportes", to: "/admin/reports", icon: ChartNoAxesCombined },
  { label: "Usuarios", to: "/admin/users", icon: UsersRound, adminOnly: true },
  { label: "Mi perfil", to: "/admin/profile", icon: UserRound },
];

export default function Sidebar() {
  const open = useAdminUiStore((state) => state.sidebarOpen);
  const openSidebar = useAdminUiStore((state) => state.openSidebar);
  const closeSidebar = useAdminUiStore((state) => state.closeSidebar);
  const [loggingOut, setLoggingOut] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.roles?.includes("ROLE_ADMIN"));
  const initials = ((user?.firstName?.[0] || user?.username?.[0] || "A") + (user?.lastName?.[0] || "")).toUpperCase();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      setLoggingOut(false);
      closeSidebar();
      navigate("/auth/login", { replace: true });
    }
  };

  const content = () => (
    <Stack gap={0} h="100%" p="md">
      <Group gap="sm" px="xs" mt="xs" mb="xl">
        <ThemeIcon color="red" radius="lg" size={48} variant="filled">
          <Text size="xl" fw={900} c="white">C</Text>
        </ThemeIcon>
        <Box style={{ flex: 1 }}>
          <Title order={3} fw={900} size="lg" lh={1.2}>CENTRAL</Title>
          <Text size="xs" fw={800} c="red.7" tt="uppercase" lts={2}>Administración</Text>
        </Box>
        <Badge color="red" variant="light" size="xs">v2</Badge>
      </Group>

      <Paper radius="lg" p="md" bg="red.8" mb="xl" shadow="sm">
        <Group justify="space-between">
          <Text size="xs" tt="uppercase" fw={800} lts={1.2} c="red.0">Panel de control</Text>
          <ShieldCheck size={18} color="white"/>
        </Group>
        <Group mt="md" gap="sm" wrap="nowrap">
          <Avatar size={42} color="red" variant="light" radius="lg" style={{ flexShrink: 0, border: "2px solid rgba(255,255,255,.45)" }}>{initials}</Avatar>
          <Box style={{ minWidth: 0 }}>
            <Text c="white" fw={750} size="sm" truncate>{user?.fullName || user?.username || "Administrador"}</Text>
            <Text c="red.1" size="xs">{isAdmin ? "Administrador" : "Gerente"}</Text>
          </Box>
        </Group>
      </Paper>

      <Text size="xs" fw={800} c="dimmed" tt="uppercase" lts={1.3} px="sm" mb="xs">Menú principal</Text>
      <Stack gap={4}>
        {navigation.filter((entry) => isAdmin || !entry.adminOnly).map((entry) => {
          const Icon = entry.icon;
          const active = location.pathname === entry.to || location.pathname.startsWith(entry.to + "/");
          return (
            <MantineNavLink
              key={entry.to}
              component={Link}
              to={entry.to}
              label={entry.label}
              leftSection={<Icon size={19}/>}
              rightSection={active ? <ChevronRight size={17}/> : null}
              active={active}
              color="red"
              variant="light"
              fw={active ? 800 : 600}
              onClick={closeSidebar}
              styles={{
                root: { borderRadius: 12, minHeight: 44, padding: "10px 14px" },
                section: { flexShrink: 0, marginInlineEnd: 11 },
                label: { fontSize: 14, lineHeight: 1.4 },
              }}
            />
          );
        })}
      </Stack>

      <Box mt="auto" pt="lg">
        <Divider mb="lg"/>
        <Paper p="sm" bg="gray.0" withBorder mb="md">
          <Text size="xs" fw={750}>Restaurant Central</Text>
          <Text c="dimmed" size="xs">Sistema de gestión del restaurante</Text>
        </Paper>
        <Button variant="light" color="red" fullWidth leftSection={<LogOut size={17}/>} loading={loggingOut} onClick={() => void handleLogout()}>
          Cerrar sesión
        </Button>
      </Box>
    </Stack>
  );

  return (
    <>
      <Box hiddenFrom="md" p="sm" bg="white" style={{ position: "sticky", top: 0, zIndex: 90, borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <Group justify="space-between">
          <Group gap="sm"><ThemeIcon size={37} color="red" radius="lg"><Text fw={900} c="white">C</Text></ThemeIcon><Title order={4}>CENTRAL <Text span c="red.7">ADMIN</Text></Title></Group>
          <ActionIcon variant="light" color="red" size="lg" onClick={openSidebar} aria-label="Abrir menú"><MenuIcon size={22}/></ActionIcon>
        </Group>
      </Box>

      <Drawer opened={open} onClose={closeSidebar} size={292} position="left" withCloseButton={false} padding={0} title={null}>
        <Box h="100dvh">{content()}</Box>
      </Drawer>

      <Box visibleFrom="md" style={{ width: 282, flexShrink: 0 }}>
        <Paper radius={0} withBorder style={{ height: "100vh", position: "sticky", top: 0, overflowY: "auto", borderLeft: 0, borderTop: 0, borderBottom: 0 }}>
          {content()}
        </Paper>
      </Box>
    </>
  );
}
