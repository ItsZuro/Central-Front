import { logoutFromServer } from "@/core/services/auth/logout";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { useCartStore } from "@/core/stores/cart/cart.store";
import {
  ActionIcon, Avatar, Box, Burger, Button, Container,
  Divider, Drawer, Group, Indicator, Menu, Stack, Text,
} from "@mantine/core";
import {
  ArrowRight, ClipboardList, LogOut, ShoppingBag, UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

const navigation = [
  { label: "Inicio", to: "/" },
  { label: "Menú", to: "/menu" },
  { label: "Reservas", to: "/reservations" },
  { label: "Contacto", to: "/contact" },
];

const navClass = ({ isActive }: { isActive: boolean }) =>
  "relative rounded-lg px-3 py-2.5 text-[13px] font-bold tracking-[0.08em] uppercase no-underline transition-colors " +
  (isActive
    ? "bg-red-600/10 text-red-300"
    : "text-zinc-300 hover:bg-white/5 hover:text-white");

export default function PublicHeader() {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const cart = useCartStore((state) => state.items);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const loggedIn = Boolean(user && accessToken);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const logout = async () => {
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      setLoggingOut(false);
      setMobileOpen(false);
      navigate("/auth/login", { replace: true });
    }
  };

  return (
    <>
      <Box
        component="header"
        pos="fixed"
        top={0}
        left={0}
        right={0}
        style={{
          zIndex: 110,
          backgroundColor: "rgba(18, 18, 21, .93)",
          borderBottom: "1px solid rgba(255, 255, 255, .09)",
          boxShadow: "0 10px 32px rgba(0, 0, 0, .17)",
          backdropFilter: "blur(15px)",
          WebkitBackdropFilter: "blur(15px)",
        }}
      >
        <Container size="xl" px={{ base: "md", sm: "xl" }}>
          <Group justify="space-between" align="center" h={76} wrap="nowrap" gap="md">
            {/* Preservar el logotipo original de Central, solicitado por el usuario. */}
            <Link
              to="/"
              aria-label="Restaurant Central, volver al inicio"
              className="flex shrink-0 items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400"
            >
              <img
                src="/images/inicio/centralLogo.png"
                alt="Central"
                className="h-11 w-auto max-w-[135px] object-contain sm:h-12 sm:max-w-[155px]"
              />
            </Link>

            <Group visibleFrom="md" gap={6} wrap="nowrap" component="nav" aria-label="Navegación principal">
              {navigation.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.to === "/"} className={navClass}>
                  {item.label}
                </NavLink>
              ))}
            </Group>

            <Group visibleFrom="md" gap="sm" wrap="nowrap">
              <Indicator
                inline
                color="red"
                size={18}
                disabled={cartCount === 0}
                label={cartCount > 99 ? "99+" : cartCount}
              >
                <ActionIcon
                  component={Link}
                  to="/checkout"
                  variant="subtle"
                  color="gray"
                  size="xl"
                  radius="md"
                  aria-label={cartCount ? `Ver carrito, ${cartCount} artículos` : "Ver carrito"}
                  styles={{ root: { color: "#e4e4e7" } }}
                >
                  <ShoppingBag size={21} />
                </ActionIcon>
              </Indicator>
              {loggedIn && user ? (
                <Menu position="bottom-end" width={250} shadow="xl" withinPortal>
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      radius="lg"
                      color="gray"
                      size="md"
                      styles={{ root: { color: "#f4f4f5", height: 46 } }}
                      leftSection={
                        <Avatar size={31} radius="xl" color="red" src={user.profileImageUrl || null}>
                          {(user.firstName?.[0] || user.username[0] || "C").toUpperCase()}
                        </Avatar>
                      }
                    >
                      {user.firstName || user.username}
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown styles={{ dropdown: { backgroundColor: "#222328", borderColor: "#44444b", padding: 7 } }}>
                    <Menu.Label>
                      <Text c="white" size="sm" fw={750}>{user.fullName || user.username}</Text>
                      <Text c="#a8a8b2" size="xs" truncate>{user.email}</Text>
                    </Menu.Label>
                    <Menu.Divider />
                    <Menu.Item component={Link} to="/profile" leftSection={<UserRound size={17} />} styles={{ item: { color: "#f5f5f5" } }}>Mi perfil</Menu.Item>
                    <Menu.Item component={Link} to="/my-orders" leftSection={<ClipboardList size={17} />} styles={{ item: { color: "#f5f5f5" } }}>Mis pedidos</Menu.Item>
                    <Menu.Divider />
                    <Menu.Item
                      color="red"
                      disabled={loggingOut}
                      leftSection={<LogOut size={17} />}
                      onClick={() => void logout()}
                    >
                      Cerrar sesión
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              ) : (
                <Group gap="xs" wrap="nowrap">
                  <Button
                    component={Link}
                    to="/auth/login"
                    variant="subtle"
                    color="gray"
                    radius="md"
                    styles={{ root: { color: "#f4f4f5" } }}
                  >
                    Iniciar sesión
                  </Button>
                  <Button component={Link} to="/auth/signup" radius="xl" color="red" rightSection={<ArrowRight size={15} />}>
                    Registrarse
                  </Button>
                </Group>
              )}
            </Group>

            <Group hiddenFrom="md" gap={8} wrap="nowrap">
              <Indicator color="red" size={16} inline disabled={cartCount === 0} label={cartCount > 99 ? "99+" : cartCount}>
                <ActionIcon
                  component={Link}
                  to="/checkout"
                  variant="subtle"
                  color="gray"
                  size="lg"
                  aria-label={cartCount ? `Ver carrito, ${cartCount} artículos` : "Ver carrito"}
                  styles={{ root: { color: "#e4e4e7" } }}
                >
                  <ShoppingBag size={20} />
                </ActionIcon>
              </Indicator>
              <Burger
                opened={mobileOpen}
                onClick={() => setMobileOpen((open) => !open)}
                color="white"
                size="sm"
                aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              />
            </Group>
          </Group>
        </Container>
      </Box>

      <Drawer
        opened={mobileOpen}
        onClose={() => setMobileOpen(false)}
        position="right"
        size="xs"
        title={null}
        withCloseButton={false}
        padding={0}
        zIndex={200}
        overlayProps={{ backgroundOpacity: 0.7, blur: 3 }}
        styles={{ content: { backgroundColor: "#1b1c21", color: "white" }, body: { padding: 0 } }}
      >
        <Stack p="lg" gap="lg" mih="100dvh">
          <Group justify="space-between" align="center">
            <Text fw={900} size="sm" c="#fda4af" tt="uppercase" lts={1.5}>Restaurant Central</Text>
            <Burger opened onClick={() => setMobileOpen(false)} color="white" size="sm" aria-label="Cerrar menú" />
          </Group>
          <Divider color="#3d3e45" />
          <Stack gap={7} component="nav" aria-label="Navegación móvil">
            {navigation.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={
                    "block rounded-xl px-4 py-3 text-sm font-bold no-underline transition-colors " +
                    (active ? "bg-red-700/25 text-red-200" : "text-zinc-200 hover:bg-white/10")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </Stack>
          <Divider color="#3d3e45" />
          {loggedIn && user ? (
            <Stack gap="sm">
              <Group gap="sm" wrap="nowrap">
                <Avatar color="red" src={user.profileImageUrl || null}>
                  {(user.firstName?.[0] || user.username[0] || "C").toUpperCase()}
                </Avatar>
                <Box style={{ minWidth: 0 }}>
                  <Text fw={700} c="white" truncate>{user.fullName || user.username}</Text>
                  <Text size="xs" c="#a9abb5" truncate>{user.email}</Text>
                </Box>
              </Group>
              <Button component={Link} to="/profile" onClick={() => setMobileOpen(false)} variant="light" color="gray" fullWidth leftSection={<UserRound size={17} />}>Mi perfil</Button>
              <Button component={Link} to="/my-orders" onClick={() => setMobileOpen(false)} variant="light" color="gray" fullWidth leftSection={<ClipboardList size={17} />}>Mis pedidos</Button>
              <Button variant="outline" color="red" fullWidth loading={loggingOut} leftSection={<LogOut size={17} />} onClick={() => void logout()}>Cerrar sesión</Button>
            </Stack>
          ) : (
            <Stack gap="sm">
              <Button component={Link} to="/auth/login" onClick={() => setMobileOpen(false)} fullWidth variant="outline" color="gray">Iniciar sesión</Button>
              <Button component={Link} to="/auth/signup" onClick={() => setMobileOpen(false)} color="red" fullWidth>Crear cuenta</Button>
            </Stack>
          )}
          <Box mt="auto">
            <Text c="#898c99" size="xs" ta="center">Sabores para compartir</Text>
          </Box>
        </Stack>
      </Drawer>
    </>
  );
}
