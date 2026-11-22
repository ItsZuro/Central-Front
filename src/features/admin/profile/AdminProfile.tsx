import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { UserResponse } from "@/core/types/user/user.model";
import {
  Alert, Avatar, Badge, Box, Button, Divider, Group, Paper, PasswordInput,
  SimpleGrid, Stack, Text, TextInput, ThemeIcon, Title, Tooltip,
} from "@mantine/core";
import axios from "axios";
import {
  ArrowLeft, Camera, CheckCircle2, CircleCheck, KeyRound, LockKeyhole,
  Mail, Save, ShieldCheck, Sparkles, UserRoundPen,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
  axios.isAxiosError<{ message?: string }>(error)
    ? error.response?.data?.message || "El servidor no pudo completar la operación."
    : error instanceof Error ? error.message : "Ocurrió un error.";

const panelBorder = "1px solid #ecdedf";

export default function AdminProfile() {
  const user = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const accessToken = useAuthStore((state) => state.accessToken);
  const sessionId = useAuthStore((state) => state.sessionId);
  const navigate = useNavigate();
  const uploadRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileForm>({
    username: "", firstName: "", lastName: "", email: "", phone: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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
      setError("Completa los campos obligatorios.");
      return;
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
      setAuth({ user: updated.user, accessToken: updated.token || accessToken || "", sessionId: sessionId || "" });
      toast.success("Información personal actualizada.");
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Selecciona una foto JPG, PNG o WEBP.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La foto debe pesar como máximo 5 MB.");
      event.currentTarget.value = "";
      return;
    }
    if (!accessToken || !user) return;

    const body = new FormData();
    body.append("file", file);
    setUploadingPhoto(true);
    setError("");
    try {
      const result = await api.put<ApiResponse<UserResponse>>("users/profile-image", body, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 45000,
      });
      if (!result.data.success || !result.data.data) {
        throw new Error(result.data.message || "No se pudo guardar la foto.");
      }
      setAuth({
        user: result.data.data,
        accessToken,
        sessionId: sessionId || "",
      });
      toast.success("Foto de perfil actualizada.");
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setUploadingPhoto(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (user?.hasPassword && !password.currentPassword) return setError("Ingresa tu contraseña actual.");
    if (password.newPassword.length < 12) return setError("La contraseña nueva necesita al menos 12 caracteres.");
    if (password.newPassword !== password.confirm) return setError("Las contraseñas nuevas no coinciden.");
    setChangingPassword(true);
    setError("");
    try {
      await api.put("users/change-password", {
        currentPassword: user?.hasPassword ? password.currentPassword : null,
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
  const displayName = user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;

  return (
    <Stack maw={1250} mx="auto" gap="xl">
      <Box>
        <Button variant="subtle" color="gray" size="compact-md" leftSection={<ArrowLeft size={16}/>}
          component={Link} to="/admin/dashboard">Volver al resumen</Button>
        <Text mt="lg" c="red.7" fw={800} tt="uppercase" size="xs" lts={2}>Mi cuenta / Administración</Text>
        <Title order={1} fw={850} mt={6}>Mi perfil</Title>
        <Text mt={6} c="dimmed" size="sm">Personaliza tu identidad en Central y administra la seguridad de tu cuenta.</Text>
      </Box>

      {error && <Alert color="red" title="No se pudo completar la operación" withCloseButton
        onClose={() => setError("")}>{error}</Alert>}

      <Paper radius="xl" withBorder style={{ overflow: "hidden", border: panelBorder, background: "#fff" }}>
        <Box
          h={115}
          style={{
            background: "radial-gradient(circle at 85% 0,rgba(255,255,255,.2),transparent 36%),linear-gradient(110deg,#8d2638,#d63248 62%,#ed5965)",
            position: "relative",
          }}
        >
          <Group gap="xs" justify="flex-end" p="md">
            <Badge color="red" variant="white" leftSection={<ShieldCheck size={12}/>} size="md">
              Acceso administrativo
            </Badge>
          </Group>
        </Box>
        <Group justify="space-between" align="flex-end" p={{ base:"md", sm:"xl" }} pt={0} gap="lg" wrap="wrap">
          <Group gap="lg" align="flex-end" wrap="nowrap">
            <Box style={{ position: "relative", marginTop: -56, flexShrink: 0 }}>
              <Avatar
                src={user.profileImageUrl || undefined}
                name={displayName}
                size={108}
                radius={27}
                color="red"
                variant="light"
                style={{ border:"5px solid #fff", boxShadow:"0 8px 25px rgba(92,31,46,.18)" }}
              />
              <input
                ref={uploadRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Seleccionar foto de perfil"
                onChange={(event) => void uploadPhoto(event)}
                style={{ display:"none" }}
              />
              <Tooltip label="Cambiar foto de perfil">
                <Button
                  aria-label="Cambiar foto de perfil"
                  size="compact-md"
                  color="red"
                  radius="xl"
                  loading={uploadingPhoto}
                  onClick={() => uploadRef.current?.click()}
                  style={{ position:"absolute", right:-8, bottom:-5, padding:"8px", minWidth:38, height:38,
                    border:"3px solid #fff", boxShadow:"0 3px 14px rgba(0,0,0,.12)" }}
                >
                  <Camera size={17} />
                </Button>
              </Tooltip>
            </Box>
            <Stack gap={5} pb={4} style={{ minWidth:0 }}>
              <Title order={2} fw={850} c="#2b1e26">{displayName}</Title>
              <Text size="sm" c="dimmed">@{user.username}</Text>
              <Group gap="xs">
                <Badge color="red" variant="light" leftSection={<ShieldCheck size={12}/>} radius="md">
                  {displayRole}
                </Badge>
                <Badge color={user.enabled ? "green" : "gray"} variant="light" radius="md">
                  {user.enabled ? "Cuenta activa" : "Cuenta inactiva"}
                </Badge>
              </Group>
            </Stack>
          </Group>
          <Stack gap={4} align="flex-end" pb={3}>
            <Button variant="light" color="red" radius="md" leftSection={<Camera size={17}/>}
              loading={uploadingPhoto} onClick={() => uploadRef.current?.click()}>
              Cambiar foto
            </Button>
            <Text c="dimmed" size="xs">JPG, PNG o WEBP · Máximo 5 MB</Text>
          </Stack>
        </Group>
      </Paper>

      <div className="grid items-start gap-6 lg:grid-cols-[310px_minmax(0,1fr)]">
        <Stack gap="lg">
          <Paper withBorder radius="xl" shadow="xs" p="lg" style={{ border:panelBorder }}>
            <Group gap="sm">
              <ThemeIcon variant="light" color="green" radius="md" size={39}>
                <CircleCheck size={19}/>
              </ThemeIcon>
              <Box>
                <Text fw={800} c="#2f222b">Cuenta protegida</Text>
                <Text c="dimmed" size="xs">Estado y datos de tu acceso</Text>
              </Box>
            </Group>
            <Divider my="lg" color="#f0e5e5"/>
            <Group gap="xs" align="center">
              <CheckCircle2 size={17} color="#379469"/>
              <Text size="sm" fw={700}>{user.enabled ? "Acceso habilitado" : "Acceso deshabilitado"}</Text>
            </Group>
            <Group mt="md" wrap="nowrap" gap="xs">
              <Mail size={16} color="#ad8f9b"/>
              <Text size="sm" c="dimmed" style={{ overflowWrap:"anywhere" }}>{user.email}</Text>
            </Group>
            <Text mt="lg" size="xs" c="dimmed">La foto de esta cuenta también aparece en el menú lateral y la barra superior.</Text>
          </Paper>

          <Paper withBorder radius="xl" p="lg" style={{ border:panelBorder,
            background:"linear-gradient(140deg,#fff9f7,#ffefef)" }}>
            <ThemeIcon color="red" variant="light" size={39} radius="md"><Sparkles size={21}/></ThemeIcon>
            <Text fw={800} c="#38242b" mt="sm">Identidad de Central</Text>
            <Text mt={6} c="#846872" size="sm">
              Mantén tus datos actualizados para identificarte dentro del panel del restaurante.
            </Text>
            <Button component={Link} to="/admin/dashboard" mt="md" variant="outline" color="red" fullWidth>
              Volver al panel
            </Button>
          </Paper>
        </Stack>

        <Stack gap="lg">
          <Paper withBorder shadow="xs" radius="xl" style={{ border:panelBorder, overflow:"hidden" }}>
            <Group px="xl" py="lg">
              <ThemeIcon color="red" variant="light" radius="md" size={41}><UserRoundPen size={20}/></ThemeIcon>
              <Box>
                <Title order={3} size="lg" c="#2d2029">Información personal</Title>
                <Text c="dimmed" size="xs" mt={4}>Tus datos y la identidad de tu cuenta de administración.</Text>
              </Box>
            </Group>
            <Divider color="#eee5e5"/>
            <form onSubmit={(event) => void saveProfile(event)}>
              <Stack gap="md" p="xl">
                <SimpleGrid cols={{base:1,sm:2}} spacing="md">
                  <TextInput required label="Nombre" value={form.firstName} maxLength={50}
                    onChange={(e) => setForm({...form,firstName:e.currentTarget.value})}/>
                  <TextInput required label="Apellidos" value={form.lastName} maxLength={50}
                    onChange={(e) => setForm({...form,lastName:e.currentTarget.value})}/>
                  <TextInput required label="Nombre de usuario" value={form.username} maxLength={30}
                    description="El cambio de usuario puede tener un periodo de espera."
                    onChange={(e) => setForm({...form,username:e.currentTarget.value})}/>
                  <TextInput required type="email" label="Correo electrónico" value={form.email} maxLength={100}
                    description="Puede requerir verificación si cambias el correo."
                    onChange={(e) => setForm({...form,email:e.currentTarget.value})}/>
                </SimpleGrid>
                <TextInput label="Teléfono (opcional)" type="tel" value={form.phone}
                  onChange={(e) => setForm({...form,phone:e.currentTarget.value})}/>
                <Group justify="flex-end" mt="sm">
                  <Button type="submit" color="red" loading={saving} radius="md"
                    leftSection={<Save size={17}/>}>Guardar cambios</Button>
                </Group>
              </Stack>
            </form>
          </Paper>

          <Paper withBorder shadow="xs" radius="xl" style={{ border:panelBorder, overflow:"hidden" }}>
            <Group px="xl" py="lg">
              <ThemeIcon color="red" variant="light" radius="md" size={41}><LockKeyhole size={20}/></ThemeIcon>
              <Box>
                <Title order={3} size="lg" c="#2d2029">Seguridad de la cuenta</Title>
                <Text size="xs" c="dimmed" mt={4}>Actualiza tu contraseña y protege tus permisos de administrador.</Text>
              </Box>
            </Group>
            <Divider color="#eee5e5"/>
            <form onSubmit={(event) => void changePassword(event)}>
              <Stack gap="md" p="xl">
                <PasswordInput required={user.hasPassword} label="Contraseña actual"
                  autoComplete="current-password" value={password.currentPassword}
                  onChange={(e) => setPassword({...password,currentPassword:e.currentTarget.value})}/>
                <SimpleGrid cols={{base:1,sm:2}}>
                  <PasswordInput required minLength={12} label="Nueva contraseña" description="Al menos 12 caracteres"
                    autoComplete="new-password" value={password.newPassword}
                    onChange={(e) => setPassword({...password,newPassword:e.currentTarget.value})}/>
                  <PasswordInput required minLength={12} label="Confirmar contraseña"
                    autoComplete="new-password" value={password.confirm}
                    onChange={(e) => setPassword({...password,confirm:e.currentTarget.value})}/>
                </SimpleGrid>
                <Group justify="space-between" gap="sm" align="center" wrap="wrap" mt="sm">
                  <Text size="xs" c="dimmed" maw={300}>
                    Por seguridad, al cambiar tu contraseña tendrás que iniciar sesión de nuevo.
                  </Text>
                  <Button type="submit" variant="light" color="red" loading={changingPassword}
                    radius="md" leftSection={<KeyRound size={17}/>}>Cambiar contraseña</Button>
                </Group>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </div>
    </Stack>
  );
}
