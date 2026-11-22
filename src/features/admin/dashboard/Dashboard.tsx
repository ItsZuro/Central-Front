import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { Alert, Badge, Box, Button, Center, Divider, Group, Paper, SimpleGrid, Stack, Table, Text, ThemeIcon, Title } from "@mantine/core";
import { Activity, AlertTriangle, ArrowRight, CalendarDays, ChartNoAxesCombined, CircleCheck, ClipboardList, Coffee, PackageOpen, Plus, RefreshCw, ShoppingBag, Tags, TrendingUp, UserRound, UsersRound, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";

interface Product {
  id: number;
  name: string;
  categoryName?: string;
  price: number;
  active: boolean;
}

interface TopProduct {
  productId: number;
  productName: string;
  totalQuantitySold: number;
  totalRevenue: number;
}

interface Summary {
  totalOrders: number;
  totalSales: number;
  ordersToday: number;
  salesToday: number;
  topProducts: TopProduct[];
  salesLast7Days: Record<string, number>;
  ordersLast7Days: Record<string, number>;
}

interface InventoryItem {
  ingredientId: number;
  ingredientName: string;
  currentStock: number;
  minimumStock: number;
  status: string;
  unitName: string;
}

interface AdminData {
  products: Product[] | null;
  categories: number | null;
  users: number | null;
  summary: Summary | null;
  inventory: InventoryItem[] | null;
}

const money = (value: number) =>
  "S/ " + Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const dayLabel = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString("es-PE", { weekday: "short", day: "numeric" });
};

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = Boolean(user?.roles?.includes("ROLE_ADMIN"));
  const [state, setState] = useState<AdminData>({ products: null, categories: null, users: null, summary: null, inventory: null });
  const [pending, setPending] = useState(true);
  const [failed, setFailed] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);

  const load = useCallback(async () => {
    setPending(true);
    const results = await Promise.allSettled([
      api.get("reports/summary"),
      api.get("products/all"),
      api.get("categories"),
      isAdmin ? api.get("users/admin") : Promise.resolve({ data: { data: null } }),
      api.get("reports/inventory"),
    ]);
    const [summary, products, categories, users, inventory] = results;
    const failures: string[] = [];
    if (summary.status === "rejected") failures.push("reportes");
    if (products.status === "rejected") failures.push("productos");
    if (categories.status === "rejected") failures.push("categorías");
    if (isAdmin && users.status === "rejected") failures.push("usuarios");
    if (inventory.status === "rejected") failures.push("inventario");

    setState({
      summary: summary.status === "fulfilled" ? summary.value.data?.data || null : null,
      products: products.status === "fulfilled" && Array.isArray(products.value.data?.data) ? products.value.data.data : null,
      categories: categories.status === "fulfilled" && Array.isArray(categories.value.data?.data) ? categories.value.data.data.length : null,
      users: users.status === "fulfilled" && Array.isArray(users.value.data?.data) ? users.value.data.data.length : null,
      inventory: inventory.status === "fulfilled" && Array.isArray(inventory.value.data?.data) ? inventory.value.data.data : null,
    });
    setFailed(failures);
    setPending(false);
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load, refresh]);

  const chartData = useMemo(() => {
    const sales = state.summary?.salesLast7Days || {};
    const orders = state.summary?.ordersLast7Days || {};
    return Array.from(new Set([...Object.keys(sales), ...Object.keys(orders)]))
      .sort()
      .map((date) => ({
        date,
        label: dayLabel(date),
        sales: Number(sales[date] || 0),
        orders: Number(orders[date] || 0),
      }));
  }, [state.summary]);

  const lowStock = useMemo(() =>
    state.inventory?.filter((item) => ["BAJO", "CRÍTICO", "CRITICO"].includes(String(item.status).toUpperCase())) || [],
  [state.inventory]);
  const activeProducts = state.products?.filter((product) => product.active).length;
  const hasSales = chartData.some((point) => point.sales > 0);

  const cards = [
    { label: "Ventas de hoy", value: state.summary ? money(state.summary.salesToday) : "—", detail: "Ingresos registrados hoy", icon: TrendingUp, iconColor: "text-emerald-700", iconBg: "bg-emerald-50", to: "/admin/reports" },
    { label: "Pedidos de hoy", value: state.summary ? String(state.summary.ordersToday) : "—", detail: state.summary ? `${state.summary.totalOrders} pedidos históricos` : "Conectado a reportes", icon: ShoppingBag, iconColor: "text-blue-700", iconBg: "bg-blue-50", to: "/admin/reports" },
    { label: "Productos activos", value: activeProducts == null ? "—" : String(activeProducts), detail: state.products ? `${state.products.length} registrados en total` : "Catálogo del restaurante", icon: UtensilsCrossed, iconColor: "text-red-700", iconBg: "bg-red-50", to: "/admin/products" },
    { label: "Alertas de stock", value: state.inventory ? String(lowStock.length) : "—", detail: state.inventory ? (lowStock.length ? "Requieren revisión" : "Sin alertas registradas") : "Inventario", icon: AlertTriangle, iconColor: "text-amber-700", iconBg: "bg-amber-50", to: "/admin/reports" },
  ];

  const tools = [
    { label: "Agregar producto", help: "Actualizar catálogo", icon: Plus, to: "/admin/products" },
    { label: "Crear categoría", help: "Organizar menú", icon: Tags, to: "/admin/categories" },
    ...(isAdmin ? [{ label: "Administrar usuarios", help: "Equipo y permisos", icon: UsersRound, to: "/admin/users" }] : []),
    { label: "Mi perfil", help: "Datos y seguridad", icon: UserRound, to: "/admin/profile" },
  ];

  return (
    <Stack maw={1500} mx="auto" gap="xl">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Box>
          <Text c="red.7" fw={800} size="xs" tt="uppercase" lts={1.5}>Restaurant Central / Administración</Text>
          <Title order={1} mt={7} fw={850}>Resumen operativo</Title>
          <Text c="dimmed" size="sm" mt="xs">
            Bienvenido, {user?.firstName || user?.username || "administrador"}. Supervisa las operaciones y la actividad de tu restaurante.
          </Text>
        </Box>
        <Group gap="sm">
          <Button variant="default" leftSection={<RefreshCw size={17} />} loading={pending} onClick={() => setRefresh((x) => x + 1)}>Actualizar</Button>
          <Button component={Link} to="/admin/products" leftSection={<Plus size={18} />}>Nuevo plato</Button>
        </Group>
      </Group>

      {failed.length > 0 && (
        <Alert color="yellow" title="Algunos datos no están disponibles" icon={<AlertTriangle size={19} />}>
          No se pudieron consultar {failed.join(", ")}. Los valores sin información se indican con «—».
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, xs: 2, xl: 4 }} spacing="lg">
        {cards.map((card, index) => (
          <Link key={card.label} to={card.to} style={{ textDecoration: "none", color: "inherit" }}>
            <Paper withBorder shadow="xs" p="lg" h="100%" radius="lg" style={{ transition: "box-shadow .15s ease" }}>
              <Group justify="space-between" align="flex-start">
                <ThemeIcon size={46} radius="md" variant="light" color={["green", "blue", "red", "orange"][index]}>
                  <card.icon size={23} />
                </ThemeIcon>
                <ArrowRight size={17} color="#a0aec0"/>
              </Group>
              <Text mt="lg" size="xs" fw={800} c="dimmed" tt="uppercase" lts={0.7}>{card.label}</Text>
              <Title order={2} fw={850} mt="xs">{pending ? "…" : card.value}</Title>
              <Text mt="xs" c="dimmed" size="xs">{card.detail}</Text>
            </Paper>
          </Link>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper withBorder shadow="xs" p="xl">
          <Group justify="space-between">
            <Box>
              <Group gap="sm"><ThemeIcon variant="light" color="red" size="lg"><ChartNoAxesCombined size={20}/></ThemeIcon><Title order={3} size="lg">Evolución de ventas</Title></Group>
              <Text c="dimmed" mt="xs" size="xs">Ingresos registrados durante los últimos siete días</Text>
            </Box>
            <Badge color="red" variant="light" leftSection={<CalendarDays size={13}/>}>7 días</Badge>
          </Group>
          {state.summary && hasSales ? (
            <Box h={275} mt="lg">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="central-sales-mantine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#dc2626" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#edf0f4" strokeDasharray="4 4"/>
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={55}/>
                  <Tooltip formatter={(value) => money(Number(value))} labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.date || "")}/>
                  <Area type="monotone" dataKey="sales" name="Ventas" stroke="#dc2626" strokeWidth={3} fill="url(#central-sales-mantine)" activeDot={{r:5}}/>
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Stack bg="gray.0" h={275} mt="lg" align="center" justify="center" gap="xs">
              <ThemeIcon variant="light" color="gray" size={56} radius="xl"><Activity size={26}/></ThemeIcon>
              <Text fw={650}>{pending ? "Cargando ventas…" : state.summary ? "Aún no hay ventas" : "No se pudieron consultar las ventas"}</Text>
              <Text c="dimmed" size="xs" ta="center">Este gráfico mostrará únicamente pedidos reales.</Text>
            </Stack>
          )}
          <Divider my="lg"/>
          <SimpleGrid cols={2}>
            <Box>
              <Text size="xs" c="dimmed">Ventas acumuladas</Text>
              <Title order={3} mt={5}>{state.summary ? money(state.summary.totalSales) : "—"}</Title>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Total de pedidos</Text>
              <Title order={3} mt={5}>{state.summary ? state.summary.totalOrders : "—"}</Title>
            </Box>
          </SimpleGrid>
        </Paper>

        <Paper withBorder shadow="xs" p="xl">
          <Group gap="sm"><ThemeIcon variant="light" color="red" size="lg"><ClipboardList size={20}/></ThemeIcon><Box><Title order={3} size="lg">Acciones rápidas</Title><Text size="xs" c="dimmed" mt={3}>Herramientas más utilizadas</Text></Box></Group>
          <Stack mt="xl" gap="sm">
            {tools.map((item) => (
              <Paper key={item.to} component={Link} to={item.to} withBorder p="md" radius="md" style={{ textDecoration: "none", color: "inherit" }}>
                <Group wrap="nowrap">
                  <ThemeIcon variant="light" color="red" radius="md" size={43}><item.icon size={20}/></ThemeIcon>
                  <Box style={{flex:1}}>
                    <Text fw={750} size="sm">{item.label}</Text>
                    <Text size="xs" c="dimmed" mt={3}>{item.help}</Text>
                  </Box>
                  <ArrowRight size={17} color="#94a3b8"/>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Paper>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Paper withBorder shadow="xs" p="xl">
          <Group justify="space-between">
            <Group gap="sm"><ThemeIcon color="red" variant="light" size="lg"><Coffee size={19}/></ThemeIcon><Title order={3} size="lg">Platos más vendidos</Title></Group>
            <Button component={Link} to="/admin/reports" size="xs" variant="subtle" color="red">Ver reportes</Button>
          </Group>
          <Text mt="xs" c="dimmed" size="xs">Ordenados por número de unidades vendidas</Text>
          {state.summary?.topProducts?.length ? (
            <Table mt="lg" verticalSpacing="md" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Producto</Table.Th><Table.Th ta="right">Unidades</Table.Th><Table.Th ta="right">Importe</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{state.summary.topProducts.slice(0,5).map((product, idx) =>
                <Table.Tr key={product.productId}>
                  <Table.Td><Group gap="sm" wrap="nowrap"><Badge variant="light" color="red" size="lg">{idx+1}</Badge><Text size="sm" fw={650}>{product.productName}</Text></Group></Table.Td>
                  <Table.Td ta="right"><Text size="sm">{product.totalQuantitySold}</Text></Table.Td>
                  <Table.Td ta="right"><Text size="sm" fw={700}>{money(product.totalRevenue)}</Text></Table.Td>
                </Table.Tr>
              )}</Table.Tbody>
            </Table>
          ) : (
            <Center h={190}>
              <Stack gap="xs" align="center"><ThemeIcon color="gray" variant="light" size="xl"><PackageOpen size={24}/></ThemeIcon><Text fw={650} size="sm">Sin productos vendidos todavía</Text><Text c="dimmed" size="xs">Aparecerán después de los primeros pedidos.</Text></Stack>
            </Center>
          )}
        </Paper>

        <Paper withBorder shadow="xs" p="xl">
          <Group justify="space-between">
            <Group gap="sm"><ThemeIcon variant="light" color="orange" size="lg"><AlertTriangle size={19}/></ThemeIcon><Title order={3} size="lg">Inventario</Title></Group>
            <Badge color="gray" variant="light">{state.inventory?.length ?? "—"} ingredientes</Badge>
          </Group>
          <Text mt="xs" c="dimmed" size="xs">Alertas de reposición de ingredientes</Text>
          {lowStock.length ? (
            <Table mt="lg" verticalSpacing="md" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Ingrediente</Table.Th><Table.Th>Estado</Table.Th><Table.Th ta="right">Stock / Mínimo</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{lowStock.slice(0,5).map((item) =>
                <Table.Tr key={item.ingredientId}>
                  <Table.Td><Text size="sm" fw={700}>{item.ingredientName}</Text></Table.Td>
                  <Table.Td><Badge color="orange" variant="light">{item.status}</Badge></Table.Td>
                  <Table.Td ta="right"><Text size="sm">{item.currentStock} / {item.minimumStock}</Text></Table.Td>
                </Table.Tr>
              )}</Table.Tbody>
            </Table>
          ) : (
            <Center h={190}>
              <Stack align="center" gap="xs"><ThemeIcon color={state.inventory ? "green" : "gray"} variant="light" size="xl"><CircleCheck size={25}/></ThemeIcon><Text fw={650} size="sm">{state.inventory ? "Sin alertas de inventario" : "Inventario no disponible"}</Text><Text c="dimmed" size="xs">{state.inventory ? "Todas las existencias superan su mínimo." : "No se pudo recuperar la información."}</Text></Stack>
            </Center>
          )}
        </Paper>
      </SimpleGrid>

      <Paper withBorder p="sm" radius="lg">
        <Group justify="space-between" px="sm" gap="xs">
          <Group gap="xs"><CircleCheck size={16} color="green"/><Text size="xs" c="dimmed">Panel conectado a Restaurant Central · AWS</Text></Group>
          <Text size="xs" c="dimmed">
            {isAdmin ? "Usuarios: " + (state.users ?? "—") + " · " : ""}Categorías: {state.categories ?? "—"}
          </Text>
        </Group>
      </Paper>
    </Stack>
  );
}
