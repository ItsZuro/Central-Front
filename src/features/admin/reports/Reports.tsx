import { api } from "@/core/api/api";
import {
  Alert, Badge, Box, Button, Center, Divider, Group, Loader, Paper,
  SegmentedControl, SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import axios from "axios";
import {
  AlertTriangle, ArrowRight, CalendarDays, ChartColumnIncreasing,
  ClipboardList, CreditCard, PackageOpen, RefreshCw, ShoppingBasket,
  TrendingUp, UtensilsCrossed,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface OrderDetail {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: number;
  customerName?: string;
  date?: string;
  total: number;
  statusCode?: string;
  statusName?: string;
  details?: OrderDetail[];
}

interface Product {
  id: number;
  name: string;
  categoryName?: string;
}

interface PaymentSummary {
  paymentMethodName: string;
  totalTransactions: number;
  totalAmount: number;
}

type DateRange = { from: string; to: string };
type AggregatedProduct = { id: number; name: string; quantity: number; amount: number };
type CategoryTotal = { label: string; units: number };

const money = (value: number) =>
  "S/ " + Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const localDate = (date: Date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

const daysBefore = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date);
};

const initialRange = (): DateRange => ({ from: daysBefore(13), to: daysBefore(0) });
const validOrder = (order: Order) =>
  !["CANCELLED", "CANCELED", "CANCELADO"].includes((order.statusCode || "").toUpperCase());

const dateOf = (order: Order) => (order.date || "").slice(0, 10);
const inRange = (order: Order, range: DateRange) => {
  const date = dateOf(order);
  return !!date && date >= range.from && date <= range.to;
};

const dayName = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("es-PE", { day: "numeric", month: "short" });
};

const pctChange = (current: number, previous: number): number | null =>
  previous > 0 ? ((current - previous) / previous) * 100 : null;

function apiError(err: unknown): string {
  return axios.isAxiosError<{ message?: string }>(err)
    ? err.response?.data?.message || "No se pudieron consultar los pedidos."
    : "No fue posible conectar con el backend.";
}

export default function Reports() {
  const [draft, setDraft] = useState<DateRange>(initialRange);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [preset, setPreset] = useState("14");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<PaymentSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [ordersResult, productsResult, paymentsResult] = await Promise.allSettled([
      api.get("orders"),
      api.get("products/all"),
      api.get("reports/payments"),
    ]);

    if (ordersResult.status === "fulfilled" && Array.isArray(ordersResult.value.data?.data)) {
      setOrders(ordersResult.value.data.data);
    } else {
      setOrders(null);
      setError(ordersResult.status === "rejected"
        ? apiError(ordersResult.reason)
        : "El servidor no devolvió un listado válido de pedidos.");
    }

    setProducts(productsResult.status === "fulfilled" && Array.isArray(productsResult.value.data?.data)
      ? productsResult.value.data.data : []);
    setPayments(paymentsResult.status === "fulfilled" && Array.isArray(paymentsResult.value.data?.data)
      ? paymentsResult.value.data.data : null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, refresh]);

  const apply = () => {
    if (!draft.from || !draft.to || draft.from > draft.to) {
      toast.error("Selecciona un intervalo de fechas válido.");
      return;
    }
    setRange(draft);
    setPreset("custom");
  };

  const selectPreset = (value: string) => {
    setPreset(value);
    if (value === "custom") return;
    const days = Number(value);
    const next = { from: daysBefore(days - 1), to: daysBefore(0) };
    setDraft(next);
    setRange(next);
  };

  const visibleOrders = useMemo(
    () => (orders || []).filter((order) => inRange(order, range)),
    [orders, range],
  );
  const acceptedOrders = useMemo(
    () => visibleOrders.filter(validOrder),
    [visibleOrders],
  );
  const amount = useMemo(
    () => acceptedOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [acceptedOrders],
  );
  const avgTicket = acceptedOrders.length ? amount / acceptedOrders.length : 0;

  const previous = useMemo(() => {
    const start = new Date(range.from + "T00:00:00");
    const end = new Date(range.to + "T00:00:00");
    const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const prevTo = new Date(start);
    prevTo.setDate(prevTo.getDate() - 1);
    const prevFrom = new Date(prevTo);
    prevFrom.setDate(prevFrom.getDate() - dayCount + 1);
    const priorRange = { from: localDate(prevFrom), to: localDate(prevTo) };
    const priorOrders = (orders || []).filter((order) => validOrder(order) && inRange(order, priorRange));
    return {
      total: priorOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      count: priorOrders.length,
    };
  }, [orders, range]);

  const chartData = useMemo(() => {
    const first = new Date(range.from + "T00:00:00");
    const last = new Date(range.to + "T00:00:00");
    const days = Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000) + 1);
    return Array.from({ length: Math.min(days, 30) }, (_, index) => {
      const date = new Date(last);
      date.setDate(last.getDate() - Math.min(days, 30) + 1 + index);
      const key = localDate(date);
      const ordersForDay = acceptedOrders.filter((order) => dateOf(order) === key);
      return {
        day: dayName(key),
        amount: ordersForDay.reduce((sum, order) => sum + Number(order.total || 0), 0),
        count: ordersForDay.length,
      };
    });
  }, [range, acceptedOrders]);

  const categoryAndTopProducts = useMemo(() => {
    const categoryByProduct = new Map(products.map((product) => [product.id, product.categoryName || "Otros"]));
    const category = new Map<string, number>();
    const productTotals = new Map<number, AggregatedProduct>();
    for (const order of acceptedOrders) {
      for (const detail of order.details || []) {
        const qty = Math.max(0, Number(detail.quantity || 0));
        if (!qty) continue;
        const categoryName = categoryByProduct.get(detail.productId) || "Otros";
        category.set(categoryName, (category.get(categoryName) || 0) + qty);
        const current = productTotals.get(detail.productId);
        productTotals.set(detail.productId, {
          id: detail.productId,
          name: detail.productName || current?.name || "Producto",
          quantity: (current?.quantity || 0) + qty,
          amount: (current?.amount || 0) + qty * Number(detail.unitPrice || 0),
        });
      }
    }
    return {
      category: Array.from(category, ([label, units]) => ({label, units} as CategoryTotal))
        .sort((a, b) => b.units - a.units),
      products: [...productTotals.values()].sort((a, b) => b.quantity - a.quantity),
    };
  }, [acceptedOrders, products]);

  const recentOrders = useMemo(() => [...visibleOrders].sort(
    (a, b) => (b.date || "").localeCompare(a.date || ""),
  ).slice(0, 8), [visibleOrders]);

  const chartHasData = chartData.some((entry) => entry.count > 0);
  const isEmpty = orders !== null && visibleOrders.length === 0;
  const priorAverage = previous.count ? previous.total / previous.count : 0;

  const cards = [
    { label: "Importe de pedidos", value: money(amount), icon: TrendingUp, color: "red", note: "Pedidos no cancelados" },
    { label: "Pedidos del periodo", value: visibleOrders.length.toString(), icon: ClipboardList, color: "blue", note: "Incluye todos los estados" },
    { label: "Ticket promedio", value: money(avgTicket), icon: ShoppingBasket, color: "grape", note: "Pedidos no cancelados" },
    { label: "Productos pedidos", value: categoryAndTopProducts.products.reduce((a, b) => a + b.quantity, 0).toString(), icon: UtensilsCrossed, color: "orange", note: "Unidades en detalles de pedidos" },
  ];

  return (
    <Stack maw={1500} mx="auto" gap="xl">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Box>
          <Text c="red.7" fw={800} tt="uppercase" size="xs" lts={1.6}>Analítica / Restaurant Central</Text>
          <Title order={1} mt={7} fw={850}>Reportes de operación</Title>
          <Text c="dimmed" size="sm" mt={5}>Analiza los pedidos registrados y sus tendencias, sin métricas simuladas.</Text>
        </Box>
        <Button variant="default" leftSection={<RefreshCw size={17}/>} loading={loading}
          onClick={() => setRefresh((current) => current + 1)}>Actualizar datos</Button>
      </Group>

      <Paper withBorder p="md" radius="lg" shadow="xs">
        <Group justify="space-between" align="flex-end" gap="md" wrap="wrap">
          <Box>
            <Text size="xs" fw={700} c="dimmed" mb="xs">PERIODO DE ANÁLISIS</Text>
            <SegmentedControl size="sm" color="red" value={preset} onChange={selectPreset}
              data={[
                {label:"7 días",value:"7"}, {label:"14 días",value:"14"},
                {label:"30 días",value:"30"}, {label:"Personalizado",value:"custom"},
              ]}/>
          </Box>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <TextInput label="Desde" type="date" value={draft.from}
              onChange={(event) => {setDraft((current) => ({ ...current, from: event.currentTarget.value })); setPreset("custom");}}/>
            <TextInput label="Hasta" type="date" value={draft.to}
              onChange={(event) => {setDraft((current) => ({ ...current, to: event.currentTarget.value })); setPreset("custom");}}/>
            <Button onClick={apply} leftSection={<CalendarDays size={17}/>}>Aplicar</Button>
          </Group>
        </Group>
      </Paper>

      {error && <Alert color="red" icon={<AlertTriangle size={19}/>} title="No se pudieron cargar los pedidos">{error}</Alert>}

      {!error && isEmpty && (
        <Alert color="blue" variant="light" icon={<PackageOpen size={21}/>} title="No hay pedidos en las fechas seleccionadas">
          Los reportes mostrarán cifras y gráficos cuando se registren pedidos. Puedes cambiar el periodo para consultar otras fechas.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
        {cards.map((card) => (
          <Paper key={card.label} withBorder shadow="xs" radius="lg" p="lg">
            <Group justify="space-between">
              <ThemeIcon size={47} radius="md" variant="light" color={card.color}><card.icon size={22}/></ThemeIcon>
              <Badge size="sm" color="gray" variant="light">{range.from === range.to ? "1 día" : "Periodo"}</Badge>
            </Group>
            <Text size="xs" c="dimmed" fw={700} mt="lg">{card.label}</Text>
            <Title order={2} mt={5}>{loading ? "…" : orders === null ? "—" : card.value}</Title>
            <Text c="dimmed" size="xs" mt="xs">{card.note}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper withBorder p="xl" shadow="xs">
          <Group justify="space-between" wrap="wrap">
            <Box><Group gap="sm"><ThemeIcon variant="light" color="red"><ChartColumnIncreasing size={19}/></ThemeIcon><Title order={3} size="lg">Evolución del importe</Title></Group>
              <Text mt={5} c="dimmed" size="xs">Importes de pedidos por día, sin cancelaciones</Text>
            </Box>
            <Badge color="red" variant="light">{chartData.length} días</Badge>
          </Group>
          {loading ? <Center h={270}><Loader color="red"/></Center> : orders && chartHasData ? (
            <Box mt="lg" h={270}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{top:10,right:10,left:-9,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4"/>
                  <XAxis dataKey="day" fontSize={11} axisLine={false} tickLine={false}/>
                  <YAxis fontSize={11} axisLine={false} tickLine={false}/>
                  <Tooltip formatter={(value) => money(Number(value))}/>
                  <Bar dataKey="amount" name="Importe" fill="#e03131" radius={[5,5,0,0]} maxBarSize={35}/>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Center h={250}><Stack align="center" gap="xs">
              <ThemeIcon size={54} color="gray" variant="light"><ChartColumnIncreasing size={27}/></ThemeIcon>
              <Text fw={700} size="sm">Sin movimientos para graficar</Text>
              <Text size="xs" c="dimmed" ta="center">Aquí aparecerá la evolución cuando existan pedidos.</Text>
            </Stack></Center>
          )}
          <Divider my="lg"/>
          <SimpleGrid cols={3}>
            {[
              {label:"Importe vs anterior",value:pctChange(amount, previous.total)},
              {label:"Pedidos vs anterior",value:pctChange(acceptedOrders.length, previous.count)},
              {label:"Ticket vs anterior",value:pctChange(avgTicket, priorAverage)},
            ].map((item) => (
              <Box key={item.label}>
                <Text c="dimmed" size="xs">{item.label}</Text>
                <Text size="sm" mt={6} fw={800} c={item.value == null ? "dimmed" : item.value >= 0 ? "green.7" : "red.7"}>
                  {item.value == null ? "—" : (item.value > 0 ? "+" : "") + item.value.toFixed(1) + "%"}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Paper>

        <Paper withBorder shadow="xs" p="xl">
          <Group justify="space-between">
            <Box><Group gap="sm"><ThemeIcon variant="light" color="red"><UtensilsCrossed size={19}/></ThemeIcon><Title order={3} size="lg">Productos pedidos por categoría</Title></Group>
              <Text c="dimmed" size="xs" mt={5}>Unidades en pedidos del periodo</Text>
            </Box>
          </Group>
          {categoryAndTopProducts.category.length ? (
            <Stack mt="xl" gap="md">
              {categoryAndTopProducts.category.slice(0,6).map((item) => {
                const total = categoryAndTopProducts.category.reduce((sum, value) => sum + value.units, 0) || 1;
                return (
                  <Box key={item.label}>
                    <Group justify="space-between" mb={5}>
                      <Text fw={650} size="sm">{item.label}</Text>
                      <Text fw={750} size="sm">{item.units} unid.</Text>
                    </Group>
                    <Box h={10} bg="gray.1" style={{borderRadius:999,overflow:"hidden"}}>
                      <Box h="100%" bg="red.6" style={{width: String(100*item.units/total) + "%",borderRadius:999}}/>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          ) : (
            <Center h={315}><Stack align="center" gap="xs">
              <ThemeIcon color="gray" variant="light" size={54}><UtensilsCrossed size={24}/></ThemeIcon>
              <Text fw={700} size="sm">Aún no hay productos pedidos</Text>
              <Text c="dimmed" size="xs" ta="center">Las categorías se calcularán desde los productos de cada pedido.</Text>
              <Button mt="sm" variant="light" color="red" component={Link} to="/admin/products" rightSection={<ArrowRight size={15}/>}>Gestionar menú</Button>
            </Stack></Center>
          )}
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{base:1,lg:2}} spacing="lg">
        <Paper withBorder p="xl" shadow="xs">
          <Group justify="space-between" mb="sm">
            <Title order={3} size="lg">Productos más solicitados</Title>
            <Badge variant="light" color="red">Top 6</Badge>
          </Group>
          <Text c="dimmed" size="xs">Cantidades e importes tomados de los detalles de pedidos</Text>
          {categoryAndTopProducts.products.length ? (
            <Table.ScrollContainer minWidth={420}><Table mt="lg" striped highlightOnHover verticalSpacing="md">
              <Table.Thead><Table.Tr><Table.Th>Producto</Table.Th><Table.Th ta="right">Unidades</Table.Th><Table.Th ta="right">Subtotal</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{categoryAndTopProducts.products.slice(0,6).map((product) =>
                <Table.Tr key={product.id}><Table.Td><Text size="sm" fw={600}>{product.name}</Text></Table.Td>
                  <Table.Td ta="right">{product.quantity}</Table.Td><Table.Td ta="right">{money(product.amount)}</Table.Td>
                </Table.Tr>
              )}</Table.Tbody>
            </Table></Table.ScrollContainer>
          ) : <Center h={185}><Text size="sm" c="dimmed">No hay productos registrados en pedidos del periodo.</Text></Center>}
        </Paper>

        <Paper withBorder p="xl" shadow="xs">
          <Group justify="space-between" mb="sm">
            <Title order={3} size="lg">Métodos de pago</Title>
            <ThemeIcon color="blue" variant="light"><CreditCard size={18}/></ThemeIcon>
          </Group>
          <Text c="dimmed" size="xs">Resumen histórico de transacciones; no depende del filtro de fechas</Text>
          {payments?.length ? (
            <Table.ScrollContainer minWidth={320}><Table mt="lg" verticalSpacing="md" striped>
              <Table.Thead><Table.Tr><Table.Th>Método</Table.Th><Table.Th ta="right">Operaciones</Table.Th><Table.Th ta="right">Importe</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{payments.map((payment) =>
                <Table.Tr key={payment.paymentMethodName}>
                  <Table.Td><Text fw={650} size="sm">{payment.paymentMethodName}</Text></Table.Td>
                  <Table.Td ta="right">{payment.totalTransactions}</Table.Td>
                  <Table.Td ta="right">{money(Number(payment.totalAmount))}</Table.Td>
                </Table.Tr>
              )}</Table.Tbody>
            </Table></Table.ScrollContainer>
          ) : <Center h={185}><Text c="dimmed" size="sm">{payments === null ? "Métodos de pago no disponibles." : "Aún no existen pagos registrados."}</Text></Center>}
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="xl" shadow="xs">
        <Group justify="space-between" mb="lg">
          <Box>
            <Title order={3} size="lg">Pedidos recientes del periodo</Title>
            <Text mt={5} size="xs" c="dimmed">Hasta ocho pedidos reales, ordenados por fecha</Text>
          </Box>
          <Badge color="gray" variant="light">{recentOrders.length} mostrados</Badge>
        </Group>
        {recentOrders.length ? (
          <Table.ScrollContainer minWidth={650}>
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead><Table.Tr><Table.Th>ID</Table.Th><Table.Th>Cliente</Table.Th><Table.Th>Fecha</Table.Th><Table.Th>Estado</Table.Th><Table.Th ta="right">Importe</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{recentOrders.map((order) => (
                <Table.Tr key={order.id}>
                  <Table.Td><Text fw={750} size="sm">#{order.id}</Text></Table.Td>
                  <Table.Td><Text size="sm">{order.customerName || "Cliente no especificado"}</Text></Table.Td>
                  <Table.Td><Text size="sm">{order.date ? new Date(order.date).toLocaleString("es-PE", {dateStyle:"short",timeStyle:"short"}) : "—"}</Text></Table.Td>
                  <Table.Td><Badge variant="light" color={validOrder(order) ? "blue" : "red"}>{order.statusName || order.statusCode || "Sin estado"}</Badge></Table.Td>
                  <Table.Td ta="right"><Text size="sm" fw={700}>{money(Number(order.total))}</Text></Table.Td>
                </Table.Tr>
              ))}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : <Center h={135}><Text c="dimmed" size="sm">No hay pedidos dentro del rango seleccionado.</Text></Center>}
      </Paper>
    </Stack>
  );
}
