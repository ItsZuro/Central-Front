import { api } from "@/core/api/api";
import { orderService } from "@/core/services/order/order.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { UserResponse } from "@/core/types/user/user.model";
import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Modal,
  Paper,
  PasswordInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  LockKeyhole,
  Mail,
  Pencil,
  Phone,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import styles from "./Profile.module.css";

type ProfileFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
};

const inputClasses = { input: styles.input, label: styles.label };
const panelStyle = { backgroundColor: "#1e1d20", border: "1px solid #373338" };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function Profile() {
  const { user, accessToken, sessionId, setAuth, logout } = useAuthStore();
  const navigate = useNavigate();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [passwordModalOpened, setPasswordModalOpened] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState({ current: "", next: "", confirmation: "" });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      phone: user?.phone || "",
      username: user?.username || "",
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        username: user.username || "",
      });
    }
  }, [user, reset]);

  const ordersQuery = useQuery({
    queryKey: ["profile", "my-orders", user?.id],
    queryFn: () => orderService.getMyOrders("es"),
    enabled: Boolean(user && accessToken),
    staleTime: 60_000,
  });

  if (!user || !accessToken) {
    return <Navigate to="/auth/login" replace state={{ from: "/profile" }} />;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username;
  const initials = [user.firstName?.[0], user.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || user.username.slice(0, 2).toUpperCase();
  const ordersAvailable = ordersQuery.data?.success && Array.isArray(ordersQuery.data.data);
  const orders = ordersAvailable ? ordersQuery.data!.data : [];
  const orderCount = ordersQuery.isPending ? "…" : ordersAvailable ? String(orders.length) : "—";
  const activeCount = ordersQuery.isPending
    ? "…"
    : ordersAvailable
      ? String(orders.filter((order) => !["COMPLETED", "DELIVERED", "CANCELLED", "FAILED"].includes(order.statusCode)).length)
      : "—";

  const saveProfile = async (data: ProfileFormData) => {
    try {
      const response = await api.put<ApiResponse<{ user: UserResponse; token: string | null }>>(
        "users/update-profile",
        data,
      );
      if (!response.data.success || !response.data.data?.user) {
        throw new Error(response.data.message || "No se pudo actualizar el perfil");
      }
      setAuth({
        user: response.data.data.user,
        accessToken: response.data.data.token || accessToken,
        sessionId: sessionId || "",
      });
      setIsEditing(false);
      toast.success("Tus datos se actualizaron correctamente");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar tu perfil"));
    }
  };

  const cancelEdit = () => {
    reset({
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      email: user.email || "",
      phone: user.phone || "",
      username: user.username || "",
    });
    setIsEditing(false);
  };

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Selecciona una imagen JPG, PNG o WebP.");
      if (uploadRef.current) uploadRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 5 MB.");
      if (uploadRef.current) uploadRef.current.value = "";
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setUploadingPhoto(true);
    try {
      const response = await api.put<ApiResponse<UserResponse>>("users/profile-image", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "No se pudo subir la imagen");
      }
      setAuth({ user: response.data.data, accessToken, sessionId: sessionId || "" });
      toast.success("Foto de perfil actualizada");
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo subir la foto de perfil"));
    } finally {
      setUploadingPhoto(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const changePassword = async () => {
    if (user.hasPassword && !password.current) {
      toast.error("Ingresa tu contraseña actual.");
      return;
    }
    if (password.next.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password.next !== password.confirmation) {
      toast.error("Las nuevas contraseñas no coinciden.");
      return;
    }
    setChangingPassword(true);
    try {
      const response = await api.put<ApiResponse<null>>("users/change-password", {
        currentPassword: user.hasPassword ? password.current : null,
        newPassword: password.next,
      });
      if (!response.data.success) {
        throw new Error(response.data.message || "No se pudo actualizar la contraseña");
      }
      setPassword({ current: "", next: "", confirmation: "" });
      setPasswordModalOpened(false);
      logout();
      toast.success("Contraseña actualizada. Inicia sesión nuevamente.");
      navigate("/auth/login", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudo actualizar la contraseña"));
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <section className={styles.page}>
      <main className={styles.container}>
        <Box mb="xl">
          <Text className={styles.kicker} mb={8}>Restaurant Central · Tu espacio</Text>
          <Text component="h1" className={styles.heading}>Mi cuenta</Text>
          <Text className={styles.subtitle} mt="sm">
            Tu perfil, tus pedidos y tus preferencias en un solo lugar.
          </Text>
        </Box>

        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <Group gap="lg" align="center" wrap="nowrap" style={{ minWidth: 0 }}>
              <div className={styles.avatarFrame}>
                <Avatar src={user.profileImageUrl || undefined} size={92} radius={30} className={styles.avatar}>
                  {initials}
                </Avatar>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadPhoto}
                  aria-label="Seleccionar foto de perfil"
                  hidden
                />
                <button
                  type="button"
                  className={styles.camera}
                  disabled={uploadingPhoto}
                  onClick={() => uploadRef.current?.click()}
                  aria-label="Cambiar foto de perfil"
                  title="Cambiar foto de perfil"
                >
                  <Camera size={17} />
                </button>
              </div>
              <Box className={styles.identity}>
                <Text className={styles.heroName}>{fullName}</Text>
                <Text className={styles.heroEmail}>{user.email}</Text>
                <Group gap="xs" mt="sm">
                  <span className={styles.memberTag}>Cliente Central</span>
                  {user.provider !== "LOCAL" && (
                    <Badge color="gray" variant="light" radius="xl" size="sm">
                      {user.provider}
                    </Badge>
                  )}
                </Group>
              </Box>
            </Group>
            <Button
              radius="md"
              variant="white"
              color="dark"
              leftSection={<Pencil size={16} />}
              onClick={() => setIsEditing(true)}
            >
              Editar perfil
            </Button>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.column}>
            <Paper className={styles.panel} style={panelStyle}>
              <div className={styles.panelBody}>
                <Group justify="space-between" align="flex-start" mb="xl" gap="sm">
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <div className={styles.iconBox}><UserRound size={21} /></div>
                    <Box>
                      <Text className={styles.panelTitle}>Información personal</Text>
                      <Text className={styles.panelDesc}>Mantén tus datos al día para una mejor atención.</Text>
                    </Box>
                  </Group>
                  {isEditing && <Badge radius="xl" color="red" variant="light">Editando</Badge>}
                </Group>
                <form onSubmit={handleSubmit(saveProfile)}>
                  <Stack gap="lg">
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                      <TextInput
                        label="Nombre"
                        placeholder="Tu nombre"
                        disabled={!isEditing}
                        classNames={inputClasses}
                        error={errors.firstName?.message}
                        {...register("firstName", {
                          required: "El nombre es obligatorio",
                          maxLength: { value: 50, message: "Máximo 50 caracteres" },
                        })}
                      />
                      <TextInput
                        label="Apellido"
                        placeholder="Tu apellido"
                        disabled={!isEditing}
                        classNames={inputClasses}
                        error={errors.lastName?.message}
                        {...register("lastName", {
                          required: "El apellido es obligatorio",
                          maxLength: { value: 50, message: "Máximo 50 caracteres" },
                        })}
                      />
                      <TextInput
                        label="Nombre de usuario"
                        leftSection={<UserRound size={15} />}
                        disabled
                        classNames={inputClasses}
                        {...register("username")}
                      />
                      <TextInput
                        label="Correo electrónico"
                        leftSection={<Mail size={15} />}
                        disabled
                        classNames={inputClasses}
                        {...register("email")}
                      />
                    </SimpleGrid>
                    <TextInput
                      label="Teléfono de contacto"
                      leftSection={<Phone size={16} />}
                      placeholder="Añade un número de contacto"
                      type="tel"
                      disabled={!isEditing}
                      classNames={inputClasses}
                      {...register("phone")}
                    />
                    {isEditing && (
                      <>
                        <Divider color="#39323a" />
                        <Group justify="flex-end" gap="sm">
                          <Button
                            type="button"
                            variant="outline"
                            radius="md"
                            className={styles.secondaryButton}
                            onClick={cancelEdit}
                            disabled={isSubmitting}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            radius="md"
                            loading={isSubmitting}
                            className={styles.action}
                            leftSection={<CheckCircle2 size={17} />}
                          >
                            Guardar cambios
                          </Button>
                        </Group>
                      </>
                    )}
                  </Stack>
                </form>
              </div>
            </Paper>

            <Paper className={styles.panel} style={panelStyle}>
              <div className={styles.panelBody}>
                <Group gap="sm" align="flex-start" mb="lg" wrap="nowrap">
                  <div className={styles.iconBox}><ShieldCheck size={20} /></div>
                  <Box>
                    <Text className={styles.panelTitle}>Seguridad de tu cuenta</Text>
                    <Text className={styles.panelDesc}>Gestiona el acceso a tu cuenta Central.</Text>
                  </Box>
                </Group>
                <div className={styles.status}>
                  <Group justify="space-between" align="center" gap="md">
                    <Group gap="sm" wrap="nowrap">
                      <LockKeyhole size={20} color="#e7b887" />
                      <Box>
                        <Text fw={750} c="#f9f3f6" size="sm">Contraseña</Text>
                        <Text c="#aaa1a9" size="xs" mt={4}>
                          {user.hasPassword ? "Actualiza tu contraseña de acceso." : "Configura una contraseña para acceder también con correo."}
                        </Text>
                      </Box>
                    </Group>
                    <Button
                      type="button"
                      variant="outline"
                      className={styles.secondaryButton}
                      radius="md"
                      size="sm"
                      onClick={() => setPasswordModalOpened(true)}
                    >
                      {user.hasPassword ? "Cambiar" : "Configurar"}
                    </Button>
                  </Group>
                </div>
              </div>
            </Paper>
          </div>

          <div className={styles.column}>
            <Paper className={styles.panel} style={panelStyle}>
              <div className={styles.panelBody}>
                <Group gap="sm" align="flex-start" mb="lg" wrap="nowrap">
                  <div className={styles.iconBox}><ClipboardList size={20} /></div>
                  <Box>
                    <Text className={styles.panelTitle}>Tu actividad</Text>
                    <Text className={styles.panelDesc}>Un vistazo a tus pedidos en Central.</Text>
                  </Box>
                </Group>
                <SimpleGrid cols={2} spacing="sm">
                  <div className={styles.metric}>
                    <Text className={styles.metricTitle}>Pedidos realizados</Text>
                    <Text className={styles.metricValue}>{orderCount}</Text>
                    <Text className={styles.metricFoot}>En tu historial</Text>
                  </div>
                  <div className={styles.metric}>
                    <Text className={styles.metricTitle}>En proceso</Text>
                    <Text className={styles.metricValue}>{activeCount}</Text>
                    <Text className={styles.metricFoot}>Pedidos activos</Text>
                  </div>
                </SimpleGrid>
                {ordersQuery.isError && (
                  <Alert mt="md" color="yellow" variant="light" radius="md">
                    No pudimos consultar tu historial ahora. Puedes intentarlo desde Mis pedidos.
                  </Alert>
                )}
                <Button
                  component={Link}
                  to="/my-orders"
                  fullWidth
                  mt="lg"
                  variant="outline"
                  radius="md"
                  className={styles.secondaryButton}
                  rightSection={<ArrowRight size={17} />}
                >
                  Consultar mis pedidos
                </Button>
              </div>
            </Paper>

            <Paper className={styles.panel} style={panelStyle}>
              <div className={styles.panelBody}>
                <Text className={styles.panelTitle}>Explora Central</Text>
                <Text className={styles.panelDesc} mb="lg">Accede a lo que necesitas sin salir de tu cuenta.</Text>
                <Stack gap="sm">
                  <Link className={styles.quickLink} to="/my-orders">
                    <span className={styles.quickLinkIcon}><ShoppingBag size={19} /></span>
                    <span>
                      <Text className={styles.quickLinkTitle}>Mis pedidos</Text>
                      <Text className={styles.quickLinkDesc}>Consulta compras y su estado</Text>
                    </span>
                    <ArrowRight size={17} className={styles.quickArrow} />
                  </Link>
                  <Link className={styles.quickLink} to="/reservations">
                    <span className={styles.quickLinkIcon}><CalendarDays size={19} /></span>
                    <span>
                      <Text className={styles.quickLinkTitle}>Reservar una mesa</Text>
                      <Text className={styles.quickLinkDesc}>Elige la fecha y el horario</Text>
                    </span>
                    <ArrowRight size={17} className={styles.quickArrow} />
                  </Link>
                  <Link className={styles.quickLink} to="/menu">
                    <span className={styles.quickLinkIcon}><ShoppingBag size={19} /></span>
                    <span>
                      <Text className={styles.quickLinkTitle}>Explorar el menú</Text>
                      <Text className={styles.quickLinkDesc}>Descubre todos nuestros platos</Text>
                    </span>
                    <ArrowRight size={17} className={styles.quickArrow} />
                  </Link>
                </Stack>
              </div>
            </Paper>
          </div>
        </div>
      </main>

      <Modal
        opened={passwordModalOpened}
        onClose={() => { if (!changingPassword) setPasswordModalOpened(false); }}
        title="Seguridad de tu cuenta"
        centered
        radius="lg"
        styles={{
          content: { background: "#211e23", border: "1px solid #4a3b44", color: "#fff" },
          header: { background: "#211e23" },
          title: { color: "#fff", fontWeight: 800 },
          close: { color: "#fff" },
        }}
      >
        <Stack gap="md">
          <Text c="#bcb1ba" size="sm">
            {user.hasPassword
              ? "Confirma tu contraseña actual para establecer una nueva."
              : "Establece una contraseña para iniciar sesión con tu correo."}
          </Text>
          {user.hasPassword && (
            <PasswordInput
              label="Contraseña actual"
              value={password.current}
              onChange={(event) => setPassword((value) => ({ ...value, current: event.currentTarget.value }))}
              classNames={inputClasses}
              required
            />
          )}
          <PasswordInput
            label="Nueva contraseña"
            value={password.next}
            onChange={(event) => setPassword((value) => ({ ...value, next: event.currentTarget.value }))}
            classNames={inputClasses}
            description="Mínimo 8 caracteres"
            required
          />
          <PasswordInput
            label="Confirmar contraseña"
            value={password.confirmation}
            onChange={(event) => setPassword((value) => ({ ...value, confirmation: event.currentTarget.value }))}
            classNames={inputClasses}
            required
          />
          <Button fullWidth className={styles.action} loading={changingPassword} onClick={changePassword}>
            Guardar nueva contraseña
          </Button>
          <Text size="xs" c="#9e949d" ta="center">
            Por seguridad, tendrás que iniciar sesión de nuevo después del cambio.
          </Text>
        </Stack>
      </Modal>
    </section>
  );
}
