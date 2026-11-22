import { useGetOrderByIdQuery } from "@/core/hooks/order/useOrder.hook";
import type { OrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Badge, Box, Button, Divider, Group, Loader, Modal, Paper, Stack, Text, Title,
} from "@mantine/core";
import { CalendarDays, CreditCard, ExternalLink, MapPin, Package, ShoppingBag, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  orderId: number | null;
  onClose: () => void;
  onRequestCancel: (order: OrderResponse) => void;
}

const formatMoney = (value: number) => "S/ " + Number(value || 0).toFixed(2);
const labels: Record<string, string> = {
  CONFIRMED: "Pagado",
  PENDING: "Pendiente de pago",
  FAILED: "Pago fallido",
  REFUNDED: "Reembolsado",
  CANCELLED: "Pago cancelado",
};
const methods: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Niubiz (pago en línea)",
  YAPE: "Yape",
  PLIN: "Plin",
  TRANSFER: "Transferencia",
};

export default function OrderDetailModal({ orderId, onClose, onRequestCancel }: Props) {
  const { data, isPending, isError, refetch } = useGetOrderByIdQuery(orderId ?? 0);
  const order = data?.data;
  const onlinePaid = order?.paymentStatus === "CONFIRMED";
  const isDelivery = !!order?.deliveryStreet;

  return (
    <Modal
      opened={orderId !== null}
      onClose={onClose}
      title={<Group gap="xs"><Package size={19} color="#ee6068" /><Text fw={800}>Detalle del pedido #{orderId}</Text></Group>}
      centered
      size="lg"
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.7, blur: 2 }}
      styles={{
        content: { background: "#1f1d22", border: "1px solid #493f48", color: "white" },
        header: { background: "#1f1d22", color: "white" },
        title: { color: "white" },
        close: { color: "#eee" },
      }}
    >
      {isPending && <Group justify="center" p="xl"><Loader color="red" /><Text>Cargando información...</Text></Group>}
      {isError && (
        <Alert color="red" title="No se pudo consultar este pedido">
          Comprueba tu conexión o inténtalo otra vez.
          <Button color="red" size="xs" mt="sm" variant="light" onClick={() => void refetch()}>Reintentar</Button>
        </Alert>
      )}
      {order && !isPending && (
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Box>
              <Title order={3} c="white">{formatMoney(order.total)}</Title>
              <Text c="#bdb3bc" size="xs" mt={4}>
                <CalendarDays size={13} style={{ display: "inline", marginRight: 5 }} />
                {new Date(order.date).toLocaleString("es-PE")}
              </Text>
            </Box>
            <Badge variant="light" color={["CANCELLED", "FAILED"].includes(order.statusCode) ? "red" : "orange"}>
              {order.statusName}
            </Badge>
          </Group>

          <SimplePaymentStatus order={order} />

          <Paper p="md" radius="md" bg="#28252b" withBorder style={{ borderColor: "#49424a" }}>
            <Group gap="xs" mb="sm"><ShoppingBag size={17} color="#fa747c" /><Text fw={750} c="white">Productos</Text></Group>
            <Stack gap="sm">
              {order.details.map((detail) => (
                <Group gap="sm" key={detail.id} align="flex-start" wrap="nowrap">
                  {detail.productImageUrl && (
                    <img src={detail.productImageUrl} alt={detail.productName}
                      style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover" }} />
                  )}
                  <Box style={{ flex: 1 }}>
                    <Text fw={650} size="sm" c="white">{detail.productName}</Text>
                    <Text c="#b9b0b8" size="xs">Cantidad: {detail.quantity}</Text>
                    {detail.selectedExtras && <Text c="#beb1be" size="xs">Extras: {detail.selectedExtras}</Text>}
                    {detail.notes && <Text c="#beb1be" size="xs">Nota: {detail.notes}</Text>}
                  </Box>
                  <Text fw={700} size="sm" c="white">{formatMoney(detail.unitPrice * detail.quantity)}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>

          <Paper p="md" radius="md" bg="#28252b" withBorder style={{ borderColor: "#49424a" }}>
            <Group gap="xs"><MapPin size={17} color="#fa747c" /><Text fw={750} c="white">{isDelivery ? "Dirección de entrega" : "Punto de recogida"}</Text></Group>
            <Text c="#e7dde5" size="sm" mt="sm">
              {isDelivery
                ? [order.deliveryStreet, order.deliveryCity, order.deliveryProvince].filter(Boolean).join(", ")
                : [order.pickupStoreName, order.pickupStoreAddress].filter(Boolean).join(" — ") || "Consulta la sucursal al restaurante"}
            </Text>
            {isDelivery && order.deliveryReference && (
              <Text c="#b9aeb9" size="sm" mt={4}>Referencia: {order.deliveryReference}</Text>
            )}
            {isDelivery && Number.isFinite(order.deliveryLatitude) && Number.isFinite(order.deliveryLongitude) && (
              <Button
                mt="sm"
                size="xs"
                variant="light"
                color="red"
                component="a"
                href={"https://www.google.com/maps/search/?api=1&query=" +
                  encodeURIComponent(order.deliveryLatitude + "," + order.deliveryLongitude)}
                target="_blank"
                rel="noopener noreferrer"
                leftSection={<ExternalLink size={14} />}
              >Ver ubicación</Button>
            )}
          </Paper>

          <Group justify="space-between">
            <Text c="#b9afb8" size="sm">Total del pedido</Text>
            <Text fw={800} c="white">{formatMoney(order.total)}</Text>
          </Group>
          <Divider color="#484048"/>
          {order.canCustomerCancel ? (
            <Button color="red" variant="outline" leftSection={<XCircle size={17} />}
              onClick={() => onRequestCancel(order)}>
              Cancelar pedido
            </Button>
          ) : (
            <Text size="xs" c="#bdb4bd" lh={1.6}>
              La cancelación automática solo está disponible antes de preparar el pedido y cuando
              no hay pagos confirmados. Para otros casos, <Link to="/contact" onClick={onClose} style={{ color: "#ff8c91" }}>contacta al restaurante</Link>.
            </Text>
          )}
          {onlinePaid && (
            <Text size="xs" c="#b9afb8">
              Si solicitas cancelar un pedido ya pagado, el restaurante deberá revisar la devolución.
              No se realizará automáticamente desde esta pantalla.
            </Text>
          )}
        </Stack>
      )}
    </Modal>
  );
}

function SimplePaymentStatus({ order }: { order: OrderResponse }) {
  const status = order.paymentStatus;
  return (
    <Paper p="md" radius="md" bg="#2a252c" withBorder style={{ borderColor: "#59434c" }}>
      <Group justify="space-between" align="center">
        <Group gap="xs"><CreditCard size={17} color="#f1b27d" /><Text fw={750} size="sm" c="white">Pago</Text></Group>
        <Badge color={status === "CONFIRMED" ? "green" : status === "FAILED" ? "red" : "yellow"} variant="light">
          {status ? labels[status] || status : "Por consultar"}
        </Badge>
      </Group>
      <Text c="#bcb2bc" size="xs" mt="sm">
        Medio: {order.paymentMethodCode ? (methods[order.paymentMethodCode] || order.paymentMethodCode) : "No registrado"}
      </Text>
    </Paper>
  );
}
