import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import {
  Alert, Badge, Box, Button, Container, Divider, Group, Loader, Modal,
  Pagination, Paper, Stack, Text, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowRight, CalendarDays, CheckCircle2, Clock3, MapPin, Plus, RefreshCw,
  TicketCheck, Users, XCircle,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "../orders/OrderList.module.css";

type ReservationStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
type CustomerReservation = {
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
  status: ReservationStatus;
};
type Paged<T> = {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
};

const stateLabels: Record<ReservationStatus, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
};
const stateColors: Record<ReservationStatus, string> = {
  PENDING: "yellow",
  CONFIRMED: "green",
  COMPLETED: "blue",
  CANCELLED: "red",
};

function prettyDate(isoDate: string) {
  // No usar new Date(YYYY-MM-DD), porque cambia de día según zona horaria.
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function isFutureReservation(reservation: CustomerReservation) {
  const fields = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (key: string) => fields.find((x) => x.type === key)?.value || "00";
  const now = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  return reservation.reservationDate + "T" + reservation.reservationTime.slice(0, 5) > now;
}

function canCancel(reservation: CustomerReservation) {
  return ["PENDING", "CONFIRMED"].includes(reservation.status) && isFutureReservation(reservation);
}

function errorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "La operación no pudo completarse.";
  }
  return "No se pudo completar la operación. Vuelve a intentarlo.";
}

const surface = { background: "#242126", border: "1px solid #4d3e45" };
const dialogStyles = {
  content: { background: "#211e23", color: "#fff", border: "1px solid #57434c" },
  header: { background: "#211e23", color: "#fff" },
  title: { color: "#fff", fontWeight: 800 },
  close: { color: "#fff" },
};

export default function MyReservations() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.accessToken);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CustomerReservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<CustomerReservation | null>(null);
  const queryClient = useQueryClient();

  const myReservations = useQuery({
    queryKey: ["reservations", "me", user?.id, page],
    enabled: Boolean(user && token),
    queryFn: async () => {
      const response = await api.get<ApiResponse<Paged<CustomerReservation>>>("reservations/me", {
        params: { page: page - 1, size: 6, sort: "reservationDate,desc" },
      });
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data;
    },
    staleTime: 30_000,
  });

  const cancelReservation = useMutation({
    mutationFn: async (id: number) => {
      const result = await api.patch<ApiResponse<CustomerReservation>>(`reservations/me/${id}/cancel`);
      if (!result.data.success) throw new Error(result.data.message);
      return result.data.data;
    },
    onSuccess: async () => {
      toast.success("Tu reserva se canceló correctamente.");
      setCancelTarget(null);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ["reservations", "me"] });
      // Actualizar también la lista de reservas que se presenta en el formulario.
      await queryClient.invalidateQueries({ queryKey: ["profile", "my-reservations"] });
    },
    onError: (error: unknown) => toast.error(errorMessage(error)),
  });

  if (!user || !token) {
    return <Navigate to="/auth/login" replace state={{ from: "/my-reservations" }} />;
  }

  const data = myReservations.data;
  const reservations = data?.content || [];
  const totalPages = Math.max(1, data?.totalPages || 1);

  return (
    <Box bg="#171619" mih="100vh" pt={112} pb={80} c="white">
      <Container size="md">
        <Group justify="space-between" align="center" gap="md" mb="xl" wrap="wrap">
          <Box>
            <Group gap="sm" mb={5}>
              <CalendarDays color="#ee656e" size={27} />
              <Title order={2} c="white" fw={850}>Mis reservas</Title>
            </Group>
            <Text c="#b8acb5" size="sm">Consulta tus mesas reservadas, horarios y confirmaciones.</Text>
          </Box>
          <Button component={Link} to="/reservations" color="red" radius="md" leftSection={<Plus size={17} />}>
            Nueva reserva
          </Button>
        </Group>

        {myReservations.isPending && (
          <Paper p="xl" radius="lg" style={surface}>
            <Group justify="center"><Loader color="red" size="sm" /><Text c="#cfc0c8">Cargando tus reservas...</Text></Group>
          </Paper>
        )}

        {myReservations.isError && (
          <Alert color="red" title="No se pudieron cargar tus reservas" radius="lg">
            <Text size="sm">Intenta nuevamente. No se ha modificado ninguna reserva.</Text>
            <Button mt="md" size="xs" variant="light" color="red" leftSection={<RefreshCw size={14} />}
              onClick={() => void myReservations.refetch()}>
              Reintentar
            </Button>
          </Alert>
        )}

        {myReservations.isSuccess && data && (
          <>
            <Text c="#b9abb5" size="xs" mb="lg">
              {data.totalElements} {data.totalElements === 1 ? "reserva registrada" : "reservas registradas"}
            </Text>
            {reservations.length === 0 ? (
              <Paper p="xl" radius="xl" ta="center" style={surface}>
                <CalendarDays size={42} color="#d95560" style={{ margin: "auto" }} />
                <Title order={3} c="white" mt="md">Aún no tienes reservas</Title>
                <Text c="#b9adb7" size="sm" mt="xs">Elige una mesa y un horario para tu próxima visita.</Text>
                <Button mt="lg" component={Link} to="/reservations" color="red" rightSection={<ArrowRight size={16} />}>
                  Reservar una mesa
                </Button>
              </Paper>
            ) : (
              <Stack gap="md">
                {reservations.map((reservation) => (
                  <Paper key={reservation.id} p={{ base: "md", sm: "lg" }} radius="lg" style={surface}>
                    <Group justify="space-between" align="flex-start" gap="md">
                      <Group gap="sm">
                        <Box p="sm" style={{ background: "#3a282f", borderRadius: 10, color: "#fa8b94" }}>
                          <TicketCheck size={21} />
                        </Box>
                        <Box>
                          <Text fw={800} size="sm" c="white">Reserva #{reservation.id}</Text>
                          <Text c="#b6abb4" size="xs" mt={4}>Mesa {reservation.tableNumber || "por confirmar"}</Text>
                        </Box>
                      </Group>
                      <Badge color={stateColors[reservation.status] || "gray"} variant="light" radius="sm">
                        {stateLabels[reservation.status] || reservation.status}
                      </Badge>
                    </Group>
                    <Divider color="#433941" my="md" />
                    <Group gap={{ base: "sm", sm: "lg" }} wrap="wrap">
                      <Group gap={6}><CalendarDays size={17} color="#db8c94" /><Text c="#f3e8ed" size="sm">{prettyDate(reservation.reservationDate)}</Text></Group>
                      <Group gap={6}><Clock3 size={17} color="#db8c94" /><Text c="#f3e8ed" size="sm">{reservation.reservationTime.slice(0, 5)}</Text></Group>
                      <Group gap={6}><Users size={17} color="#db8c94" /><Text c="#f3e8ed" size="sm">{reservation.numberOfPeople} personas</Text></Group>
                    </Group>
                    <Group mt="lg" gap="sm">
                      <Button color="red" variant="light" radius="md" size="sm"
                        onClick={() => setSelected(reservation)}>Ver detalle</Button>
                      {canCancel(reservation) && (
                        <Button color="red" variant="outline" radius="md" size="sm"
                          onClick={() => setCancelTarget(reservation)}>Cancelar reserva</Button>
                      )}
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}

            {data.totalElements > 0 && (
              <Stack gap="sm" align="center" mt="xl">
                <Text c="#aa9da6" size="xs">
                  Página {page} de {totalPages} · {data.totalElements} reservas
                </Text>
                {totalPages > 1 && (
                  <Pagination value={Math.min(page, totalPages)} onChange={setPage}
                    total={totalPages} withEdges color="red" radius="md"
                    classNames={{ control: styles.pageControl, dots: styles.pageDots }} />
                )}
              </Stack>
            )}
          </>
        )}
      </Container>

      <Modal opened={selected !== null} onClose={() => setSelected(null)} centered size="md"
        radius="lg" title={`Detalle de reserva #${selected?.id ?? ""}`} styles={dialogStyles}>
        {selected && (
          <Stack gap="sm">
            <Group justify="space-between">
              <Text c="#e2d3dc" fw={700}>Estado de la reserva</Text>
              <Badge variant="light" color={stateColors[selected.status]}>{stateLabels[selected.status]}</Badge>
            </Group>
            <Divider color="#493c45" />
            <Group gap="xs"><CalendarDays size={18} color="#f58994" /><Text>{prettyDate(selected.reservationDate)}</Text></Group>
            <Group gap="xs"><Clock3 size={18} color="#f58994" /><Text>{selected.reservationTime.slice(0, 5)}</Text></Group>
            <Group gap="xs"><Users size={18} color="#f58994" /><Text>{selected.numberOfPeople} personas</Text></Group>
            <Group gap="xs"><MapPin size={18} color="#f58994" /><Text>Mesa {selected.tableNumber || "por confirmar"}</Text></Group>
            <Divider color="#493c45" />
            <Text c="#bdb0ba" size="xs">Datos de contacto</Text>
            <Text size="sm" c="white">{selected.contactName || selected.customerName}</Text>
            <Text size="sm" c="#d8cbd4">{selected.contactPhone || "Sin teléfono registrado"}</Text>
            {canCancel(selected) && (
              <Button color="red" variant="outline" mt="sm" leftSection={<XCircle size={16} />}
                onClick={() => setCancelTarget(selected)}>Cancelar reserva</Button>
            )}
            {selected.status === "CONFIRMED" && (
              <Group gap={6} mt="xs"><CheckCircle2 size={15} color="#84cb9c" />
                <Text c="#b9d5c3" size="xs">Tu mesa está confirmada.</Text></Group>
            )}
          </Stack>
        )}
      </Modal>

      <Modal opened={cancelTarget !== null}
        onClose={() => { if (!cancelReservation.isPending) setCancelTarget(null); }}
        centered radius="lg" title={`Cancelar reserva #${cancelTarget?.id ?? ""}`} styles={dialogStyles}>
        <Stack gap="md">
          <Text c="#e9dce4" size="sm">
            ¿Confirmas que deseas cancelar esta reserva? La mesa volverá a quedar disponible para otros clientes.
          </Text>
          <Text c="#b5a5af" size="xs">
            Fecha: {cancelTarget ? prettyDate(cancelTarget.reservationDate) : "—"} ·
            Hora: {cancelTarget?.reservationTime.slice(0, 5) || "—"}
          </Text>
          <Group justify="flex-end">
            <Button color="gray" variant="subtle" disabled={cancelReservation.isPending}
              onClick={() => setCancelTarget(null)}>Conservar reserva</Button>
            <Button color="red" loading={cancelReservation.isPending}
              onClick={() => { if (cancelTarget) cancelReservation.mutate(cancelTarget.id); }}>
              Confirmar cancelación
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Box>
  );
}
