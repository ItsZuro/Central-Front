import { logoutFromServer } from "@/core/services/auth/logout";
import { orderService } from "@/core/services/order/order.service";
import { useOrderEvents } from "@/core/hooks/order/useOrderEvents";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { KitchenOrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Badge, Box, Button, Center, Divider, Group, Loader, Paper,
  SegmentedControl, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle, BellRing, CheckCheck, CheckCircle2, ChefHat, ClipboardList,
  Clock3, CookingPot, Flame, LayoutGrid, LogOut, PackageCheck, RefreshCw,
  Search, ShoppingBag, Sparkles, Truck, UtensilsCrossed, type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "./Kitchen.module.css";

type OrderScope = "ALL" | "DINE_IN" | "TAKE_AWAY" | "DELIVERY";
type KitchenTarget = "IN_PROGRESS" | "READY_FOR_PICKUP" | "COMPLETED";
type LaneKey = "confirmed" | "cooking" | "ready";

const activeCodes = new Set(["CONFIRMED", "IN_PROGRESS", "READY_FOR_PICKUP"]);
const muted = "#afa7b2";

function errorText(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "No se pudo conectar con el servidor de cocina.";
  }
  return error instanceof Error ? error.message : "Ocurrió un error al actualizar el pedido.";
}

function ageMinutes(date: string, now: number): number {
  const iso = /Z$|[+-]\d{2}:\d{2}$/.test(date) ? date : date + "-05:00";
  const createdAt = new Date(iso).getTime();
  return Number.isFinite(createdAt) ? Math.max(0, Math.floor((now - createdAt) / 60000)) : 0;
}

function minuteLabel(minutes: number): string {
  if (minutes < 1) return "Justo ahora";
  if (minutes < 60) return "Hace " + minutes + " min";
  const hours = Math.floor(minutes / 60);
  return "Hace " + hours + " h" + (minutes % 60 ? " " + (minutes % 60) + " min" : "");
}

function timeLabel(date: string) {
  const iso = /Z$|[+-]\d{2}:\d{2}$/.test(date) ? date : date + "-05:00";
  const value = new Date(iso);
  if (!Number.isFinite(value.getTime())) return "--:--";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(value);
}

function isUrgent(order: KitchenOrderResponse, now: number) {
  return ["CONFIRMED", "IN_PROGRESS"].includes(order.statusCode)
    && ageMinutes(order.date, now) >= 25;
}

function channelLabel(order: KitchenOrderResponse) {
  if (order.typeCode === "DINE_IN") return order.tableCode ? "Mesa " + order.tableCode : "Salón";
  if (order.typeCode === "DELIVERY") return "Delivery";
  return "Para llevar";
}

function ChannelIcon({ type }: { type: KitchenOrderResponse["typeCode"] }) {
  if (type === "DINE_IN") return <UtensilsCrossed size={14}/>;
  if (type === "DELIVERY") return <Truck size={14}/>;
  return <ShoppingBag size={14}/>;
}

function nextAction(order: KitchenOrderResponse): { code: KitchenTarget; label: string } | null {
  if (order.statusCode === "CONFIRMED") return {
    code: "IN_PROGRESS", label: "Iniciar preparación",
  };
  if (order.statusCode === "IN_PROGRESS") {
    return order.typeCode === "DINE_IN"
      ? { code: "COMPLETED", label: "Finalizar preparación" }
      : { code: "READY_FOR_PICKUP", label: "Marcar como listo" };
  }
  return null;
}

function Metric({
  label, value, subtitle, Icon, color,
}: { label: string; value: number; subtitle: string; Icon: LucideIcon; color: string }) {
  return (
    <Paper radius="xl" p="lg" className={styles.metric}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text c={muted} size="xs" fw={700}>{label}</Text>
        <ThemeIcon size={40} radius="md" variant="light" color={color}><Icon size={20}/></ThemeIcon>
      </Group>
      <Title order={2} c="white" mt="xs" fw={850}>{value}</Title>
      <Text size="xs" mt="xs" c="#9b939e">{subtitle}</Text>
    </Paper>
  );
}

function EmptyLane({ label }: { label: string }) {
  return (
    <Center className={styles.empty} p="xl" style={{ borderRadius: 14 }}>
      <Stack gap="xs" align="center" ta="center">
        <ThemeIcon size={44} radius="xl" color="gray" variant="light"><CheckCircle2 size={22}/></ThemeIcon>
        <Text c="white" size="sm" fw={750}>{label}</Text>
        <Text c={muted} size="xs">Los pedidos aparecerán aquí cuando cambie su estado.</Text>
      </Stack>
    </Center>
  );
}

function KitchenTicket({
  order, now, busy, onAdvance,
}: {
  order: KitchenOrderResponse;
  now: number;
  busy: boolean;
  onAdvance: (id: number, target: KitchenTarget) => void;
}) {
  const elapsed = ageMinutes(order.date, now);
  const urgent = isUrgent(order, now);
  const blocked = order.typeCode === "DELIVERY" && !order.paymentConfirmed;
  const action = nextAction(order);
  const notes = order.items.reduce((total, item) => total + (item.notes?.trim() ? 1 : 0), 0);
  return (
    <Paper radius="lg" p="md" className={styles.orderCard}>
      <Group justify="space-between" align="flex-start" gap="xs">
        <Box>
          <Group gap="xs">
            <Text fw={850} size="lg" c="white">Pedido #{order.id}</Text>
            {urgent && <Badge color="red" variant="filled" size="sm" leftSection={<Flame size={12}/>}>Prioritario</Badge>}
          </Group>
          <Group gap="xs" mt={6}>
            <Badge variant="outline" color="gray" leftSection={<ChannelIcon type={order.typeCode}/>}>
              {channelLabel(order)}
            </Badge>
            <Badge color={elapsed >= 25 ? "orange" : "gray"} variant="light" leftSection={<Clock3 size={12}/>}>
              {minuteLabel(elapsed)}
            </Badge>
          </Group>
        </Box>
        <Text size="xs" c={muted} fw={650}>{timeLabel(order.date)}</Text>
      </Group>

      <Divider my="md" color="#4a444d"/>
      <Stack gap="sm">
        {(order.items || []).length === 0 ? (
          <Text c={muted} size="sm">No hay productos registrados en este pedido.</Text>
        ) : order.items.map((item) => (
          <Box key={item.id} className={styles.itemLine}>
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon size={28} radius="sm" color="red" variant="light" fw={800}>
                {item.quantity}
              </ThemeIcon>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text c="#faf6fa" size="sm" fw={750}>{item.productName}</Text>
                {item.selectedExtras?.trim() && (
                  <Text size="xs" c="#d0b7c5" mt={4}>Adicionales: {item.selectedExtras}</Text>
                )}
                {item.notes?.trim() && (
                  <Box mt="xs" className={styles.note}>
                    <Text size="xs" fw={700} c="#ffe1b5">Nota de preparación</Text>
                    <Text size="xs" mt={3} c="#f4dec5" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                      {item.notes}
                    </Text>
                  </Box>
                )}
              </Box>
            </Group>
          </Box>
        ))}
      </Stack>

      <Group justify="space-between" mt="md" gap="xs">
        <Text size="xs" c={muted}>
          {order.items.reduce((n, item) => n + item.quantity, 0)} unidades
          {notes ? " · " + notes + " observación(es)" : ""}
        </Text>
        {order.statusCode === "READY_FOR_PICKUP" && <Badge color="green" variant="light">Listo para entrega</Badge>}
        {order.statusCode === "COMPLETED" && <Badge color="green" variant="light">Preparación terminada</Badge>}
      </Group>
      {blocked && action && (
        <Alert color="orange" mt="sm" icon={<AlertCircle size={16}/>} title="Pago pendiente">
          El delivery requiere pago confirmado antes de entrar a cocina.
        </Alert>
      )}
      {action && (
        <Button mt="md" fullWidth color={action.code === "IN_PROGRESS" ? "red" : "teal"}
          leftSection={action.code === "IN_PROGRESS" ? <CookingPot size={17}/> : <CheckCheck size={17}/>}
          disabled={blocked}
          loading={busy}
          onClick={() => onAdvance(order.id, action.code)}>
          {action.label}
        </Button>
      )}
    </Paper>
  );
}

function KitchenLane({
  lane, orders, now, busyId, onAdvance,
}: {
  lane: LaneKey;
  orders: KitchenOrderResponse[];
  now: number;
  busyId: number | null;
  onAdvance: (id: number, target: KitchenTarget) => void;
}) {
  const info = {
    confirmed: { label: "Por preparar", hint: "Pedidos confirmados", color: "orange",
      Icon: ClipboardList, empty: "Sin pedidos pendientes" },
    cooking: { label: "En preparación", hint: "Pedidos en cocina", color: "blue",
      Icon: CookingPot, empty: "Cocina al día" },
    ready: { label: "Listos", hint: "Para entregar o finalizados hoy", color: "green",
      Icon: PackageCheck, empty: "Todavía no hay pedidos listos" },
  }[lane];
  return (
    <Paper radius="xl" p="md" className={styles.lane}>
      <Group className={styles.laneHeader} justify="space-between" align="center">
        <Group gap="xs">
          <ThemeIcon color={info.color} size={35} radius="md" variant="light">
            <info.Icon size={19}/>
          </ThemeIcon>
          <Box>
            <Text c="white" fw={800}>{info.label}</Text>
            <Text c={muted} size="xs">{info.hint}</Text>
          </Box>
        </Group>
        <Badge color={info.color} variant="light" size="lg" radius="xl">{orders.length}</Badge>
      </Group>
      <Stack gap="md" mt="md">
        {orders.length ? orders.map((order) => (
          <KitchenTicket key={order.id} order={order} now={now}
            busy={busyId === order.id} onAdvance={onAdvance}/>
        )) : <EmptyLane label={info.empty}/>}
      </Stack>
    </Paper>
  );
}

export default function Orders() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  useOrderEvents(() => {
    void queryClient.invalidateQueries({ queryKey: ["kitchen", "board"] });
  });
  const [scope, setScope] = useState<OrderScope>("ALL");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const board = useQuery({
    queryKey: ["kitchen", "board"],
    queryFn: async () => {
      const result = await orderService.getKitchenBoard();
      if (!result.success) throw new Error(result.message || "Error al consultar cocina.");
      return result.data || [];
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const advance = useMutation({
    mutationFn: (action: { id: number; target: KitchenTarget }) =>
      orderService.advanceKitchenOrder(action.id, action.target),
    onSuccess: async (response) => {
      if (!response.success) throw new Error(response.message || "No se pudo actualizar el pedido.");
      toast.success("Pedido #" + response.data.id + " actualizado.");
      await queryClient.invalidateQueries({ queryKey: ["kitchen", "board"] });
    },
    onError: (error: unknown) => {
      toast.error(errorText(error));
      void queryClient.invalidateQueries({ queryKey: ["kitchen", "board"] });
    },
  });

  const list = board.data || [];
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return list.filter((order) => {
      if (scope !== "ALL" && order.typeCode !== scope) return false;
      if (!text) return true;
      return [
        String(order.id),
        order.tableCode || "",
        channelLabel(order),
        ...order.items.flatMap((item) => [item.productName, item.notes || "", item.selectedExtras || ""]),
      ].join(" ").toLowerCase().includes(text);
    });
  }, [list, scope, search]);
  const pending = visible.filter((item) => item.statusCode === "CONFIRMED");
  const cooking = visible.filter((item) => item.statusCode === "IN_PROGRESS");
  const ready = visible.filter((item) => ["READY_FOR_PICKUP", "COMPLETED", "DELIVERED"].includes(item.statusCode));
  const active = list.filter((item) => activeCodes.has(item.statusCode));
  const urgentCount = active.filter((order) => isUrgent(order, now)).length;
  const busyId = advance.isPending ? advance.variables?.id ?? null : null;

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logoutFromServer(); }
    finally { navigate("/auth/login", { replace: true }); setLoggingOut(false); }
  };

  return (
    <Box className={styles.root}>
      <Box className={styles.header}>
        <Box maw={1550} mx="auto" px={{ base: "md", md: "xl" }} py="lg">
          <Group justify="space-between" align="center" wrap="wrap" gap="lg">
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={55} radius="lg" color="red" variant="filled"><ChefHat size={30}/></ThemeIcon>
              <Box>
                <Text size="xs" c="#fc6677" fw={850} tt="uppercase" lts={1.8}>
                  Restaurant Central / Personal
                </Text>
                <Title order={1} fw={850} c="white" mt={3}>Panel de cocina</Title>
                <Text c={muted} mt={3} size="sm">
                  {user?.fullName || user?.username || "Personal de cocina"} · Preparación de pedidos
                </Text>
              </Box>
            </Group>
            <Group gap="xs">
              <Button variant="default" leftSection={<RefreshCw size={17}/>}
                loading={board.isFetching} onClick={() => void board.refetch()}>Actualizar</Button>
              <Button variant="subtle" leftSection={<LogOut size={17}/>}
                loading={loggingOut} onClick={() => void logout()}>Salir</Button>
            </Group>
          </Group>
        </Box>
      </Box>

      <Box maw={1550} mx="auto" px={{ base: "md", md: "xl" }} py="xl">
        <Paper className={styles.hero} radius="xl" p={{ base: "lg", md: "xl" }}>
          <Box className={styles.heroContent}>
            <Group justify="space-between" align="center" gap="md">
              <Box>
                <Group gap="xs" mb="sm"><Sparkles size={18} color="#f7a4ad"/>
                  <Text c="#f7a4ad" fw={850} size="xs" tt="uppercase" lts={1.6}>Centro de producción</Text>
                </Group>
                <Title order={2} c="white" fw={850}>Pedidos listos para cocinar, sin complicaciones</Title>
                <Text c="#e4d6de" size="sm" mt="sm" maw={660} lh={1.65}>
                  Revisa comandas, observaciones y tiempos. Inicia la preparación y marca los platos cuando estén listos.
                </Text>
              </Box>
              <Badge variant="light" color="red" size="lg" leftSection={<RefreshCw size={12}/>}>
                Actualización cada 15 s
              </Badge>
            </Group>
          </Box>
        </Paper>

        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mt="lg">
          <Metric label="Por preparar" value={list.filter((x) => x.statusCode === "CONFIRMED").length}
            subtitle="Confirmados y en cola" Icon={BellRing} color="orange"/>
          <Metric label="En preparación" value={list.filter((x) => x.statusCode === "IN_PROGRESS").length}
            subtitle="Comandas en cocina" Icon={CookingPot} color="blue"/>
          <Metric label="Listos / finalizados" value={list.filter((x) =>
            ["READY_FOR_PICKUP","COMPLETED","DELIVERED"].includes(x.statusCode)).length}
            subtitle="Incluye los finalizados hoy" Icon={CheckCircle2} color="green"/>
          <Metric label="Atención prioritaria" value={urgentCount}
            subtitle="Más de 25 min desde el pedido" Icon={Flame} color="red"/>
        </SimpleGrid>

        <Group justify="space-between" align="flex-end" mt="xl" mb="md" gap="md">
          <Box>
            <Group gap="xs"><LayoutGrid size={20} color="#ee5668"/>
              <Title order={2} c="white" size="h3">Tablero de comandas</Title>
            </Group>
            <Text c={muted} size="xs" mt={5}>La información se actualiza sin recargar la página.</Text>
          </Box>
          <Badge variant="outline" color="gray">Hora local: Perú (UTC−5)</Badge>
        </Group>
        <Group gap="md" mb="lg" justify="space-between" align="center" wrap="wrap">
          <SegmentedControl value={scope} color="red" onChange={(value) => setScope(value as OrderScope)}
            data={[
              { value: "ALL", label: "Todos" },
              { value: "DINE_IN", label: "Salón" },
              { value: "TAKE_AWAY", label: "Para llevar" },
              { value: "DELIVERY", label: "Delivery" },
            ]}/>
          <TextInput value={search} onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder="Buscar pedido, mesa o plato"
            aria-label="Buscar comandas" leftSection={<Search size={17}/>}
            classNames={{ input: styles.filterInput }} w={{ base: "100%", sm: 310 }}/>
        </Group>

        {board.isError && (
          <Alert color="red" title="No se pudo consultar cocina" icon={<AlertCircle size={19}/>} mb="lg">
            {errorText(board.error)}
            <Button size="xs" mt="sm" variant="light" color="red"
              onClick={() => void board.refetch()}>Reintentar</Button>
          </Alert>
        )}
        {board.isPending ? (
          <Center py={90}><Stack align="center" gap="sm"><Loader color="red"/>
            <Text c={muted} size="sm">Cargando comandas de cocina...</Text></Stack></Center>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <KitchenLane lane="confirmed" orders={pending} now={now} busyId={busyId}
              onAdvance={(id, target) => advance.mutate({ id, target })}/>
            <KitchenLane lane="cooking" orders={cooking} now={now} busyId={busyId}
              onAdvance={(id, target) => advance.mutate({ id, target })}/>
            <KitchenLane lane="ready" orders={ready} now={now} busyId={busyId}
              onAdvance={(id, target) => advance.mutate({ id, target })}/>
          </SimpleGrid>
        )}
        <Paper mt="lg" p="md" radius="lg" className={styles.metric}>
          <Group align="flex-start" gap="sm">
            <ThemeIcon color="gray" variant="light" radius="md"><ChefHat size={17}/></ThemeIcon>
            <Box style={{ flex: 1 }}>
              <Text c="white" fw={750} size="sm">Acceso exclusivo de cocina</Text>
              <Text c={muted} size="xs" mt={4} lh={1.6}>
                Aquí solo se actualiza la preparación. El cobro se gestiona en caja,
                las mesas y reservas en sala y los repartos con el personal de delivery.
                Pedidos pendientes de confirmación o cancelados no ingresan a la cola de preparación.
              </Text>
            </Box>
          </Group>
        </Paper>
      </Box>
    </Box>
  );
}
