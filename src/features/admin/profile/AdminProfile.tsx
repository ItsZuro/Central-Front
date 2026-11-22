import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { UserResponse } from "@/core/types/user/user.model";
import { Alert, Avatar, Badge, Box, Button, Divider, Group, Paper, PasswordInput, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import axios from "axios";
import { ArrowLeft, CircleCheck, KeyRound, LockKeyhole, Mail, Save, ShieldCheck, UserRoundPen } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

interface ProfileForm {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const errorMessage = (error: unknown) =>
  axios.isAxiosError<{message?: string}>(error)
    ? error.response?.data?.message || "El servidor no pudo completar la operación."
    : error instanceof Error ? error.message : "Ocurrió un error.";

export default function AdminProfile() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);
  const sessionId = useAuthStore((state) => state.sessionId);
  const navigate = useNavigate();

  const [form, setForm] = useState<ProfileForm>({
    username: "", firstName: "", lastName: "", email: "", phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState({currentPassword:"",newPassword:"",confirm:""});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      username: user.username || "",
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
    });
  }, [user]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    if (![form.username, form.email, form.firstName, form.lastName].every((field) => field.trim())) {
      setError("Completa los campos obligatorios."); return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await api.put<ApiResponse<{user:UserResponse;token:string|null}>>("users/update-profile", {
        username: form.username.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
      });
      const updated = response.data?.data;
      if (!response.data.success || !updated?.user) throw new Error(response.data.message || "No se pudo actualizar tu perfil.");
      setAuth({user:updated.user,accessToken:updated.token || accessToken || "",sessionId:sessionId || ""});
      toast.success("Perfil actualizado correctamente.");
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.newPassword.length < 12) return setError("La contraseña nueva necesita al menos 12 caracteres.");
    if (password.newPassword !== password.confirm) return setError("Las contraseñas nuevas no coinciden.");
    setChangingPassword(true);
    setError("");
    try {
      await api.put("users/change-password", {
        currentPassword: password.currentPassword,
        newPassword: password.newPassword,
      });
      setPassword({currentPassword:"",newPassword:"",confirm:""});
      toast.success("Contraseña cambiada. Inicia sesión nuevamente.");
      useAuthStore.getState().logout();
      navigate("/auth/login", {replace:true});
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return <Text c="dimmed" p="xl">Cargando perfil…</Text>;
  const displayRole = user.roles?.includes("ROLE_ADMIN") ? "Administrador" : "Gerente";

  return (
    <Stack maw={1200} mx="auto" gap="xl">
      <Box>
        <Button variant="subtle" color="gray" size="compact-md" leftSection={<ArrowLeft size={16}/>} component={Link} to="/admin/dashboard">Volver al resumen</Button>
        <Text mt="lg" c="red.7" fw={800} tt="uppercase" size="xs" lts={2}>Mi cuenta / Administración</Text>
        <Title order={1} fw={850} mt={6}>Mi perfil</Title>
        <Text mt={6} c="dimmed" size="sm">Actualiza tu información y la seguridad de tu acceso.</Text>
      </Box>

      {error && <Alert color="red" title="No se pudo completar la operación" withCloseButton onClose={() => setError("")}>{error}</Alert>}

      <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
        <Stack gap="lg">
          <Paper withBorder shadow="xs" style={{overflow:"hidden"}}>
            <Box h={96} bg="red.8" style={{background:"linear-gradient(110deg,#ad0714,#e11d29,#f97316)"}}/>
            <Stack align="center" p="xl" mt={-53} gap="sm" style={{position:"relative"}}>
              <Avatar radius="lg" size={86} color="red" variant="light" src={user.profileImageUrl || null} name={user.fullName || user.username} style={{border:"4px solid white"}}/>
              <Title order={3} ta="center">{user.fullName || user.username}</Title>
              <Text size="sm" c="dimmed">@{user.username}</Text>
              <Badge color="red" variant="light" size="lg" leftSection={<ShieldCheck size={15}/>} mt="sm">{displayRole}</Badge>
            </Stack>
          </Paper>
          <Paper withBorder shadow="xs" p="lg">
            <Group gap="sm"><ThemeIcon variant="light" color="green"><CircleCheck size={18}/></ThemeIcon><Text fw={700}>Estado de tu cuenta</Text></Group>
            <Text c="dimmed" mt="md" size="sm">{user.enabled ? "Cuenta activa y habilitada" : "Cuenta deshabilitada"}</Text>
            <Group mt="md" wrap="nowrap" gap="xs"><Mail size={16} color="#94a3b8"/><Text size="sm" c="dimmed" style={{overflowWrap:"anywhere"}}>{user.email}</Text></Group>
          </Paper>
        </Stack>

        <Stack gap="lg">
          <Paper withBorder shadow="xs">
            <Group px="xl" py="lg"><ThemeIcon color="red" variant="light"><UserRoundPen size={18}/></ThemeIcon><Box><Title order={3} size="lg">Información personal</Title><Text c="dimmed" size="xs" mt={4}>El correo y el usuario pueden tener límites entre modificaciones.</Text></Box></Group>
            <Divider/>
            <form onSubmit={(event) => void saveProfile(event)}>
              <Stack gap="md" p="xl">
                <SimpleGrid cols={{base:1,sm:2}} spacing="md">
                  <TextInput required label="Nombre" value={form.firstName} maxLength={50} onChange={(e) => setForm({...form,firstName:e.currentTarget.value})}/>
                  <TextInput required label="Apellidos" value={form.lastName} maxLength={50} onChange={(e) => setForm({...form,lastName:e.currentTarget.value})}/>
                  <TextInput required label="Nombre de usuario" value={form.username} maxLength={30} onChange={(e) => setForm({...form,username:e.currentTarget.value})}/>
                  <TextInput required type="email" label="Correo electrónico" value={form.email} maxLength={100} onChange={(e) => setForm({...form,email:e.currentTarget.value})}/>
                </SimpleGrid>
                <TextInput label="Teléfono (opcional)" type="tel" value={form.phone} onChange={(e) => setForm({...form,phone:e.currentTarget.value})}/>
                <Group justify="flex-end" mt="sm"><Button type="submit" loading={saving} leftSection={<Save size={17}/>}>Guardar cambios</Button></Group>
              </Stack>
            </form>
          </Paper>

          <Paper withBorder shadow="xs">
            <Group px="xl" py="lg"><ThemeIcon color="red" variant="light"><LockKeyhole size={18}/></ThemeIcon><Box><Title order={3} size="lg">Seguridad de la cuenta</Title><Text size="xs" c="dimmed" mt={4}>Actualiza tu contraseña de acceso a Restaurant Central.</Text></Box></Group>
            <Divider/>
            <form onSubmit={(event) => void changePassword(event)}>
              <Stack gap="md" p="xl">
                <PasswordInput required label="Contraseña actual" autoComplete="current-password" value={password.currentPassword} onChange={(e) => setPassword({...password,currentPassword:e.currentTarget.value})}/>
                <SimpleGrid cols={{base:1,sm:2}}>
                  <PasswordInput required minLength={12} label="Nueva contraseña" description="Al menos 12 caracteres" autoComplete="new-password" value={password.newPassword} onChange={(e) => setPassword({...password,newPassword:e.currentTarget.value})}/>
                  <PasswordInput required minLength={12} label="Confirmar contraseña" autoComplete="new-password" value={password.confirm} onChange={(e) => setPassword({...password,confirm:e.currentTarget.value})}/>
                </SimpleGrid>
                <Group justify="flex-end" mt="sm"><Button type="submit" variant="light" color="red" loading={changingPassword} leftSection={<KeyRound size={17}/>}>Cambiar contraseña</Button></Group>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </div>
    </Stack>
  );
}
