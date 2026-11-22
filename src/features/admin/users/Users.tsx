import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { Alert, Avatar, Badge, Box, Button, Checkbox, Divider, Group, Loader, Modal, Paper, PasswordInput, Select, SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import axios from "axios";
import { AlertCircle, Clock3, Pencil, Plus, Search, ShieldCheck, UserRoundCheck, UsersRound } from "lucide-react";
import WeeklyScheduleEditor, { initialWeek, fromShifts, toShifts, validateWeek, type StaffShift, type WeeklyDay } from "./WeeklyScheduleEditor";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";

interface AdminUser {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  provider: string;
  enabled: boolean;
  roles: string[];
}
interface UserForm {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  enabled: boolean;
}
interface NewUser {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  role: string;
}
const initialNewUser = (): NewUser => ({
  username: "", email: "", firstName: "", lastName: "", phone: "",
  password: "", role: "ROLE_WAITER",
});
const roleOptions = [
  { value: "ROLE_WAITER", label: "Mesero" },
  { value: "ROLE_CHEF", label: "Cocinero" },
  { value: "ROLE_CASHIER", label: "Cajero" },
  { value: "ROLE_MANAGER", label: "Gerente" },
  { value: "ROLE_ADMIN", label: "Administrador" },
];

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || "El servidor no pudo guardar el usuario.";
  return "Ocurrió un error inesperado.";
}

export default function Users() {
  const currentUser = useAuthStore((state) => state.user);
  // La sesión persistida puede tener un ID ausente o representado como texto.
  // Usar también el username único para reconocer la propia cuenta.
  const isCurrentAccount = (account: AdminUser) => {
    if (!currentUser) return false;
    const sameId = currentUser.id != null && Number(currentUser.id) === account.id;
    const sameUsername =
      !!currentUser.username &&
      currentUser.username.trim().toLowerCase() === account.username.trim().toLowerCase();
    return sameId || sameUsername;
  };
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 180);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState<NewUser>(initialNewUser());
  const [newWeek, setNewWeek] = useState<WeeklyDay[]>(initialWeek());
  const [scheduleUser, setScheduleUser] = useState<AdminUser | null>(null);
  const [scheduleWeek, setScheduleWeek] = useState<WeeklyDay[]>(initialWeek());
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [form, setForm] = useState<UserForm>({
    username: "", email: "", firstName: "", lastName: "", phone: "", enabled: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("users/admin");
      setUsers(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => users.filter((user) =>
    [user.username, user.email, user.firstName, user.lastName].join(" ").toLowerCase().includes(debouncedSearch.trim().toLowerCase())
  ), [users, debouncedSearch]);

  const openEdit = (user: AdminUser) => {
    if (isCurrentAccount(user)) return;
    setError("");
    setEditing(user);
    setForm({
      username: user.username, email: user.email, firstName: user.firstName,
      lastName: user.lastName, phone: user.phone || "", enabled: user.enabled,
    });
  };

  const openSchedule = async (user: AdminUser) => {
    if (user.roles.includes("ROLE_ADMIN")) return;
    setScheduleUser(user);
    setScheduleLoading(true);
    setScheduleReady(false);
    setScheduleError("");
    try {
      const response = await api.get<{ success: boolean; message: string; data: StaffShift[] }>(
        "users/admin/" + user.id + "/schedule"
      );
      if (!response.data.success) throw new Error(response.data.message);
      setScheduleWeek(fromShifts(response.data.data || []));
      setScheduleReady(true);
    } catch (err) {
      setScheduleError(errorMessage(err));
    } finally {
      setScheduleLoading(false);
    }
  };

  const saveSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scheduleUser || !scheduleReady) return;
    const validation = validateWeek(scheduleWeek);
    if (validation) { setScheduleError(validation); return; }
    setScheduleSaving(true);
    setScheduleError("");
    try {
      const response = await api.put<{ success: boolean; message: string; data: StaffShift[] }>(
        "users/admin/" + scheduleUser.id + "/schedule",
        toShifts(scheduleWeek)
      );
      if (!response.data.success) throw new Error(response.data.message);
      setScheduleUser(null);
      toast.success("Horario laboral actualizado.");
    } catch (err) {
      setScheduleError(errorMessage(err));
    } finally {
      setScheduleSaving(false);
    }
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    if (isCurrentAccount(editing)) return setError("Tu cuenta se edita desde Mi perfil.");
    if (!form.username.trim() || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) return setError("Completa los campos obligatorios.");
    setSaving(true);
    setError("");
    try {
      await api.put("users/" + editing.id, {
        username: form.username.trim(), firstName: form.firstName.trim(),
        lastName: form.lastName.trim(), email: form.email.trim(),
        phone: form.phone.trim() || null, enabled: form.enabled,
      });
      setEditing(null);
      toast.success("Usuario actualizado.");
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const createStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newUser.password.length < 12) return setError("La contraseña inicial debe tener al menos 12 caracteres.");
    if (newUser.role !== "ROLE_ADMIN") {
      const validation = validateWeek(newWeek);
      if (validation) { setError(validation); return; }
    }
    setSaving(true);
    setError("");
    try {
      await api.post("users/admin", {
        username: newUser.username.trim(), email: newUser.email.trim(),
        firstName: newUser.firstName.trim(), lastName: newUser.lastName.trim(),
        phone: newUser.phone.trim() || null, password: newUser.password,
        role: newUser.role,
        schedules: newUser.role === "ROLE_ADMIN" ? [] : toShifts(newWeek),
      });
      setCreating(false);
      setNewUser(initialNewUser());
      setNewWeek(initialWeek());
      toast.success("Cuenta del personal creada correctamente.");
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const roleName = (role: string) =>
    roleOptions.find((item) => item.value === role)?.label || role.replace("ROLE_", "");

  return (
    <Stack maw={1450} mx="auto" gap="xl">
      <Group align="flex-end" justify="space-between" wrap="wrap">
        <Box>
          <Text c="red.7" size="xs" fw={800} lts={2} tt="uppercase">Equipo / Administración</Text>
          <Title order={1} mt={6} fw={850}>Usuarios</Title>
          <Text size="sm" c="dimmed" mt={6}>Crea cuentas de personal y administra el directorio del restaurante.</Text>
        </Box>
        <Button size="md" leftSection={<Plus size={19}/>} onClick={() => {setError(""); setCreating(true);}}>Nuevo usuario</Button>
      </Group>

      {error && <Alert title="No se pudo completar la acción" color="red" icon={<AlertCircle size={18}/>} withCloseButton onClose={() => setError("")}>{error}</Alert>}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {[
          { label: "Total de cuentas", value: users.length, icon: UsersRound },
          { label: "Cuentas activas", value: users.filter((user) => user.enabled).length, icon: UserRoundCheck },
          { label: "Administradores", value: users.filter((user) => user.roles?.includes("ROLE_ADMIN")).length, icon: ShieldCheck },
        ].map((metric) => (
          <Paper key={metric.label} withBorder shadow="xs" p="lg">
            <Group gap="md"><ThemeIcon variant="light" color="red" size={48} radius="md"><metric.icon size={22}/></ThemeIcon>
              <Box><Text c="dimmed" size="xs" fw={650}>{metric.label}</Text><Title mt={4} order={2}>{loading ? "…" : metric.value}</Title></Box>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      <Paper withBorder shadow="xs">
        <Group p="lg" justify="space-between" align="end">
          <Box><Title order={3} size="lg">Directorio de usuarios</Title><Text size="xs" c="dimmed" mt={5}>Consulta los roles, datos y estado de cada cuenta.</Text></Box>
          <TextInput leftSection={<Search size={17}/>} aria-label="Buscar usuarios" placeholder="Buscar usuarios…" value={search} onChange={(event) => setSearch(event.currentTarget.value)}/>
        </Group>
        <Divider/>
        {loading ? <Group justify="center" p={70}><Loader color="red"/></Group> : !filtered.length ? (
          <Stack align="center" p={65} gap="sm">
            <ThemeIcon color="red" variant="light" radius="lg" size={68}><UsersRound size={28}/></ThemeIcon>
            <Title order={3}>No se encontraron usuarios</Title>
            <Text size="sm" c="dimmed">Prueba con otro usuario, correo o nombre.</Text>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={850}>
            <Table highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead><Table.Tr>
                <Table.Th>Usuario</Table.Th><Table.Th>Correo</Table.Th><Table.Th>Roles</Table.Th><Table.Th>Proveedor</Table.Th><Table.Th>Estado</Table.Th><Table.Th ta="right">Acciones</Table.Th>
              </Table.Tr></Table.Thead>
              <Table.Tbody>{filtered.map((user) => (
                <Table.Tr key={user.id}>
                  <Table.Td><Group wrap="nowrap" gap="sm">
                    <Avatar color="red" variant="light" radius="xl" name={`${user.firstName} ${user.lastName}`}/>
                    <Box><Text fw={700} size="sm">{user.firstName} {user.lastName}</Text><Text c="dimmed" size="xs">@{user.username}</Text></Box>
                  </Group></Table.Td>
                  <Table.Td><Text size="sm">{user.email}</Text></Table.Td>
                  <Table.Td><Group gap={5}>{user.roles?.length ? user.roles.map((role) => <Badge size="sm" variant="light" color="red" key={role}>{roleName(role)}</Badge>) : <Text c="dimmed">—</Text>}</Group></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{user.provider || "—"}</Text></Table.Td>
                  <Table.Td><Badge variant="light" color={user.enabled ? "green" : "gray"}>{user.enabled ? "Activo" : "Inactivo"}</Badge></Table.Td>
                  <Table.Td ta="right">
                    {isCurrentAccount(user) ? (
                      <Button component={Link} to="/admin/profile" color="red" variant="light"
                        size="xs" leftSection={<Pencil size={14}/>}>
                        Mi perfil
                      </Button>
                    ) : (
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        {!user.roles?.includes("ROLE_ADMIN") && (
                          <Button variant="light" size="xs" color="blue"
                            leftSection={<Clock3 size={14}/>} onClick={() => void openSchedule(user)}>
                            Horarios
                          </Button>
                        )}
                        <Button variant="light" size="xs" color="gray"
                          leftSection={<Pencil size={14}/>} onClick={() => openEdit(user)}>
                          Editar
                        </Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal opened={creating} size="xl" title="Nuevo usuario de personal" onClose={() => {if (!saving) {setCreating(false); setError("");}}} centered>
        <form onSubmit={(event) => void createStaff(event)}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Nombre de usuario" required maxLength={30} value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.currentTarget.value })}/>
              <TextInput label="Correo electrónico" type="email" required value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.currentTarget.value })}/>
              <TextInput label="Nombre" required value={newUser.firstName} onChange={(e) => setNewUser({ ...newUser, firstName: e.currentTarget.value })}/>
              <TextInput label="Apellidos" required value={newUser.lastName} onChange={(e) => setNewUser({ ...newUser, lastName: e.currentTarget.value })}/>
              <Select label="Rol de personal" required data={roleOptions} value={newUser.role} onChange={(value) => setNewUser({ ...newUser, role: value || "ROLE_WAITER" })}/>
              <TextInput label="Teléfono" value={newUser.phone} onChange={(e) => setNewUser({ ...newUser, phone: e.currentTarget.value })}/>
            </SimpleGrid>
            <PasswordInput required label="Contraseña inicial" description="Mínimo 12 caracteres. Compártela de forma privada con el empleado." minLength={12} maxLength={128} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.currentTarget.value })}/>
            <Divider my="xs" label="Turnos del personal" labelPosition="center" />
            {newUser.role === "ROLE_ADMIN" ? (
              <Alert color="blue">El administrador no está sujeto al control horario del personal operativo.</Alert>
            ) : (
              <WeeklyScheduleEditor value={newWeek} onChange={setNewWeek} disabled={saving} />
            )}
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end"><Button variant="default" disabled={saving} onClick={() => setCreating(false)}>Cancelar</Button><Button type="submit" loading={saving}>Crear cuenta</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal
        opened={scheduleUser !== null}
        size="xl"
        title={"Horario laboral · " + (scheduleUser?.firstName || "") + " " + (scheduleUser?.lastName || "")}
        onClose={() => { if (!scheduleSaving) { setScheduleUser(null); setScheduleError(""); } }}
        closeOnEscape={!scheduleSaving}
        closeOnClickOutside={!scheduleSaving}
        centered
      >
        <form onSubmit={(event) => void saveSchedule(event)}>
          <Stack gap="md">
            {scheduleLoading ? (
              <Group justify="center" py="xl"><Loader color="red"/><Text size="sm">Cargando turnos...</Text></Group>
            ) : (
              scheduleReady ? <WeeklyScheduleEditor value={scheduleWeek} onChange={setScheduleWeek} disabled={scheduleSaving}/> : null
            )}
            {scheduleError && <Alert color="red" icon={<AlertCircle size={17}/>} title="No se pudo cargar o guardar el horario">{scheduleError}</Alert>}
            <Group justify="flex-end">
              <Button variant="default" disabled={scheduleSaving}
                onClick={() => {setScheduleUser(null);setScheduleError("");}}>Cancelar</Button>
              <Button type="submit" disabled={scheduleLoading || !scheduleReady}
                loading={scheduleSaving}>Guardar horario</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={editing !== null} size="lg" title="Editar usuario" onClose={() => {if (!saving) {setEditing(null); setError("");}}} centered>
        <form onSubmit={(event) => void save(event)}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Usuario" required value={form.username} onChange={(e) => setForm({ ...form, username: e.currentTarget.value })}/>
              <TextInput label="Correo" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}/>
              <TextInput label="Nombre" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.currentTarget.value })}/>
              <TextInput label="Apellidos" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.currentTarget.value })}/>
            </SimpleGrid>
            <TextInput label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })}/>
            <Checkbox color="red" label="Cuenta activa" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })}/>
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end"><Button variant="default" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" loading={saving}>Guardar cambios</Button></Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
