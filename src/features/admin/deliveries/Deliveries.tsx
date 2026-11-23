import { orderService } from "@/core/services/order/order.service";
import { useOrderEvents } from "@/core/hooks/order/useOrderEvents";
import type { DriverOptionResponse, OrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Badge, Box, Button, Center, Divider, Group, Loader, Modal, Paper,
  ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Text, TextInput,
  ThemeIcon, Title,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle, Bike, Clock3, MapPin, PackageCheck, RefreshCw, Search,
  ShieldCheck, Truck, UserRoundCheck, UserRoundX,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-toastify";

type Filter = "unassigned" | "assigned" | "route" | "completed" | "all";
const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const terminal = new Set(["CANCELLED", "FAILED", "COMPLETED", "DELIVERED", "REFUNDED"]);
const labels: Record<string, string> = {
  PENDING: "Pendiente", PENDING_CONFIRMATION: "Por confirmar",
  CONFIRMED: "Confirmado", IN_PROGRESS: "En cocina",
  READY_FOR_PICKUP: "Listo para recoger", OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado", CANCELLED: "Cancelado",
  FAILED: "Fallido", COMPLETED: "Finalizado", REFUNDED: "Reembolsado",
};
function errorText(error: unknown): string {
  if (axios.isAxiosError<{message?: string}>(error)) {
    return error.response?.data?.message || "El servidor no pudo realizar la operación.";
  }
  return error instanceof Error ? error.message : "No se pudo completar la operación.";
}
function statusColor(code: string): string {
  if (code === "DELIVERED") return "green";
  if (code === "OUT_FOR_DELIVERY") return "blue";
  if (code === "READY_FOR_PICKUP") return "teal";
  if (terminal.has(code)) return "gray";
  return "orange";
}
function orderTime(value: string): string {
  // LocalDateTime sin zona del backend: no convertirlo con la zona del navegador.
  const [date, time] = (value || "").split("T");
  const parts = date?.split("-");
  return parts?.length === 3
    ? parts[2] + "/" + parts[1] + "/" + parts[0] + " " + (time?.slice(0, 5) || "")
    : "—";
}
function canAssign(order: OrderResponse) {
  return !terminal.has(order.statusCode) &&
    (order.statusCode !== "OUT_FOR_DELIVERY" || order.employeeId == null);
}
function Metric({label, value, hint, tone}: {
  label: string; value: number | string; hint: string; tone: string;
}) {
  return <Paper radius="xl" withBorder p="lg" bg="white">
    <Group justify="space-between" gap="md">
      <Box>
        <Text c="dimmed" size="xs" fw={700}>{label}</Text>
        <Title order={2} mt={7} c="#231e24" fw={850}>{value}</Title>
        <Text c="dimmed" size="xs" mt={4}>{hint}</Text>
      </Box>
      <ThemeIcon size={43} radius="md" color={tone} variant="light"><Truck size={21}/></ThemeIcon>
    </Group>
  </Paper>;
}
export default function Deliveries() {
  const queryClient = useQueryClient();
  useOrderEvents(() => {
    void queryClient.invalidateQueries({ queryKey: ["management", "deliveries", "orders"] });
  });
  const [filter, setFilter] = useState<Filter>("unassigned");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim().toLowerCase(), 250);
  const [target, setTarget] = useState<OrderResponse | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const ordersQuery = useQuery({
    queryKey: ["management", "deliveries", "orders"],
    queryFn: async () => {
      const result = await orderService.getAllOrders("es", "DELIVERY");
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "No se pudieron cargar los pedidos delivery.");
      }
      return result.data;
    },
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const driversQuery = useQuery({
    queryKey: ["management", "deliveries", "drivers"],
    queryFn: async () => {
      const result = await orderService.getEligibleDrivers();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.message || "No se pudieron consultar los repartidores.");
      }
      return result.data;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const assignment = useMutation({
    mutationFn: async ({orderId, employeeId}: {orderId: number; employeeId: number}) => {
      const result = await orderService.assignDriver(orderId, {employeeId});
      if (!result.success) throw new Error(result.message || "No se pudo asignar el reparto.");
      return result.data;
    },
    onSuccess: async (order) => {
      toast.success("Pedido #" + order.id + " asignado correctamente.");
      setTarget(null);
      setSelectedDriver(null);
      await Promise.all([
        queryClient.invalidateQueries({queryKey: ["management", "deliveries", "orders"]}),
        queryClient.invalidateQueries({queryKey: ["driver", "deliveries"]}),
      ]);
    },
    onError: (error) => {
      toast.error(errorText(error));
      void queryClient.invalidateQueries({queryKey: ["management", "deliveries", "orders"]});
    },
  });
  const all = ordersQuery.data || [];
  const eligible = driversQuery.data || [];
  const summary = useMemo(() => ({
    total: all.length,
    unassigned: all.filter((o) => !o.employeeId && !terminal.has(o.statusCode)).length,
    ready: all.filter((o) => o.statusCode === "READY_FOR_PICKUP" && !!o.employeeId).length,
    inRoute: all.filter((o) => o.statusCode === "OUT_FOR_DELIVERY").length,
    orphanRoute: all.filter((o) => o.statusCode === "OUT_FOR_DELIVERY" && !o.employeeId).length,
    delivered: all.filter((o) => o.statusCode === "DELIVERED").length,
  }), [all]);
  const visible = useMemo(() => all.filter((order) => {
    if (filter === "unassigned" && (order.employeeId != null || terminal.has(order.statusCode))) return false;
    if (filter === "assigned" && (order.employeeId == null || terminal.has(order.statusCode))) return false;
    if (filter === "route" && order.statusCode !== "OUT_FOR_DELIVERY") return false;
    if (filter === "completed" && !terminal.has(order.statusCode)) return false;
    if (!debouncedSearch) return true;
    return [order.id, order.customerName, order.employeeName, order.deliveryStreet,
      order.deliveryCity, order.deliveryReference].filter(Boolean).join(" ")
      .toLowerCase().includes(debouncedSearch);
  }).sort((a,b) => b.id - a.id), [all, filter, debouncedSearch]);
  const openAssign = (order: OrderResponse) => {
    if (!canAssign(order)) return;
    setTarget(order);
    setSelectedDriver(order.employeeId != null &&
      eligible.some((d) => d.employeeId === order.employeeId)
        ? String(order.employeeId) : null);
  };
  const confirmAssign = () => {
    if (target && selectedDriver) {
      assignment.mutate({orderId: target.id, employeeId: Number(selectedDriver)});
    }
  };
  const currentDriver = eligible.find((d: DriverOptionResponse) => String(d.employeeId) === selectedDriver);
  return <Stack maw={1200} mx="auto" gap="xl">
    <Group justify="space-between" align="flex-end" gap="md">
      <Box>
        <Text c="red.7" fw={800} tt="uppercase" size="xs" lts={1.5}>
          Operaciones / Delivery
        </Text>
        <Title order={1} mt="xs">Gestión de repartos</Title>
        <Text c="dimmed" size="sm" mt="xs">
          Asigna cada pedido a un repartidor antes de despacharlo y supervisa sus estados.
        </Text>
      </Box>
      <Button variant="default" color="gray" leftSection={<RefreshCw size={17}/>}
        loading={ordersQuery.isFetching || driversQuery.isFetching}
        onClick={() => {void ordersQuery.refetch(); void driversQuery.refetch();}}>
        Actualizar
      </Button>
    </Group>
    {summary.orphanRoute > 0 && (
      <Alert color="orange" title="Hay entregas en camino sin repartidor asignado"
        icon={<AlertCircle size={19}/>}>
        Se detectaron {summary.orphanRoute} pedidos antiguos en estado «En camino» sin responsable.
        Selecciónalos para recuperar la asignación. El sistema conservará su estado y
        no los marcará automáticamente como entregados.
      </Alert>
    )}
    <SimpleGrid cols={{base: 2, md: 4}} spacing="md">
      <Metric label="Sin asignar" value={ordersQuery.isPending ? "—" : summary.unassigned}
        hint="Necesitan un repartidor" tone="red"/>
      <Metric label="Listos y asignados" value={ordersQuery.isPending ? "—" : summary.ready}
        hint="Preparados para salir" tone="teal"/>
      <Metric label="En camino" value={ordersQuery.isPending ? "—" : summary.inRoute}
        hint="Incluye posibles incidencias" tone="blue"/>
      <Metric label="Entregados" value={ordersQuery.isPending ? "—" : summary.delivered}
        hint="En el historial consultado" tone="green"/>
    </SimpleGrid>
    <Paper radius="xl" p="lg" withBorder bg="white">
      <Group justify="space-between" align="center" gap="md" mb="md">
        <Box>
          <Title order={3} size="h4">Pedidos delivery</Title>
          <Text c="dimmed" size="xs" mt={4}>
            {summary.total} pedidos registrados · {eligible.length} repartidores activos
          </Text>
        </Box>
        <TextInput value={search} onChange={(e) => setSearch(e.currentTarget.value)}
          leftSection={<Search size={17}/>} w={{base:"100%",sm:285}}
          placeholder="Buscar pedido, cliente o dirección" aria-label="Buscar repartos"/>
      </Group>
      <ScrollArea type="auto" mb="md" offsetScrollbars>
        <SegmentedControl color="red" size="sm" value={filter}
          onChange={(value) => setFilter(value as Filter)}
          data={[
            {label:"Sin asignar", value:"unassigned"},
            {label:"Asignados", value:"assigned"},
            {label:"En camino", value:"route"},
            {label:"Finalizados", value:"completed"},
            {label:"Todos", value:"all"},
          ]}/>
      </ScrollArea>
      {ordersQuery.isError && (
        <Alert color="red" icon={<AlertCircle size={18}/>} title="No se pudieron consultar pedidos">
          {errorText(ordersQuery.error)}
        </Alert>
      )}
      {driversQuery.isError && (
        <Alert mb="md" color="orange" icon={<AlertCircle size={18}/>}
          title="No se pudieron cargar los repartidores activos">
          {errorText(driversQuery.error)}
        </Alert>
      )}
      {ordersQuery.isPending ? <Center py={55}><Loader color="red"/></Center> :
        ordersQuery.isError ? null : visible.length === 0 ? (
        <Center py={55}><Stack align="center" gap="xs">
          <ThemeIcon color="gray" variant="light" radius="xl" size={48}><PackageCheck size={23}/></ThemeIcon>
          <Text fw={750} c="#2d2730">No hay pedidos en esta categoría</Text>
          <Text size="sm" c="dimmed" ta="center">Prueba otro filtro o consulta más adelante.</Text>
        </Stack></Center>
      ) : <Stack gap="sm">
        {visible.slice(0,100).map((order) => {
          const orphan = order.statusCode === "OUT_FOR_DELIVERY" && !order.employeeId;
          return <Paper key={order.id} withBorder radius="lg" p="md" bg={orphan ? "#fff8ed" : "#fff"}>
            <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
              <Box style={{flex:1,minWidth:220}}>
                <Group gap="xs" mb={7}>
                  <Text fw={850} size="md" c="#241d23">Pedido #{order.id}</Text>
                  <Badge color={statusColor(order.statusCode)} variant="light">
                    {labels[order.statusCode] || order.statusCode}
                  </Badge>
                  {orphan && <Badge color="orange" variant="filled">Sin repartidor en ruta</Badge>}
                </Group>
                <Text c="#5c4c56" size="sm" fw={650}>{order.customerName || "Cliente"}</Text>
                <Group gap={6} mt={6} wrap="nowrap">
                  <MapPin size={15} color="#bd4053"/>
                  <Text size="xs" c="dimmed" style={{overflowWrap:"anywhere"}}>
                    {[order.deliveryStreet,order.deliveryCity,order.deliveryProvince]
                      .filter(Boolean).join(", ") || "Dirección no registrada"}
                  </Text>
                </Group>
                <Group gap="md" mt={8}>
                  <Text c="dimmed" size="xs"><Clock3 size={13} style={{verticalAlign:"middle"}}/> {orderTime(order.date)}</Text>
                  <Text size="xs" fw={750} c="#382b34">{money.format(order.total || 0)}</Text>
                  <Badge color={order.paymentStatus === "CONFIRMED" ? "green" : "orange"}
                    size="sm" variant="light">
                    Pago {order.paymentStatus === "CONFIRMED" ? "confirmado" : "no confirmado"}
                  </Badge>
                </Group>
              </Box>
              <Stack gap="xs" align="flex-end" style={{minWidth:180}}>
                {order.employeeId != null ? (
                  <Badge size="lg" color="blue" variant="light" radius="md"
                    leftSection={<UserRoundCheck size={14}/>}>
                    {order.employeeName || "Empleado #" + order.employeeId}
                  </Badge>
                ) : (
                  <Badge size="lg" color="red" variant="light"
                    leftSection={<UserRoundX size={14}/>}>Sin repartidor</Badge>
                )}
                {canAssign(order) ? (
                  <Button color={orphan ? "orange" : "red"} size="sm"
                    leftSection={<Bike size={16}/>}
                    disabled={driversQuery.isPending || driversQuery.isError || eligible.length === 0}
                    onClick={() => openAssign(order)}>
                    {orphan ? "Recuperar asignación" : order.employeeId ? "Cambiar repartidor" : "Asignar repartidor"}
                  </Button>
                ) : <Text size="xs" c="dimmed">
                  {terminal.has(order.statusCode) ? "Pedido cerrado" : "Reparto ya iniciado"}
                </Text>}
              </Stack>
            </Group>
          </Paper>;
        })}
        {visible.length > 100 && <Text size="xs" c="dimmed">
          Se muestran los 100 pedidos más recientes de este filtro.
        </Text>}
      </Stack>}
    </Paper>
    <Paper radius="lg" p="md" withBorder>
      <Group align="flex-start" gap="sm" wrap="nowrap">
        <ShieldCheck color="#bf4353" size={19}/>
        <Text c="dimmed" size="xs" lh={1.65}>
          Asignar un empleado no cambia el estado del pedido. Solo el repartidor
          asignado podrá iniciar la ruta después de que cocina lo marque
          «Listo para recoger» y se confirme el pago.
        </Text>
      </Group>
    </Paper>
    <Modal opened={target !== null} centered size="md"
      onClose={() => {if (!assignment.isPending) {setTarget(null);setSelectedDriver(null);}}}
      closeOnClickOutside={!assignment.isPending} closeOnEscape={!assignment.isPending}
      title={target?.statusCode === "OUT_FOR_DELIVERY" ? "Recuperar reparto sin responsable" : "Asignar repartidor"}>
      <Stack gap="lg">
        <Box>
          <Text fw={800}>Pedido #{target?.id}</Text>
          <Text c="dimmed" size="sm">{target?.customerName || "Cliente"}</Text>
        </Box>
        {target?.statusCode === "OUT_FOR_DELIVERY" && (
          <Alert color="orange" icon={<AlertCircle size={18}/>}>
            El pedido ya figura «En camino». La asignación vinculará al responsable sin cambiar
            su estado ni marcarlo como entregado.
          </Alert>
        )}
        {target?.paymentStatus !== "CONFIRMED" && (
          <Alert color="yellow" icon={<AlertCircle size={18}/>}>
            El pago no figura confirmado. No podrá completarse el reparto
            hasta regularizar el pago por el flujo correspondiente.
          </Alert>
        )}
        <Select searchable required label="Repartidor activo" placeholder="Seleccionar empleado"
          value={selectedDriver} onChange={setSelectedDriver}
          nothingFoundMessage="No hay repartidores habilitados"
          data={eligible.map((driver) => ({
            value: String(driver.employeeId),
            label: driver.fullName + " (@" + driver.username + ")",
          }))}/>
        {currentDriver && <Text size="xs" c="dimmed">
          La asignación quedará registrada a nombre de {currentDriver.fullName}.
        </Text>}
        {assignment.isError && <Alert color="red" icon={<AlertCircle size={18}/>}
          title="No se pudo asignar">{errorText(assignment.error)}</Alert>}
        <Divider/>
        <Group justify="flex-end">
          <Button variant="default" disabled={assignment.isPending}
            onClick={() => {setTarget(null);setSelectedDriver(null);}}>Cancelar</Button>
          <Button color="red" loading={assignment.isPending}
            disabled={!selectedDriver || !eligible.some((d) => String(d.employeeId) === selectedDriver)}
            onClick={confirmAssign}>Confirmar asignación</Button>
        </Group>
      </Stack>
    </Modal>
  </Stack>;
}
