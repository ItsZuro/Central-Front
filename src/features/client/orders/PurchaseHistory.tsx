import { useCancelOrderMutation, useGetMyOrdersQuery } from "@/core/hooks/order/useOrder.hook";
import type { OrderResponse } from "@/core/types/order/order.model";
import { Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import axios from "axios";
import { useState } from "react";
import { toast } from "react-toastify";
import OrderDetailModal from "./OrderDetailModal";
import {
  Bike,
  Check,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  Package,
  ShoppingBag,
  Store,
  Utensils,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

// ==========================================
// 1. CONFIGURACIÓN VISUAL DE ESTADOS
// ==========================================
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  PENDING_CONFIRMATION: {
    label: "Por Confirmar",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    icon: Clock,
  },
  PENDING: {
    label: "Pendiente",
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    icon: Clock,
  },
  CONFIRMED: {
    label: "Confirmado",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    icon: CheckCircle2,
  },
  IN_PROGRESS: {
    label: "Cocinando",
    color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    icon: ChefHat,
  },
  READY_FOR_PICKUP: {
    label: "Listo",
    color: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    icon: Store,
  },
  OUT_FOR_DELIVERY: {
    label: "En Camino",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    icon: Bike,
  },
  DELIVERED: {
    label: "Entregado",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: Package,
  },
  COMPLETED: {
    label: "Completado",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: "Cancelado",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
  FAILED: {
    label: "Fallido",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
};

// El backend envía el tipo traducido (p. ej., "Para Llevar"),
// no un código técnico. Normalizar antes de elegir el seguimiento.
const resolveOrderType = (name: string): string => {
  const normalized = name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (normalized.includes("LLEVAR") || normalized.includes("RECOG") || normalized.includes("PICKUP") || normalized.includes("TAKE_AWAY")) {
    return "TAKE_AWAY";
  }
  if (normalized.includes("DELIVERY") || normalized.includes("DOMICILIO") || normalized.includes("ENTREGA")) {
    return "DELIVERY";
  }
  if (normalized.includes("MESA") || normalized.includes("SALON") || normalized.includes("DINE_IN")) {
    return "DINE_IN";
  }
  return "DELIVERY";
};

const TYPE_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  DELIVERY: { label: "Delivery", icon: Bike },
  TAKE_AWAY: { label: "Para Llevar", icon: ShoppingBag },
  DINE_IN: { label: "En Mesa", icon: Utensils },
};

const ORDER_FLOWS: Record<string, { label: string; statuses: string[] }[]> = {
  DELIVERY: [
    { label: "Recibido", statuses: ["PENDING", "PENDING_CONFIRM"] },
    { label: "Confirmado", statuses: ["CONFIRMED"] },
    { label: "Preparando", statuses: ["IN_PROGRESS"] },
    { label: "En Camino", statuses: ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP"] },
    { label: "Entregado", statuses: ["DELIVERED", "COMPLETED"] },
  ],
  TAKE_AWAY: [
    { label: "Recibido", statuses: ["PENDING", "PENDING_CONFIRM"] },
    { label: "Confirmado", statuses: ["CONFIRMED"] },
    { label: "Preparando", statuses: ["IN_PROGRESS"] },
    { label: "Listo para Recoger", statuses: ["READY_FOR_PICKUP"] },
    { label: "Entregado", statuses: ["COMPLETED", "DELIVERED"] },
  ],
  DINE_IN: [
    { label: "Recibido", statuses: ["PENDING", "PENDING_CONFIRM"] },
    { label: "Confirmado", statuses: ["CONFIRMED"] },
    { label: "Preparando", statuses: ["IN_PROGRESS"] },
    { label: "Servido", statuses: ["COMPLETED"] },
  ],
};

// Componente Stepper Interno
const OrderStepper = ({
  typeCode,
  statusCode,
}: {
  typeCode: string;
  statusCode: string;
}) => {
  // Si está cancelado, no mostramos stepper, mostramos alerta roja
  if (["CANCELLED", "FAILED"].includes(statusCode)) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3 text-red-400 text-sm">
        <XCircle size={18} />
        <span className="font-medium">
          Este pedido ha sido cancelado. Si tienes dudas, contáctanos.
        </span>
      </div>
    );
  }

  // Obtenemos los pasos según el tipo (por defecto Delivery si no encuentra)
  const steps = ORDER_FLOWS[typeCode] || ORDER_FLOWS["DELIVERY"];

  // Calculamos en qué paso estamos
  let currentStepIndex = 0;
  // Buscamos el índice del paso que contiene el estado actual
  const foundIndex = steps.findIndex((step) =>
    step.statuses.includes(statusCode)
  );

  if (foundIndex !== -1) {
    currentStepIndex = foundIndex;
  } else {
    // Lógica fallback: Si el estado es "avanzado" (ej: COMPLETED), asumimos el último paso
    if (statusCode === "COMPLETED" || statusCode === "DELIVERED")
      currentStepIndex = steps.length - 1;
  }

  // Calculamos porcentaje de la barra
  const progressPercentage = (currentStepIndex / (steps.length - 1)) * 100;

  return (
    <div className="w-full mt-2 mb-4 px-2">
      {/* Barra de fondo y progreso */}
      <div className="relative h-1 bg-neutral-700 rounded-full mb-6">
        <div
          className="absolute h-full bg-orange-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />

        {/* Puntos (Steps) */}
        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div
                key={index}
                className="flex flex-col items-center relative group"
              >
                {/* Círculo */}
                <div
                  className={`w-4 h-4 rounded-full border-2 transition-colors duration-300 z-10 
                    ${
                      isCompleted
                        ? "bg-orange-500 border-orange-500"
                        : "bg-neutral-800 border-neutral-600"
                    }
                    ${isCurrent ? "ring-4 ring-orange-500/20 scale-125" : ""}
                  `}
                >
                  {isCompleted && index < currentStepIndex && (
                    <Check
                      size={10}
                      className="text-black absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                      strokeWidth={4}
                    />
                  )}
                </div>

                {/* Etiqueta */}
                <span
                  className={`absolute top-6 text-[10px] font-medium uppercase tracking-wide whitespace-nowrap transition-colors
                    ${isCompleted ? "text-orange-400" : "text-neutral-500"}
                    ${isCurrent ? "text-white font-bold" : ""}
                  `}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function PurchaseHistory() {
  const { data: ordersData, isLoading, isError, refetch } = useGetMyOrdersQuery();
  const cancelMutation = useCancelOrderMutation();
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OrderResponse | null>(null);
  const [filter, setFilter] = useState("all");
  const orders = [...(ordersData?.data || [])].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime());
  const filteredOrders = orders.filter((order) => {
    if (filter === "active") return !["CANCELLED", "FAILED", "COMPLETED", "DELIVERED"].includes(order.statusCode);
    if (filter === "finished") return ["COMPLETED", "DELIVERED"].includes(order.statusCode);
    if (filter === "cancelled") return ["CANCELLED", "FAILED"].includes(order.statusCode);
    return true;
  });

  const confirmCancellation = async () => {
    if (!cancelTarget || cancelMutation.isPending) return;
    try {
      await cancelMutation.mutateAsync({ id: cancelTarget.id });
      toast.success("Pedido cancelado correctamente. El historial se ha actualizado.");
      setCancelTarget(null);
      setSelectedOrderId(null);
    } catch (error) {
      const message = axios.isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message
        : undefined;
      toast.error(message || "No se pudo cancelar el pedido. Puede haber cambiado de estado; actualiza e inténtalo de nuevo.");
      setCancelTarget(null);
      await refetch();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-900 pt-24 pb-12 flex justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <section className="min-h-screen bg-neutral-900 pt-28 px-4 text-white text-center">
        <Text c="red.4" mb="md">No se pudo cargar el historial de pedidos.</Text>
        <Button color="red" onClick={() => void refetch()}>Reintentar</Button>
      </section>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-900 pt-24 pb-12 px-4 flex items-center justify-center">
        <div className="max-w-md w-full text-center py-16 bg-neutral-800/50 rounded-3xl border border-neutral-800">
          <div className="w-20 h-20 bg-neutral-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Aún no tienes pedidos
          </h2>
          <Link
            to="/menu"
            className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 px-8 rounded-full mt-4 transition-all"
          >
            <Utensils size={18} />
            Ir al Menú
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-neutral-900 text-white pt-28 pb-12 px-4 md:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Package className="text-orange-500" />
              Mis Pedidos
            </h1>
            <p className="text-gray-400 mt-1">
              Historial de tus compras recientes
            </p>
          </div>
        </div>

        <Group justify="space-between" mb="lg" align="end">
          <Text size="sm" c="#b5aeb7">{orders.length} pedidos registrados</Text>
          <Select
            label="Filtrar pedidos"
            aria-label="Filtrar pedidos"
            value={filter}
            onChange={(value) => setFilter(value || "all")}
            data={[
              { value: "all", label: "Todos" },
              { value: "active", label: "En curso" },
              { value: "finished", label: "Finalizados" },
              { value: "cancelled", label: "Cancelados" },
            ]}
            allowDeselect={false}
            w={190}
            comboboxProps={{ withinPortal: true }}
            styles={{ input: { background: "#242226", color: "#fff", borderColor: "#5b4850" },
              dropdown: { background: "#242226", color: "#fff", borderColor: "#5b4850" },
              option: { color: "#fff" }, label: { color: "#cfc4cc" } }}
          />
        </Group>
        {filteredOrders.length === 0 && (
          <Text c="#bcb1bc" ta="center" py="xl">No hay pedidos en este filtro.</Text>
        )}

        <div className="grid gap-8">
          {filteredOrders.map((order) => {
            // Helpers para obtener configuración visual segura
            const statusInfo = STATUS_CONFIG[order.statusCode] || {
              label: order.statusName,
              color: "bg-gray-700 text-gray-300",
              icon: Clock,
            };

            const typeKey = resolveOrderType(order.typeName);
            const typeInfo = TYPE_CONFIG[typeKey] || {
              label: order.typeName,
              icon: ShoppingBag,
            };

            const TypeIcon = typeInfo.icon;
            const StatusIcon = statusInfo.icon; // Extraemos el icono del estado

            return (
              <div
                key={order.id}
                className="group bg-neutral-800 rounded-2xl border border-neutral-700/50 overflow-hidden hover:border-neutral-600 transition-all hover:shadow-xl hover:shadow-black/20"
              >
                {/* Header Compacto */}
                <div className="px-6 py-4 bg-neutral-800/80 border-b border-neutral-700/50 flex flex-wrap justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-700/50 rounded-lg">
                      <TypeIcon
                        size={20}
                        className="text-gray-300"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">
                          Pedido #{order.id}
                        </span>
                        <span className="text-neutral-500 text-sm">•</span>
                        <span className="text-neutral-400 text-sm">
                          {new Date(order.date).toLocaleDateString("es-PE", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-orange-500 font-medium uppercase tracking-wide">
                          {typeInfo.label}
                        </span>
                        {/* USAMOS statusInfo AQUÍ PARA EL BADGE */}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border ${statusInfo.color} flex items-center gap-1`}
                        >
                          <StatusIcon size={10} />
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-bold text-white">
                      S/ {Number(order.total).toFixed(2)}
                    </span>
                    <div className="mt-1 text-xs text-neutral-400">
                      Pago: <span className={order.paymentStatus === "CONFIRMED" ? "text-green-400" : "text-amber-300"}>
                        {order.paymentStatus === "CONFIRMED" ? "Pagado"
                          : order.paymentStatus === "PENDING" ? "Pendiente"
                          : order.paymentStatus === "REFUNDED" ? "Reembolsado"
                          : order.paymentStatus === "FAILED" ? "Fallido"
                          : order.paymentStatus || "Por consultar"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cuerpo con Stepper */}
                <div className="p-6 pt-8 pb-8">
                  {/* STEPPER */}
                  <OrderStepper
                    typeCode={typeKey}
                    statusCode={order.statusCode}
                  />

                  {/* Detalles adicionales si es delivery */}
                  {typeKey === "DELIVERY" && order.deliveryStreet && (
                    <div className="mt-8 mb-6 p-4 bg-neutral-900/50 rounded-xl flex items-start gap-3 border border-neutral-800">
                      <MapPin
                        className="text-orange-500 mt-1 shrink-0"
                        size={18}
                      />
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                          Dirección de entrega
                        </p>
                        <p className="text-gray-300 text-sm">
                          {order.deliveryStreet}, {order.deliveryCity}
                        </p>
                        {order.deliveryReference && (
                          <p className="text-gray-500 text-xs mt-1">
                            Ref: {order.deliveryReference}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* LISTA DE PRODUCTOS CON IMAGEN */}
                  <div className="mt-6 pt-4 border-t border-neutral-700/30">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-4 tracking-wider">
                      Productos ({order.details.length})
                    </p>
                    <div className="space-y-4">
                      {order.details.map((detail) => (
                        <div
                          key={detail.id}
                          className="flex items-center gap-4"
                        >
                          {/* Imagen del producto */}
                          <div className="w-12 h-12 rounded-lg bg-neutral-700 overflow-hidden shrink-0 border border-neutral-600">
                            {detail.productImageUrl ? (
                              <img
                                src={detail.productImageUrl}
                                alt={detail.productName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500">
                                <Utensils size={16} />
                              </div>
                            )}
                          </div>

                          {/* Info del producto */}
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-200 font-medium text-sm truncate">
                              {detail.productName}
                            </p>
                            <p className="text-gray-500 text-xs">
                              Cantidad: {detail.quantity}
                            </p>
                          </div>

                          {/* Precio */}
                          <div className="text-right">
                            <p className="text-gray-300 font-mono text-sm">
                              S/{" "}
                              {Number(
                                detail.unitPrice * detail.quantity
                              ).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Group mt="md" gap="sm" wrap="wrap">
                    <Button
                      variant="light"
                      color="red"
                      radius="md"
                      size="sm"
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      Ver detalle
                    </Button>
                    {order.canCustomerCancel && (
                      <Button
                        variant="outline"
                        color="red"
                        radius="md"
                        size="sm"
                        onClick={() => setCancelTarget(order)}
                      >
                        Cancelar pedido
                      </Button>
                    )}
                    {!order.canCustomerCancel && !["CANCELLED", "FAILED", "COMPLETED", "DELIVERED"].includes(order.statusCode) && (
                      <Link to="/contact" className="text-xs text-rose-300 hover:text-rose-200">
                        ¿Necesitas ayuda?
                      </Link>
                    )}
                  </Group>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <OrderDetailModal
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        onRequestCancel={(order) => setCancelTarget(order)}
      />

      <Modal
        opened={cancelTarget !== null}
        onClose={() => { if (!cancelMutation.isPending) setCancelTarget(null); }}
        centered
        radius="lg"
        title={<Text fw={800} c="white">Cancelar pedido #{cancelTarget?.id}</Text>}
        styles={{
          content: { background: "#201c21", border: "1px solid #694047", color: "white" },
          header: { background: "#201c21" },
          close: { color: "#fff" },
        }}
      >
        <Stack gap="md">
          <Text size="sm" c="#e7dbe4">
            ¿Confirmas la cancelación de este pedido? Solo se permite antes de iniciar la preparación
            y si no tiene un pago confirmado.
          </Text>
          <Text size="xs" c="#b8abb6">
            El servidor volverá a validar el estado y el pago. Un pedido pagado con Niubiz
            requiere gestión de devolución con el restaurante.
          </Text>
          <Group justify="end">
            <Button variant="subtle" color="gray" disabled={cancelMutation.isPending}
              onClick={() => setCancelTarget(null)}>Volver</Button>
            <Button color="red" loading={cancelMutation.isPending} onClick={() => void confirmCancellation()}>
              Confirmar cancelación
            </Button>
          </Group>
        </Stack>
      </Modal>
    </section>
  );
}
