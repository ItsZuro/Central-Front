import { useGetFeaturedProductsQuery, useGetProductsQuery } from "@/core/hooks/products/useProduct.hooks";
import type { ProductResponse } from "@/core/types/products/products.model";
import {
  Badge, Box, Button, Card, Container, Group, Image, Paper,
  SimpleGrid, Skeleton, Stack, Text, ThemeIcon, Title,
} from "@mantine/core";
import {
  ArrowDown, ArrowRight, ChefHat, ShoppingBag, Sparkles, UtensilsCrossed,
} from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";

const money = (value: number) =>
  "S/ " + Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function Home() {
  const featured = useGetFeaturedProductsQuery();
  const catalog = useGetProductsQuery();

  // Si aún no se ha marcado ningún producto como destacado, mostrar los platos
  // activos del catálogo, sin inventar reseñas, puntuaciones ni platos.
  const showcase = useMemo<ProductResponse[]>(() => {
    const chosen = (featured.data?.data || []).filter((item) => item.active);
    const products = (catalog.data?.data || []).filter((item) => item.active);
    return (chosen.length ? chosen : products).slice(0, 3);
  }, [featured.data, catalog.data]);
  const loading = featured.isLoading && catalog.isLoading;
  const loadFailed = featured.isError && catalog.isError;

  return (
    <Box bg="#121316" c="white" style={{ overflow: "hidden" }}>
      {/* Se conserva íntegra la imagen grande original del inicio. */}
      <Box
        component="section"
        pos="relative"
        mih="100svh"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", isolation: "isolate" }}
      >
        <Image
          src="/images/inicio/home-fondo.png"
          alt="Fotografía principal de Restaurant Central"
          fit="cover"
          pos="absolute"
          inset={0}
          w="100%"
          h="100%"
          style={{ zIndex: -2 }}
        />
        <Box
          pos="absolute"
          inset={0}
          aria-hidden="true"
          style={{
            zIndex: -1,
            background: "linear-gradient(180deg, rgba(5,5,7,.52) 0%, rgba(7,6,7,.22) 42%, rgba(13,13,16,.83) 100%)",
          }}
        />
        <Container size="lg" px="lg" py={145} w="100%">
          <Stack align="center" gap="sm">
            <Badge
              size="lg"
              radius="xl"
              variant="light"
              color="red"
              leftSection={<Sparkles size={14}/>}
              styles={{ root: { background: "rgba(111,28,36,.40)", border: "1px solid rgba(255,160,160,.32)", color: "#ffe4e6" } }}
            >
              Bienvenido a Restaurant Central
            </Badge>
            <Title
              order={1}
              c="white"
              ta="center"
              fw={850}
              lh={1.02}
              mt="sm"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "clamp(5rem, 13vw, 10.5rem)",
                letterSpacing: "-.055em",
                textShadow: "0 9px 40px rgba(0,0,0,.40)",
              }}
            >
              CENTRAL
            </Title>
            <Text
              c="#f6f6f7"
              size="sm"
              tt="uppercase"
              fw={750}
              ta="center"
              lts={6}
              style={{ textShadow: "0 2px 14px rgba(0,0,0,.65)" }}
            >
              Restaurante
            </Text>
            <Text
              c="#ededf1"
              size="lg"
              lh={1.65}
              mt="lg"
              maw={610}
              ta="center"
              style={{ textShadow: "0 1px 12px rgba(0,0,0,.75)" }}
            >
              Descubre platos para compartir y elige lo que más te provoca.
            </Text>
            <Group mt="lg" justify="center" gap="md">
              <Button
                component={Link}
                to="/menu"
                size="lg"
                radius="lg"
                color="red"
                rightSection={<ArrowRight size={19}/>}
              >
                Explorar nuestra carta
              </Button>
              <Button
                component={Link}
                to="/reservations"
                size="lg"
                radius="lg"
                variant="outline"
                styles={{ root: { borderColor: "rgba(255,255,255,.72)", color: "white", backgroundColor: "rgba(0,0,0,.20)" } }}
              >
                Reservas
              </Button>
            </Group>
          </Stack>
        </Container>
        <a
          href="#nuestra-esencia"
          aria-label="Explorar el contenido de la página"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-white/25 bg-black/25 p-3 text-white transition hover:bg-black/50"
        >
          <ArrowDown size={19}/>
        </a>
      </Box>

      <Box component="section" id="nuestra-esencia" bg="#151518" py={{ base: 65, sm: 100 }}>
        <Container size="xl" px={{ base: "lg", sm: "xl" }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: 36, md: 60 }} style={{ alignItems: "center" }}>
            <Box pos="relative">
              <Image
                src="/images/inicio/central-info.jpg"
                alt="Imagen gastronómica de Restaurant Central"
                fit="cover"
                h={{ base: 315, md: 465 }}
                radius="xl"
              />
              <Badge
                pos="absolute"
                bottom={17}
                left={17}
                size="lg"
                variant="filled"
                color="red"
                leftSection={<ChefHat size={15}/>}
              >
                Nuestra esencia
              </Badge>
            </Box>
            <Stack gap="lg">
              <Text c="red.4" size="xs" tt="uppercase" lts={2} fw={850}>Algo más que una buena comida</Text>
              <Title order={2} c="white" fw={850} lh={1.16}
                style={{ fontSize: "clamp(2.1rem, 3.7vw, 3.4rem)", letterSpacing: "-.035em" }}>
                Un lugar para disfrutar de cada
                <Text inherit span c="red.4"> sabor.</Text>
              </Title>
              <Text c="#bcbec7" size="md" lh={1.9}>
                En Restaurant Central queremos que elegir tu próxima comida sea sencillo y agradable.
                Explora nuestra carta, descubre cada plato y arma tu pedido desde un mismo lugar.
              </Text>
              <Group gap="lg" wrap="wrap">
                <Group gap="xs"><ThemeIcon color="red" variant="light" size={37} radius="md"><UtensilsCrossed size={19}/></ThemeIcon><Text c="#eeeef0" size="sm" fw={700}>Carta digital</Text></Group>
                <Group gap="xs"><ThemeIcon color="red" variant="light" size={37} radius="md"><ShoppingBag size={19}/></ThemeIcon><Text c="#eeeef0" size="sm" fw={700}>Pedidos en línea</Text></Group>
              </Group>
              <Button
                mt="md"
                component={Link}
                to="/menu"
                size="md"
                color="red"
                w="fit-content"
                rightSection={<ArrowRight size={17}/>}
              >
                Conocer el menú
              </Button>
            </Stack>
          </SimpleGrid>
        </Container>
      </Box>

      <Box component="section" bg="#121316" py={{ base: 68, sm: 100 }} style={{ borderTop: "1px solid #2e2f35" }}>
        <Container size="xl" px={{ base: "lg", sm: "xl" }}>
          <Group justify="space-between" align="flex-end" wrap="wrap" gap="lg" mb={36}>
            <Stack gap={7} maw={580}>
              <Text size="xs" c="red.4" fw={850} tt="uppercase" lts={2}>Sabores para descubrir</Text>
              <Title order={2} c="white" fw={850} lh={1.15} style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}>Una selección de la carta</Title>
              <Text c="#aeb1ba" size="sm" lh={1.75}>Platos disponibles para conocer, elegir y disfrutar.</Text>
            </Stack>
            <Button
              component={Link}
              to="/menu"
              variant="outline"
              color="red"
              rightSection={<ArrowRight size={17}/>}
              styles={{ root: { borderColor: "#84323d", color: "#fecaca" } }}
            >
              Ver toda la carta
            </Button>
          </Group>

          {loading ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {Array.from({ length: 3 }, (_, index) =>
                <Paper key={index} radius="xl" bg="#202126" withBorder style={{ overflow: "hidden", borderColor: "#35353b" }}>
                  <Skeleton height={260}/><Box p="lg"><Skeleton height={23} width="65%"/><Skeleton height={13} mt="md"/><Skeleton height={13} mt="xs" width="80%"/></Box>
                </Paper>
              )}
            </SimpleGrid>
          ) : showcase.length ? (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {showcase.map((product) => (
                <Card
                  key={product.id}
                  padding={0}
                  radius="xl"
                  withBorder
                  style={{ backgroundColor: "#1f2025", borderColor: "#34353d", overflow: "hidden" }}
                >
                  <Card.Section pos="relative">
                    <Image
                      src={product.imageUrl || "/images/inicio/home-causa.png"}
                      fallbackSrc="/images/inicio/home-causa.png"
                      alt={product.name}
                      h={260}
                      fit="cover"
                      loading="lazy"
                    />
                    {product.categoryName && (
                      <Badge color="dark" variant="filled" pos="absolute" top={14} left={14}
                        styles={{ root: { backgroundColor: "rgba(14,14,18,.86)", border: "1px solid #454650" } }}>
                        {product.categoryName}
                      </Badge>
                    )}
                  </Card.Section>
                  <Stack p="lg" gap="md" style={{ flexGrow: 1 }}>
                    <Title order={3} size="lg" c="white" fw={800} lineClamp={2}>{product.name}</Title>
                    <Text size="sm" c="#b5b7c0" lh={1.75} lineClamp={2}>
                      {product.description || "Descubre este plato y sus detalles en nuestra carta."}
                    </Text>
                    <Group mt="auto" justify="space-between" align="center" style={{ borderTop: "1px solid #383941", paddingTop: 16 }}>
                      <Text fw={850} c="#fda4af" size="lg">{money(Number(product.price))}</Text>
                      <Button component={Link} to="/menu" size="sm" color="red" rightSection={<ArrowRight size={16}/>}>Ver plato</Button>
                    </Group>
                  </Stack>
                </Card>
              ))}
            </SimpleGrid>
          ) : (
            <Paper
              radius="xl"
              p={{ base: "xl", sm: 45 }}
              style={{ backgroundColor: "#202126", border: "1px solid #36373e" }}
            >
              <Stack align="center" gap="sm">
                <ThemeIcon color="red" variant="light" size={60} radius="xl"><UtensilsCrossed size={27}/></ThemeIcon>
                <Title order={3} c="white" ta="center">Nuestra carta está en preparación</Title>
                <Text c="#aeb1ba" size="sm" ta="center" maw={450}>
                  {loadFailed ? "No se pudieron recuperar los platos del servidor." : "Todavía no hay platos disponibles en esta sección."}
                </Text>
                <Button component={Link} to="/menu" color="red" variant="light" mt="sm">Ir a nuestra carta</Button>
              </Stack>
            </Paper>
          )}
        </Container>
      </Box>

      {/* Un cierre editorial: un solo bloque con los pasos y una fotografía,
          sin repetir la llamada a la acción roja del footer compartido. */}
      <Box
        component="section"
        py={{ base: 78, sm: 114 }}
        bg="#16171b"
        style={{ borderTop: "1px solid #2e3037" }}
      >
        <Container size="xl" px={{ base: "lg", sm: "xl" }}>
          <SimpleGrid
            cols={{ base: 1, md: 2 }}
            spacing={{ base: 42, md: 65 }}
            style={{ alignItems: "center" }}
          >
            <Stack gap="lg" maw={520}>
              <Text c="#fda4af" fw={800} tt="uppercase" lts={2.1} size="xs">
                Tu experiencia, a tu ritmo
              </Text>
              <Title
                order={2}
                c="white"
                lh={1.13}
                fw={850}
                style={{
                  fontSize: "clamp(2.15rem, 4.2vw, 3.45rem)",
                  letterSpacing: "-0.04em",
                }}
              >
                Elige, disfruta y
                <Text span inherit c="red.4"> comparte.</Text>
              </Title>
              <Text c="#b9bac5" size="md" lh={1.8}>
                Una carta para descubrir sabores y armar tu pedido con calma.
                Así funciona Restaurant Central.
              </Text>
              <Stack gap={0} mt="md">
                {[
                  {
                    number: "01",
                    title: "Encuentra algo que te guste",
                    description: "Explora los platos de la carta y revisa sus ingredientes y precios.",
                  },
                  {
                    number: "02",
                    title: "Hazlo a tu gusto",
                    description: "Elige la cantidad y añade extras cuando el plato los tenga.",
                  },
                  {
                    number: "03",
                    title: "Confirma tu pedido",
                    description: "Comprueba el carrito, la cobertura y las opciones de pago disponibles.",
                  },
                ].map((step, index) => (
                  <Group
                    key={step.number}
                    gap="lg"
                    align="flex-start"
                    wrap="nowrap"
                    py="lg"
                    style={{
                      borderTop: "1px solid #36373e",
                      borderBottom: index === 2 ? "1px solid #36373e" : undefined,
                    }}
                  >
                    <Text
                      c="#ee747e"
                      fw={850}
                      size="lg"
                      style={{ fontVariantNumeric: "tabular-nums", minWidth: 31 }}
                    >
                      {step.number}
                    </Text>
                    <Box style={{ flex: 1 }}>
                      <Text c="white" fw={750} size="md">{step.title}</Text>
                      <Text c="#aeb0bb" size="sm" mt={6} lh={1.75}>
                        {step.description}
                      </Text>
                    </Box>
                  </Group>
                ))}
              </Stack>
            </Stack>

            <Box
              pos="relative"
              style={{
                overflow: "hidden",
                borderRadius: 22,
                border: "1px solid rgba(255,255,255,.11)",
                boxShadow: "0 30px 70px rgba(0,0,0,.24)",
              }}
            >
              <Image
                src="/images/inicio/home-lomoSaltado.png"
                fallbackSrc="/images/inicio/home-causa.png"
                alt="Plato servido de Restaurant Central"
                h={{ base: 355, md: 545 }}
                fit="cover"
              />
              <Box
                aria-hidden="true"
                pos="absolute"
                inset={0}
                style={{
                  background: "linear-gradient(0deg, rgba(9,10,14,.87), transparent 44%)",
                  pointerEvents: "none",
                }}
              />
              <Stack pos="absolute" bottom={25} left={26} right={26} gap={5}>
                <Text c="#fda4af" fw={800} size="xs" tt="uppercase" lts={1.6}>
                  Restaurant Central
                </Text>
                <Title order={3} c="white" fw={800} size="xl">
                  Cada plato tiene su momento.
                </Title>
              </Stack>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  );
}
