import { useAuthStore } from "@/core/stores/auth/auth.store";
import {
  Box, Button, Container, Divider, Group, SimpleGrid, Stack,
  Text, ThemeIcon, Title,
} from "@mantine/core";
import {
  ArrowRight, ChefHat, Heart, Mail, ShoppingBag, UtensilsCrossed,
} from "lucide-react";
import { Link } from "react-router-dom";

const navigation = [
  { label: "Inicio", to: "/" },
  { label: "Nuestra carta", to: "/menu" },
  { label: "Reservas", to: "/reservations" },
  { label: "Contáctanos", to: "/contact" },
];

const footerLinkClass =
  "inline-flex w-fit items-center gap-2 text-sm text-zinc-400 no-underline transition-colors duration-200 hover:text-white focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-400";

export default function PublicFooter() {
  const isLoggedIn = useAuthStore((state) => Boolean(state.accessToken));
  const accountLinks = isLoggedIn
    ? [
        { label: "Mi perfil", to: "/profile" },
        { label: "Mis pedidos", to: "/my-orders" },
      ]
    : [
        { label: "Iniciar sesión", to: "/auth/login" },
        { label: "Crear una cuenta", to: "/auth/signup" },
      ];

  return (
    <Box component="footer" bg="#121316" c="white" style={{ borderTop: "1px solid #2f2022" }}>
      <Container size="xl" px={{ base: "lg", sm: "xl" }} pt={{ base: 46, sm: 64 }} pb="lg">
        <Box
          className="relative overflow-hidden rounded-3xl"
          p={{ base: "xl", sm: 36 }}
          mb={{ base: 48, sm: 64 }}
          style={{
            background: "linear-gradient(110deg, #9f111b 0%, #be1724 55%, #d43b33 100%)",
            border: "1px solid rgba(255,255,255,0.11)",
          }}
        >
          <Box
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border-[50px] border-white/10"
          />
          <Group justify="space-between" align="center" gap="xl" style={{ position: "relative" }}>
            <Stack gap={9} maw={620}>
              <Group gap="xs">
                <UtensilsCrossed size={18} color="#fecaca" />
                <Text c="#fecaca" size="xs" fw={800} tt="uppercase" lts={2}>
                  Restaurant Central
                </Text>
              </Group>
              <Title order={2} c="white" fw={850} lh={1.15} style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.45rem)" }}>
                ¿Qué se te antoja hoy?
              </Title>
              <Text c="#ffe4e6" size="sm" lh={1.7}>
                Explora nuestra carta y encuentra el plato perfecto para tu próximo antojo.
              </Text>
            </Stack>
            <Button
              component={Link}
              to="/menu"
              size="md"
              variant="white"
              color="red"
              rightSection={<ArrowRight size={18} />}
              styles={{ root: { color: "#a50f1d", flexShrink: 0 }, label: { fontWeight: 800 } }}
            >
              Explorar el menú
            </Button>
          </Group>
        </Box>

        <SimpleGrid cols={{ base: 1, xs: 2, lg: 4 }} spacing={{ base: 32, lg: 40 }} verticalSpacing={32}>
          <Stack gap="md">
            <Link to="/" aria-label="Restaurant Central, ir al inicio" className="inline-flex w-fit items-center gap-3 no-underline">
              <ThemeIcon size={46} radius="lg" color="red" variant="filled">
                <ChefHat size={26} color="white" />
              </ThemeIcon>
              <Box>
                <Text size="lg" c="white" fw={900} lh={1.1} lts={1}>CENTRAL</Text>
                <Text size="xs" c="#fda4af" fw={800} tt="uppercase" lts={2}>Restaurante</Text>
              </Box>
            </Link>
            <Text c="#a9acb5" size="sm" lh={1.85} maw={290}>
              Un espacio para descubrir sabores, compartir momentos y disfrutar de la cocina que nos reúne.
            </Text>
            <Group gap={7}>
              <Heart size={16} color="#f87171" fill="#f87171" />
              <Text size="xs" c="#9297a2">Hecho para quienes disfrutan comer bien.</Text>
            </Group>
          </Stack>

          <Stack gap="md" component="nav" aria-label="Navegación del restaurante">
            <Text size="sm" fw={800} c="white" lts={0.5}>Explora</Text>
            {navigation.map((item) => (
              <Link key={item.to} to={item.to} className={footerLinkClass}>
                {item.label}
              </Link>
            ))}
          </Stack>

          <Stack gap="md" component="nav" aria-label="Enlaces de mi cuenta">
            <Text size="sm" fw={800} c="white" lts={0.5}>Tu cuenta</Text>
            {accountLinks.map((item) => (
              <Link key={item.to} to={item.to} className={footerLinkClass}>
                {item.label}
              </Link>
            ))}
            <Link to="/menu" className={footerLinkClass}>
              <ShoppingBag size={16} color="#f87171" />
              Hacer un pedido
            </Link>
          </Stack>

          <Stack gap="md">
            <Text size="sm" fw={800} c="white" lts={0.5}>Estamos para ayudarte</Text>
            <Text c="#a9acb5" size="sm" lh={1.85}>
              ¿Tienes alguna consulta sobre nuestra carta, reservas o pedidos?
              Escríbenos desde la página de contacto.
            </Text>
            <Button
              component={Link}
              to="/contact"
              variant="outline"
              color="red"
              radius="md"
              leftSection={<Mail size={17} />}
              w="fit-content"
              styles={{ root: { borderColor: "#a93b48", color: "#fecdd3" } }}
            >
              Ir a contacto
            </Button>
          </Stack>
        </SimpleGrid>

        <Divider color="#303139" mt={{ base: 42, sm: 56 }} mb="lg" />
        <Group justify="space-between" gap="md" align="center" wrap="wrap">
          <Text c="#8f949f" size="xs">
            © {new Date().getFullYear()} Restaurant Central. Todos los derechos reservados.
          </Text>
          <Text c="#8f949f" size="xs">
            Sabores para compartir, momentos para recordar.
          </Text>
        </Group>
      </Container>
    </Box>
  );
}
