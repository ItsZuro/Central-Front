import { useMenuData } from "@/core/hooks/menu/useMenuData";
import { useCartStore, type CartItemDraft } from "@/core/stores/cart/cart.store";
import type { ProductResponse } from "@/core/types/products/products.model";
import {
  Alert, Badge, Box, Button, Card, Container, Group, Image, Paper, Select,
  SimpleGrid, Skeleton, Stack, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  AlertCircle, ArrowRight, ChefHat, Clock3, Flame, Search, ShoppingBag,
  SlidersHorizontal, Sparkles, Star, UtensilsCrossed, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ProductDrawer from "./components/product-drawer/ProductDrawer";
import menuSelectStyles from "./MenuSelect.module.css";

type SortOption = "featured" | "price-asc" | "price-desc" | "name";

const money = (value: number) =>
  "S/ " + Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function Menu() {
  const navigate = useNavigate();
  const { categories, products, isLoading, isError, error } = useMenuData();
  const [selectedCategoryId, setSelectedCategoryId] = useState(0);
  const [selectedDish, setSelectedDish] = useState<ProductResponse | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 180);
  const [sort, setSort] = useState<SortOption>("featured");

  const addItemToCart = useCartStore((state) => state.addItem);
  const items = useCartStore((state) => state.items);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.finalPrice * item.quantity, 0);

  const catalog = useMemo(
    () => (products?.data || []).filter((product) => product.active),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const term = debouncedSearch.trim().toLocaleLowerCase("es-PE");
    const result = catalog.filter((product) => {
      if (selectedCategoryId !== 0 && product.categoryId !== selectedCategoryId) {
        return false;
      }
      return !term || [product.name, product.description, product.categoryName]
        .some((text) => (text || "").toLocaleLowerCase("es-PE").includes(term));
    });
    if (sort === "price-asc") result.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort === "price-desc") result.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name, "es-PE"));
    return result;
  }, [catalog, selectedCategoryId, debouncedSearch, sort]);

  const activeCategory = categories?.data?.find((category) => category.id === selectedCategoryId);
  const clearFilters = () => {
    setSearch("");
    setSelectedCategoryId(0);
    setSort("featured");
  };

  const handleAddToCartFromDrawer = (item: CartItemDraft) => {
    addItemToCart(item);
    toast.success(`Agregado: ${item.quantity} × ${item.product.name}`, {
      position: "bottom-center",
      autoClose: 2500,
      theme: "dark",
    });
  };

  return (
    <Box component="section" bg="#111215" c="white" mih="100vh" style={{ overflow: "hidden" }}>
      <Box
        pos="relative"
        style={{
          backgroundColor: "#171316",
          backgroundImage:
            "linear-gradient(100deg, rgba(13,12,15,.96) 0%, rgba(18,13,15,.88) 52%, rgba(20,12,13,.48) 100%), url('/images/auth/AuthFoodImage.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <Container size="xl" px={{ base: "lg", md: "xl" }} pt={{ base: 140, md: 165 }} pb={{ base: 75, md: 102 }}>
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ alignItems: "center" }}>
            <Stack gap="lg" maw={660}>
              <Badge
                color="red"
                variant="light"
                size="lg"
                radius="xl"
                leftSection={<Sparkles size={14} />}
                styles={{ root: { background: "rgba(120,22,30,.42)", color: "#fecaca", border: "1px solid rgba(255,145,150,.3)" } }}
              >
                Carta de Restaurant Central
              </Badge>
              <Title order={1} c="white" fw={900} lh={1.07}
                style={{ fontSize: "clamp(2.9rem, 5.4vw, 5.5rem)", letterSpacing: "-0.045em" }}>
                Sabores que merecen
                <Text span inherit c="red.4"> su momento.</Text>
              </Title>
              <Text c="#e0dce0" size="lg" lh={1.75} maw={550}>
                Descubre nuestra selección de platos, explora sus ingredientes y personaliza tu pedido a tu gusto.
              </Text>
              <Group gap="lg" mt="xs">
                <Group gap="xs">
                  <ChefHat size={18} color="#fda4af" />
                  <Text c="gray.2" size="sm" fw={600}>Preparado para ti</Text>
                </Group>
                <Group gap="xs">
                  <UtensilsCrossed size={18} color="#fda4af" />
                  <Text c="gray.2" size="sm" fw={600}>Explora nuestra carta</Text>
                </Group>
              </Group>
            </Stack>

            <Box visibleFrom="md" style={{ position: "relative", justifySelf: "center", width: "100%", maxWidth: 435 }}>
              <Box
                aria-hidden="true"
                pos="absolute"
                style={{
                  inset: "14% 7%",
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(227,43,47,.22) 0%, transparent 72%)",
                  filter: "blur(22px)",
                }}
              />
              <Image
                src="/images/inicio/home-lomoSaltado.png"
                fallbackSrc="/images/inicio/home-causa.png"
                alt="Presentación gastronómica de Restaurant Central"
                fit="contain"
                mah={355}
                style={{ position: "relative", filter: "drop-shadow(0 27px 40px rgba(0,0,0,.45))" }}
              />
            </Box>
          </SimpleGrid>
        </Container>
      </Box>

      <Box bg="#111215">
        <Container size="xl" px={{ base: "lg", md: "xl" }} pt={{ base: 34, md: 44 }} pb={120}>
          <Stack gap="xl">
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Box>
                <Text fw={800} c="red.4" size="xs" tt="uppercase" lts={2}>Encuentra tu favorito</Text>
                <Title order={2} c="white" fw={850} mt={6} size="h1">Nuestra carta</Title>
                <Text c="#aeb1b8" size="sm" mt={7}>
                  {isLoading
                    ? "Cargando los platos del restaurante…"
                    : `${catalog.length} ${catalog.length === 1 ? "plato disponible" : "platos disponibles"} para explorar`}
                </Text>
              </Box>
              <Group gap="xs">
                <ThemeIcon color="red" variant="light" radius="lg" size={42}><Flame size={22} /></ThemeIcon>
                <Box>
                  <Text c="white" size="sm" fw={700}>Elige a tu gusto</Text>
                  <Text c="#aeb1b8" size="xs">Consulta detalles antes de pedir</Text>
                </Box>
              </Group>
            </Group>

            <Paper
              radius="xl"
              p={{ base: "md", sm: "lg" }}
              style={{ backgroundColor: "#1c1d22", border: "1px solid #34343b" }}
            >
              <Stack gap="lg">
                <Group justify="space-between" align="end" gap="md" wrap="wrap">
                  <TextInput
                    aria-label="Buscar platos"
                    label="Buscar en la carta"
                    placeholder="Ej. Lomo saltado, postres, bebidas…"
                    leftSection={<Search size={18} />}
                    value={search}
                    onChange={(event) => setSearch(event.currentTarget.value)}
                    rightSection={search ? (
                      <button
                        type="button"
                        aria-label="Limpiar búsqueda"
                        onClick={() => setSearch("")}
                        className="flex items-center justify-center rounded p-1 text-zinc-400 hover:text-white"
                      >
                        <X size={16} />
                      </button>
                    ) : null}
                    styles={{
                      root: { flexGrow: 1, minWidth: 200, maxWidth: 470 },
                      label: { color: "#f0f0f3", marginBottom: 9 },
                      input: { color: "white", backgroundColor: "#121316", borderColor: "#484850" },
                      section: { color: "#a8aab3" },
                    }}
                  />
                  <Select
                    aria-label="Ordenar productos"
                    label="Ordenar por"
                    value={sort}
                    onChange={(value) => setSort((value || "featured") as SortOption)}
                    data={[
                      { value: "featured", label: "Orden de la carta" },
                      { value: "price-asc", label: "Precio: menor a mayor" },
                      { value: "price-desc", label: "Precio: mayor a menor" },
                      { value: "name", label: "Nombre: A - Z" },
                    ]}
                    leftSection={<SlidersHorizontal size={17} />}
                    allowDeselect={false}
                    classNames={{ dropdown: menuSelectStyles.dropdown, option: menuSelectStyles.option }}
                    w={{ base: "100%", xs: 230 }}
                    styles={{
                      label: { color: "#f0f0f3", marginBottom: 9 },
                      input: { color: "white", backgroundColor: "#121316", borderColor: "#484850" },
                      section: { color: "#a8aab3" },
                      dropdown: { backgroundColor: "#25262b", borderColor: "#44454d" },
                      option: { color: "#f5f5f6" },
                    }}
                  />
                </Group>

                <Box>
                  <Text c="#aeb1b8" size="xs" fw={750} mb="sm" tt="uppercase" lts={1.1}>Categorías</Text>
                  <Group gap="sm">
                    <Button
                      radius="xl"
                      color="red"
                      variant={selectedCategoryId === 0 ? "filled" : "outline"}
                      onClick={() => setSelectedCategoryId(0)}
                      styles={{ root: selectedCategoryId === 0 ? {} : { color: "#c6c8ce", borderColor: "#45464d" } }}
                    >
                      Todos los platos
                    </Button>
                    {(categories?.data || []).map((category) => (
                      <Button
                        key={category.id}
                        radius="xl"
                        color="red"
                        variant={selectedCategoryId === category.id ? "filled" : "outline"}
                        onClick={() => setSelectedCategoryId(category.id)}
                        styles={{ root: selectedCategoryId === category.id ? {} : { color: "#c6c8ce", borderColor: "#45464d" } }}
                      >
                        {category.name}
                      </Button>
                    ))}
                    {isLoading && Array.from({ length: 3 }, (_, index) => (
                      <Skeleton key={index} radius="xl" width={95} height={35} />
                    ))}
                  </Group>
                </Box>
              </Stack>
            </Paper>

            {isError && (
              <Alert color="red" title="No se pudo cargar la carta" icon={<AlertCircle size={20} />} radius="lg">
                {error instanceof Error ? error.message : "Comprueba la conexión con el servidor e inténtalo nuevamente."}
              </Alert>
            )}

            <Group justify="space-between" align="center">
              <Box>
                <Title order={3} c="white" size="h3" fw={800}>
                  {activeCategory ? activeCategory.name : "Todos los platos"}
                </Title>
                <Text mt={4} c="#aeb1b8" size="sm">
                  {!isLoading && !isError ? `${filteredProducts.length} resultados` : "Explora los sabores del restaurante"}
                </Text>
              </Box>
              {(search || selectedCategoryId !== 0 || sort !== "featured") && (
                <Button size="sm" variant="subtle" color="red" onClick={clearFilters} leftSection={<X size={16} />}>
                  Limpiar filtros
                </Button>
              )}
            </Group>

            {isLoading ? (
              <SimpleGrid cols={{ base: 1, xs: 2, lg: 3, xl: 4 }} spacing="lg">
                {Array.from({ length: 8 }, (_, index) => (
                  <Paper key={index} radius="xl" bg="#202126" style={{ overflow: "hidden", border: "1px solid #36363d" }}>
                    <Skeleton height={210} radius={0} />
                    <Box p="lg"><Skeleton height={21} width="70%" mb="lg"/><Skeleton height={12} mb={8}/><Skeleton height={12} width="65%" mb="xl"/><Skeleton height={34}/></Box>
                  </Paper>
                ))}
              </SimpleGrid>
            ) : isError ? null : filteredProducts.length === 0 ? (
              <Paper p={{ base: "xl", sm: 52 }} radius="xl"
                style={{ textAlign: "center", backgroundColor: "#1c1d22", border: "1px solid #36363d" }}>
                <Stack align="center" gap="md">
                  <ThemeIcon size={66} color="red" variant="light" radius="xl"><UtensilsCrossed size={30} /></ThemeIcon>
                  <Title order={3} c="white" fw={800}>
                    {catalog.length === 0 ? "Pronto tendremos platos para ti" : "No encontramos platos con esos filtros"}
                  </Title>
                  <Text c="#aeb1b8" size="sm" maw={430}>
                    {catalog.length === 0
                      ? "Estamos preparando la carta. Vuelve para descubrir los productos disponibles."
                      : "Prueba otra categoría o modifica el término de búsqueda."}
                  </Text>
                  {catalog.length > 0 && <Button color="red" variant="light" mt="sm" onClick={clearFilters}>Ver todos los platos</Button>}
                </Stack>
              </Paper>
            ) : (
              <SimpleGrid cols={{ base: 1, xs: 2, lg: 3, xl: 4 }} spacing="lg">
                {filteredProducts.map((dish) => (
                  <Card
                    key={dish.id}
                    shadow="md"
                    radius="xl"
                    padding={0}
                    withBorder
                    style={{
                      height: "100%",
                      backgroundColor: "#1d1e23",
                      borderColor: "#34353c",
                      overflow: "hidden",
                      transition: "transform .2s ease, border-color .2s ease, box-shadow .2s ease",
                    }}
                  >
                    <Card.Section>
                      <Box pos="relative" style={{ overflow: "hidden" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedDish(dish)}
                          aria-label={`Ver detalles de ${dish.name}`}
                          className="block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-red-500"
                        >
                          <Image
                            src={dish.imageUrl || "/images/inicio/home-causa.png"}
                            fallbackSrc="/images/inicio/home-causa.png"
                            alt={dish.name}
                            h={215}
                            fit="cover"
                            loading="lazy"
                            style={{ transition: "transform .3s ease" }}
                          />
                        </button>
                        <Badge
                          color="dark"
                          variant="filled"
                          pos="absolute"
                          top={14}
                          right={14}
                          radius="md"
                          size="md"
                          styles={{ root: { backgroundColor: "rgba(18,18,21,.85)", color: "#f5f5f5", border: "1px solid rgba(255,255,255,.12)" } }}
                        >
                          {dish.categoryName || "Especial"}
                        </Badge>
                      </Box>
                    </Card.Section>
                    <Stack p="lg" gap="md" style={{ flexGrow: 1 }}>
                      <Box>
                        <Text c="white" fw={800} size="lg" lh={1.28} lineClamp={2}>{dish.name}</Text>
                        <Text mt={10} c="#aeb1b8" size="sm" lh={1.7} lineClamp={2}>
                          {dish.description || "Conoce todos los detalles de este plato."}
                        </Text>
                      </Box>
                      <Group gap="sm" mt="auto" justify="space-between" wrap="wrap">
                        <Group gap={6}>
                          <Clock3 size={15} color="#c4a0a3" />
                          <Text size="xs" c="#c4c4ca">
                            {dish.preparationTimeMinutes ? `${dish.preparationTimeMinutes} min` : "A preparar"}
                          </Text>
                        </Group>
                        {Number(dish.rating) > 0 && (
                          <Group gap={4}>
                            <Star size={15} color="#fbbf24" fill="#fbbf24" />
                            <Text size="xs" fw={700} c="#f6e2a2">{Number(dish.rating).toFixed(1)}</Text>
                          </Group>
                        )}
                      </Group>
                      <Group justify="space-between" align="center" style={{ borderTop: "1px solid #37383d", paddingTop: 16 }}>
                        <Text c="#fda4af" fw={900} size="xl" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {money(Number(dish.price))}
                        </Text>
                        <Button
                          size="sm"
                          radius="md"
                          color="red"
                          rightSection={<ArrowRight size={16} />}
                          onClick={() => setSelectedDish(dish)}
                        >
                          Ver plato
                        </Button>
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Container>
      </Box>

      {totalItems > 0 && (
        <Paper
          pos="fixed"
          bottom={{ base: 16, sm: 25 }}
          right={{ base: 16, sm: 25 }}
          radius="xl"
          shadow="xl"
          p={4}
          style={{ zIndex: 65, backgroundColor: "#ce202d", border: "1px solid rgba(255,255,255,.2)" }}
        >
          <Button
            size="lg"
            color="red"
            radius="lg"
            leftSection={<ShoppingBag size={21} />}
            rightSection={<ArrowRight size={17} />}
            onClick={() => navigate("/checkout")}
            styles={{ root: { backgroundColor: "transparent" } }}
            aria-label={`Ir al carrito: ${totalItems} artículos, ${money(totalPrice)}`}
          >
            <Group gap="xs" wrap="nowrap">
              <Badge color="white" variant="filled" radius="xl" styles={{ root: { color: "#a61922" } }}>{totalItems}</Badge>
              <Text fw={800} c="white" size="sm">{money(totalPrice)}</Text>
            </Group>
          </Button>
        </Paper>
      )}

      <ProductDrawer
        dish={selectedDish}
        isOpen={selectedDish !== null}
        onClose={() => setSelectedDish(null)}
        onAddToCart={handleAddToCartFromDrawer}
      />
    </Box>
  );
}

export default Menu;
