import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import {
  Alert, Badge, Box, Button, Container, Divider, Group, Paper,
  SimpleGrid, Stack, Text, Textarea, TextInput, ThemeIcon, Title,
} from "@mantine/core";
import axios from "axios";
import {
  ArrowRight, CheckCircle2, CircleHelp, Clock3, LockKeyhole,
  Mail, MessageCircleMore, MessageSquareText, Send, ShieldCheck,
  Sparkles, UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

const darkFieldStyles = {
  label: { color: "#f1f2f6", fontWeight: 650 },
  description: { color: "#a5a7b2" },
  input: { color: "#f8fafc", backgroundColor: "#121419", borderColor: "#454650" },
  section: { color: "#a7a9b8" },
};

function getError(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 429) {
      return "Espera un minuto antes de enviar otra consulta.";
    }
    if (error.response?.status === 403) {
      return "Tu cuenta no tiene permisos para registrar consultas.";
    }
    return error.response?.data?.message || "No se pudo registrar el mensaje. Inténtalo nuevamente.";
  }
  return error instanceof Error ? error.message : "No se pudo registrar el mensaje.";
}

export default function Contact() {
  const user = useAuthStore((state) => state.user);
  const canSubmit = Boolean(user?.roles?.includes("ROLE_CLIENT"));
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [receipt, setReceipt] = useState<number | null>(null);
  const [error, setError] = useState("");

  const valid = subject.trim().length >= 3 && message.trim().length >= 5;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setReceipt(null);

    if (!canSubmit) {
      setError("Inicia sesión con una cuenta de cliente para enviar tu consulta.");
      return;
    }
    if (!valid) {
      setError("Escribe un asunto de al menos 3 caracteres y un mensaje de al menos 5.");
      return;
    }

    setSending(true);
    try {
      const response = await api.post<ApiResponse<number>>("contact", {
        subject: subject.trim(),
        message: message.trim(),
      });
      if (!response.data.success || response.data.data == null) {
        throw new Error(response.data.message || "No se pudo registrar el mensaje.");
      }
      setReceipt(response.data.data);
      setSubject("");
      setMessage("");
      toast.success("Tu consulta quedó registrada correctamente.");
    } catch (cause) {
      const message = getError(cause);
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Box component="section" bg="#121316" style={{ minHeight: "100vh", overflow: "hidden", background: "linear-gradient(180deg, #171316 0%, #121316 45%, #121316 100%)" }}>
      <Box
        pos="relative"
        style={{
          backgroundColor: "#171316",
          isolation: "isolate",
          overflow: "hidden",
        }}
      >
        <Box
          pos="absolute"
          inset={0}
          aria-hidden="true"
          style={{
            zIndex: -1,
            backgroundImage: "linear-gradient(93deg, rgba(15,13,17,0.98) 0%, rgba(20,15,17,0.92) 44%, rgba(23,13,15,0.58) 100%), url('/images/auth/AuthFoodImage.png')",
            backgroundPosition: "center, center 45%",
            backgroundSize: "cover",
          }}
        />
        <Container size="xl" px={{ base: "lg", sm: "xl" }} pt={{ base: 150, sm: 165 }} pb={{ base: 100, sm: 130 }}>
          <Stack gap="lg" maw={720} style={{ position: "relative" }}>
            <Badge color="red" variant="light" size="lg" radius="xl" leftSection={<Sparkles size={14} />}>
              Atención al cliente
            </Badge>
            <Title
              order={1}
              c="white"
              fw={900}
              lh={1.08}
              style={{ fontSize: "clamp(2.8rem, 6vw, 5.3rem)", letterSpacing: "-0.045em" }}
            >
              Estamos aquí para
              <Text span inherit c="red.4"> escucharte.</Text>
            </Title>
            <Text c="#d5d5db" size="lg" lh={1.75} maw={585}>
              ¿Tienes una pregunta sobre nuestra carta, un pedido o una reserva?
              Cuéntanos qué necesitas y registra tu consulta en Restaurant Central.
            </Text>
            <Group gap="lg" mt="xs">
              <Group gap="xs">
                <CheckCircle2 size={17} color="#f87171" />
                <Text c="#eeeeef" fw={600} size="sm">Consulta registrada</Text>
              </Group>
              <Group gap="xs">
                <ShieldCheck size={17} color="#f87171" />
                <Text c="#eeeeef" fw={600} size="sm">Acceso con tu cuenta</Text>
              </Group>
            </Group>
          </Stack>
        </Container>
      </Box>

      <Container
        size="xl"
        px={{ base: "lg", sm: "xl" }}
        pb={{ base: 72, sm: 112 }}
        style={{ position: "relative", marginTop: -62, zIndex: 1 }}
      >
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing={{ base: "lg", md: 30 }} style={{ alignItems: "start" }}>
          <Stack gap="lg">
            <Paper
              radius="xl"
              p={{ base: "xl", sm: 34 }}
              style={{
                background: "linear-gradient(150deg, #202026, #151519)",
                border: "1px solid #373039",
                boxShadow: "0 20px 60px rgba(23,18,20,0.12)",
              }}
            >
              <ThemeIcon variant="light" color="red" size={54} radius="lg">
                <MessageCircleMore size={25} />
              </ThemeIcon>
              <Title order={2} mt="xl" c="white" fw={800} size="h3">
                Hablemos de tu experiencia
              </Title>
              <Text c="#aeb1bb" size="sm" lh={1.85} mt="sm">
                Queremos conocer tus dudas y sugerencias. Nuestro formulario guarda
                cada consulta para que el equipo del restaurante pueda revisarla.
              </Text>
              <Divider my="xl" color="#3a343d" />
              <Stack gap="xl">
                <Group align="flex-start" wrap="nowrap" gap="md">
                  <ThemeIcon size={43} radius="md" color="red" variant="light" style={{ flexShrink: 0 }}>
                    <UserRound size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text c="white" fw={700} size="sm">Identifícate con tu cuenta</Text>
                    <Text c="#aeb1bb" size="sm" mt={5} lh={1.65}>
                      Así la consulta queda vinculada a tu perfil de cliente.
                    </Text>
                  </Box>
                </Group>
                <Group align="flex-start" wrap="nowrap" gap="md">
                  <ThemeIcon size={43} radius="md" color="red" variant="light" style={{ flexShrink: 0 }}>
                    <MessageSquareText size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text c="white" fw={700} size="sm">Describe tu consulta</Text>
                    <Text c="#aeb1bb" size="sm" mt={5} lh={1.65}>
                      Añade un asunto claro y los detalles que necesitemos conocer.
                    </Text>
                  </Box>
                </Group>
                <Group align="flex-start" wrap="nowrap" gap="md">
                  <ThemeIcon size={43} radius="md" color="red" variant="light" style={{ flexShrink: 0 }}>
                    <CheckCircle2 size={20} />
                  </ThemeIcon>
                  <Box>
                    <Text c="white" fw={700} size="sm">Recibe un número de registro</Text>
                    <Text c="#aeb1bb" size="sm" mt={5} lh={1.65}>
                      Al guardar tu consulta, la página te mostrará su identificador.
                    </Text>
                  </Box>
                </Group>
              </Stack>
            </Paper>

            <Paper withBorder radius="xl" p="lg" bg="#1c1d23" style={{ borderColor: "#34343d" }}>
              <Group wrap="nowrap" gap="md">
                <ThemeIcon size={43} variant="light" color="red" radius="md" style={{ flexShrink: 0 }}>
                  <Clock3 size={21} />
                </ThemeIcon>
                <Box>
                  <Text fw={750} size="sm" c="white">Información importante</Text>
                  <Text size="xs" c="#b3b5c1" mt={5} lh={1.7}>
                    El formulario registra mensajes para revisión. No envía correos electrónicos
                    ni confirma un plazo de respuesta.
                  </Text>
                </Box>
              </Group>
            </Paper>
          </Stack>

          <Paper
            radius="xl"
            withBorder
            p={{ base: "lg", sm: 36 }}
            bg="#1d1e24"
            shadow="lg"
            style={{
              borderColor: "#373840",
              boxShadow: "0 22px 70px rgba(0,0,0,0.30)",
            }}
          >
            <Group justify="space-between" align="center" wrap="wrap" gap="xs">
              <Group gap="xs">
                <ThemeIcon color="red" variant="light" size={38} radius="md">
                  <Mail size={19} />
                </ThemeIcon>
                <Text c="red.7" size="xs" fw={800} tt="uppercase" lts={1.6}>
                  Escríbenos
                </Text>
              </Group>
              <Badge color="red" variant="outline" size="md" radius="xl">Formulario seguro</Badge>
            </Group>

            <Title order={2} mt="lg" fw={850} c="white">
              Envíanos tu consulta
            </Title>
            <Text size="sm" c="#b5b6c2" mt="sm" lh={1.7}>
              Completa los campos y registra tu mensaje. Te mostraremos una confirmación al guardarlo.
            </Text>

            <Divider my="xl" color="#393941" />

            {!canSubmit && (
              <Alert
                color="yellow"
                radius="lg"
                title="Necesitas una cuenta de cliente"
                icon={<LockKeyhole size={19} />}
                mb="xl"
                styles={{
                  root: { backgroundColor: "#302719", borderColor: "#614729" },
                  title: { color: "#f7c772" },
                  message: { color: "#f2e8d8" },
                }}
              >
                <Stack gap="sm">
                  <Text size="sm" c="#f2e8d8">
                    Puedes conocer esta página sin iniciar sesión, pero para enviar consultas
                    necesitas acceder con una cuenta de cliente.
                  </Text>
                  <Group gap="sm" wrap="wrap">
                    <Button component={Link} to="/auth/login" size="xs" color="red" rightSection={<ArrowRight size={14} />}>
                      Iniciar sesión
                    </Button>
                    <Button component={Link} to="/auth/signup" size="xs" color="gray" variant="outline" styles={{ root: { borderColor: "#8b8172", color: "#f2e8d8" } }}>
                      Crear cuenta
                    </Button>
                  </Group>
                </Stack>
              </Alert>
            )}

            {receipt !== null && (
              <Alert
                color="green"
                radius="lg"
                mb="xl"
                title="¡Consulta registrada correctamente!"
                icon={<CheckCircle2 size={19} />}
                role="status"
              >
                Tu mensaje se guardó para revisión con el número <strong>#{receipt}</strong>.
                Conserva este identificador como referencia.
              </Alert>
            )}

            <form onSubmit={(event) => void submit(event)}>
              <Stack gap="lg">
                <TextInput
                  styles={darkFieldStyles}
                  label="Tu correo electrónico"
                  description="Se obtiene automáticamente de tu cuenta de cliente."
                  value={user?.email || ""}
                  placeholder="Inicia sesión para continuar"
                  leftSection={<Mail size={17} />}
                  readOnly
                  disabled={!canSubmit}
                  radius="md"
                />
                <TextInput
                  styles={darkFieldStyles}
                  data-autofocus={false}
                  label="Asunto"
                  description="Escribe brevemente el motivo de tu consulta."
                  placeholder="Ej. Consulta sobre un pedido"
                  leftSection={<CircleHelp size={18} />}
                  required
                  minLength={3}
                  maxLength={120}
                  disabled={!canSubmit || sending}
                  value={subject}
                  onChange={(event) => setSubject(event.currentTarget.value)}
                  radius="md"
                />
                <Textarea
                  styles={darkFieldStyles}
                  label="Tu mensaje"
                  description="Cuéntanos los detalles para que podamos revisarlos."
                  placeholder="Hola, quisiera consultar sobre..."
                  required
                  minLength={5}
                  maxLength={3000}
                  minRows={6}
                  autosize
                  disabled={!canSubmit || sending}
                  value={message}
                  onChange={(event) => setMessage(event.currentTarget.value)}
                  radius="md"
                />
                <Group justify="space-between" gap="xs">
                  <Text c="#a5a7b2" size="xs">
                    Evita incluir contraseñas o información bancaria.
                  </Text>
                  <Text c="#a5a7b2" size="xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {message.length}/3000
                  </Text>
                </Group>

                {error && (
                  <Alert color="red" title="No se pudo registrar la consulta" role="alert"
                    onClose={() => setError("")} withCloseButton radius="lg">
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  color="red"
                  radius="md"
                  loading={sending}
                  disabled={!canSubmit || !valid}
                  leftSection={<Send size={19} />}
                >
                  Registrar mi consulta
                </Button>
                <Group justify="center" gap="xs">
                  <LockKeyhole size={14} color="#9ca3af" />
                  <Text c="#a5a7b2" size="xs" ta="center">
                    Tu mensaje quedará registrado en Restaurant Central.
                  </Text>
                </Group>
              </Stack>
            </form>
          </Paper>
        </SimpleGrid>
      </Container>
    </Box>
  );
}
