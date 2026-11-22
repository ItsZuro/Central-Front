import type { CartItem } from "@/core/stores/cart/cart.store";
import { ActionIcon, Badge, Box, Button, Divider, Group, Paper, ScrollArea, Stack, Text } from "@mantine/core";
import { ArrowRight, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import styles from "../Checkout.module.css";

interface OrderSummaryProps {
  pickupMode?: boolean;
  isCheckoutReady?: boolean;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  isLoading: boolean;
  isUserLoggedIn: boolean;
  pendingCardOrderId?: number | null;
  onRemoveItem: (id: string) => void;
  onProcessOrder: () => void;
}

const money = (amount: number) => "S/ " + amount.toFixed(2);

export default function OrderSummary({
  pickupMode = false,
  isCheckoutReady = true,
  items,
  subtotal,
  deliveryFee,
  total,
  isLoading,
  isUserLoggedIn,
  pendingCardOrderId = null,
  onRemoveItem,
  onProcessOrder,
}: OrderSummaryProps) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Paper className={styles.summary} shadow="xl">
      <Box className={styles.summaryTop}>
        <Group justify="space-between" align="center" gap="sm">
          <Group gap="sm">
            <div className={styles.iconBadge} style={{ width: 39, height: 39, borderRadius: 11 }}>
              <ShoppingBag size={19} />
            </div>
            <Box>
              <Text fw={800} size="md" c="#faf6f3">Tu pedido</Text>
              <Text c="#a8a0a8" size="xs">Revisa los productos elegidos</Text>
            </Box>
          </Group>
          <Badge radius="xl" color="red" variant="light">
            {units} {units === 1 ? "producto" : "productos"}
          </Badge>
        </Group>
      </Box>

      <ScrollArea.Autosize mah={390} type="auto">
        <Stack gap="md" className={styles.summaryBody}>
          {items.map((item) => (
            <div key={item.cartItemId} className={styles.summaryItem}>
              <img
                src={item.product.imageUrl || "https://via.placeholder.com/150"}
                alt={item.product.name}
                className={styles.summaryPhoto}
                loading="lazy"
              />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
                  <Text fw={750} c="#f7f3f2" size="sm" lineClamp={2} style={{ flex: 1 }}>
                    {item.product.name}
                  </Text>
                  <ActionIcon
                    type="button"
                    variant="subtle"
                    color="gray"
                    size="sm"
                    radius="sm"
                    aria-label={"Eliminar " + item.product.name}
                    title="Eliminar producto"
                    onClick={() => onRemoveItem(item.cartItemId)}
                  >
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
                <Text size="xs" c="#a9a1a9" mt={5}>
                  Cantidad: <Text span fw={750} c="#ece5e8">{item.quantity}</Text>
                </Text>
                {item.selectedExtras.length > 0 && (
                  <Text size="xs" c="#9f979f" mt={4} lineClamp={2}>
                    + {item.selectedExtras.map((extra) => extra.name).join(", ")}
                  </Text>
                )}
                {item.notes.trim() && (
                  <Text size="xs" c="#958d95" mt={4} lineClamp={1}>
                    Nota: {item.notes}
                  </Text>
                )}
                <Text fw={800} c="#ff7b80" mt={8} size="sm">
                  {money(item.finalPrice * item.quantity)}
                </Text>
              </Box>
            </div>
          ))}
        </Stack>
      </ScrollArea.Autosize>

      <Box className={styles.summaryFooter}>
        <Stack gap={11}>
          <Group justify="space-between">
            <Text size="sm" c="#afa8af">Subtotal (sin IGV)</Text>
            <Text size="sm" c="#e3dce1" fw={650}>{money(subtotal)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="#afa8af">IGV (18%)</Text>
            <Text size="sm" c="#e3dce1" fw={650}>{money(total - subtotal - deliveryFee)}</Text>
          </Group>
          <Group justify="space-between">
            <Text size="sm" c="#afa8af">{pickupMode ? "Recogida en tienda" : "Costo de envío"}</Text>
            <Text size="sm" c="#e3dce1" fw={650}>{money(deliveryFee)}</Text>
          </Group>
        </Stack>
        <div className={styles.totalRow}>
          <Group justify="space-between" align="center">
            <Text c="#fff" fw={800} size="md">Total a pagar</Text>
            <Text className={styles.totalAmount}>{money(total)}</Text>
          </Group>
        </div>
        <Button
          mt="lg"
          fullWidth
          h={54}
          className={styles.cta}
          onClick={onProcessOrder}
          loading={isLoading}
          disabled={!isCheckoutReady}
          rightSection={!isLoading && isCheckoutReady ? <ArrowRight size={18} /> : undefined}
        >
          {!isCheckoutReady
            ? "Preparando pedido..."
            : isUserLoggedIn
              ? (pendingCardOrderId ? "Volver a abrir Niubiz" : "Confirmar pedido")
              : "Continuar e iniciar sesión"}
        </Button>
        {pendingCardOrderId != null && (
          <Text size="xs" c="#dfc4a0" lh={1.6} mt="sm">
            El pedido #{pendingCardOrderId} ya está registrado. Puedes reabrir la pasarela
            sin crear otro pedido. Si llegaste a enviar los datos de tu tarjeta, revisa
            primero Mis pedidos para evitar un cobro duplicado.
          </Text>
        )}
        <Divider color="#383239" my="md" />
        <Group align="flex-start" gap="xs" wrap="nowrap">
          <ShieldCheck size={17} color="#c6a67c" style={{ flexShrink: 0 }} />
          <Text size="xs" c="#a8a1a8" lh={1.65}>
            {isUserLoggedIn
              ? "Verifica tus datos antes de confirmar. El método de pago seleccionado se aplicará a tu pedido."
              : "Puedes preparar tu pedido sin una cuenta. Te pediremos iniciar sesión solo cuando confirmes."}
          </Text>
        </Group>
      </Box>
    </Paper>
  );
}
