import { api } from "@/core/api/api";
import type { ApiResponse } from "@/core/types/base/api-response";
import {
  Alert, Avatar, Badge, Box, Button, Center, Divider, Drawer, Group, Loader, Modal,
  Pagination, Paper, SegmentedControl, SimpleGrid, Stack, Table, Tabs, Text,
  Textarea, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle, CalendarDays, ClipboardList, Clock3, History, LockKeyhole, MessageSquareText,
  RefreshCw, Search, ShieldCheck, UserCheck, UserRound, UserX, UsersRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";

type Customer = {
  id: number; userId: number; username: string; firstName: string; lastName: string;
  fullName: string; email: string; phone: string | null; points: number | null;
  enabled: boolean; emailVerified: boolean; provider: string; profileImageUrl: string | null;
};
type Summary = { total: number; active: number; suspended: number };
type Page<T> = { content: T[]; totalPages: number; totalElements: number; pageNumber: number };
type Order = { id: number; date: string; total: number; typeName: string; statusCode: string;
  statusName: string; paymentStatus: string; details?: { id: number; quantity: number; productName: string }[] };
type Reservation = { id: number; reservationDate: string; reservationTime: string;
  tableNumber: string; numberOfPeople: number; status: string };
type AccountAction = { id: number; actorUserId: number; action: string; reason: string; occurredAt: string };
type ContactMessage = { id: number; subject: string; message: string; createdAt: string };
type StatusFilter = "all" | "active" | "suspended";
type DetailTab = "orders" | "reservations" | "messages" | "actions";
type StatusTarget = { customer: Customer; enabled: boolean };

const money = (value: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value ?? 0);
function dateLabel(iso?: string) {
  if (!iso) return "—";
  const [year, month, day] = iso.slice(0, 10).split("-");
  return year && month && day ? day + "/" + month + "/" + year : iso;
}
function dateTimeLabel(iso?: string) { return iso ? dateLabel(iso) + " " + iso.slice(11, 16) : "—"; }
function errorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "El servidor no pudo completar la operación.";
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}
function fullName(customer: Customer) {
  return customer.fullName?.trim() ||
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.username;
}
function StatusBadge({ enabled }: { enabled: boolean }) {
  return <Badge color={enabled ? "green" : "red"} variant="light" radius="xl">
    {enabled ? "Activa" : "Suspendida"}
  </Badge>;
}
function EmptyList({ title, description }: { title: string; description: string }) {
  return <Center py={38}><Stack align="center" gap="xs">
    <ThemeIcon color="gray" variant="light" radius="xl" size={45}><UsersRound size={21}/></ThemeIcon>
    <Text fw={750} ta="center">{title}</Text>
    <Text c="dimmed" size="sm" ta="center">{description}</Text>
  </Stack></Center>;
}

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced] = useDebouncedValue(search.trim(), 350);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<DetailTab>("orders");
  const [orderPage, setOrderPage] = useState(1);
  const [reservationPage, setReservationPage] = useState(1);
  const [messagePage, setMessagePage] = useState(1);
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [reason, setReason] = useState("");

  const summaryQuery = useQuery({
    queryKey: ["management", "customers", "summary"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Summary>>("customer-management/summary");
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
    staleTime: 25_000,
  });
  const directoryQuery = useQuery({
    queryKey: ["management", "customers", "directory", debounced, status, page],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Page<Customer>>>("customer-management", {
        params: { query: debounced || undefined, enabled: status === "all" ? undefined : status === "active",
          page: page - 1, size: 12 },
      });
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
    staleTime: 10_000,
  });
  const detailQuery = useQuery({
    queryKey: ["management", "customers", "detail", selectedId],
    enabled: selectedId !== null,
    queryFn: async () => {
      const response = await api.get<ApiResponse<Customer>>("customer-management/" + selectedId);
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
  });
  const ordersQuery = useQuery({
    queryKey: ["management", "customers", selectedId, "orders", orderPage],
    enabled: selectedId !== null && tab === "orders",
    queryFn: async () => {
      const response = await api.get<ApiResponse<Page<Order>>>(
        "customer-management/" + selectedId + "/orders", { params: { page: orderPage - 1, size: 6 } }
      );
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
  });
  const reservationsQuery = useQuery({
    queryKey: ["management", "customers", selectedId, "reservations", reservationPage],
    enabled: selectedId !== null && tab === "reservations",
    queryFn: async () => {
      const response = await api.get<ApiResponse<Page<Reservation>>>(
        "customer-management/" + selectedId + "/reservations", { params: { page: reservationPage - 1, size: 6 } }
      );
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
  });
  const messagesQuery = useQuery({
    queryKey: ["management", "customers", selectedId, "messages", messagePage],
    enabled: selectedId !== null && tab === "messages",
    queryFn: async () => {
      const response = await api.get<ApiResponse<Page<ContactMessage>>>(
        "customer-management/" + selectedId + "/messages",
        { params: { page: messagePage - 1, size: 6 } }
      );
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
  });
  const actionsQuery = useQuery({
    queryKey: ["management", "customers", selectedId, "actions"],
    enabled: selectedId !== null && tab === "actions",
    queryFn: async () => {
      const response = await api.get<ApiResponse<AccountAction[]>>(
        "customer-management/" + selectedId + "/actions"
      );
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
  });
  const changeStatus = useMutation({
    mutationFn: async (payload: { id: number; enabled: boolean; reason: string }) => {
      const response = await api.patch<ApiResponse<Customer>>(
        "customer-management/" + payload.id + "/status",
        { enabled: payload.enabled, reason: payload.reason }
      );
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
    onSuccess: async (customer) => {
      toast.success(customer.enabled ? "Cuenta de cliente reactivada." : "Cuenta de cliente suspendida.");
      setStatusTarget(null);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["management", "customers"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const openCustomer = (customer: Customer) => {
    setSelectedId(customer.id);
    setTab("orders");
    setOrderPage(1);
    setReservationPage(1);
    setMessagePage(1);
  };
  const openStatus = (customer: Customer) => {
    setReason("");
    setStatusTarget({ customer, enabled: !customer.enabled });
  };
  const closeStatus = () => {
    if (changeStatus.isPending) return;
    setStatusTarget(null);
    setReason("");
  };
  const rows = directoryQuery.data?.content ?? [];
  const selected = detailQuery.data;
  const totalPages = Math.max(1, directoryQuery.data?.totalPages ?? 1);

  return (
    <Box maw={1280} mx="auto" px={{ base: "xs", md: "xl" }} py="lg">
      <Group justify="space-between" align="flex-end" gap="lg" mb="xl">
        <Box>
          <Text c="#cc3447" tt="uppercase" fw={800} size="xs" lts={1.6}>Relaciones comerciales / Gestión</Text>
          <Title order={1} mt={6} c="#241c21" fw={850}>Clientes</Title>
          <Text c="dimmed" size="sm" mt={7}>
            Consulta cuentas registradas, historial de pedidos y reservas.
          </Text>
        </Box>
        <Button variant="default" color="gray"
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["management", "customers"] })}
          loading={directoryQuery.isFetching || summaryQuery.isFetching}
          leftSection={<RefreshCw size={16}/>}>Actualizar</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md" mb="xl">
        {[
          { label: "Clientes registrados", value: summaryQuery.data?.total, Icon: UsersRound, color: "red" },
          { label: "Cuentas activas", value: summaryQuery.data?.active, Icon: UserCheck, color: "green" },
          { label: "Cuentas suspendidas", value: summaryQuery.data?.suspended, Icon: UserX, color: "orange" },
        ].map(({ label, value, Icon, color }) => (
          <Paper key={label} withBorder radius="lg" p="md" shadow="xs">
            <Group align="center" gap="md">
              <ThemeIcon color={color} variant="light" radius="md" size={44}><Icon size={21}/></ThemeIcon>
              <Box><Text c="dimmed" size="xs">{label}</Text>
                <Title order={2} c="#2b2229">{value ?? "—"}</Title></Box>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Paper withBorder shadow="xs" radius="lg" p={0}>
        <Group justify="space-between" align="center" p="md" gap="sm">
          <Box><Title order={3} size="md">Directorio de clientes</Title>
            <Text c="dimmed" size="xs" mt={4}>El personal se administra desde Usuarios.</Text></Box>
          <Text size="sm" c="dimmed">{directoryQuery.data?.totalElements ?? "—"} resultados</Text>
        </Group>
        <Divider color="#eee3e6"/>
        <Stack gap="sm" p="md">
          <TextInput leftSection={<Search size={17}/>} placeholder="Buscar por nombre, usuario o correo..."
            aria-label="Buscar clientes" value={search}
            onChange={(event) => { setSearch(event.currentTarget.value); setPage(1); }}/>
          <SegmentedControl color="red" value={status}
            onChange={(value) => { setStatus(value as StatusFilter); setPage(1); }}
            data={[{value:"all",label:"Todos"},{value:"active",label:"Activos"},
              {value:"suspended",label:"Suspendidos"}]}/>
        </Stack>
        {directoryQuery.isError && (
          <Alert color="red" m="md" icon={<AlertCircle size={17}/>} title="No se pudo cargar el directorio">
            {errorMessage(directoryQuery.error)}
          </Alert>
        )}
        {directoryQuery.isPending ? <Center py={65}><Loader color="red"/></Center> :
          rows.length === 0 && !directoryQuery.isError ?
            <EmptyList title="No se encontraron clientes" description="Prueba otra búsqueda o cambia el filtro."/> :
          !directoryQuery.isError ? (
            <Table.ScrollContainer minWidth={750}>
              <Table verticalSpacing="md" horizontalSpacing="md" highlightOnHover>
                <Table.Thead><Table.Tr>
                  <Table.Th>Cliente</Table.Th><Table.Th>Correo</Table.Th>
                  <Table.Th>Registro</Table.Th><Table.Th>Puntos</Table.Th>
                  <Table.Th>Estado</Table.Th><Table.Th ta="right">Acciones</Table.Th>
                </Table.Tr></Table.Thead>
                <Table.Tbody>{rows.map((customer) => (
                  <Table.Tr key={customer.id}>
                    <Table.Td><Group wrap="nowrap" gap="sm">
                      <Avatar color="red" radius="xl" src={customer.profileImageUrl || undefined}>
                        {customer.firstName?.[0] || customer.username?.[0] || "C"}
                      </Avatar>
                      <Box style={{ minWidth: 0 }}>
                        <Text fw={750} size="sm" truncate>{fullName(customer)}</Text>
                        <Text c="dimmed" size="xs" truncate>@{customer.username}</Text>
                      </Box>
                    </Group></Table.Td>
                    <Table.Td><Text size="sm" truncate maw={245}>{customer.email}</Text></Table.Td>
                    <Table.Td><Badge variant="light" color={customer.provider === "LOCAL" ? "gray" : "blue"}>
                      {customer.provider === "LOCAL" ? "Local" : "Externa"}
                    </Badge></Table.Td>
                    <Table.Td><Text fw={700} size="sm">{customer.points ?? 0}</Text></Table.Td>
                    <Table.Td><StatusBadge enabled={customer.enabled}/></Table.Td>
                    <Table.Td><Group justify="flex-end" gap="xs" wrap="nowrap">
                      <Button size="xs" variant="light" color="gray" leftSection={<UserRound size={14}/>}
                        onClick={() => openCustomer(customer)}>Ver detalle</Button>
                      <Button size="xs" variant="light" color={customer.enabled ? "orange" : "green"}
                        onClick={() => openStatus(customer)}
                        leftSection={customer.enabled ? <UserX size={14}/> : <UserCheck size={14}/>}>
                        {customer.enabled ? "Suspender" : "Reactivar"}
                      </Button>
                    </Group></Table.Td>
                  </Table.Tr>
                ))}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : null}
        <Divider color="#eee3e6"/>
        <Group justify="space-between" p="md">
          <Text size="xs" c="dimmed">Página {page} de {totalPages}</Text>
          <Pagination value={Math.min(page,totalPages)} total={totalPages}
            onChange={setPage} color="red" size="sm"/>
        </Group>
      </Paper>
      <Alert icon={<ShieldCheck size={18}/>} variant="light" color="blue" mt="lg" radius="lg">
        El gerente no puede consultar ni restablecer contraseñas de clientes ni editar sus credenciales.
        Suspender o reactivar una cuenta exige justificación y deja un registro.
      </Alert>

      <Drawer opened={selectedId !== null} onClose={() => setSelectedId(null)}
        position="right" size="lg" title="Ficha del cliente" padding="lg"
        styles={{ title: { fontWeight: 800, fontSize: 17 } }}>
        {detailQuery.isPending ? <Center py={45}><Loader color="red"/></Center> :
          detailQuery.isError ? <Alert color="red">{errorMessage(detailQuery.error)}</Alert> :
          selected ? (
            <Stack gap="lg">
              <Paper bg="#faf5f5" radius="lg" p="md">
                <Group justify="space-between" align="flex-start" mb="xs">
                  <Group gap="sm"><Avatar color="red" size="lg" src={selected.profileImageUrl || undefined}>
                    {selected.firstName?.[0] || selected.username?.[0] || "C"}
                  </Avatar><Box><Text fw={800}>{fullName(selected)}</Text>
                    <Text c="dimmed" size="xs">@{selected.username}</Text></Box></Group>
                  <StatusBadge enabled={selected.enabled}/>
                </Group>
                <Divider my="md"/>
                <SimpleGrid cols={2} spacing="sm">
                  <Box><Text c="dimmed" size="xs">Correo</Text>
                    <Text size="sm" style={{overflowWrap:"anywhere"}}>{selected.email}</Text></Box>
                  <Box><Text c="dimmed" size="xs">Teléfono</Text><Text size="sm">{selected.phone || "No registrado"}</Text></Box>
                  <Box><Text c="dimmed" size="xs">Puntos</Text><Text fw={800}>{selected.points ?? 0}</Text></Box>
                  <Box><Text c="dimmed" size="xs">Email verificado</Text>
                    <Badge size="sm" color={selected.emailVerified ? "green" : "gray"} variant="light">
                      {selected.emailVerified ? "Sí" : "No"}</Badge></Box>
                </SimpleGrid>
              </Paper>
              <Group justify="space-between" gap="sm">
                <Text c="dimmed" size="xs">Ficha de consulta, sin edición de credenciales.</Text>
                <Button variant="light" size="xs" color={selected.enabled ? "orange" : "green"}
                  leftSection={selected.enabled ? <LockKeyhole size={15}/> : <UserCheck size={15}/>}
                  onClick={() => openStatus(selected)}>
                  {selected.enabled ? "Suspender cuenta" : "Reactivar cuenta"}
                </Button>
              </Group>
              <Tabs value={tab} onChange={(value) => { if (value) setTab(value as DetailTab); }} color="red">
                <Tabs.List grow>
                  <Tabs.Tab value="orders" leftSection={<ClipboardList size={15}/>}>Pedidos</Tabs.Tab>
                  <Tabs.Tab value="reservations" leftSection={<CalendarDays size={15}/>}>Reservas</Tabs.Tab>
                  <Tabs.Tab value="messages" leftSection={<MessageSquareText size={15}/>}>Mensajes</Tabs.Tab>
                  <Tabs.Tab value="actions" leftSection={<History size={15}/>}>Actividad</Tabs.Tab>
                </Tabs.List>
              </Tabs>
              {tab === "orders" && <Stack gap="sm">
                {ordersQuery.isPending ? <Center py={35}><Loader size="sm" color="red"/></Center> :
                  ordersQuery.isError ? <Alert color="red">{errorMessage(ordersQuery.error)}</Alert> :
                  !ordersQuery.data?.content.length ?
                    <EmptyList title="Sin pedidos" description="Este cliente aún no registra compras."/> :
                  ordersQuery.data.content.map((order) => (
                    <Paper key={order.id} p="md" withBorder radius="md">
                      <Group justify="space-between" mb="xs">
                        <Box><Text size="sm" fw={800}>Pedido #{order.id}</Text>
                          <Text size="xs" c="dimmed">{dateTimeLabel(order.date)} · {order.typeName || "Pedido"}</Text></Box>
                        <Badge color={["CANCELLED","FAILED"].includes(order.statusCode) ? "red" : "blue"} variant="light">
                          {order.statusName || order.statusCode}</Badge>
                      </Group>
                      {order.details?.slice(0,3).map((item) =>
                        <Text key={item.id} size="xs" c="dimmed">{item.quantity} × {item.productName}</Text>)}
                      <Group justify="space-between" mt="sm">
                        <Text size="xs" c="dimmed">Pago: {order.paymentStatus === "CONFIRMED" ? "Confirmado" : "Pendiente"}</Text>
                        <Text size="sm" fw={800}>{money(order.total)}</Text>
                      </Group>
                    </Paper>
                  ))}
                {(ordersQuery.data?.totalPages || 0) > 1 &&
                  <Center><Pagination value={orderPage} total={ordersQuery.data?.totalPages || 1}
                    color="red" onChange={setOrderPage} size="sm"/></Center>}
              </Stack>}
              {tab === "reservations" && <Stack gap="sm">
                {reservationsQuery.isPending ? <Center py={35}><Loader size="sm" color="red"/></Center> :
                  reservationsQuery.isError ? <Alert color="red">{errorMessage(reservationsQuery.error)}</Alert> :
                  !reservationsQuery.data?.content.length ?
                    <EmptyList title="Sin reservas" description="Este cliente todavía no registra reservas."/> :
                  reservationsQuery.data.content.map((reservation) => (
                    <Paper withBorder radius="md" p="md" key={reservation.id}>
                      <Group justify="space-between" mb="xs">
                        <Text fw={800} size="sm">Reserva #{reservation.id}</Text>
                        <Badge color={reservation.status === "CONFIRMED" ? "green" :
                          reservation.status === "CANCELLED" ? "red" : "yellow"} variant="light">
                          {reservation.status}</Badge>
                      </Group>
                      <Group gap="xs" mb="xs"><Clock3 size={15} color="#b94d58"/>
                        <Text size="sm">{dateLabel(reservation.reservationDate)}, {reservation.reservationTime?.slice(0,5)}</Text>
                      </Group>
                      <Text size="xs" c="dimmed">Mesa {reservation.tableNumber || "sin asignar"} · {reservation.numberOfPeople} personas</Text>
                    </Paper>
                  ))}
                {(reservationsQuery.data?.totalPages || 0) > 1 &&
                  <Center><Pagination value={reservationPage} total={reservationsQuery.data?.totalPages || 1}
                    color="red" onChange={setReservationPage} size="sm"/></Center>}
              </Stack>}
              {tab === "messages" && <Stack gap="sm">
                <Text c="dimmed" size="xs">
                  Mensajes enviados por el cliente al restaurante. Esta vista no altera su estado ni envía respuestas.
                </Text>
                {messagesQuery.isPending ? <Center py={35}><Loader size="sm" color="red"/></Center> :
                  messagesQuery.isError ? <Alert color="red">{errorMessage(messagesQuery.error)}</Alert> :
                  !messagesQuery.data?.content.length ?
                    <EmptyList title="Sin mensajes" description="Este cliente aún no ha enviado consultas."/> :
                  messagesQuery.data.content.map((message) => (
                    <Paper key={message.id} p="md" withBorder radius="md">
                      <Group justify="space-between" mb="xs">
                        <Text size="sm" fw={800}>{message.subject}</Text>
                        <Text size="xs" c="dimmed">{dateTimeLabel(message.createdAt)}</Text>
                      </Group>
                      <Text size="sm" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>
                        {message.message}
                      </Text>
                    </Paper>
                  ))}
                {(messagesQuery.data?.totalPages || 0) > 1 &&
                  <Center><Pagination value={messagePage} total={messagesQuery.data?.totalPages || 1}
                    color="red" onChange={setMessagePage} size="sm"/></Center>}
              </Stack>}
              {tab === "actions" && <Stack gap="sm">
                {actionsQuery.isPending ? <Center py={35}><Loader size="sm" color="red"/></Center> :
                  actionsQuery.isError ? <Alert color="red">{errorMessage(actionsQuery.error)}</Alert> :
                  !actionsQuery.data?.length ?
                    <EmptyList title="Sin acciones registradas" description="No hay suspensiones o reactivaciones desde este módulo."/> :
                  actionsQuery.data.map((action) => (
                    <Paper key={action.id} withBorder radius="md" p="md">
                      <Group justify="space-between" mb="xs">
                        <Badge variant="light" color={action.action === "SUSPENDED" ? "orange" : "green"}>
                          {action.action === "SUSPENDED" ? "Suspendida" : "Reactivada"}</Badge>
                        <Text c="dimmed" size="xs">{dateTimeLabel(action.occurredAt)}</Text>
                      </Group>
                      <Text size="sm">{action.reason}</Text>
                      <Text size="xs" c="dimmed" mt="xs">Responsable: usuario #{action.actorUserId}</Text>
                    </Paper>
                  ))}
              </Stack>}
            </Stack>
          ) : null}
      </Drawer>

      <Modal opened={statusTarget !== null}
        title={statusTarget?.enabled ? "Reactivar cuenta de cliente" : "Confirmar suspensión"}
        size="md" centered closeOnEscape={!changeStatus.isPending}
        closeOnClickOutside={!changeStatus.isPending} onClose={closeStatus}>
        <Stack gap="md">
          <Alert icon={<AlertCircle size={18}/>} color={statusTarget?.enabled ? "green" : "orange"}
            title={statusTarget ? fullName(statusTarget.customer) : "Cliente"}>
            {statusTarget?.enabled ?
              "La cuenta recuperará el acceso. Las sesiones anteriores permanecerán revocadas." :
              "El cliente perderá acceso. Se conservarán sus pedidos, puntos y reservas existentes."}
          </Alert>
          <Textarea label="Justificación" required minRows={3} maxLength={500}
            description="Entre 10 y 500 caracteres. Se guardará en el historial de la cuenta."
            placeholder="Explica el motivo comercial o de seguridad..."
            value={reason} onChange={(event) => setReason(event.currentTarget.value)}
            disabled={changeStatus.isPending}/>
          <Group justify="flex-end">
            <Button variant="default" disabled={changeStatus.isPending} onClick={closeStatus}>Cancelar</Button>
            <Button color={statusTarget?.enabled ? "green" : "red"}
              disabled={!statusTarget || reason.trim().length < 10} loading={changeStatus.isPending}
              onClick={() => {
                if (statusTarget && reason.trim().length >= 10) {
                  changeStatus.mutate({ id: statusTarget.customer.id, enabled: statusTarget.enabled,
                    reason: reason.trim() });
                }
              }}>
              {statusTarget?.enabled ? "Confirmar reactivación" : "Confirmar suspensión"}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
