import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  Alert, Avatar, Badge, Box, Button, Container, Divider, Grid, Group,
  Image, Modal, NumberInput, Paper, SimpleGrid, Skeleton, Stack,
  Text, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronRight, CircleAlert,
  Clock3, ClipboardList, LogIn, MapPin, Phone, RefreshCw,
  ShieldCheck, Sparkles, Users, UtensilsCrossed, X,
} from "lucide-react";
import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";

type Status = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED";
type AvailableTable = { id: number; name: string; capacity: number; availableTimes: string[] };
type Reservation = {
  id: number;
  tableNumber: string;
  reservationDate: string;
  reservationTime: string;
  numberOfPeople: number;
  status: Status;
};
type Page<T> = { content: T[] };

const statusNames: Record<Status, string> = {
  PENDING: "Pendiente de confirmación",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
};
const statusColors: Record<Status, string> = {
  PENDING: "yellow",
  CONFIRMED: "teal",
  CANCELLED: "gray",
  COMPLETED: "blue",
};

const fieldStyles = {
  label: { color: "#ececf1", fontWeight: 700, marginBottom: 10 },
  input: {
    backgroundColor: "#15161b",
    border: "1px solid #494a55",
    color: "#f5f5f6",
    minHeight: 48,
    borderRadius: 11,
  },
};

function limaDateTime(extraMinutes = 0) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Lima",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(Date.now() + extraMinutes * 60_000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return {
    date: [get("year"), get("month"), get("day")].join("-"),
    time: get("hour") + ":" + get("minute"),
  };
}

function formatDate(date: string) {
  const parts = date.split("-");
  return parts.length === 3 ? parts.reverse().join("/") : date;
}

function getError(e: unknown) {
  if (axios.isAxiosError(e)) {
    const response = e.response?.data as { message?: string } | undefined;
    if (response?.message) return response.message;
    if (e.response?.status === 401) return "Inicia sesión nuevamente.";
    if (e.response?.status === 403) return "No tienes permisos para realizar esta operación.";
  }
  return "No se pudo completar la solicitud. Comprueba la conexión con el servidor.";
}

export default function Reservations() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);
  const isClient = Boolean(token && user?.roles?.includes("ROLE_CLIENT"));
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState(2);
  const [time, setTime] = useState("");
  const [tableId, setTableId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [availability, setAvailability] = useState<AvailableTable[]>([]);
  const [bookings, setBookings] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState("");
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Reservation | null>(null);
  const [reload, setReload] = useState(0);

  const today = limaDateTime().date;
  const threshold = limaDateTime(16);
  const earliestSlot = threshold.date + "T" + threshold.time;

  useEffect(() => {
    if (user) {
      setName((old) => old || user.fullName || "");
      setPhone((old) => old || user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    setTime("");
    setTableId(null);
    setAvailability([]);
    setError("");
    if (!date || date < today) return;
    let active = true;
    setLoading(true);
    api.get<ApiResponse<AvailableTable[]>>("tables/available-times", {
      params: { numberOfPeople: guests, date, filterByCapacity: true },
    }).then(({ data }) => {
      if (active) {
        if (!data.success) throw new Error(data.message);
        setAvailability(data.data || []);
      }
    }).catch((e: unknown) => {
      if (active) setError(getError(e));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [date, guests, reload, today]);

  useEffect(() => {
    if (!isClient) {
      setBookings([]);
      setBookingsError("");
      return;
    }
    let active = true;
    setLoadingBookings(true);
    setBookingsError("");
    api.get<ApiResponse<Page<Reservation>>>("reservations/me", {
      params: { page: 0, size: 20 },
    }).then(({ data }) => {
      if (active) {
        if (!data.success) throw new Error(data.message);
        setBookings(data.data?.content || []);
      }
    }).catch((e: unknown) => {
      if (active) {
        setBookingsError(getError(e));
        setBookings([]);
      }
    }).finally(() => {
      if (active) setLoadingBookings(false);
    });
    return () => { active = false; };
  }, [isClient, reload]);

  const slots = useMemo(() =>
    Array.from(new Set(availability.flatMap((table) => table.availableTimes || [])))
      .filter((slot) => date + "T" + slot >= earliestSlot)
      .sort(),
    [availability, date, earliestSlot]
  );
  const tables = useMemo(() =>
    availability.filter((table) => table.availableTimes?.includes(time)),
    [availability, time]
  );
  const selectedTable = tables.find((table) => table.id === tableId);
  const canSubmit = isClient && date >= today && Boolean(time) &&
    Boolean(selectedTable) && name.trim().length > 0 &&
    phone.trim().length >= 7 && phone.trim().length <= 15 &&
    !loading && !sending;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setCreated(null);
    if (!isClient) {
      setError("Necesitas una cuenta de cliente para realizar una reserva.");
      return;
    }
    if (!date || date < today || !time || date + "T" + time < earliestSlot ||
        !tableId || !tables.some((table) => table.id === tableId)) {
      setError("Elige una fecha, un horario y una mesa disponibles.");
      return;
    }
    if (!name.trim() || phone.trim().length < 7 || phone.trim().length > 15) {
      setError("Comprueba el nombre y el teléfono (7 a 15 caracteres).");
      return;
    }

    setSending(true);
    try {
      const response = await api.post<Reservation>("reservations/me", {
        tableId,
        contactName: name.trim(),
        contactPhone: phone.trim(),
        reservationDate: date,
        reservationTime: time + ":00",
        numberOfPeople: guests,
      });
      setCreated(response.data);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(getError(cause));
      setReload((value) => value + 1);
    } finally {
      setSending(false);
    }
  }

  async function cancel(id: number) {
    setError("");
    setCancelling(id);
    try {
      await api.patch("reservations/me/" + id + "/cancel");
      setCancelTarget(null);
      setReload((value) => value + 1);
    } catch (cause) {
      setError(getError(cause));
    } finally {
      setCancelling(null);
    }
  }

  return (
    <Box bg="#111215" c="white" mih="100vh" pb={{ base: 80, sm: 110 }}>
      <Box
        component="section"
        pos="relative"
        mih={{ base: 390, sm: 430 }}
        pt={{ base: 125, sm: 140 }}
        pb={{ base: 95, sm: 110 }}
        style={{ isolation: "isolate", overflow: "hidden" }}
      >
        <Image
          src="/images/inicio/central-info.jpg"
          alt="Ambiente gastronómico de Restaurant Central"
          fit="cover"
          pos="absolute"
          inset={0}
          w="100%"
          h="100%"
          style={{ zIndex: -2 }}
        />
        <Box pos="absolute" inset={0} style={{
          zIndex: -1,
          background: "linear-gradient(90deg, rgba(10,10,12,.93) 0%, rgba(10,10,12,.76) 52%, rgba(10,10,12,.47) 100%), linear-gradient(0deg, #111215 0%, transparent 45%)",
        }}/>
        <Container size="xl" px={{ base: "lg", sm: "xl" }}>
          <Stack align="flex-start" gap="md" maw={730}>
            <Badge color="red" variant="light" size="lg" radius="xl" leftSection={<Sparkles size={14}/>}>
              Restaurant Central · Reservas
            </Badge>
            <Title order={1} c="white" fw={850} lh={1.08} style={{
              fontSize: "clamp(3rem, 6.3vw, 5.2rem)",
              letterSpacing: "-.052em",
              textShadow: "0 8px 30px rgba(0,0,0,.5)",
            }}>
              Tu mesa, tu
              <Text inherit span c="#fda4af"> momento.</Text>
            </Title>
            <Text size="md" c="#ececf0" lh={1.85} maw={570}>
              Selecciona la fecha, consulta los horarios reales del restaurante
              y envía tu solicitud para disfrutar de una buena experiencia.
            </Text>
            <Group gap="sm">
              <Badge variant="outline" color="gray" size="lg"
                leftSection={<Clock3 size={14}/>}
                styles={{ root: { borderColor: "#777882", color: "#e1e2e7" } }}>
                Sujeto a disponibilidad
              </Badge>
              <Badge variant="outline" color="gray" size="lg"
                leftSection={<ShieldCheck size={14}/>}
                styles={{ root: { borderColor: "#777882", color: "#e1e2e7" } }}>
                Confirmación posterior
              </Badge>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container size="xl" px={{ base: "lg", sm: "xl" }} mt={{ base: -45, sm: -60 }} pos="relative" style={{ zIndex: 2 }}>
        {!isClient && (
          <Alert
            color="yellow"
            radius="lg"
            mb="lg"
            icon={<CircleAlert size={20}/>}
            title="Inicia sesión para solicitar una mesa"
            styles={{ root: { backgroundColor: "#302a22", border: "1px solid #675134" }, title: { color: "#fde68a" }, message: { color: "#e1d5c0" } }}
          >
            <Group justify="space-between" align="center" gap="sm" mt={7}>
              <Text size="sm" c="#e1d5c0">
                Puedes consultar los horarios sin iniciar sesión. Para registrar una reserva necesitas una cuenta de cliente.
              </Text>
              <Group gap="xs">
                <Button component={Link} to="/auth/login" size="xs" color="red" leftSection={<LogIn size={15}/>}>Iniciar sesión</Button>
                <Button component={Link} to="/auth/signup" size="xs" variant="outline" color="yellow">Crear cuenta</Button>
              </Group>
            </Group>
          </Alert>
        )}

        <Grid gutter={{ base: "lg", md: "xl" }} align="start">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Paper radius="xl" p={{ base: "lg", sm: 34 }} style={{
              backgroundColor: "#1d1e23",
              border: "1px solid #3c3d46",
              boxShadow: "0 22px 60px rgba(0,0,0,.25)",
            }}>
              <Group justify="space-between" align="flex-start" mb="xl" gap="sm">
                <Box>
                  <Text c="#fda4af" size="xs" fw={850} lts={1.7} tt="uppercase" mb={7}>
                    Solicitud de reserva
                  </Text>
                  <Title order={2} size="h2" c="white" fw={850}>Encuentra tu mesa</Title>
                  <Text c="#aeb1ba" size="sm" mt={8} lh={1.6}>
                    Los horarios y mesas se consultan directamente al servidor.
                  </Text>
                </Box>
                <ThemeIcon color="red" variant="light" radius="lg" size={50}><CalendarDays size={24}/></ThemeIcon>
              </Group>

              <Box component="form" onSubmit={(event: FormEvent<HTMLFormElement>) => void submit(event)}>
                <Group gap="sm" mb="lg">
                  <ThemeIcon size={27} radius="xl" color="red" variant="filled"><Text size="xs" c="white" fw={800}>1</Text></ThemeIcon>
                  <Text c="white" fw={800}>Elige fecha y número de personas</Text>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Fecha de la reserva"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(event) => { setDate(event.currentTarget.value); setCreated(null); }}
                    required
                    leftSection={<CalendarDays size={17} color="#a8aab3"/>}
                    styles={fieldStyles}
                    style={{ colorScheme: "dark" }}
                  />
                  <NumberInput
                    label="Número de personas"
                    value={guests}
                    min={1}
                    max={10}
                    allowDecimal={false}
                    allowNegative={false}
                    clampBehavior="strict"
                    onChange={(value) => { setGuests(typeof value === "number" ? value : 2); setCreated(null); }}
                    required
                    leftSection={<Users size={17} color="#a8aab3"/>}
                    styles={fieldStyles}
                  />
                </SimpleGrid>
                <Group justify="flex-start" mt="md" gap="xs">
                  <Button
                    type="button"
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => { setDate(today); setCreated(null); }}
                    leftSection={<CalendarDays size={14}/>}
                  >
                    Hoy
                  </Button>
                  <Text c="#999aa5" size="xs">Los turnos se actualizan según la fecha seleccionada.</Text>
                </Group>

                <Divider color="#3e3f47" my="xl"/>

                <Group gap="sm" mb="md">
                  <ThemeIcon size={27} radius="xl" color="red" variant="filled"><Text size="xs" c="white" fw={800}>2</Text></ThemeIcon>
                  <Text c="white" fw={800}>Selecciona un horario disponible</Text>
                  {loading && <RefreshCw size={16} color="#fda4af" className="animate-spin" />}
                </Group>

                {!date ? (
                  <Paper radius="lg" p="lg" style={{ backgroundColor: "#16171b", border: "1px dashed #42434b" }}>
                    <Group gap="sm">
                      <Clock3 size={20} color="#999aa5"/>
                      <Text c="#b6b8c1" size="sm">Selecciona una fecha para consultar horarios.</Text>
                    </Group>
                  </Paper>
                ) : loading ? (
                  <SimpleGrid cols={{ base: 3, xs: 4, sm: 5 }} spacing="sm">
                    {Array.from({ length: 10 }, (_, index) => <Skeleton key={index} height={44} radius="md"/>)}
                  </SimpleGrid>
                ) : slots.length ? (
                  <SimpleGrid cols={{ base: 3, xs: 4, sm: 5 }} spacing="sm">
                    {slots.map((slot) => {
                      const selected = time === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => { setTime(slot); setTableId(null); setCreated(null); }}
                          aria-pressed={selected}
                          className="rounded-xl border px-2 py-3 text-sm font-bold transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                          style={{
                            color: selected ? "#ffffff" : "#e4e5ea",
                            borderColor: selected ? "#e54854" : "#41424b",
                            backgroundColor: selected ? "#a21e2d" : "#15161b",
                            boxShadow: selected ? "0 5px 18px rgba(185,28,28,.23)" : "none",
                          }}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </SimpleGrid>
                ) : !error ? (
                  <Alert color="yellow" icon={<Clock3 size={20}/>} radius="lg"
                    styles={{ root: { backgroundColor: "#302a22", borderColor: "#61503b" }, message: { color: "#f6e5c6" } }}>
                    No encontramos horarios para esa fecha y cantidad de personas.
                    Puede que todavía no haya mesas configuradas o disponibles.
                  </Alert>
                ) : null}

                <Divider color="#3e3f47" my="xl"/>

                <Group gap="sm" mb="md">
                  <ThemeIcon size={27} radius="xl" color="red" variant="filled"><Text size="xs" c="white" fw={800}>3</Text></ThemeIcon>
                  <Text c="white" fw={800}>Escoge la mesa</Text>
                  {time && <Badge variant="light" color="red">{time}</Badge>}
                </Group>
                {time && tables.length ? (
                  <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="sm">
                    {tables.map((table) => {
                      const selected = tableId === table.id;
                      return (
                        <button
                          key={table.id}
                          type="button"
                          onClick={() => { setTableId(table.id); setCreated(null); }}
                          aria-pressed={selected}
                          className="rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
                          style={{
                            borderColor: selected ? "#e54854" : "#454650",
                            backgroundColor: selected ? "#3a1c25" : "#15161b",
                            color: "#f4f4f5",
                          }}
                        >
                          <Group justify="space-between" align="center" gap="xs">
                            <Group gap="sm">
                              <ThemeIcon color={selected ? "red" : "gray"} variant="light" size={38} radius="lg">
                                <UtensilsCrossed size={18}/>
                              </ThemeIcon>
                              <Box>
                                <Text c="white" fw={800} size="sm">{table.name}</Text>
                                <Text c="#aeb1ba" size="xs">Hasta {table.capacity} personas</Text>
                              </Box>
                            </Group>
                            {selected && <Check size={21} color="#fda4af"/>}
                          </Group>
                        </button>
                      );
                    })}
                  </SimpleGrid>
                ) : (
                  <Paper radius="lg" p="lg" style={{ backgroundColor: "#16171b", border: "1px dashed #42434b" }}>
                    <Text c="#aeb1ba" size="sm">Primero elige un horario para consultar sus mesas.</Text>
                  </Paper>
                )}

                <Divider color="#3e3f47" my="xl"/>

                <Group gap="sm" mb="lg">
                  <ThemeIcon size={27} radius="xl" color="red" variant="filled"><Text size="xs" c="white" fw={800}>4</Text></ThemeIcon>
                  <Text c="white" fw={800}>Datos de contacto</Text>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                  <TextInput
                    label="Nombre de contacto"
                    placeholder="Nombre y apellido"
                    value={name}
                    maxLength={100}
                    onChange={(event) => setName(event.currentTarget.value)}
                    required
                    styles={fieldStyles}
                    leftSection={<Users size={17} color="#a8aab3"/>}
                  />
                  <TextInput
                    label="Teléfono"
                    placeholder="Número de contacto"
                    type="tel"
                    value={phone}
                    maxLength={15}
                    onChange={(event) => setPhone(event.currentTarget.value)}
                    required
                    styles={fieldStyles}
                    leftSection={<Phone size={17} color="#a8aab3"/>}
                  />
                </SimpleGrid>

                {error && (
                  <Alert mt="xl" color="red" icon={<CircleAlert size={19}/>} title="No se pudo completar la reserva"
                    styles={{ root: { backgroundColor: "#391f27", borderColor: "#a43949" }, title: { color: "#fecdd3" }, message: { color: "#fda4af" } }}>
                    {error}
                  </Alert>
                )}

                {created && (
                  <Alert mt="xl" color="teal" icon={<CheckCircle2 size={21}/>} title="Solicitud recibida"
                    styles={{ root: { backgroundColor: "#1a3934", borderColor: "#39776b" }, title: { color: "#a7f3d0" }, message: { color: "#d1fae5" } }}>
                    Reserva #{created.id} registrada. Estado: {statusNames[created.status] || created.status}.
                    El restaurante aún debe confirmarla.
                  </Alert>
                )}
                <Button
                  type="submit"
                  color="red"
                  size="lg"
                  radius="lg"
                  fullWidth
                  mt="xl"
                  loading={sending}
                  disabled={!canSubmit}
                  rightSection={<ArrowRight size={20}/>}
                >
                  Solicitar reserva
                </Button>
                <Text c="#9da0ab" size="xs" ta="center" lh={1.7} mt="sm">
                  La disponibilidad se verifica nuevamente al enviar la solicitud.
                  No se confirma automáticamente.
                </Text>
              </Box>
            </Paper>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
              <Paper radius="xl" p={{ base: "lg", sm: "xl" }} style={{
                backgroundColor: "#1f2026", border: "1px solid #393a43",
              }}>
                <Group gap="sm" mb="lg">
                  <ThemeIcon variant="light" color="red" size={43} radius="lg"><ClipboardList size={22}/></ThemeIcon>
                  <Title order={3} size="lg" c="white">Tu solicitud</Title>
                </Group>
                <Stack gap="md">
                  <Group gap="sm" align="flex-start">
                    <CalendarDays size={19} color="#fb7185"/>
                    <Box>
                      <Text c="#989ba8" size="xs" tt="uppercase" fw={800}>Fecha</Text>
                      <Text c="white" fw={700} size="sm" mt={4}>{date ? formatDate(date) : "Por seleccionar"}</Text>
                    </Box>
                  </Group>
                  <Group gap="sm" align="flex-start">
                    <Users size={19} color="#fb7185"/>
                    <Box>
                      <Text c="#989ba8" size="xs" tt="uppercase" fw={800}>Personas</Text>
                      <Text c="white" fw={700} size="sm" mt={4}>{guests} {guests === 1 ? "persona" : "personas"}</Text>
                    </Box>
                  </Group>
                  <Group gap="sm" align="flex-start">
                    <Clock3 size={19} color="#fb7185"/>
                    <Box>
                      <Text c="#989ba8" size="xs" tt="uppercase" fw={800}>Horario</Text>
                      <Text c="white" fw={700} size="sm" mt={4}>{time || "Por seleccionar"}</Text>
                    </Box>
                  </Group>
                  <Group gap="sm" align="flex-start">
                    <UtensilsCrossed size={19} color="#fb7185"/>
                    <Box>
                      <Text c="#989ba8" size="xs" tt="uppercase" fw={800}>Mesa</Text>
                      <Text c="white" fw={700} size="sm" mt={4}>{selectedTable?.name || "Por seleccionar"}</Text>
                    </Box>
                  </Group>
                </Stack>
                <Divider color="#3b3c45" my="lg"/>
                <Group gap="sm" wrap="nowrap" align="flex-start">
                  <ShieldCheck size={18} color="#a1a1aa"/>
                  <Text c="#b4b6c0" size="xs" lh={1.8}>
                    La reserva queda pendiente hasta que el restaurante la confirme.
                  </Text>
                </Group>
              </Paper>
              <Paper radius="xl" p={{ base: "lg", sm: "xl" }} style={{
                backgroundColor: "#18191e", border: "1px solid #373840",
              }}>
                <Text c="#fda4af" fw={800} tt="uppercase" lts={1.5} size="xs" mb="md">
                  Antes de reservar
                </Text>
                <Stack gap="md">
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ChevronRight size={19} color="#fb7185"/>
                    <Text c="#c4c6ce" size="sm" lh={1.7}>
                      Los horarios dependen de las mesas disponibles para la fecha.
                    </Text>
                  </Group>
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ChevronRight size={19} color="#fb7185"/>
                    <Text c="#c4c6ce" size="sm" lh={1.7}>
                      Necesitas iniciar sesión con una cuenta de cliente.
                    </Text>
                  </Group>
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <ChevronRight size={19} color="#fb7185"/>
                    <Text c="#c4c6ce" size="sm" lh={1.7}>
                      Podrás consultar y cancelar tus reservas desde esta página.
                    </Text>
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Grid.Col>
        </Grid>

        {isClient && (
          <Paper radius="xl" p={{ base: "lg", sm: 32 }} mt="xl" style={{
            backgroundColor: "#1d1e23", border: "1px solid #3a3b44",
          }}>
            <Group justify="space-between" align="center" mb="lg" gap="sm">
              <Group gap="sm">
                <ThemeIcon color="red" size={44} radius="lg" variant="light"><ClipboardList size={22}/></ThemeIcon>
                <Box>
                  <Title order={2} c="white" size="h3">Mis reservas</Title>
                  <Text size="sm" c="#aeb1ba">Consulta el estado de tus últimas solicitudes.</Text>
                </Box>
              </Group>
              <Button size="sm" variant="subtle" color="gray" leftSection={<RefreshCw size={16}/>}
                onClick={() => setReload((value) => value + 1)}>
                Actualizar
              </Button>
            </Group>

            {bookingsError && <Alert mb="lg" color="red" icon={<CircleAlert size={19}/>}>{bookingsError}</Alert>}
            {loadingBookings ? (
              <Stack gap="sm">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} height={80} radius="lg"/>)}</Stack>
            ) : bookings.length ? (
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {bookings.map((item) => (
                  <Paper key={item.id} radius="lg" p="lg" style={{
                    backgroundColor: "#15161b", border: "1px solid #373840",
                  }}>
                    <Group justify="space-between" mb="md" gap="xs">
                      <Text c="white" fw={800}>Reserva #{item.id}</Text>
                      <Badge radius="md" variant="light" color={statusColors[item.status]}>
                        {statusNames[item.status] || item.status}
                      </Badge>
                    </Group>
                    <Group gap="md" wrap="wrap">
                      <Text c="#d4d5dc" size="sm"><CalendarDays size={15} className="inline-block mr-1"/>{formatDate(item.reservationDate)}</Text>
                      <Text c="#d4d5dc" size="sm"><Clock3 size={15} className="inline-block mr-1"/>{item.reservationTime.slice(0, 5)}</Text>
                      <Text c="#d4d5dc" size="sm"><Users size={15} className="inline-block mr-1"/>{item.numberOfPeople}</Text>
                    </Group>
                    <Text c="#a0a2ad" size="xs" mt="sm">Mesa {item.tableNumber}</Text>
                    {(item.status === "PENDING" || item.status === "CONFIRMED") && (
                      <Button
                        size="xs"
                        color="red"
                        variant="outline"
                        mt="md"
                        leftSection={<X size={15}/>}
                        onClick={() => setCancelTarget(item)}
                      >
                        Cancelar reserva
                      </Button>
                    )}
                  </Paper>
                ))}
              </SimpleGrid>
            ) : !bookingsError ? (
              <Stack align="center" gap="sm" py="xl">
                <Avatar size={58} radius="xl" color="gray"><CalendarDays size={26}/></Avatar>
                <Text c="white" fw={750}>Todavía no tienes reservas.</Text>
                <Text size="sm" c="#aeb1ba" ta="center">
                  Cuando envíes una solicitud aparecerá aquí.
                </Text>
              </Stack>
            ) : null}
          </Paper>
        )}
      </Container>

      <Modal
        opened={cancelTarget !== null}
        onClose={() => { if (cancelling === null) setCancelTarget(null); }}
        title="Cancelar reserva"
        centered
        radius="lg"
        styles={{
          content: { backgroundColor: "#212228", color: "white" },
          header: { backgroundColor: "#212228" },
          title: { color: "white", fontWeight: 800 },
        }}
      >
        <Text c="#d2d3dc" size="sm" lh={1.8}>
          ¿Quieres cancelar la reserva #{cancelTarget?.id}?
          La cancelación se enviará al servidor.
        </Text>
        <Group justify="flex-end" mt="xl">
          <Button variant="subtle" color="gray" onClick={() => setCancelTarget(null)} disabled={cancelling !== null}>
            Volver
          </Button>
          <Button color="red" loading={cancelling !== null} onClick={() => {
            if (cancelTarget) void cancel(cancelTarget.id);
          }}>
            Confirmar cancelación
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}
