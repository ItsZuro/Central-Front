import { logoutFromServer } from "@/core/services/auth/logout";
import { orderService } from "@/core/services/order/order.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { OrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Avatar, Badge, Box, Button, Center, Divider, Group, Loader, Modal,
  Paper, ScrollArea, SegmentedControl, SimpleGrid, Stack, Text, ThemeIcon, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle, Bike, CheckCircle2, Clock3, ClipboardList, ExternalLink, History,
  LogOut, MapPin, Navigation, PackageCheck, RefreshCw, ShieldCheck,
  ShoppingBag, Truck, UserRound, type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "./Driver.module.css";

type DeliveryStatus = "OUT_FOR_DELIVERY" | "DELIVERED";
type Filter = "all" | "pending" | "route" | "delivered";
const muted = "#bdb3bf";
const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const statusNames: Record<string, string> = {
  PENDING: "Pendiente",
  PENDING_CONFIRMATION: "Por confirmar",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En preparación",
  READY_FOR_PICKUP: "Listo para recoger",
  OUT_FOR_DELIVERY: "En ruta",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  FAILED: "Fallido",
};

function errorText(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "No se pudo completar la operación.";
  }
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}
function isPending(status: string) {
  return !["DELIVERED", "CANCELLED", "FAILED"].includes(status);
}
function directionsUrl(order: OrderResponse): string | null {
  let destination = "";
  if (Number.isFinite(order.deliveryLatitude) && Number.isFinite(order.deliveryLongitude)) {
    destination = String(order.deliveryLatitude) + "," + String(order.deliveryLongitude);
  } else if (order.deliveryStreet?.trim()) {
    destination = [
      order.deliveryStreet, order.deliveryCity, order.deliveryProvince, "Perú",
    ].filter(Boolean).join(", ");
  }
  return destination
    ? "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(destination)
    : null;
}
function Metric({ label, value, hint, Icon, color }: {
  label: string;
  value: string | number;
  hint: string;
  Icon: LucideIcon;
  color: string;
}) {
  return (
    <Paper radius="xl" p="lg" className={styles.metric}>
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Text c={muted} fw={700} size="xs">{label}</Text>
        <ThemeIcon size={42} radius="md" color={color} variant="light"><Icon size={21}/></ThemeIcon>
      </Group>
      <Title order={2} c="white" mt="xs" fw={850}>{value}</Title>
      <Text c="#a69ba9" size="xs" mt={6}>{hint}</Text>
    </Paper>
  );
}
function EmptyState({ filter, onReset }: { filter: Filter; onReset: () => void }) {
  const all = filter === "all";
  return (
    <Paper className={styles.emptyState} radius="xl" p={{ base: "xl", md: 48 }}>
      <Stack align="center" gap="sm">
        <ThemeIcon variant="light" color="gray" size={64} radius="xl"><Truck size={31}/></ThemeIcon>
        <Title order={3} c="white" ta="center">
          {all ? "No tienes repartos asignados" : "No hay repartos en esta categoría"}
        </Title>
        <Text c={muted} size="sm" ta="center" maw={430}>
          {all
            ? "Los pedidos que te asignen desde el restaurante aparecerán aquí automáticamente."
            : "Selecciona otra categoría para consultar tus pedidos asignados."}
        </Text>
        {!all && <Button variant="default" onClick={onReset} mt="xs">Ver todos los repartos</Button>}
      </Stack>
    </Paper>
  );
}
function StatusBadge({ status }: { status: string }) {
  const color = status === "DELIVERED" ? "green"
    : status === "OUT_FOR_DELIVERY" ? "blue"
      : status === "READY_FOR_PICKUP" ? "orange"
        : status === "CANCELLED" || status === "FAILED" ? "red" : "gray";
  return (
    <Badge variant="light" color={color} radius="xl" size="lg">
      {statusNames[status] || status}
    </Badge>
  );
}
function DeliveryCard({
  order, busy, onAdvance, onDeliver,
}: {
  order: OrderResponse;
  busy: boolean;
  onAdvance: (id: number) => void;
  onDeliver: (order: OrderResponse) => void;
}) {
  const url = directionsUrl(order);
  const ready = order.statusCode === "READY_FOR_PICKUP";
  const onRoute = order.statusCode === "OUT_FOR_DELIVERY";
  const blocked = ["IN_PROGRESS", "CONFIRMED", "PENDING", "PENDING_CONFIRMATION"].includes(order.statusCode);
  return (
    <Paper radius="xl" p={{ base: "md", sm: "lg" }} className={styles.deliveryCard}>
      <Stack gap="md" h="100%">
        <Group justify="space-between" align="flex-start" gap="sm">
          <Box>
            <Text size="xs" c="#f38a9a" fw={850} tt="uppercase" lts={1}>Comanda de reparto</Text>
            <Title order={3} c="white" mt={4}>Pedido #{order.id}</Title>
          </Box>
          <StatusBadge status={order.statusCode}/>
        </Group>

        <Paper className={styles.productLine} p="sm" radius="md">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon color="red" variant="light" radius="md" size={35}>
              <UserRound size={18}/>
            </ThemeIcon>
            <Box style={{ minWidth: 0 }}>
              <Text c={muted} size="xs">Destinatario</Text>
              <Text c="white" fw={700} size="sm" style={{ overflowWrap: "anywhere" }}>
                {order.customerName || "Cliente"}
              </Text>
            </Box>
          </Group>
        </Paper>

        <Box>
          <Group gap="xs" mb={7}>
            <MapPin size={17} color="#ff8796"/>
            <Text c="white" fw={750} size="sm">Dirección de entrega</Text>
          </Group>
          <Text c="#e6dfe8" size="sm" style={{ overflowWrap: "anywhere" }}>
            {[order.deliveryStreet, order.deliveryCity, order.deliveryProvince].filter(Boolean).join(", ")
              || "Dirección no disponible"}
          </Text>
          {order.deliveryReference && (
            <Text c={muted} size="xs" mt={5} style={{ overflowWrap: "anywhere" }}>
              Referencia: {order.deliveryReference}
            </Text>
          )}
          {order.deliveryInstructions && (
            <Box className={styles.note} mt="sm">
              <Text c="#ffe7c2" size="xs" fw={800}>Instrucciones de entrega</Text>
              <Text size="sm" c="#f8e4cd" mt={4}
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {order.deliveryInstructions}
              </Text>
            </Box>
          )}
          {(order.estimatedDuration || order.estimatedDistance) && (
            <Group gap="sm" mt="sm">
              <Clock3 size={15} color="#e2a3ae"/>
              <Text size="xs" c={muted}>
                {[order.estimatedDuration, order.estimatedDistance].filter(Boolean).join(" · ")}
                {" · Estimación de ruta"}
              </Text>
            </Group>
          )}
        </Box>

        <Divider color="#514752"/>
        <Box>
          <Group gap="xs" mb="sm">
            <ShoppingBag size={17} color="#fa8294"/>
            <Text fw={750} c="white" size="sm">Productos del pedido</Text>
          </Group>
          <Stack gap="xs">
            {(order.details || []).length > 0 ? order.details.map((item) => (
              <Group key={item.id} wrap="nowrap" align="flex-start" gap="sm">
                <Badge color="gray" variant="light" radius="sm">{item.quantity}×</Badge>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" c="#f2edf3" fw={650}>{item.productName}</Text>
                  {item.selectedExtras && (
                    <Text c={muted} size="xs" mt={2}>Adicionales: {item.selectedExtras}</Text>
                  )}
                  {item.notes && (
                    <Text c="#eecda4" size="xs" mt={2}
                      style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      Nota: {item.notes}
                    </Text>
                  )}
                </Box>
              </Group>
            )) : <Text size="sm" c={muted}>Sin productos detallados.</Text>}
          </Stack>
        </Box>

        <Box style={{ marginTop: "auto" }}>
          <Divider color="#514752" mb="md"/>
          <Group justify="space-between" align="center" mb="md">
            <Box>
              <Text c={muted} size="xs">Importe del pedido</Text>
              <Title order={3} c="white">{money.format(Number(order.total) || 0)}</Title>
            </Box>
            {order.paymentStatus === "CONFIRMED" && (
              <Badge color="green" variant="light" leftSection={<ShieldCheck size={12}/>}>
                Pago confirmado
              </Badge>
            )}
          </Group>
          <Group gap="sm" wrap="wrap">
            {url && (
              <Button component="a" href={url} target="_blank" rel="noopener noreferrer"
                variant="default" leftSection={<Navigation size={17}/>} rightSection={<ExternalLink size={13}/>}>
                Ver ruta
              </Button>
            )}
            {ready && (
              <Button color="red" loading={busy} disabled={busy}
                onClick={() => onAdvance(order.id)} leftSection={<Bike size={17}/>}>
                Iniciar reparto
              </Button>
            )}
            {onRoute && (
              <Button color="green" loading={busy} disabled={busy}
                onClick={() => onDeliver(order)} leftSection={<CheckCircle2 size={17}/>}>
                Marcar entregado
              </Button>
            )}
            {order.statusCode === "DELIVERED" && (
              <Badge color="green" variant="light" leftSection={<PackageCheck size={14}/>}>
                Entrega finalizada
              </Badge>
            )}
          </Group>
          {blocked && (
            <Alert color="yellow" variant="light" mt="md" icon={<Clock3 size={17}/>}>
              El pedido todavía no está listo. Podrás iniciar el reparto cuando cocina lo marque como listo.
            </Alert>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}
export default function AssignedDeliveries() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>("all");
  const [toDeliver, setToDeliver] = useState<OrderResponse | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const deliveries = useQuery({
    queryKey: ["driver", "deliveries", "mine"],
    queryFn: async () => {
      const response = await orderService.getAssignedDeliveries();
      if (!response.success) throw new Error(response.message || "No se pudo consultar tus repartos.");
      return response.data || [];
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: DeliveryStatus }) => {
      const result = await orderService.updateAssignedDeliveryStatus(id, status);
      if (!result.success) throw new Error(result.message || "No se pudo actualizar el estado.");
      return result.data;
    },
    onSuccess: async (_, action) => {
      toast.success(action.status === "DELIVERED"
        ? "Entrega confirmada. El pedido se marcó como entregado."
        : "Reparto iniciado. El pedido figura en ruta.");
      setToDeliver(null);
      await queryClient.invalidateQueries({ queryKey: ["driver", "deliveries"] });
    },
    onError: (error) => {
      toast.error(errorText(error));
      void queryClient.invalidateQueries({ queryKey: ["driver", "deliveries"] });
    },
  });

  const allOrders = deliveries.data ?? [];
  const stats = useMemo(() => ({
    assigned: allOrders.length,
    pending: allOrders.filter((o) => isPending(o.statusCode)).length,
    ready: allOrders.filter((o) => o.statusCode === "READY_FOR_PICKUP").length,
    route: allOrders.filter((o) => o.statusCode === "OUT_FOR_DELIVERY").length,
    delivered: allOrders.filter((o) => o.statusCode === "DELIVERED").length,
  }), [allOrders]);
  const filtered = useMemo(() => {
    if (filter === "pending") return allOrders.filter((o) => isPending(o.statusCode));
    if (filter === "route") return allOrders.filter((o) => o.statusCode === "OUT_FOR_DELIVERY");
    if (filter === "delivered") return allOrders.filter((o) => o.statusCode === "DELIVERED");
    return allOrders;
  }, [allOrders, filter]);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      setLoggingOut(false);
      navigate("/auth/login", { replace: true });
    }
  };

  return (
    <Box className={styles.root}>
      <Box className={styles.header}>
        <Box maw={1460} mx="auto" px={{ base: "md", md: "xl" }} py="lg">
          <Group justify="space-between" align="center" gap="md">
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={54} radius="lg" color="red">
                <Truck size={28}/>
              </ThemeIcon>
              <Box>
                <Text c="#fa8394" size="xs" fw={850} lts={1.5} tt="uppercase">
                  Restaurant Central / Personal
                </Text>
                <Title order={1} c="white" mt={3}>Panel del repartidor</Title>
                <Text c={muted} size="sm" mt={3}>
                  {user?.fullName || user?.username || "Repartidor"} · Gestión de entregas
                </Text>
              </Box>
            </Group>
            <Group gap="xs">
              <Button variant="default" leftSection={<RefreshCw size={17}/>}
                onClick={() => void deliveries.refetch()} loading={deliveries.isFetching}>
                Actualizar
              </Button>
              <Button variant="subtle" leftSection={<LogOut size={17}/>}
                loading={loggingOut} onClick={() => void logout()}>
                Salir
              </Button>
            </Group>
          </Group>
        </Box>
      </Box>

      <Box maw={1460} mx="auto" px={{ base: "md", md: "xl" }} py="xl">
        <Paper radius="xl" p={{ base: "lg", md: "xl" }} className={styles.hero}>
          <Box className={styles.heroContent}>
            <Group align="center" justify="space-between" gap="lg">
              <Box>
                <Group gap="xs" mb="sm">
                  <Bike size={18} color="#ffa4af"/>
                  <Text c="#ffa4af" size="xs" fw={850} tt="uppercase" lts={1.5}>
                    Centro de entregas
                  </Text>
                </Group>
                <Title c="white" order={2} fw={850}>
                  Tus repartos, organizados en un solo lugar
                </Title>
                <Text size="sm" mt="sm" c="#e7d7e0" maw={640} lh={1.65}>
                  Revisa los pedidos asignados, abre la ruta de entrega y confirma cada reparto
                  cuando realmente haya llegado al cliente.
                </Text>
              </Box>
              <Badge size="lg" variant="light" color="red"
                leftSection={<RefreshCw size={12}/>}>
                Sincronización cada 15 s
              </Badge>
            </Group>
          </Box>
        </Paper>

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mt="lg">
          <Metric label="Repartos asignados" value={deliveries.isPending || deliveries.isError ? "—" : stats.assigned}
            hint="En la lista de tu cuenta" Icon={ClipboardList} color="red"/>
          <Metric label="Listos para recoger" value={deliveries.isPending || deliveries.isError ? "—" : stats.ready}
            hint="Puedes iniciar la ruta" Icon={Clock3} color="orange"/>
          <Metric label="En ruta" value={deliveries.isPending || deliveries.isError ? "—" : stats.route}
            hint="Entregas en curso" Icon={Bike} color="blue"/>
          <Metric label="Entregados" value={deliveries.isPending || deliveries.isError ? "—" : stats.delivered}
            hint="De los pedidos asignados" Icon={PackageCheck} color="green"/>
        </SimpleGrid>

        <Group justify="space-between" align="flex-end" gap="md" mt="xl" mb="lg">
          <Box>
            <Group gap="xs">
              <History size={21} color="#f27a8e"/>
              <Title order={2} c="white" size="h3">Mis pedidos</Title>
              <Badge variant="light" color="gray">{stats.pending} pendientes</Badge>
            </Group>
            <Text c={muted} size="xs" mt={6}>
              Solo se muestran las entregas asignadas a tu cuenta.
            </Text>
          </Box>
        </Group>
        <ScrollArea type="auto" mb="lg" offsetScrollbars>
          <SegmentedControl className={styles.segmented} color="red"
            value={filter} onChange={(value) => setFilter(value as Filter)}
            data={[
              { value: "all", label: "Todos" },
              { value: "pending", label: "Pendientes" },
              { value: "route", label: "En ruta" },
              { value: "delivered", label: "Entregados" },
            ]}/>
        </ScrollArea>

        {deliveries.isError && (
          <Alert icon={<AlertCircle size={18}/>} color="red"
            title="No se pudieron consultar tus repartos" mb="lg">
            {errorText(deliveries.error)}
            <Box mt="sm">
              <Button color="red" variant="light" size="xs"
                onClick={() => void deliveries.refetch()}>
                Reintentar
              </Button>
            </Box>
          </Alert>
        )}

        {deliveries.isPending ? (
          <Center py={75}>
            <Stack align="center" gap="sm">
              <Loader color="red"/>
              <Text c={muted} size="sm">Consultando entregas asignadas...</Text>
            </Stack>
          </Center>
        ) : deliveries.isError ? null : filtered.length === 0 ? (
          <EmptyState filter={filter} onReset={() => setFilter("all")}/>
        ) : (
          <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
            {filtered.map((order) => (
              <DeliveryCard key={order.id} order={order}
                busy={changeStatus.isPending && changeStatus.variables?.id === order.id}
                onAdvance={(id) => changeStatus.mutate({ id, status: "OUT_FOR_DELIVERY" })}
                onDeliver={setToDeliver}/>
            ))}
          </SimpleGrid>
        )}

        <Paper radius="lg" p="md" className={styles.panel} mt="lg">
          <Group align="flex-start" gap="sm">
            <ThemeIcon radius="md" color="gray" variant="light" size={35}>
              <ShieldCheck size={18}/>
            </ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text c="white" fw={750} size="sm">Acceso exclusivo a tus repartos</Text>
              <Text c={muted} size="xs" mt={5} lh={1.6}>
                El repartidor solo puede actualizar entregas asignadas. Los cobros se gestionan en caja,
                la preparación en cocina y las asignaciones en administración.
                Esta vista se consulta automáticamente cada 15 segundos.
              </Text>
            </Box>
          </Group>
        </Paper>
      </Box>

      <Modal opened={toDeliver !== null} centered size="md"
        onClose={() => { if (!changeStatus.isPending) setToDeliver(null); }}
        closeOnClickOutside={!changeStatus.isPending}
        closeOnEscape={!changeStatus.isPending}
        title="Confirmar entrega"
        classNames={{
          content: styles.modalContent, header: styles.modalHeader,
          title: styles.modalTitle, close: styles.modalClose,
        }}>
        <Stack gap="lg">
          <Group gap="md">
            <Avatar color="green" radius="xl" size="lg"><CheckCircle2 size={23}/></Avatar>
            <Box>
              <Text c="white" fw={800}>Pedido #{toDeliver?.id}</Text>
              <Text size="sm" c={muted}>{toDeliver?.customerName || "Cliente"}</Text>
            </Box>
          </Group>
          <Text c="#f2e9f2" size="sm">
            ¿Confirmas que entregaste efectivamente el pedido al destinatario?
            Esta acción marcará el pedido como «Entregado».
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" disabled={changeStatus.isPending}
              onClick={() => setToDeliver(null)}>Cancelar</Button>
            <Button color="green" leftSection={<CheckCircle2 size={17}/>}
              loading={changeStatus.isPending}
              onClick={() => {
                if (toDeliver) changeStatus.mutate({ id: toDeliver.id, status: "DELIVERED" });
              }}>
              Confirmar entrega
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
