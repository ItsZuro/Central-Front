import type { CartItem } from "@/core/stores/cart/cart.store";
import type { OrderResponse } from "@/core/types/order/order.model";
import { describe, expect, it } from "vitest";
import {
  createCheckoutSignature,
  getRetryablePayment,
  matchesLegacyPendingOrder,
  parsePendingCardPayment,
} from "./pendingPayment";

const cartItem = {
  cartItemId: "item-1",
  product: { id: 1 },
  quantity: 1,
  finalPrice: 3.50,
  selectedExtras: [],
  notes: "",
} as unknown as CartItem;

const order = {
  id: 51,
  statusCode: "PENDING",
  total: 4.13,
  pickupStoreId: 1,
  details: [{ productId: 1, quantity: 1, notes: "" }],
} as OrderResponse;

describe("reintentos de pago Niubiz", () => {
  it("acepta los metadatos del mismo carrito y cliente", () => {
    const signature = createCheckoutSignature(3, "pickup", [cartItem], null);
    const payload = JSON.stringify({
      orderId: 51,
      amount: 4.13,
      purchaseNumber: "51",
      checkoutSignature: signature,
    });
    expect(getRetryablePayment(payload, signature)?.orderId).toBe(51);
  });

  it("no reutiliza una orden para otro usuario, cantidad o tipo de pedido", () => {
    const original = createCheckoutSignature(3, "pickup", [cartItem], null);
    const payload = JSON.stringify({
      orderId: 51,
      amount: 4.13,
      purchaseNumber: "51",
      checkoutSignature: original,
    });
    const otherUser = createCheckoutSignature(4, "pickup", [cartItem], null);
    const otherQuantity = createCheckoutSignature(3, "pickup", [{ ...cartItem, quantity: 2 }], null);
    const otherType = createCheckoutSignature(3, "delivery", [cartItem], { lat: -14.0, lng: -75.7 });

    expect(getRetryablePayment(payload, otherUser)).toBeNull();
    expect(getRetryablePayment(payload, otherQuantity)).toBeNull();
    expect(getRetryablePayment(payload, otherType)).toBeNull();
  });

  it("ignora almacenamiento corrupto o incompleto", () => {
    expect(parsePendingCardPayment("{")).toBeNull();
    expect(parsePendingCardPayment("{}")).toBeNull();
    expect(parsePendingCardPayment(JSON.stringify({ orderId: 51, purchaseNumber: "51", amount: -1 }))).toBeNull();
  });

  it("recupera pedidos antiguos solo si coinciden productos, total y estado", () => {
    expect(matchesLegacyPendingOrder(order, [cartItem], "pickup", 4.13)).toBe(true);
    expect(matchesLegacyPendingOrder({ ...order, statusCode: "COMPLETED" }, [cartItem], "pickup", 4.13)).toBe(false);
    expect(matchesLegacyPendingOrder(order, [{ ...cartItem, quantity: 2 }], "pickup", 4.13)).toBe(false);
    expect(matchesLegacyPendingOrder(order, [cartItem], "pickup", 7.0)).toBe(false);
  });
});
