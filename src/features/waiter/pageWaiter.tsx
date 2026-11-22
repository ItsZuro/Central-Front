import { api } from "@/core/api/api";
import { logoutFromServer } from "@/core/services/auth/logout";
import { orderService } from "@/core/services/order/order.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { OrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Badge, Box, Button, Center, Divider, Grid, Group, Loader, Paper,
  Pagination, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack,
  Tabs, Text, TextInput, ThemeIcon, Title, UnstyledButton,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle, ArrowLeft, ArrowRight, BellRing, CalendarDays, CheckCircle2,
  ChefHat, ClipboardList, Clock3, Coffee, LayoutDashboard, LogOut, MapPin,
  RefreshCw, Search, Sparkles, Truck, Users, UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import NewDineInOrder from "./NewDineInOrder";
import styles from "./Waiter.module.css";

type Section = "dashboard" | "orders" | "tables" | "reservations";
type OrderScope = "room" | "other" | "all";
type ReservationScope = "active" | "all";

type RestaurantTable = {
  id: number;
  code: string;
  alias?: string | null;
  capacity: number;
  status: string;
  activeOrderId?: number | null;
};

type Reservation = {
  id: number;
  customerId: number;
  customerName: string;
  tableId: number;
  tableNumber: string;
  contactName: string;
  contactPhone: string;
  reservationDate: string;
  reservationTime: string;
  numberOfPeople: number;
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
};

type Paged<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  pageNumber: number;
};

const terminal = new Set(["COMPLETED", "DELIVERED", "CANCELLED", "FAILED", "REFUNDED"]);
const activeReservation = (reservation: Reservation) =>
  reservation.status === "CONFIRMED" || reservation.status === "PENDING";
const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

const muted = "#aba6b1";
const inputClasses = { input: styles.fieldInput, label: styles.fieldLabel };

function limaNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const p = (type: string) => parts.find((value) => value.type === type)?.value || "00";
  return { date: p("year") + "-" + p("month") + "-" + p("day"), time: p("hour") + ":" + p("minute") };
}

function prettyDate(date: string) {
  return date.split("-").reverse().join("/");
}

function isRoomOrder(order: OrderResponse) {
  return order.tableId != null || /presencial|dine[\s_-]?in/i.test(order.typeName || "");
}

function statusLabel(code: string) {
  const labels: Record<string, string> = {
    PENDING_CONFIRMATION: "Por confirmar",
    PENDING: "Pendiente",
    CONFIRMED: "Confirmado",
    IN_PROGRESS: "En preparación",
    READY_FOR_PICKUP: "Listo para recoger",
    OUT_FOR_DELIVERY: "En camino",
    DELIVERED: "Entregado",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
    FAILED: "Fallido",
    REFUNDED: "Reembolsado",
    OCCUPIED: "Ocupada",
    FREE: "Libre",
    RESERVED: "Reservada",
  };
  return labels[code] || code.replace(/_/g, " ");
}

function orderChannel(order: OrderResponse) {
  if (isRoomOrder(order)) return "Salón";
  if (order.deliveryStreet || /delivery|domicilio/i.test(order.typeName || "")) return "Delivery";
  if (order.pickupStoreId != null || /llevar|take.away/i.test(order.typeName || "")) return "Para llevar";
  return order.typeName || "Pedido";
}

function StatusPill({ status }: { status: string }) {
  const color = ["FREE", "CONFIRMED", "DELIVERED"].includes(status)
    ? "green" : ["IN_PROGRESS", "OCCUPIED"].includes(status)
      ? "yellow" : ["RESERVED", "OUT_FOR_DELIVERY"].includes(status)
        ? "cyan" : terminal.has(status) ? "gray" : "red";
  return <Badge variant="light" color={color} radius="xl">{statusLabel(status)}</Badge>;
}

function Empty({ Icon, title, detail }: { Icon: LucideIcon; title: string; detail: string }) {
  return (
    <Center py={45} style={{ border: "1px dashed #514c54", borderRadius: 14, background: "#252429" }}>
      <Stack align="center" gap="xs" px="md">
        <ThemeIcon variant="light" color="gray" radius="xl" size={46}><Icon size={24} /></ThemeIcon>
        <Text fw={750} c="white" ta="center">{title}</Text>
        <Text c={muted} size="xs" ta="center" maw={340} lh={1.6}>{detail}</Text>
      </Stack>
    </Center>
  );
}

function Metric({
  label, value, hint, Icon, color = "red",
}: { label: string; value: number | string; hint: string; Icon: LucideIcon; color?: string }) {
  return (
    <Paper p="lg" radius="xl" className={styles.metric}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Text size="xs" c={muted} fw={650}>{label}</Text>
        <ThemeIcon size={40} color={color} radius="md" variant="light"><Icon size={20}/></ThemeIcon>
      </Group>
      <Title order={2} mt="xs" c="white" fw={850}>{value}</Title>
      <Text c="#898590" mt="xs" size="xs">{hint}</Text>
    </Paper>
  );
}

function OrderCard({ order, compact = false }: { order: OrderResponse; compact?: boolean }) {
  return (
    <Paper p="lg" radius="xl" className={styles.orderCard}>
      <Group justify="space-between" align="flex-start" gap="sm">
        <Box>
          <Group gap="xs" mb={6}>
            <Text c="white" fw={800}>Pedido #{order.id}</Text>
            <Badge variant="outline" color="gray" size="sm">{orderChannel(order)}</Badge>
          </Group>
          <Text c={muted} size="xs">
            {order.tableCode ? "Mesa " + order.tableCode + " · " : ""}
            {order.customerName || "Cliente sin nombre"}
          </Text>
        </Box>
        <StatusPill status={order.statusCode}/>
      </Group>
      {!compact && (order.details?.length ?? 0) > 0 ? (
        <>
          <Divider my="md" color="#45414a"/>
          <Stack gap="xs">
            {order.details.map((detail) => (
              <Group key={detail.id} justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                <Box style={{ flex: 1 }}>
                  <Text c="#eeeaf0" size="sm">{detail.quantity} × {detail.productName}</Text>
                  {detail.notes && <Text c={muted} size="xs">{detail.notes}</Text>}
                </Box>
                <Text c="#cbc4cd" size="xs">{money.format(detail.unitPrice * detail.quantity)}</Text>
              </Group>
            ))}
          </Stack>
        </>
      ) : (
        <Text c={muted} mt="md" size="xs">
          {order.details?.length || 0} {(order.details?.length || 0) === 1 ? "producto" : "productos"} en el pedido
        </Text>
      )}
      <Divider my="md" color="#45414a"/>
      <Group justify="space-between">
        <Text c={muted} size="xs">
          Pago: {order.paymentStatus === "CONFIRMED" ? "Confirmado" :
            order.paymentStatus === "PENDING" ? "Pendiente" :
            order.paymentStatus ? statusLabel(order.paymentStatus) : "Sin información"}
        </Text>
        <Text c="white" fw={800} size="sm">{money.format(order.total || 0)}</Text>
      </Group>
    </Paper>
  );
}

function ReservationCard({ reservation }: { reservation: Reservation }) {
  return (
    <Paper p="lg" radius="xl" className={styles.orderCard}>
      <Group justify="space-between" align="flex-start">
        <Box>
          <Text c="#f18d9b" size="xs" tt="uppercase" fw={800}>Reserva #{reservation.id}</Text>
          <Title order={4} c="white" mt={4}>
            {reservation.contactName || reservation.customerName || "Cliente sin nombre"}
          </Title>
        </Box>
        <StatusPill status={reservation.status}/>
      </Group>
      <Divider my="md" color="#45414a"/>
      <SimpleGrid cols={2} spacing="sm">
        <Group gap="xs" wrap="nowrap"><Clock3 size={16} color="#e68a97"/><Text c="white" size="sm">{reservation.reservationTime.slice(0, 5)}</Text></Group>
        <Group gap="xs" wrap="nowrap"><Users size={16} color="#e68a97"/><Text c="white" size="sm">{reservation.numberOfPeople} personas</Text></Group>
        <Group gap="xs" wrap="nowrap"><MapPin size={16} color="#e68a97"/><Text c="white" size="sm">Mesa {reservation.tableNumber || "por confirmar"}</Text></Group>
        <Text c={muted} size="xs">{reservation.contactPhone || "Sin teléfono de contacto"}</Text>
      </SimpleGrid>
    </Paper>
  );
}

async function fetchReservations(date: string, page: number) {
  const response = await api.get<ApiResponse<Paged<Reservation>>>("/reservations/filter", {
    params: { startDate: date, endDate: date, page, size: 100, sort: "reservationTime,asc" },
  });
  if (!response.data.success) throw new Error(response.data.message || "No se pudieron cargar las reservas.");
  return response.data.data;
}

export default function WaiterApp() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const today = limaNow().date;
  const [section, setSection] = useState<Section>("dashboard");
  const [orderScope, setOrderScope] = useState<OrderScope>("room");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatus, setOrderStatus] = useState<string | null>("ALL");
  const [selectedDate, setSelectedDate] = useState(today);
  const [reservationPage, setReservationPage] = useState(0);
  const [reservationScope, setReservationScope] = useState<ReservationScope>("active");
  const [loggingOut, setLoggingOut] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ["waiter", "orders"],
    queryFn: async () => {
      const response = await orderService.getAllOrders("es");
      if (!response.success) throw new Error(response.message);
      return response.data ?? [];
    },
    refetchInterval: 15_000,
  });
  const tablesQuery = useQuery({
    queryKey: ["waiter", "tables"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<RestaurantTable[]>>("/tables");
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data ?? [];
    },
    refetchInterval: 15_000,
  });
  const todayReservations = useQuery({
    queryKey: ["waiter", "reservations", today, 0],
    queryFn: () => fetchReservations(today, 0),
    refetchInterval: 60_000,
  });
  const dailyReservations = useQuery({
    queryKey: ["waiter", "reservations", selectedDate, reservationPage],
    queryFn: () => fetchReservations(selectedDate, reservationPage),
    refetchInterval: 60_000,
  });

  const orders = useMemo(() => ordersQuery.data ?? [], [ordersQuery.data]);
  const tables = tablesQuery.data ?? [];
  const activeRoomOrders = orders.filter((order) => isRoomOrder(order) && !terminal.has(order.statusCode));
  const occupiedTables = tables.filter((table) => table.status === "OCCUPIED");
  const freeTables = tables.filter((table) => table.status === "FREE");
  const activeToday = (todayReservations.data?.content ?? []).filter(activeReservation);
  const upcoming = activeToday.filter((r) => r.reservationTime.slice(0, 5) >= limaNow().time)
    .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime));

  const statuses = useMemo(
    () => Array.from(new Set(orders.map((order) => order.statusCode))).sort(), [orders]
  );
  const filteredOrders = useMemo(() => {
    const search = orderSearch.trim().toLocaleLowerCase("es");
    return orders.filter((order) =>
      (orderScope === "all" || (orderScope === "room" ? isRoomOrder(order) : !isRoomOrder(order))) &&
      (orderStatus === "ALL" || orderStatus === order.statusCode) &&
      (!search || String(order.id).includes(search) ||
        (order.customerName || "").toLocaleLowerCase("es").includes(search) ||
        (order.tableCode || "").toLocaleLowerCase("es").includes(search))
    ).sort((a, b) => b.id - a.id);
  }, [orders, orderSearch, orderScope, orderStatus]);

  const daily = (dailyReservations.data?.content ?? [])
    .filter((reservation) => reservationScope === "all" || activeReservation(reservation))
    .sort((a, b) => a.reservationTime.localeCompare(b.reservationTime));

  const reload = () => {
    void ordersQuery.refetch();
    void tablesQuery.refetch();
    void todayReservations.refetch();
    void dailyReservations.refetch();
  };
  const onCreated = () => {
    reload();
    setOrderSearch("");
    setOrderStatus("ALL");
    setOrderScope("room");
    setSection("orders");
  };
  const viewOrder = (id: number) => {
    setOrderSearch(String(id));
    setOrderStatus("ALL");
    setOrderScope("room");
    setSection("orders");
  };
  const logout = async () => {
    setLoggingOut(true);
    try {
      await logoutFromServer();
    } finally {
      setLoggingOut(false);
      navigate("/auth/login", { replace: true });
    }
  };
  const fetching = ordersQuery.isFetching || tablesQuery.isFetching ||
    todayReservations.isFetching || dailyReservations.isFetching;

  return (
    <Box className={styles.root} pb={70}>
      <Box component="header" className={styles.header}>
        <Box maw={1430} mx="auto" px={{ base: "md", sm: "xl" }} py="lg">
          <Group justify="space-between" gap="md" wrap="wrap">
            <Group gap="md">
              <ThemeIcon color="red" variant="filled" size={51} radius="lg"><UtensilsCrossed size={23}/></ThemeIcon>
              <Stack gap={3}>
                <Text size="xs" fw={800} c="#ff6d7a" tt="uppercase" lts={2}>Restaurant Central / Personal</Text>
                <Title order={2} c="white" fw={850}>Panel del mesero</Title>
                <Text c={muted} size="xs">{user?.fullName?.trim() || user?.username || "Personal del restaurante"} · Atención de sala</Text>
              </Stack>
            </Group>
            <Group gap="xs">
              <Button variant="default" color="gray" leftSection={<RefreshCw size={17}/>}
                loading={fetching} onClick={reload}>Actualizar</Button>
              <Button variant="subtle" color="gray" leftSection={<LogOut size={17}/>}
                loading={loggingOut} onClick={() => void logout()}>Salir</Button>
            </Group>
          </Group>
        </Box>
      </Box>

      <Box maw={1430} mx="auto" px={{ base: "md", sm: "xl" }} pt="xl">
        <Group justify="space-between" align="flex-start" gap="md" mb="lg" wrap="wrap">
          <ScrollArea type="auto" scrollbarSize={5} style={{ maxWidth: "100%" }}>
            <Group gap="xs" wrap="nowrap" pb={5}>
              <Tabs value={section} onChange={(value) => { if (value) setSection(value as Section); }}
                color="red" variant="pills" keepMounted={false}>
                <Tabs.List>
                  <Tabs.Tab value="dashboard" leftSection={<LayoutDashboard size={17}/>}>Resumen</Tabs.Tab>
                  <Tabs.Tab value="orders" leftSection={<ClipboardList size={17}/>}>Pedidos</Tabs.Tab>
                  <Tabs.Tab value="tables" leftSection={<Users size={17}/>}>Mesas</Tabs.Tab>
                  <Tabs.Tab value="reservations" leftSection={<CalendarDays size={17}/>}>Reservas</Tabs.Tab>
                </Tabs.List>
              </Tabs>
              <Button component={Link} to="/driver" variant="light" color="red" size="sm" leftSection={<Truck size={17}/>}>
                Mis repartos
              </Button>
            </Group>
          </ScrollArea>
          <Button component={Link} to="/" variant="subtle" color="gray" size="xs"
            leftSection={<ArrowLeft size={15}/>}>Volver al restaurante</Button>
        </Group>

        {(ordersQuery.isError || tablesQuery.isError || todayReservations.isError ||
          (section === "reservations" && dailyReservations.isError)) && (
          <Alert icon={<AlertCircle size={18}/>} color="red" title="No se pudieron cargar algunos datos" mb="lg">
            <Stack gap={3}>
              {ordersQuery.isError && <Text size="sm">No se pudieron consultar los pedidos.</Text>}
              {tablesQuery.isError && <Text size="sm">No se pudieron consultar las mesas.</Text>}
              {todayReservations.isError && <Text size="sm">No se pudieron consultar las reservas de hoy.</Text>}
              {section === "reservations" && dailyReservations.isError && selectedDate !== today &&
                <Text size="sm">No se pudieron consultar las reservas seleccionadas.</Text>}
              <Button size="xs" variant="light" color="red" mt="xs" onClick={reload}>Reintentar</Button>
            </Stack>
          </Alert>
        )}

        {section === "dashboard" && (
          <Stack gap="xl">
            <Paper className={styles.hero} p={{ base: "lg", sm: "xl" }} radius="xl">
              <Group justify="space-between" align="center" className={styles.heroContent} gap="xl">
                <Box maw={640}>
                  <Group gap="xs" mb="xs"><Sparkles size={17} color="#ff98a3"/>
                    <Text c="#ff9aa7" tt="uppercase" fw={800} size="xs" lts={1.3}>Centro de operaciones</Text>
                  </Group>
                  <Title order={1} c="white" fw={850} size="h2">Todo listo para atender el salón</Title>
                  <Text c="#d7cbd0" mt="sm" size="sm" lh={1.7}>
                    Consulta mesas, registra pedidos presenciales y revisa las próximas reservas en un solo lugar.
                  </Text>
                </Box>
                <Group gap="sm">
                  <NewDineInOrder onCreated={onCreated} label="Nuevo pedido"/>
                  <Button variant="default" leftSection={<Users size={17}/>}
                    onClick={() => setSection("tables")}>Ver mesas</Button>
                </Group>
              </Group>
            </Paper>

            <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md">
              <Metric label="Mesas ocupadas" value={tablesQuery.isPending || tablesQuery.isError ? "—" : occupiedTables.length}
                hint="Situación actual" Icon={Users} color="orange"/>
              <Metric label="Pedidos en sala" value={ordersQuery.isPending || ordersQuery.isError ? "—" : activeRoomOrders.length}
                hint="Pedidos presenciales activos" Icon={ClipboardList} color="red"/>
              <Metric label="En preparación" value={ordersQuery.isPending || ordersQuery.isError ? "—" :
                activeRoomOrders.filter((order) => order.statusCode === "IN_PROGRESS").length}
                hint="Pedidos de sala en cocina" Icon={ChefHat} color="blue"/>
              <Metric label="Reservas de hoy" value={todayReservations.isPending || todayReservations.isError ? "—" : activeToday.length}
                hint="Pendientes o confirmadas" Icon={CalendarDays} color="green"/>
            </SimpleGrid>

            <Grid gutter="lg">
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Stack gap="lg">
                  <Paper withBorder className={styles.panel} p="lg" radius="xl">
                    <Group justify="space-between" align="flex-start" mb="lg" gap="sm">
                      <Box>
                        <Title order={3} c="white" size="lg">Pedidos activos de sala</Title>
                        <Text size="xs" c={muted} mt={5}>Delivery y para llevar se consultan en otra pestaña.</Text>
                      </Box>
                      <Button size="xs" variant="subtle" color="red" rightSection={<ArrowRight size={15}/>}
                        onClick={() => {setOrderScope("room");setOrderSearch("");setSection("orders");}}>Ver todos</Button>
                    </Group>
                    {ordersQuery.isPending ? <Center py="lg"><Loader size="sm" color="red"/></Center> :
                      ordersQuery.isError ? <Empty Icon={AlertCircle} title="No se pudieron cargar los pedidos" detail="Pulsa Actualizar para intentarlo de nuevo."/> :
                      activeRoomOrders.length === 0 ?
                        <Empty Icon={Coffee} title="Salón sin pedidos activos" detail="Los nuevos pedidos registrados en mesa aparecerán aquí."/> :
                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                          {[...activeRoomOrders].sort((a, b) => b.id - a.id).slice(0, 4).map((order) =>
                            <OrderCard key={order.id} order={order} compact/> )}
                        </SimpleGrid>}
                  </Paper>

                  <Paper withBorder className={styles.panel} p="lg" radius="xl">
                    <Group justify="space-between" align="flex-start" mb="lg">
                      <Box>
                        <Title order={3} c="white" size="lg">Estado del salón</Title>
                        <Text c={muted} size="xs" mt={5}>Disponibilidad de mesas actualizada desde el servidor.</Text>
                      </Box>
                      <Button size="xs" variant="subtle" color="red" onClick={() => setSection("tables")}>Ver mesas</Button>
                    </Group>
                    {tablesQuery.isPending ? <Center py="lg"><Loader size="sm" color="red"/></Center> :
                      tablesQuery.isError ? <Empty Icon={AlertCircle} title="Error de conexión" detail="No se pudo consultar el estado de mesas."/> :
                      tables.length === 0 ? <Empty Icon={Users} title="Sin mesas registradas" detail="Las mesas configuradas aparecerán aquí."/> :
                        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
                          {tables.slice(0, 6).map((table) => (
                            <UnstyledButton key={table.id} p="md" className={styles.boardCell}
                              onClick={() => setSection("tables")}>
                              <Group justify="space-between" align="flex-start" gap="xs">
                                <Text fw={750} c="white" size="sm">Mesa {table.alias || table.code || table.id}</Text>
                                <Badge size="xs" variant="dot" color={table.status === "FREE" ? "green" : table.status === "OCCUPIED" ? "yellow" : "blue"}>
                                  {statusLabel(table.status)}
                                </Badge>
                              </Group>
                              <Text c={muted} mt="sm" size="xs">{table.capacity} personas</Text>
                            </UnstyledButton>
                          ))}
                        </SimpleGrid>}
                  </Paper>
                </Stack>
              </Grid.Col>
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <Stack gap="lg">
                  <Paper withBorder className={styles.panel} p="lg" radius="xl">
                    <Group mb="sm" gap="xs">
                      <BellRing size={19} color="#f48a98"/>
                      <Title order={3} c="white" size="lg">Avisos de sala</Title>
                    </Group>
                    <Text c={muted} size="xs" lh={1.6} mb="md">
                      Alertas basadas en los pedidos y reservas registrados.
                    </Text>
                    {ordersQuery.isPending || todayReservations.isPending ? <Loader color="red" size="sm"/> : (
                      <Stack gap="sm">
                        {activeRoomOrders.filter((order) =>
                          ["PENDING", "PENDING_CONFIRMATION"].includes(order.statusCode))
                          .slice(0, 2).map((order) => (
                            <UnstyledButton key={"pending-" + order.id} className={styles.actionCard} p="sm"
                              onClick={() => viewOrder(order.id)}>
                              <Group align="flex-start" wrap="nowrap" gap="sm">
                                <ThemeIcon variant="light" color="yellow"><Clock3 size={17}/></ThemeIcon>
                                <Box>
                                  <Text c="white" fw={750} size="sm">Pedido #{order.id} por confirmar</Text>
                                  <Text c={muted} size="xs" mt={4}>Revisa el pedido y coordina el cobro con caja.</Text>
                                </Box>
                              </Group>
                            </UnstyledButton>
                          ))}
                        {upcoming.slice(0, 2).map((reservation) => (
                          <UnstyledButton key={"reservation-" + reservation.id} className={styles.actionCard} p="sm"
                            onClick={() => setSection("reservations")}>
                            <Group wrap="nowrap" align="flex-start" gap="sm">
                              <ThemeIcon color="cyan" variant="light"><CalendarDays size={17}/></ThemeIcon>
                              <Box>
                                <Text c="white" size="sm" fw={750}>Reserva #{reservation.id} · {reservation.reservationTime.slice(0, 5)}</Text>
                                <Text c={muted} size="xs" mt={4}>
                                  {reservation.contactName || reservation.customerName} · {reservation.numberOfPeople} personas
                                </Text>
                              </Box>
                            </Group>
                          </UnstyledButton>
                        ))}
                        {activeRoomOrders.filter((order) => ["PENDING", "PENDING_CONFIRMATION"].includes(order.statusCode)).length === 0 &&
                          upcoming.length === 0 && (
                            <Text c={muted} size="xs" p="md" style={{background:"#29272e", borderRadius:10}}>
                              No hay avisos de sala pendientes por ahora.
                            </Text>
                          )}
                      </Stack>
                    )}
                  </Paper>
                  <Paper withBorder className={styles.panel} p="lg" radius="xl">
                    <Group justify="space-between" gap="xs" mb="md">
                      <Title order={3} size="lg" c="white">Próximas reservas</Title>
                      <Button variant="subtle" color="red" size="xs" onClick={() => setSection("reservations")}>Ver agenda</Button>
                    </Group>
                    {todayReservations.isPending ? <Loader color="red" size="sm"/> :
                      todayReservations.isError ? <Text c={muted} size="sm">No se pudieron consultar las reservas.</Text> :
                      upcoming.length === 0 ? <Text c={muted} size="sm">No hay más llegadas previstas para hoy.</Text> :
                        <Stack gap="sm">
                          {upcoming.slice(0, 4).map((reservation) => (
                            <Paper key={reservation.id} p="sm" radius="lg" bg="#2b2930">
                              <Group justify="space-between" wrap="nowrap" align="center">
                                <ThemeIcon variant="light" color="red"><CalendarDays size={17}/></ThemeIcon>
                                <Box style={{flex:1,minWidth:0}}>
                                  <Text c="white" fw={700} size="sm" truncate>
                                    {reservation.contactName || reservation.customerName}
                                  </Text>
                                  <Text size="xs" c={muted} mt={3}>
                                    Mesa {reservation.tableNumber || "por asignar"} · {reservation.numberOfPeople} personas
                                  </Text>
                                </Box>
                                <Text c="#f3a0aa" fw={800} size="sm">{reservation.reservationTime.slice(0, 5)}</Text>
                              </Group>
                            </Paper>
                          ))}
                        </Stack>}
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>
          </Stack>
        )}

        {section === "orders" && (
          <Stack gap="lg">
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Box>
                <Text size="xs" c="#f08d9a" tt="uppercase" fw={800} lts={1.3}>Servicio / Pedidos</Text>
                <Title order={2} c="white" fw={850} mt={5}>Pedidos del restaurante</Title>
                <Text size="sm" c={muted} mt={5}>El salón se consulta primero. Cocina prepara y caja registra los pagos.</Text>
              </Box>
              <NewDineInOrder onCreated={onCreated} label="Nuevo pedido"/>
            </Group>
            <Group justify="space-between" gap="md">
              <SegmentedControl
                value={orderScope}
                onChange={(value) => {setOrderScope(value as OrderScope);setOrderSearch("");}}
                data={[
                  {value:"room",label:"Salón"},
                  {value:"other",label:"Otros canales"},
                  {value:"all",label:"Todos"},
                ]}
                color="red"
              />
              <Text size="xs" c={muted}>{filteredOrders.length} pedidos visibles</Text>
            </Group>
            <SimpleGrid cols={{base:1,sm:2}} spacing="sm">
              <TextInput aria-label="Buscar pedidos" placeholder="Buscar pedido, cliente o mesa..."
                leftSection={<Search size={17}/>} value={orderSearch}
                onChange={(event) => setOrderSearch(event.currentTarget.value)}
                classNames={inputClasses}/>
              <Select aria-label="Filtrar estado de pedido" value={orderStatus} onChange={setOrderStatus}
                data={[
                  {value:"ALL",label:"Todos los estados"},
                  ...statuses.map((status) => ({value:status,label:statusLabel(status)})),
                ]}
                clearable={false}
                classNames={{...inputClasses,dropdown:styles.dropdown,option:styles.option}}
                comboboxProps={{withinPortal:false}}
              />
            </SimpleGrid>
            {ordersQuery.isPending ? <Center py="xl"><Loader color="red"/></Center> :
              ordersQuery.isError ? <Empty Icon={AlertCircle} title="No se pudieron cargar los pedidos" detail="Comprueba la conexión y pulsa Actualizar."/> :
              filteredOrders.length === 0 ?
                <Empty Icon={ClipboardList} title="No hay pedidos con estos filtros" detail="Puedes registrar un pedido presencial o cambiar la búsqueda."/> :
                <SimpleGrid cols={{base:1,md:2}} spacing="md">
                  {filteredOrders.map((order) => <OrderCard order={order} key={order.id}/>)}
                </SimpleGrid>}
            <Text c={muted} size="xs">Pedidos reales del servidor, actualizados cada 15 segundos. Los cobros se gestionan desde caja.</Text>
          </Stack>
        )}

        {section === "tables" && (
          <Stack gap="lg">
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Box>
                <Text c="#f08d9a" size="xs" fw={800} tt="uppercase" lts={1.3}>Servicio / Salón</Text>
                <Title order={2} c="white" fw={850} mt={5}>Mesas del restaurante</Title>
                <Text c={muted} mt={5} size="sm">Consulta la disponibilidad y registra pedidos en mesas libres.</Text>
              </Box>
              <NewDineInOrder onCreated={onCreated} label="Nuevo pedido"/>
            </Group>
            <Group gap="sm">
              {[
                {label:"Libres",value:freeTables.length,color:"green"},
                {label:"Ocupadas",value:occupiedTables.length,color:"yellow"},
                {label:"Reservadas",value:tables.filter((t) => t.status === "RESERVED").length,color:"cyan"},
              ].map((item) => (
                <Paper key={item.label} radius="md" px="md" py="sm" className={styles.panel}>
                  <Group gap="xs">
                    <Badge variant="dot" color={item.color}>{item.label}</Badge>
                    <Text fw={800} c="white" size="sm">{tablesQuery.isPending || tablesQuery.isError ? "—" : item.value}</Text>
                  </Group>
                </Paper>
              ))}
            </Group>
            {tablesQuery.isPending ? <Center py="xl"><Loader color="red"/></Center> :
              tablesQuery.isError ? <Empty Icon={AlertCircle} title="No se pudieron consultar las mesas" detail="Comprueba la conexión con el servidor."/> :
              tables.length === 0 ?
                <Empty Icon={Users} title="No hay mesas configuradas" detail="Las mesas registradas aparecerán en este apartado."/> :
                <SimpleGrid cols={{base:1,xs:2,md:3,lg:4}} spacing="md">
                  {tables.map((table) => (
                    <Paper key={table.id} p="lg" radius="xl" className={styles.tableCard}>
                      <Group justify="space-between" align="flex-start">
                        <ThemeIcon color={table.status === "FREE" ? "green" : table.status === "OCCUPIED" ? "yellow" : "blue"}
                          variant="light" radius="md" size={43}>
                          <UtensilsCrossed size={19}/>
                        </ThemeIcon>
                        <StatusPill status={table.status}/>
                      </Group>
                      <Title order={4} mt="lg" c="white">Mesa {table.alias || table.code || table.id}</Title>
                      <Text mt={4} c={muted} size="xs">Capacidad: {table.capacity} personas</Text>
                      <Box className={styles.tableCardFooter}>
                        {table.activeOrderId != null ? (
                          <Button fullWidth variant="light" color="gray" size="sm"
                            rightSection={<ArrowRight size={16}/>}
                            onClick={() => viewOrder(table.activeOrderId!)}>
                            Pedido #{table.activeOrderId}
                          </Button>
                        ) : table.status === "FREE" ? (
                          <NewDineInOrder onCreated={onCreated} defaultTableId={table.id} variant="outline" label="Crear pedido"/>
                        ) : (
                          <Text c={muted} ta="center" py="sm" size="xs">
                            {table.status === "RESERVED" ? "Mesa reservada" : "Mesa ocupada"}
                          </Text>
                        )}
                      </Box>
                    </Paper>
                  ))}
                </SimpleGrid>}
            <Text c={muted} size="xs" lh={1.7}>
              La disponibilidad proviene del backend. La ocupación cambia con las reservas y los pedidos,
              no mediante estados simulados.
            </Text>
          </Stack>
        )}

        {section === "reservations" && (
          <Stack gap="lg">
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Box>
                <Text c="#f08d9a" size="xs" fw={800} tt="uppercase" lts={1.3}>Servicio / Agenda</Text>
                <Title order={2} c="white" fw={850} mt={5}>Reservas y llegadas</Title>
                <Text c={muted} size="sm" mt={5}>Mesas reservadas, horarios y datos de contacto registrados.</Text>
              </Box>
              <Group align="flex-end" gap="xs">
                <TextInput type="date" aria-label="Fecha de reservas" value={selectedDate}
                  leftSection={<CalendarDays size={17}/>}
                  onChange={(event) => {if(event.currentTarget.value){
                    setSelectedDate(event.currentTarget.value);setReservationPage(0);
                  }}}
                  classNames={inputClasses} className={styles.dateInput}/>
                <Button variant="default" onClick={() => {setSelectedDate(today);setReservationPage(0);}}>Hoy</Button>
              </Group>
            </Group>
            <Group justify="space-between" gap="md">
              <Text c={muted} size="sm">
                <Text span c="white" fw={750}>{prettyDate(selectedDate)}</Text>
                {dailyReservations.data && " · " + dailyReservations.data.totalElements + " registros"}
              </Text>
              <SegmentedControl
                value={reservationScope}
                onChange={(value) => setReservationScope(value as ReservationScope)}
                color="red"
                data={[
                  {value:"active",label:"Pendientes y confirmadas"},
                  {value:"all",label:"Todas"},
                ]}
              />
            </Group>
            {dailyReservations.isPending ? <Center py="xl"><Loader color="red"/></Center> :
              dailyReservations.isError ? <Empty Icon={AlertCircle} title="No se pudo consultar la agenda" detail="Intenta actualizar o cambiar de fecha."/> :
              daily.length === 0 ? <Empty Icon={CalendarDays} title="No hay reservas para mostrar" detail="No hay reservas registradas con estos filtros."/> :
                <SimpleGrid cols={{base:1,md:2}} spacing="md">
                  {daily.map((reservation) => <ReservationCard key={reservation.id} reservation={reservation}/>)}
                </SimpleGrid>}
            {(dailyReservations.data?.totalPages || 0) > 1 && (
              <Center>
                <Pagination color="red" value={reservationPage + 1} total={dailyReservations.data?.totalPages || 1}
                  onChange={(page) => setReservationPage(page - 1)} withEdges/>
              </Center>
            )}
            <Alert icon={<CheckCircle2 size={18}/>} variant="light" color="blue">
              Esta agenda consulta reservas reales. No confirma ni cancela reservas automáticamente.
            </Alert>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
