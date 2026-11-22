import { orderService } from "@/core/services/order/order.service";
import type { OrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Badge, Box, Button, Center, Divider, Group, Loader, Paper,
  SimpleGrid, Stack, Text, ThemeIcon, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Bike, CheckCircle2, Clock3, MapPin, PackageCheck, RefreshCw, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "../waiter/Waiter.module.css";

type DeliveryStatus = "OUT_FOR_DELIVERY" | "DELIVERED";

const labels: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En preparación",
  READY_FOR_PICKUP: "Listo para recoger",
  OUT_FOR_DELIVERY: "En camino",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export default function AssignedDeliveries() {
  const queryClient = useQueryClient();

  const deliveries = useQuery({
    queryKey: ["waiter", "deliveries", "mine"],
    queryFn: async () => {
      const response = await orderService.getAssignedDeliveries();
      if (!response.success) throw new Error(response.message);
      return response.data ?? [];
    },
    refetchInterval: 15_000,
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: DeliveryStatus }) => {
      const response = await orderService.updateAssignedDeliveryStatus(id, status);
      if (!response.success) throw new Error(response.message);
      return response.data;
    },
    onSuccess: async () => {
      toast.success("Estado del reparto actualizado.");
      await queryClient.invalidateQueries({ queryKey: ["waiter", "deliveries"] });
      await queryClient.invalidateQueries({ queryKey: ["waiter", "orders"] });
    },
    onError: () => toast.error("No se pudo actualizar el reparto. Comprueba la asignación y el estado del pedido."),
  });

  const orders: OrderResponse[] = deliveries.data || [];
  const pending = orders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.statusCode));

  return (
    <Box className={styles.root} py={{ base: "xl", md: 56 }} px="md">
      <Box maw={1080} mx="auto">
        <Stack gap="xl">
          <Group justify="space-between" align="flex-start" gap="md">
            <Box>
              <Button component={Link} to="/waiter" variant="subtle" color="gray" size="sm"
                leftSection={<ArrowLeft size={16} />}>Volver al panel del mesero</Button>
              <Group gap="sm" mt="lg">
                <ThemeIcon color="red" variant="light" radius="md" size={48}><Truck size={24} /></ThemeIcon>
                <Box>
                  <Title order={1} c="white" size="h2">Mis repartos asignados</Title>
                  <Text c="#aaa5b1" size="sm" mt={4}>Entregas vinculadas a tu cuenta de empleado.</Text>
                </Box>
              </Group>
            </Box>
            <Button variant="default" leftSection={<RefreshCw size={17} />}
              onClick={() => void deliveries.refetch()} loading={deliveries.isFetching}>Actualizar</Button>
          </Group>

          {deliveries.isError && (
            <Alert color="red" icon={<AlertCircle size={18} />} title="No se pudieron consultar los repartos">
              Comprueba la conexión con el servidor y vuelve a intentarlo.
            </Alert>
          )}

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper p="lg" radius="xl" className={styles.metric}>
              <Group gap="md">
                <ThemeIcon color="orange" variant="light" size={46} radius="md"><Bike size={23} /></ThemeIcon>
                <Box>
                  <Text c="#aaa5b1" size="xs">Entregas pendientes</Text>
                  <Title order={2} c="white">{deliveries.isPending || deliveries.isError ? "—" : pending.length}</Title>
                </Box>
              </Group>
            </Paper>
            <Paper p="lg" radius="xl" className={styles.metric}>
              <Group gap="md">
                <ThemeIcon color="green" variant="light" size={46} radius="md"><PackageCheck size={23}/></ThemeIcon>
                <Box>
                  <Text c="#aaa5b1" size="xs">Entregas realizadas</Text>
                  <Title order={2} c="white">{deliveries.isPending || deliveries.isError ? "—" : orders.filter((o) => o.statusCode === "DELIVERED").length}</Title>
                </Box>
              </Group>
            </Paper>
          </SimpleGrid>

          {deliveries.isPending ? (
            <Center py={90}><Loader color="red" /></Center>
          ) : orders.length === 0 && !deliveries.isError ? (
            <Center py={65}>
              <Stack align="center" gap="xs">
                <ThemeIcon variant="light" color="gray" size={58} radius="xl"><Truck size={29}/></ThemeIcon>
                <Title order={3} c="white">No tienes repartos asignados</Title>
                <Text c="#aaa5b1" size="sm" ta="center">Los pedidos que se te asignen aparecerán aquí automáticamente.</Text>
              </Stack>
            </Center>
          ) : (
            <Stack gap="md">
              {orders.map((order) => (
                <Paper key={order.id} className={styles.orderCard} p="lg" radius="xl">
                  <Group align="flex-start" justify="space-between" gap="sm">
                    <Box>
                      <Title order={3} c="white">Pedido #{order.id}</Title>
                      <Text c="#aba5af" size="xs" mt={5}>{order.customerName || "Cliente"}</Text>
                    </Box>
                    <Badge color={order.statusCode === "DELIVERED" ? "green" :
                      order.statusCode === "OUT_FOR_DELIVERY" ? "cyan" : "yellow"} variant="light" radius="xl">
                      {labels[order.statusCode] || order.statusName || order.statusCode}
                    </Badge>
                  </Group>
                  <Divider my="md" color="#4a434b" />
                  <Stack gap="xs">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                      <MapPin size={18} color="#e9919b"/>
                      <Text c="#e6dfe5" size="sm">
                        {order.deliveryStreet || "Sin dirección registrada"}
                      </Text>
                    </Group>
                    {order.deliveryReference &&
                      <Text c="#aaa5b1" size="xs">Referencia: {order.deliveryReference}</Text>}
                    {order.estimatedDuration &&
                      <Group gap="xs"><Clock3 size={16} color="#e9919b"/>
                        <Text c="#aaa5b1" size="xs">Tiempo estimado: {order.estimatedDuration}</Text>
                      </Group>}
                  </Stack>
                  <Group mt="lg" gap="sm">
                    {order.deliveryLatitude != null && order.deliveryLongitude != null && (
                      <Button component="a"
                        href={"https://www.google.com/maps/dir/?api=1&destination=" +
                          encodeURIComponent(order.deliveryLatitude + "," + order.deliveryLongitude)}
                        target="_blank" rel="noopener noreferrer" variant="default"
                        leftSection={<MapPin size={16} />}>Ver ruta</Button>
                    )}
                    {order.statusCode === "READY_FOR_PICKUP" && (
                      <Button color="red" leftSection={<Bike size={17} />}
                        loading={changeStatus.isPending && changeStatus.variables?.id === order.id}
                        onClick={() => changeStatus.mutate({ id: order.id, status: "OUT_FOR_DELIVERY" })}>
                        Iniciar reparto
                      </Button>
                    )}
                    {order.statusCode === "OUT_FOR_DELIVERY" && (
                      <Button color="green" leftSection={<CheckCircle2 size={17} />}
                        loading={changeStatus.isPending && changeStatus.variables?.id === order.id}
                        onClick={() => changeStatus.mutate({ id: order.id, status: "DELIVERED" })}>
                        Marcar entregado
                      </Button>
                    )}
                  </Group>
                  {order.statusCode === "IN_PROGRESS" && (
                    <Alert color="yellow" mt="md" variant="light" icon={<Clock3 size={16} />}>
                      Pedido en preparación. El reparto se habilitará cuando esté listo.
                    </Alert>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
          <Text c="#aaa5b1" size="xs">
            La lista se sincroniza con el servidor cada 15 segundos. Solo puedes actualizar las entregas que te han asignado.
          </Text>
        </Stack>
      </Box>
    </Box>
  );
}
