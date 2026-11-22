import type { CartItem } from "@/core/stores/cart/cart.store";
import type { OrderResponse } from "@/core/types/order/order.model";

export const PENDING_PAYMENT_KEY = "pending_payment_metadata";

export interface PendingCardPayment {
  orderId: number;
  amount: number;
  purchaseNumber: string;
  checkoutSignature?: string;
}

/** Mantener la identidad del carrito/cliente mientras se reintenta un cobro. */
export function createCheckoutSignature(
  userId: number | null,
  orderMode: "pickup" | "delivery",
  items: CartItem[],
  coordinates: { lat: number; lng: number } | null,
): string {
  return JSON.stringify({
    userId,
    orderMode,
    coordinates: orderMode === "delivery" ? coordinates : null,
    items: items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      notes: item.notes.trim(),
      finalPrice: item.finalPrice,
      extraIds: item.selectedExtras.map((extra) => extra.id).sort((a, b) => a - b),
    })),
  });
}

export function parsePendingCardPayment(raw: string | null): PendingCardPayment | null {
  if (!raw) return null;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;
    const meta = data as Record<string, unknown>;
    if (
      !Number.isSafeInteger(meta.orderId) || Number(meta.orderId) <= 0 ||
      typeof meta.amount !== "number" || !Number.isFinite(meta.amount) || meta.amount <= 0 ||
      typeof meta.purchaseNumber !== "string" || meta.purchaseNumber.length === 0
    ) return null;
    return {
      orderId: Number(meta.orderId),
      amount: meta.amount,
      purchaseNumber: meta.purchaseNumber,
      checkoutSignature: typeof meta.checkoutSignature === "string" ? meta.checkoutSignature : undefined,
    };
  } catch {
    return null;
  }
}

export function getRetryablePayment(
  raw: string | null,
  signature: string,
): PendingCardPayment | null {
  const existing = parsePendingCardPayment(raw);
  return existing?.checkoutSignature === signature ? existing : null;
}

/** Migración segura de sesiones iniciadas antes de guardar la firma del carrito. */
export function matchesLegacyPendingOrder(
  order: OrderResponse,
  items: CartItem[],
  mode: "pickup" | "delivery",
  amount: number,
): boolean {
  if (order.statusCode !== "PENDING" || Math.abs(Number(order.total) - amount) > 0.005) return false;
  if (mode === "pickup" && !order.pickupStoreId) return false;
  if (mode === "delivery" && !order.deliveryStreet) return false;
  if (order.details.length !== items.length) return false;
  // Los extras antiguos no contienen IDs en OrderResponse: evitar asociar el carrito equivocado.
  if (items.some((item) => item.selectedExtras.length > 0)) return false;
  const lhs = items.map((item) => JSON.stringify([
    item.product.id, item.quantity, item.notes.trim(),
  ])).sort();
  const rhs = order.details.map((detail) => JSON.stringify([
    detail.productId, detail.quantity, (detail.notes || "").trim(),
  ])).sort();
  return lhs.every((value, index) => value === rhs[index]);
}
