import { Badge, Box, Group, Paper, Text, ThemeIcon, Title } from "@mantine/core";
import { ChefHat, Sparkles, UtensilsCrossed } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AuthPageLayoutProps {
  children: ReactNode;
  page: "login" | "signup";
}

/** Shared restaurant-themed backdrop for both authentication flows. */
export default function AuthPageLayout({ children, page }: AuthPageLayoutProps) {
  return (
    <Box className="relative isolate min-h-screen overflow-hidden bg-[#130d0b] text-white">
      <Box
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center"
        style={{
          backgroundImage:
            "linear-gradient(95deg, rgba(15, 9, 8, 0.43) 0%, rgba(14, 8, 8, 0.64) 48%, rgba(13, 8, 8, 0.82) 100%), url('/images/auth/AuthFoodImage.png')",
          backgroundPosition: "center 45%",
        }}
      />
      <Box
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-transparent to-black/35"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 py-5 sm:px-8 sm:py-8 lg:px-12">
        <header>
          <Link to="/" aria-label="Ir al inicio de Restaurant Central" className="inline-flex items-center gap-3 rounded-xl p-1 text-white no-underline transition hover:opacity-90">
            <ThemeIcon size={45} radius="lg" color="red" variant="filled">
              <UtensilsCrossed size={24} />
            </ThemeIcon>
            <div className="text-left">
              <Text c="white" fw={900} size="lg" lh={1.1} lts={0.6}>CENTRAL</Text>
              <Text c="red.3" size="xs" fw={800} tt="uppercase" lts={1.5}>Restaurant</Text>
            </div>
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-9 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(400px,475px)] lg:gap-16 lg:py-12">
          <section className="hidden max-w-[670px] lg:block">
            <Badge
              variant="light"
              color="red"
              size="lg"
              radius="xl"
              leftSection={<Sparkles size={14} />}
              styles={{ root: { border: "1px solid rgba(248,113,113,.3)", backgroundColor: "rgba(127,29,29,.35)", color: "#fecaca" } }}
            >
              Una experiencia que se disfruta
            </Badge>
            <Title order={1} c="white" mt="xl" fw={900} lh={1.1} style={{ fontSize: "clamp(3rem, 4.8vw, 5.2rem)", letterSpacing: "-0.045em", textShadow: "0 3px 22px rgba(0,0,0,.35)" }}>
              El sabor de cada
              <Text span inherit c="red.4"> momento.</Text>
            </Title>
            <Text mt="xl" c="gray.1" size="lg" lh={1.75} maw={520} style={{ textShadow: "0 1px 12px rgba(0,0,0,.45)" }}>
              {page === "login"
                ? "Vuelve a tus platos favoritos, consulta tus pedidos y disfruta de todo lo que Restaurant Central tiene para ti."
                : "Crea tu cuenta para descubrir nuestro menú, realizar pedidos y guardar tus mejores experiencias."}
            </Text>
            <Group mt={36} gap="sm">
              <ChefHat size={23} color="#fca5a5" />
              <Text size="sm" c="gray.2" fw={600}>Preparado con pasión, servido con calidad.</Text>
            </Group>
          </section>

          <Paper
            component="section"
            aria-label={page === "login" ? "Formulario de inicio de sesión" : "Formulario de registro"}
            withBorder
            radius="xl"
            p={{ base: "lg", sm: "xl" }}
            shadow="xl"
            w="100%"
            maw={475}
            mx="auto"
            style={{
              backgroundColor: "rgba(21, 19, 20, 0.92)",
              borderColor: "rgba(255,255,255,0.15)",
              boxShadow: "0 26px 85px rgba(0, 0, 0, 0.48)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              color: "white",
            }}
          >
            {children}
          </Paper>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 py-2">
          <Text c="gray.3" size="xs">© Restaurant Central · Sabores que nos reúnen</Text>
          <Text c="gray.3" size="xs">Tu experiencia empieza aquí</Text>
        </footer>
      </div>
    </Box>
  );
}
