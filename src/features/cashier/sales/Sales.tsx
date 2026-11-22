import { cashRegisterService, type CashShift, type CashEntry } from "@/core/services/cash-register/cash-register.service";
import { logoutFromServer } from "@/core/services/auth/logout";
import { orderService } from "@/core/services/order/order.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { OrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Badge, Box, Button, Center, Divider, Group, Loader, Modal, NumberInput,
  Paper, ScrollArea, Select, SimpleGrid, Stack, Table, Tabs, Text, Textarea,
  TextInput, ThemeIcon, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertCircle, ArrowDownLeft, ArrowUpRight, Banknote, CalendarClock, CheckCircle2,
  CircleDollarSign, ClipboardList, Clock3, CreditCard, FileDown, History, LockKeyhole,
  LogOut, Plus, ReceiptText, RefreshCw, Search, ShieldCheck, Wallet, type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import NewDineInOrder from "../../waiter/NewDineInOrder";
import styles from "./Cashier.module.css";

type Tab = "summary" | "payments" | "movements" | "closing" | "history";
type MovementType = "CASH_IN" | "CASH_OUT";
const money = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const muted = "#b4aab6";
const field = { input: styles.fieldInput, label: styles.fieldLabel };
const selectStyles = { input: styles.fieldInput, label: styles.fieldLabel, dropdown: styles.dropdown, option: styles.option };
const methodLabels: Record<string, string> = { CASH: "Efectivo", YAPE: "Yape", PLIN: "Plin", TRANSFER: "Transferencia" };
const statusLabels: Record<string, string> = {
  PENDING_CONFIRMATION: "Por confirmar", PENDING: "Pendiente", CONFIRMED: "Confirmado",
  IN_PROGRESS: "En preparación", READY_FOR_PICKUP: "Listo para recoger",
  COMPLETED: "Completado", CANCELLED: "Cancelado", OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado", FAILED: "Fallido", REFUNDED: "Reembolsado",
};
function errorText(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "No se pudo completar la operación. Revisa el estado de la caja.";
  }
  return error instanceof Error ? error.message : "No se pudo conectar con el servidor.";
}
function localDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}
function asNumber(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return value.trim() ? Number(value) : 0;
}
function moneyNumber(value: number) { return Math.round((value + Number.EPSILON) * 100); }
function payable(order: OrderResponse) {
  return order.paymentStatus !== "CONFIRMED"
    && !["CANCELLED", "FAILED", "REFUNDED", "DELIVERED"].includes(order.statusCode)
    && (order.tableId != null || order.pickupStoreId != null
      || /salón|presencial|llevar|dine|take/i.test(order.typeName || ""))
    && !order.deliveryStreet
    && !/delivery|domicilio/i.test(order.typeName || "");
}
function channel(order: OrderResponse) {
  return order.tableId != null ? "Mesa " + (order.tableCode || "sin asignar")
    : order.pickupStoreName ? "Para llevar · " + order.pickupStoreName : "Para llevar";
}
function totalMethod(shift: CashShift | null | undefined, key: string) {
  return Number(shift?.salesByMethod?.[key] || 0);
}
function totalSales(shift: CashShift | null | undefined) {
  return Object.values(shift?.salesByMethod || {}).reduce((sum, amount) => sum + Number(amount), 0);
}
function Metric({ label, value, hint, Icon, color = "red" }: {
  label: string; value: string; hint: string; Icon: LucideIcon; color?: string;
}) {
  return <Paper className={styles.metric} p="lg" radius="xl">
    <Group justify="space-between" align="flex-start" gap="md">
      <Text c={muted} size="xs" fw={700}>{label}</Text>
      <ThemeIcon size={42} radius="md" variant="light" color={color}><Icon size={22}/></ThemeIcon>
    </Group>
    <Title order={2} c="white" mt="xs" fw={850}>{value}</Title>
    <Text c="#9d939f" size="xs" mt={7}>{hint}</Text>
  </Paper>;
}
function getEntryLabel(entry: CashEntry) {
  if (entry.type === "CASH_IN") return "Ingreso de efectivo";
  if (entry.type === "CASH_OUT") return "Retiro de efectivo";
  return "Cobro del pedido #" + entry.orderId;
}
function downloadCsv(shift: CashShift) {
  const rows: Array<Array<string | number | null>> = [
    ["Restaurant Central", "Arqueo de caja"],
    ["Turno", shift.id], ["Cajero ID", shift.cashierUserId],
    ["Apertura (Perú)", localDate(shift.openedAt)],
    ["Cierre (Perú)", localDate(shift.closedAt)],
    ["Fondo inicial", shift.openingCash],
    ...Object.entries(shift.salesByMethod).map(([method, total]) =>
      ["Cobros " + (methodLabels[method] || method), total]),
    ["Ingresos de efectivo", shift.cashIn], ["Retiros de efectivo", shift.cashOut],
    ["Efectivo esperado", shift.expectedCash],
    ["Efectivo contado", shift.countedCash],
    ["Diferencia", shift.difference],
    ["Observación de cierre", shift.closingNote || ""],
    [],
    ["Registro", "Fecha (Perú)", "Tipo", "Método", "Pedido", "Importe", "Referencia", "Descripción"],
    ...shift.entries.map((item) => [
      item.id, localDate(item.at), item.type, item.methodCode, item.orderId,
      item.amount, item.reference, item.description,
    ]),
  ];
  const quote = (item: string | number | null) => {
    const s = item == null ? "" : String(item);
    const safe = /^[=+@\t\r]/.test(s) || /^-\D/.test(s) ? "'" + s : s;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const csv = "\ufeff" + rows.map((r) => r.map(quote).join(";")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = "arqueo-central-turno-" + shift.id + ".csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}
function EntryList({ entries }: { entries: CashEntry[] }) {
  if (!entries.length) return <Center py={38}><Text size="sm" c={muted}>No hay movimientos registrados en este turno.</Text></Center>;
  return <Stack gap="xs">
    {[...entries].reverse().map((entry) => (
      <Paper key={entry.id} p="sm" radius="md" className={styles.entry}>
        <Group justify="space-between" align="flex-start" gap="xs">
          <Box>
            <Text c="white" fw={750} size="sm">{getEntryLabel(entry)}</Text>
            <Text c={muted} size="xs" mt={3}>{localDate(entry.at)}</Text>
            {entry.description && <Text c="#d5cbd4" size="xs" mt={5}>{entry.description}</Text>}
            {entry.reference && <Text c={muted} size="xs">Referencia: {entry.reference}</Text>}
          </Box>
          <Box ta="right">
            <Text fw={800} c={entry.type === "CASH_OUT" ? "#ff9c9c" : "#b2e9c1"}>
              {entry.type === "CASH_OUT" ? "−" : "+"}{money.format(entry.amount)}
            </Text>
            <Badge mt={4} variant="light" color={entry.type === "SALE" ? "blue" : "gray"}>
              {entry.type === "SALE" ? (methodLabels[entry.methodCode] || entry.methodCode) : "Efectivo"}
            </Badge>
          </Box>
        </Group>
      </Paper>
    ))}
  </Stack>;
}

export default function Sales() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("summary");
  const [search, setSearch] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [openModal, setOpenModal] = useState(false);
  const [openingCash, setOpeningCash] = useState<string | number>("");
  const [payOrder, setPayOrder] = useState<OrderResponse | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("CASH_IN");
  const [movementModal, setMovementModal] = useState(false);
  const [movementAmount, setMovementAmount] = useState<string | number>("");
  const [movementReason, setMovementReason] = useState("");
  const [closeModal, setCloseModal] = useState(false);
  const [countedCash, setCountedCash] = useState<string | number>("");
  const [closingNote, setClosingNote] = useState("");

  const shiftQuery = useQuery({
    queryKey: ["cashier", "shift"],
    queryFn: cashRegisterService.current,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const ordersQuery = useQuery({
    queryKey: ["cashier", "orders"],
    queryFn: async () => {
      const response = await orderService.getAllOrders();
      if (!response.success) throw new Error(response.message);
      return response.data || [];
    },
    refetchInterval: 15_000,
  });
  const methodsQuery = useQuery({
    queryKey: ["cashier", "methods"],
    queryFn: cashRegisterService.methods,
    staleTime: 60_000,
  });
  const historyQuery = useQuery({
    queryKey: ["cashier", "history"],
    queryFn: cashRegisterService.history,
    enabled: tab === "history",
  });

  const shift = shiftQuery.data;
  const methods = useMemo(
    () => (methodsQuery.data || []).filter((m) =>
      m.provider?.toUpperCase() === "INTERNAL" && ["CASH", "YAPE", "PLIN", "TRANSFER"].includes(m.code.toUpperCase())),
    [methodsQuery.data]
  );
  const selectedMethod = methods.find((m) => String(m.id) === methodId);
  const requiresReference = selectedMethod?.code !== "CASH";
  const orders = ordersQuery.data || [];
  const awaiting = useMemo(() => orders.filter(payable).sort((a,b) => b.id - a.id), [orders]);
  const shownOrders = useMemo(() => {
    const s = search.trim().toLowerCase();
    return awaiting.filter((o) => !s || [String(o.id), o.customerName, o.tableCode || "",
      ...(o.details || []).map((i) => i.productName)].join(" ").toLowerCase().includes(s)).slice(0, 80);
  }, [awaiting, search]);
  const paidInShift = new Set((shift?.entries || []).filter((e) => e.type === "SALE").map((e) => e.orderId));
  const expected = Number(shift?.expectedCash || 0);
  const countedValue = asNumber(countedCash);
  const differenceCents = moneyNumber(countedValue) - moneyNumber(expected);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["cashier"] });
    await qc.invalidateQueries({ queryKey: ["waiter", "orders"] });
  };
  const mutationError = (error: unknown) => {
    toast.error(errorText(error));
    void refresh();
  };
  const openShift = useMutation({
    mutationFn: () => cashRegisterService.open(asNumber(openingCash)),
    onSuccess: async () => { toast.success("Turno de caja abierto."); setOpenModal(false); setOpeningCash(""); await refresh(); },
    onError: mutationError,
  });
  const collect = useMutation({
    mutationFn: () => {
      if (!payOrder || !selectedMethod) throw new Error("Selecciona un método de pago válido.");
      return cashRegisterService.collect(payOrder.id, selectedMethod.id, paymentReference.trim() || undefined);
    },
    onSuccess: async () => {
      toast.success("Cobro registrado y confirmado en el turno.");
      setPayOrder(null); setMethodId(null); setPaymentReference("");
      await refresh();
    },
    onError: mutationError,
  });
  const movement = useMutation({
    mutationFn: () => cashRegisterService.move(movementType, asNumber(movementAmount), movementReason.trim()),
    onSuccess: async () => {
      toast.success("Movimiento de efectivo registrado.");
      setMovementModal(false); setMovementAmount(""); setMovementReason("");
      await refresh();
    },
    onError: mutationError,
  });
  const closeShift = useMutation({
    mutationFn: () => cashRegisterService.close(countedValue, closingNote.trim()),
    onSuccess: async (closed) => {
      toast.success("Cierre registrado. Diferencia: " + money.format(closed.difference || 0));
      setCloseModal(false); setCountedCash(""); setClosingNote("");
      setTab("history");
      await refresh();
    },
    onError: mutationError,
  });

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try { await logoutFromServer(); }
    finally { setLoggingOut(false); navigate("/auth/login", { replace: true }); }
  };

  const showCollect = (order: OrderResponse) => {
    setPayOrder(order);
    setMethodId(methods.find((m) => m.code === "CASH")?.id.toString() || null);
    setPaymentReference("");
  };

  return <Box className={styles.root}>
    <Box className={styles.header}>
      <Box maw={1480} mx="auto" px={{ base: "md", md: "xl" }} py="lg">
        <Group justify="space-between" gap="lg" wrap="wrap">
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={54} color="red" radius="lg"><Wallet size={29}/></ThemeIcon>
            <Box>
              <Text c="#f77786" tt="uppercase" size="xs" fw={850} lts={1.7}>
                Restaurant Central / Personal
              </Text>
              <Title c="white" order={1} fw={850} mt={3}>Panel del cajero</Title>
              <Text c={muted} size="sm" mt={4}>
                {user?.fullName || user?.username || "Cajero"} · Cobros y arqueo de caja
              </Text>
            </Box>
          </Group>
          <Group gap="xs">
            <Button variant="default" leftSection={<RefreshCw size={16}/>}
              loading={shiftQuery.isFetching || ordersQuery.isFetching}
              onClick={() => void refresh()}>Actualizar</Button>
            <Button variant="subtle" leftSection={<LogOut size={16}/>}
              loading={loggingOut} onClick={() => void logout()}>Salir</Button>
          </Group>
        </Group>
      </Box>
    </Box>

    <Box maw={1480} mx="auto" px={{ base: "md", md: "xl" }} py="xl">
      <Paper className={styles.hero} radius="xl" p={{ base: "lg", md: "xl" }}>
        <Box className={styles.heroInner}>
          <Group justify="space-between" align="center" gap="md">
            <Box>
              <Text tt="uppercase" c="#f7a3ab" size="xs" fw={850} lts={1.7}>
                <CircleDollarSign size={16} style={{ verticalAlign: "middle", marginRight: 8 }}/>
                Control de ingresos
              </Text>
              <Title c="white" order={2} fw={850} mt="xs">
                {shift ? "Tu caja está abierta" : "Abre tu turno para comenzar"}
              </Title>
              <Text c="#e4d6e0" size="sm" mt="sm" maw={670} lh={1.6}>
                Registra cobros reales, controla ingresos y retiros de efectivo y verifica el arqueo al finalizar el turno.
              </Text>
              {shift && <Badge mt="md" variant="light" color="green" size="lg">
                Turno #{shift.id} · Apertura {localDate(shift.openedAt)}
              </Badge>}
            </Box>
            {shift ? <Badge color="green" variant="filled" size="lg" leftSection={<CheckCircle2 size={14}/>}>Caja abierta</Badge> :
              <Button color="red" size="lg" leftSection={<Plus size={18}/>}
                onClick={() => setOpenModal(true)} disabled={shiftQuery.isPending || shiftQuery.isError}>
                Abrir caja
              </Button>}
          </Group>
        </Box>
      </Paper>

      {shiftQuery.isError && <Alert mt="lg" color="red" title="No se pudo consultar tu turno"
        icon={<AlertCircle size={18}/>}>{errorText(shiftQuery.error)}</Alert>}
      {shiftQuery.isPending && <Center py={60}><Loader color="red"/></Center>}

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" mt="lg">
        <Metric label="Cobros del turno" value={shift ? money.format(totalSales(shift)) : "—"}
          hint="Solo pagos registrados en esta caja" Icon={CreditCard} color="blue"/>
        <Metric label="Efectivo esperado" value={shift ? money.format(expected) : "—"}
          hint="Fondo + cobros + ingresos − retiros" Icon={Banknote} color="green"/>
        <Metric label="Pedidos pendientes de cobro" value={ordersQuery.isPending ? "—" : String(awaiting.length)}
          hint="Salón y para llevar, sin pagos confirmados" Icon={ReceiptText} color="orange"/>
        <Metric label="Cobros registrados" value={shift ? String(shift.salesCount) : "—"}
          hint="Operaciones de este turno" Icon={ClipboardList} color="red"/>
      </SimpleGrid>

      <Tabs value={tab} onChange={(value) => { if (value) setTab(value as Tab); }} mt="xl" color="red">
        <ScrollArea type="auto" offsetScrollbars>
          <Tabs.List>
            <Tabs.Tab value="summary" leftSection={<Wallet size={17}/>}>Resumen</Tabs.Tab>
            <Tabs.Tab value="payments" leftSection={<ReceiptText size={17}/>}>Cobros</Tabs.Tab>
            <Tabs.Tab value="movements" leftSection={<ArrowDownLeft size={17}/>}>Movimientos</Tabs.Tab>
            <Tabs.Tab value="closing" leftSection={<LockKeyhole size={17}/>}>Cierre de caja</Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<History size={17}/>}>Historial</Tabs.Tab>
          </Tabs.List>
        </ScrollArea>
      </Tabs>

      {tab === "summary" && <Stack gap="lg" mt="lg">
        <Paper className={styles.panel} radius="xl" p="lg">
          <Group justify="space-between" mb="md">
            <Box><Title order={3} c="white">Conciliación por método de pago</Title>
              <Text c={muted} size="xs" mt={5}>No se mezclan transferencias con efectivo físico.</Text></Box>
            {shift && <Button variant="light" color="gray" size="xs" leftSection={<FileDown size={15}/>}
              onClick={() => downloadCsv(shift)}>Exportar registro</Button>}
          </Group>
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
            {["CASH","YAPE","PLIN","TRANSFER"].map((m) => <Paper p="md" key={m} className={styles.entry} radius="lg">
              <Text c={muted} size="xs">{methodLabels[m]}</Text>
              <Title order={3} c="white" mt={7}>{shift ? money.format(totalMethod(shift,m)) : "—"}</Title>
            </Paper>)}
          </SimpleGrid>
          <Divider my="lg" color="#45404a"/>
          <SimpleGrid cols={{ base: 1, sm: 3 }}>
            <Box><Text size="xs" c={muted}>Fondo de apertura</Text>
              <Text fw={800} c="white">{shift ? money.format(shift.openingCash) : "—"}</Text></Box>
            <Box><Text size="xs" c={muted}>Ingresos de efectivo / Retiros</Text>
              <Text fw={800} c="white">{shift ? money.format(shift.cashIn) + " / " + money.format(shift.cashOut) : "—"}</Text></Box>
            <Box><Text size="xs" c={muted}>Saldo esperado</Text>
              <Text fw={800} c="#b2e8bd">{shift ? money.format(shift.expectedCash) : "—"}</Text></Box>
          </SimpleGrid>
        </Paper>
        <Paper className={styles.panel} p="lg" radius="xl">
          <Group justify="space-between" mb="md">
            <Title order={3} c="white">Movimientos recientes</Title>
            <Button variant="subtle" color="red" onClick={() => setTab("movements")}>Ver todos</Button>
          </Group>
          <EntryList entries={(shift?.entries || []).slice(-6)}/>
        </Paper>
        <Alert color="blue" variant="light" icon={<ShieldCheck size={18}/>}>
          El cierre incluye únicamente los pagos presenciales confirmados en tu turno.
          Niubiz se confirma fuera de caja; Yape, Plin y transferencias se registran manualmente
          y deben cotejarse contra sus respectivos comprobantes.
        </Alert>
      </Stack>}

      {tab === "payments" && <Stack mt="lg" gap="lg">
        <Paper className={styles.panel} p="lg" radius="xl">
          <Group justify="space-between" align="flex-start" wrap="wrap" gap="md" mb="lg">
            <Box><Title order={3} c="white">Pedidos pendientes de cobro</Title>
              <Text size="xs" c={muted} mt={6}>El importe definitivo lo determina el servidor.</Text></Box>
            {shift && <Box><NewDineInOrder onCreated={() => void refresh()} label="Nueva venta presencial"/></Box>}
          </Group>
          {!shift && <Alert color="orange" icon={<AlertCircle size={17}/>} mb="md">
            Abre tu turno antes de registrar ventas o cobrar pedidos.
          </Alert>}
          <TextInput value={search} onChange={(e) => setSearch(e.currentTarget.value)}
            placeholder="Buscar pedido, cliente o plato" leftSection={<Search size={16}/>}
            classNames={field} mb="lg"/>
          {ordersQuery.isPending ? <Center py={40}><Loader color="red"/></Center> :
            ordersQuery.isError ? <Alert color="red">{errorText(ordersQuery.error)}</Alert> :
            shownOrders.length === 0 ? <Center py={48}><Text c={muted}>No hay pedidos pendientes de cobro.</Text></Center> :
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              {shownOrders.map((order) => (
                <Paper className={styles.ticket} p="lg" radius="lg" key={order.id}>
                  <Group justify="space-between" align="flex-start">
                    <Box><Title order={3} c="white" size="h4">Pedido #{order.id}</Title>
                      <Text c={muted} size="xs" mt={5}>{channel(order)} · {order.customerName || "Cliente"}</Text></Box>
                    <Badge color="orange" variant="light">{statusLabels[order.statusCode] || order.statusCode}</Badge>
                  </Group>
                  <Stack gap={6} mt="md">
                    {(order.details || []).slice(0, 5).map((line) =>
                      <Text c="#ded6dd" size="sm" key={line.id}>
                        {line.quantity} × {line.productName}
                      </Text>)}
                    {(order.details || []).length > 5 && <Text c={muted} size="xs">
                      Y {(order.details || []).length - 5} producto(s) más
                    </Text>}
                  </Stack>
                  <Divider my="md" color="#4c4550"/>
                  <Group justify="space-between" align="center" gap="sm">
                    <Title order={3} c="white">{money.format(order.total)}</Title>
                    <Button color="red" disabled={!shift || paidInShift.has(order.id)}
                      leftSection={<Banknote size={17}/>} onClick={() => showCollect(order)}>Cobrar</Button>
                  </Group>
                </Paper>
              ))}
            </SimpleGrid>}
          {awaiting.length > 80 && <Text mt="md" c={muted} size="xs">Se muestran los primeros 80 resultados; utiliza el buscador para encontrar otro pedido.</Text>}
        </Paper>
      </Stack>}

      {tab === "movements" && <Stack mt="lg" gap="lg">
        <Paper className={styles.panel} p="lg" radius="xl">
          <Group justify="space-between" gap="md" mb="lg">
            <Box><Title order={3} c="white">Libro de caja</Title>
              <Text size="xs" c={muted} mt={6}>Operaciones registradas durante el turno actual.</Text></Box>
            <Button color="red" disabled={!shift} leftSection={<Plus size={17}/>}
              onClick={() => { setMovementType("CASH_IN"); setMovementModal(true); }}>Añadir movimiento</Button>
          </Group>
          <EntryList entries={shift?.entries || []}/>
        </Paper>
      </Stack>}

      {tab === "closing" && <Stack mt="lg" gap="lg">
        <Paper className={styles.panel} p="lg" radius="xl">
          <Group gap="sm" mb="lg">
            <ThemeIcon size={45} color="red" variant="light" radius="md"><LockKeyhole size={22}/></ThemeIcon>
            <Box><Title order={3} c="white">Arqueo y cierre del turno</Title>
              <Text c={muted} size="xs" mt={5}>Compara el saldo del sistema contra el efectivo contado físicamente.</Text></Box>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mb="lg">
            <Paper className={styles.entry} p="md" radius="lg"><Text c={muted} size="xs">Efectivo esperado</Text>
              <Title order={2} c="white" mt="xs">{shift ? money.format(expected) : "—"}</Title></Paper>
            <Paper className={styles.entry} p="md" radius="lg"><Text c={muted} size="xs">Ventas electrónicas manuales</Text>
              <Title order={2} c="white" mt="xs">{shift ? money.format(
                totalMethod(shift,"YAPE") + totalMethod(shift,"PLIN") + totalMethod(shift,"TRANSFER")
              ) : "—"}</Title></Paper>
          </SimpleGrid>
          <Alert color="yellow" icon={<AlertCircle size={17}/>} mb="lg">
            Debes contar los billetes y monedas físicamente. Los pagos digitales no forman parte del efectivo
            que hay en el cajón. Cualquier diferencia se registra con una justificación.
          </Alert>
          <Button color="red" size="md" disabled={!shift} leftSection={<LockKeyhole size={17}/>}
            onClick={() => { setCountedCash(""); setClosingNote(""); setCloseModal(true); }}>Realizar cierre de caja</Button>
        </Paper>
      </Stack>}

      {tab === "history" && <Stack mt="lg" gap="md">
        <Paper className={styles.panel} p="lg" radius="xl">
          <Group justify="space-between" mb="md">
            <Box><Title order={3} c="white">Historial de cierres</Title>
              <Text c={muted} size="xs" mt={5}>Últimos 20 turnos cerrados de esta cuenta.</Text></Box>
            <Button variant="default" size="xs" onClick={() => void historyQuery.refetch()}
              leftSection={<RefreshCw size={15}/>} loading={historyQuery.isFetching}>Actualizar</Button>
          </Group>
          {historyQuery.isPending ? <Center py={45}><Loader color="red"/></Center> :
            historyQuery.isError ? <Alert color="red">{errorText(historyQuery.error)}</Alert> :
            !historyQuery.data?.length ? <Center py={45}><Text c={muted}>Todavía no existen cierres registrados.</Text></Center> :
            <Table.ScrollContainer minWidth={710}>
              <Table verticalSpacing="md" highlightOnHover>
                <Table.Thead><Table.Tr>
                  <Table.Th>Turno</Table.Th><Table.Th>Fecha de cierre</Table.Th>
                  <Table.Th>Efectivo esperado</Table.Th><Table.Th>Contado</Table.Th>
                  <Table.Th>Diferencia</Table.Th><Table.Th>Reporte</Table.Th>
                </Table.Tr></Table.Thead>
                <Table.Tbody>{historyQuery.data.map((item) =>
                  <Table.Tr key={item.id}>
                    <Table.Td><Text c="white" fw={700}>#{item.id}</Text></Table.Td>
                    <Table.Td><Text c={muted} size="sm">{localDate(item.closedAt)}</Text></Table.Td>
                    <Table.Td><Text c="white">{money.format(item.expectedCash)}</Text></Table.Td>
                    <Table.Td><Text c="white">{money.format(item.countedCash || 0)}</Text></Table.Td>
                    <Table.Td><Badge variant="light" color={moneyNumber(item.difference || 0) === 0 ? "green" : "orange"}>
                      {money.format(item.difference || 0)}
                    </Badge></Table.Td>
                    <Table.Td><Button size="xs" color="red" variant="light"
                      leftSection={<FileDown size={15}/>} onClick={() => downloadCsv(item)}>Descargar CSV</Button></Table.Td>
                  </Table.Tr>)}</Table.Tbody>
              </Table>
            </Table.ScrollContainer>}
        </Paper>
      </Stack>}

      <Group mt="xl" gap="xs">
        <ShieldCheck size={16} color="#ac9ca7"/>
        <Text c={muted} size="xs">
          Los cierres conservan las cifras reales del turno. No se incluyen pagos pendientes ni ventas no cobradas.
          Todos los horarios se muestran en America/Lima.
        </Text>
      </Group>
    </Box>

    <Modal opened={openModal} onClose={() => { if (!openShift.isPending) setOpenModal(false); }}
      centered size="md" title="Apertura de caja" classNames={{
        content: styles.modalContent, header: styles.modalHeader, title: styles.modalTitle, close: styles.modalClose,
      }}>
      <Stack gap="lg">
        <Text c={muted} size="sm">Introduce el fondo de efectivo con el que empieza este turno.</Text>
        <NumberInput label="Fondo inicial (S/)" required min={0} decimalScale={2}
          value={openingCash} onChange={setOpeningCash} classNames={field} hideControls
          placeholder="0.00"/>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setOpenModal(false)} disabled={openShift.isPending}>Cancelar</Button>
          <Button color="red" loading={openShift.isPending}
            disabled={openingCash === "" || !Number.isFinite(asNumber(openingCash)) || asNumber(openingCash) < 0}
            onClick={() => openShift.mutate()}>Confirmar apertura</Button>
        </Group>
      </Stack>
    </Modal>

    <Modal opened={payOrder !== null} centered size="lg"
      onClose={() => { if (!collect.isPending) setPayOrder(null); }}
      title={"Cobrar pedido #" + (payOrder?.id || "")} classNames={{
        content: styles.modalContent, header: styles.modalHeader, title: styles.modalTitle, close: styles.modalClose,
      }}>
      <Stack gap="lg">
        <Paper className={styles.entry} p="md" radius="lg">
          <Text c={muted} size="xs">Importe exacto del pedido</Text>
          <Title order={2} c="white" mt={5}>{money.format(payOrder?.total || 0)}</Title>
          <Text c={muted} size="xs" mt={5}>Se cobrará el total, no se permiten pagos parciales.</Text>
        </Paper>
        <Select label="Método de pago" required placeholder="Selecciona un método"
          value={methodId} onChange={(value) => { setMethodId(value); setPaymentReference(""); }}
          data={methods.map((method) => ({ value: String(method.id),
            label: methodLabels[method.code] || method.name || method.code }))}
          classNames={selectStyles} comboboxProps={{ withinPortal: false }}/>
        {methodsQuery.isError && <Alert color="red">No se cargaron los métodos de cobro.</Alert>}
        {requiresReference && selectedMethod && <TextInput label="Referencia de operación" required minLength={6}
          placeholder="Código visible en el comprobante" classNames={field}
          description="Confirma manualmente el abono antes de registrarlo en caja."
          value={paymentReference} onChange={(e) => setPaymentReference(e.currentTarget.value)}/>}
        <Alert color={requiresReference ? "yellow" : "blue"} icon={<ShieldCheck size={17}/>}>
          {requiresReference
            ? "El registro de Yape, Plin o transferencia es una verificación manual del cajero, no una confirmación de la entidad financiera."
            : "Confirma que recibiste el dinero en efectivo antes de guardar. No podrás cobrar dos veces el mismo pedido."}
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" disabled={collect.isPending} onClick={() => setPayOrder(null)}>Cancelar</Button>
          <Button color="red" loading={collect.isPending}
            disabled={!shift || !selectedMethod || (requiresReference && paymentReference.trim().length < 6)}
            onClick={() => collect.mutate()}>Confirmar cobro</Button>
        </Group>
      </Stack>
    </Modal>

    <Modal opened={movementModal} centered size="md"
      onClose={() => { if (!movement.isPending) setMovementModal(false); }}
      title="Movimiento de efectivo" classNames={{
        content: styles.modalContent, header: styles.modalHeader, title: styles.modalTitle, close: styles.modalClose,
      }}>
      <Stack gap="lg">
        <Select label="Tipo de movimiento" required value={movementType}
          data={[{value:"CASH_IN",label:"Ingreso de efectivo"},{value:"CASH_OUT",label:"Retiro de efectivo"}]}
          onChange={(value) => setMovementType(value as MovementType || "CASH_IN")}
          classNames={selectStyles} comboboxProps={{ withinPortal: false }}/>
        <NumberInput label="Importe (S/)" required min={0.01} decimalScale={2}
          placeholder="0.00" hideControls value={movementAmount} onChange={setMovementAmount} classNames={field}/>
        <Textarea label="Motivo documentado" required minLength={5} maxLength={500} minRows={3}
          value={movementReason} onChange={(e) => setMovementReason(e.currentTarget.value)}
          classNames={field} placeholder="Motivo del ingreso o retiro"/>
        <Alert color="blue" icon={movementType === "CASH_IN" ? <ArrowDownLeft size={17}/> : <ArrowUpRight size={17}/>}>
          {movementType === "CASH_IN" ? "Este importe aumentará el efectivo esperado." :
            "Este importe disminuirá el efectivo esperado. No puedes retirar más que el saldo disponible."}
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" disabled={movement.isPending} onClick={() => setMovementModal(false)}>Cancelar</Button>
          <Button color="red" loading={movement.isPending}
            disabled={!shift || asNumber(movementAmount) <= 0 || movementReason.trim().length < 5}
            onClick={() => movement.mutate()}>Registrar movimiento</Button>
        </Group>
      </Stack>
    </Modal>

    <Modal opened={closeModal} centered size="lg"
      closeOnClickOutside={!closeShift.isPending} closeOnEscape={!closeShift.isPending}
      onClose={() => { if (!closeShift.isPending) setCloseModal(false); }}
      title="Arqueo final y cierre de caja" classNames={{
        content: styles.modalContent, header: styles.modalHeader, title: styles.modalTitle, close: styles.modalClose,
      }}>
      <Stack gap="lg">
        <Paper className={styles.entry} p="md" radius="lg">
          <Text c={muted} size="xs">Saldo de efectivo según el registro</Text>
          <Title order={2} c="white" mt={5}>{money.format(expected)}</Title>
          <Text c={muted} mt="xs" size="xs">Apertura + cobros en efectivo + ingresos − retiros.</Text>
        </Paper>
        <NumberInput label="Efectivo contado físicamente (S/)" required min={0}
          value={countedCash} onChange={setCountedCash} hideControls decimalScale={2}
          classNames={field} placeholder="Escribe el importe que contaste"/>
        {countedCash !== "" && <Alert color={differenceCents === 0 ? "green" : "orange"}
          title={differenceCents === 0 ? "Caja cuadrada" : "Diferencia detectada"}
          icon={differenceCents === 0 ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}>
          Diferencia: {money.format(differenceCents / 100)}.
          {differenceCents !== 0 && " Debes indicar una explicación para cerrar el turno."}
        </Alert>}
        <Textarea label="Observación del cierre" minRows={3} maxLength={500}
          required={differenceCents !== 0} value={closingNote}
          onChange={(e) => setClosingNote(e.currentTarget.value)}
          description="Obligatoria si hay faltante o sobrante; se conservará en el arqueo."
          placeholder="Indica la causa de cualquier diferencia..." classNames={field}/>
        <Alert color="yellow" icon={<AlertCircle size={17}/>}>
          El cierre bloquea nuevos cobros en este turno. Revisa las operaciones antes de confirmar.
        </Alert>
        <Group justify="flex-end">
          <Button variant="default" disabled={closeShift.isPending} onClick={() => setCloseModal(false)}>Cancelar</Button>
          <Button color="red" leftSection={<LockKeyhole size={17}/>} loading={closeShift.isPending}
            disabled={!shift || countedCash === "" || countedValue < 0 ||
              (differenceCents !== 0 && closingNote.trim().length < 10)}
            onClick={() => closeShift.mutate()}>Confirmar cierre</Button>
        </Group>
      </Stack>
    </Modal>
  </Box>;
}
