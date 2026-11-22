import { api } from "@/core/api/api";
import type { ApiResponse } from "@/core/types/base/api-response";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { CartItemDraft } from "@/core/stores/cart/cart.store";
import type { ProductResponse } from "@/core/types/products/products.model";
import {
  ActionIcon, Alert, Badge, Box, Button, Checkbox, Divider, Drawer, Group,
  Image, Paper, Rating, Stack, Text, Textarea, ThemeIcon, Title,
} from "@mantine/core";
import {
  AlertCircle, CheckCircle2, ChefHat, Clock3, Minus, Plus, ShoppingBag, Star, X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface ProductDrawerProps {
  dish: ProductResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (item: CartItemDraft) => void;
}

interface ProductReview {
  id: number;
  customerName: string;
  comment: string;
  rating: number;
}

const money = (value: number) =>
  "S/ " + Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ProductDrawer({
  dish, isOpen, onClose, onAddToCart,
}: ProductDrawerProps) {
  const user = useAuthStore((state) => state.user);
  const isClient = Boolean(user?.roles?.includes("ROLE_CLIENT"));

  const [quantity, setQuantity] = useState(1);
  const [selectedExtraIds, setSelectedExtraIds] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState<
    "checking" | "eligible" | "ineligible" | "error"
  >("checking");
  const [reviewRefresh, setReviewRefresh] = useState(0);

  const productId = dish?.id;

  useEffect(() => {
    if (!isOpen || !productId) return;
    setQuantity(1);
    setSelectedExtraIds([]);
    setNotes("");
    setReviewText("");
    setRating(5);
    setReviewError("");
  }, [isOpen, productId]);

  useEffect(() => {
    if (!isOpen || !productId) return;
    let active = true;
    setReviewsLoading(true);
    api.get<ApiResponse<ProductReview[]>>(`reviews/product/${productId}`)
      .then(({ data }) => {
        if (active) {
          setReviews(Array.isArray(data.data) ? data.data : []);
          setReviewError("");
        }
      })
      .catch(() => {
        if (active) setReviewError("No se pudieron consultar las reseñas de este producto.");
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });
    return () => { active = false; };
  }, [isOpen, productId, reviewRefresh]);

  useEffect(() => {
    if (!isOpen || !productId || !isClient) return;
    let active = true;
    setReviewEligibility("checking");
    api.get<ApiResponse<boolean>>(`reviews/product/${productId}/eligibility`)
      .then(({ data }) => {
        if (active) setReviewEligibility(data.data ? "eligible" : "ineligible");
      })
      .catch(() => {
        if (active) setReviewEligibility("error");
      });
    return () => { active = false; };
  }, [isOpen, productId, isClient, reviewRefresh]);

  if (!dish) return null;

  const extrasTotal = selectedExtraIds.reduce((sum, id) => {
    const extra = dish.extras?.find((item) => item.id === id);
    return sum + (extra ? Number(extra.price) : 0);
  }, 0);
  const unitPrice = Number((Number(dish.price) + extrasTotal).toFixed(2));
  const totalPrice = Number((unitPrice * quantity).toFixed(2));

  const toggleExtra = (extraId: number) => {
    setSelectedExtraIds((ids) =>
      ids.includes(extraId) ? ids.filter((id) => id !== extraId) : [...ids, extraId],
    );
  };

  const addToCart = () => {
    if (!onAddToCart) return;
    onAddToCart({
      product: dish,
      quantity,
      selectedExtras: dish.extras?.filter((extra) => selectedExtraIds.includes(extra.id)) || [],
      notes: notes.trim(),
      // El precio se almacena por unidad. Zustand multiplica por cantidad.
      finalPrice: unitPrice,
    });
    onClose();
  };

  const submitReview = async () => {
    if (!isClient || reviewEligibility !== "eligible" || !productId) return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      await api.post("reviews", {
        productId,
        rating,
        comment: reviewText.trim(),
      });
      setReviewText("");
      setReviewRefresh((value) => value + 1);
      toast.success("¡Gracias por compartir tu calificación!");
    } catch {
      setReviewError("No se pudo publicar. Comprueba que tu pedido esté entregado o completado y que no hayas reseñado antes.");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="lg"
      withCloseButton={false}
      padding={0}
      title={null}
      zIndex={150}
      closeOnEscape
      styles={{
        content: { backgroundColor: "#1a1b20", color: "#f8fafc" },
        body: { padding: 0, minHeight: "100%" },
      }}
    >
      <Box style={{ minHeight: "100%", backgroundColor: "#1a1b20" }}>
        <Box pos="relative" h={270} style={{ overflow: "hidden" }}>
          <Image
            src={dish.imageUrl || "/images/inicio/home-causa.png"}
            fallbackSrc="/images/inicio/home-causa.png"
            alt={dish.name}
            h={270}
            fit="cover"
          />
          <Box
            pos="absolute"
            inset={0}
            style={{
              background: "linear-gradient(0deg, rgba(13,14,18,.98), rgba(13,14,18,.08) 63%, rgba(0,0,0,.4))",
              pointerEvents: "none",
            }}
          />
          <ActionIcon
            variant="filled"
            color="dark"
            size="xl"
            radius="xl"
            onClick={onClose}
            aria-label="Cerrar detalles"
            pos="absolute"
            top={18}
            right={18}
            style={{ backgroundColor: "rgba(0,0,0,.7)", border: "1px solid rgba(255,255,255,.22)" }}
          >
            <X size={21} />
          </ActionIcon>
          <Box pos="absolute" bottom={18} left={26} right={24}>
            <Badge color="red" variant="filled" mb="sm">{dish.categoryName || "Especial"}</Badge>
            <Title order={2} c="white" fw={900} lh={1.18} style={{ fontSize: "clamp(1.7rem, 4vw, 2.3rem)" }}>
              {dish.name}
            </Title>
          </Box>
        </Box>

        <Stack gap="xl" px={{ base: "lg", sm: "xl" }} py="xl">
          <Box>
            <Text c="#d4d5db" size="sm" lh={1.8}>{dish.description || "Descripción no disponible."}</Text>
            <Group gap="md" mt="md" wrap="wrap">
              <Group gap={6}>
                <Clock3 size={16} color="#fda4af" />
                <Text c="#c5c6ce" size="sm">{dish.preparationTimeMinutes ? `${dish.preparationTimeMinutes} min` : "Tiempo por confirmar"}</Text>
              </Group>
              <Group gap={6}>
                <ChefHat size={16} color="#fda4af" />
                <Text c="#c5c6ce" size="sm">Preparado a tu gusto</Text>
              </Group>
              {Number(dish.rating) > 0 && (
                <Group gap={6}>
                  <Star size={16} fill="#fbbf24" color="#fbbf24" />
                  <Text c="#f6d992" size="sm" fw={700}>{Number(dish.rating).toFixed(1)}</Text>
                </Group>
              )}
            </Group>
            <Group mt="lg" justify="space-between" style={{ borderTop: "1px solid #35363d", paddingTop: 15 }}>
              <Text c="#aeb1b8" size="sm">Precio base</Text>
              <Title order={3} c="#fda4af" fw={850}>{money(Number(dish.price))}</Title>
            </Group>
          </Box>

          <Divider color="#393940" />

          <Box>
            <Text c="white" fw={800} size="sm" mb="md">Cantidad</Text>
            <Group justify="space-between" p="xs" style={{ borderRadius: 12, border: "1px solid #43444d", backgroundColor: "#23242b" }}>
              <ActionIcon
                size="xl"
                radius="md"
                variant="light"
                color="gray"
                aria-label="Disminuir cantidad"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              ><Minus size={20} /></ActionIcon>
              <Text c="white" size="xl" fw={850} style={{ fontVariantNumeric: "tabular-nums" }}>{quantity}</Text>
              <ActionIcon
                size="xl"
                radius="md"
                color="red"
                aria-label="Aumentar cantidad"
                disabled={quantity >= 99}
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              ><Plus size={20} /></ActionIcon>
            </Group>
          </Box>

          {dish.extras?.length > 0 && (
            <Box>
              <Text c="white" size="sm" fw={800} mb="md">Personaliza con adicionales</Text>
              <Stack gap="sm">
                {dish.extras.map((extra) => (
                  <Paper
                    key={extra.id}
                    radius="md"
                    p="md"
                    onClick={() => toggleExtra(extra.id)}
                    style={{
                      cursor: "pointer",
                      backgroundColor: selectedExtraIds.includes(extra.id) ? "#362126" : "#24252b",
                      border: "1px solid " + (selectedExtraIds.includes(extra.id) ? "#bc4856" : "#3d3e45"),
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Checkbox
                        color="red"
                        checked={selectedExtraIds.includes(extra.id)}
                        onChange={() => toggleExtra(extra.id)}
                        aria-label={`Agregar ${extra.name}`}
                        label={<Text c="#f5f5f6" size="sm" fw={650}>{extra.name}</Text>}
                      />
                      <Text size="sm" fw={750} c="#fda4af" style={{ whiteSpace: "nowrap" }}>
                        + {money(Number(extra.price))}
                      </Text>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          <Box>
            <Textarea
              label="Instrucciones especiales (opcional)"
              description="Ej. Sin cebolla, salsas aparte…"
              placeholder="¿Cómo prefieres tu plato?"
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              minRows={3}
              autosize
              maxLength={500}
              styles={{
                label: { color: "#f5f5f6", fontWeight: 750 },
                description: { color: "#a3a5af" },
                input: { color: "white", backgroundColor: "#24252b", borderColor: "#454650" },
              }}
            />
          </Box>

          <Paper radius="lg" p="lg" style={{ backgroundColor: "#23242a", border: "1px solid #3c3d44" }}>
            <Group gap="sm" mb="lg">
              <ThemeIcon color="orange" variant="light" radius="md" size="lg"><Star size={19} /></ThemeIcon>
              <Box style={{ flex: 1 }}>
                <Text c="white" fw={800}>Opiniones de clientes</Text>
                <Text c="#adb0b8" size="xs">Calificaciones de quienes han comprado este plato</Text>
              </Box>
              <Badge variant="light" color="gray">{reviews.length}</Badge>
            </Group>
            {reviewsLoading && <Text size="sm" c="#aeb1b8">Cargando reseñas…</Text>}
            {!reviewsLoading && reviews.length === 0 && (
              <Text size="sm" c="#b8bac4">Este plato aún no tiene reseñas.</Text>
            )}
            <Stack gap="md">
              {reviews.map((review) => (
                <Box key={review.id} pt="md" style={{ borderTop: "1px solid #3e3f47" }}>
                  <Group justify="space-between" wrap="wrap">
                    <Text c="white" fw={750} size="sm">{review.customerName || "Cliente"}</Text>
                    <Rating value={review.rating} readOnly size="xs" color="yellow" />
                  </Group>
                  {review.comment && <Text c="#bec0c9" size="sm" lh={1.7} mt="xs" style={{ whiteSpace: "pre-wrap" }}>{review.comment}</Text>}
                </Box>
              ))}
            </Stack>

            {isClient && (
              <Box mt="lg" pt="lg" style={{ borderTop: "1px solid #40414a" }}>
                {reviewEligibility === "checking" && <Text size="sm" c="#aeb1b8">Verificando tu compra…</Text>}
                {reviewEligibility === "error" && <Alert color="yellow" icon={<AlertCircle size={18}/>}>No pudimos verificar tu compra. Inténtalo nuevamente más tarde.</Alert>}
                {reviewEligibility === "ineligible" && <Text c="#b9bbc5" size="sm" lh={1.7}>Podrás dejar una reseña opcional después de recibir un pedido que incluya este plato, siempre que no lo hayas calificado antes.</Text>}
                {reviewEligibility === "eligible" && (
                  <Stack gap="sm">
                    <Text c="white" fw={750} size="sm">¿Qué te pareció este plato?</Text>
                    <Rating value={rating} onChange={setRating} size="lg" color="yellow" />
                    <Textarea
                      aria-label="Comentario de la reseña"
                      placeholder="Tu opinión (opcional)…"
                      value={reviewText}
                      onChange={(event) => setReviewText(event.currentTarget.value)}
                      minRows={3}
                      autosize
                      maxLength={2000}
                      styles={{ input: { color: "white", backgroundColor: "#1a1b20", borderColor: "#454650" } }}
                    />
                    <Button color="red" onClick={() => void submitReview()} loading={submittingReview} disabled={rating < 1 || rating > 5}>
                      Publicar reseña
                    </Button>
                  </Stack>
                )}
              </Box>
            )}
            {reviewError && <Alert color="red" mt="md" icon={<AlertCircle size={17}/>}>{reviewError}</Alert>}
          </Paper>
        </Stack>

        <Box
          p="lg"
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 3,
            backgroundColor: "#1a1b20",
            borderTop: "1px solid #383941",
            boxShadow: "0 -10px 25px rgba(0,0,0,.15)",
          }}
        >
          <Button
            size="lg"
            color="red"
            radius="md"
            fullWidth
            leftSection={<ShoppingBag size={21} />}
            onClick={addToCart}
            styles={{ root: { height: 54 }, label: { width: "100%", justifyContent: "space-between" } }}
          >
            <Text c="white" fw={800} size="sm">Agregar al pedido</Text>
            <Text c="white" fw={900} size="sm">{money(totalPrice)}</Text>
          </Button>
          <Group justify="center" gap="xs" mt="xs">
            <CheckCircle2 size={13} color="#94a3b8" />
            <Text size="xs" c="#9a9ca6">Puedes revisar tu carrito antes de finalizar.</Text>
          </Group>
        </Box>
      </Box>
    </Drawer>
  );
}
