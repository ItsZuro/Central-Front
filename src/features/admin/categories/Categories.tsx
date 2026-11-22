import { api } from "@/core/api/api";
import { ActionIcon, Alert, Badge, Box, Button, Center, Group, Loader, Modal, Paper, SimpleGrid, Stack, Table, Text, TextInput, ThemeIcon, Title } from "@mantine/core";
import axios from "axios";
import { AlertCircle, ArrowRight, FolderPlus, Pencil, Tags, Trash2, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface Category {
  id: number;
  name: string;
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || "No se pudo completar la operación.";
  return "Ocurrió un error inesperado.";
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Category | "new" | null>(null);
  const [name, setName] = useState("");
  const [deleting, setDeleting] = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("categories");
      setCategories(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (err) {
      setError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const open = (category?: Category) => {
    setEditor(category || "new");
    setName(category?.name || "");
    setError("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return setError("Escribe un nombre para la categoría.");
    if (categories.some((category) =>
      category.name.toLowerCase() === value.toLowerCase() &&
      (editor === "new" || category.id !== editor?.id)
    )) return setError("Ya existe una categoría con ese nombre.");

    setBusy(true);
    setError("");
    try {
      if (editor === "new") await api.post("categories", { name: value });
      else if (editor) await api.put("categories/" + editor.id, { name: value });
      toast.success(editor === "new" ? "Categoría creada." : "Categoría actualizada.");
      setEditor(null);
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      await api.delete("categories/" + deleting.id);
      toast.success("Categoría eliminada.");
      setDeleting(null);
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack gap="xl" maw={1200} mx="auto">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Box>
          <Text size="xs" fw={800} c="red.7" tt="uppercase" lts={2}>Catálogo / Configuración</Text>
          <Title order={1} mt={6} fw={850}>Categorías</Title>
          <Text c="dimmed" mt={6} size="sm">Organiza los platos y bebidas disponibles en Restaurant Central.</Text>
        </Box>
        <Button size="md" leftSection={<FolderPlus size={18}/>} onClick={() => open()}>Nueva categoría</Button>
      </Group>

      {error && <Alert color="red" icon={<AlertCircle size={18}/>} title="No se pudo completar la operación" withCloseButton onClose={() => setError("")}>{error}</Alert>}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Paper withBorder p="xl" shadow="xs">
          <ThemeIcon size={48} radius="md" variant="light" color="red"><Tags size={23}/></ThemeIcon>
          <Text c="dimmed" size="sm" mt="lg">Categorías registradas</Text>
          <Title mt={4} order={2}>{loading ? "…" : categories.length}</Title>
          <Text c="dimmed" size="xs" mt="sm">Datos obtenidos desde PostgreSQL</Text>
        </Paper>
        <Paper p="xl" bg="red.8" radius="lg" style={{ gridColumn: "span 2" }}>
          <Group gap="xs"><UtensilsCrossed size={19} color="white"/><Text c="white" size="sm" fw={700}>Configuración del menú</Text></Group>
          <Title mt="lg" order={3} c="white">Primero las categorías. Después los platos.</Title>
          <Text c="white" mt="xs" size="sm">Por ejemplo: Platos principales, Entradas, Bebidas y Postres. Cada producto requiere una categoría.</Text>
          <Button mt="lg" variant="white" color="red" component={Link} to="/admin/products" rightSection={<ArrowRight size={16}/>}>Ir a productos</Button>
        </Paper>
      </SimpleGrid>

      <Paper withBorder shadow="xs">
        <Group justify="space-between" px="lg" py="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Box><Title order={3} size="lg">Listado de categorías</Title><Text c="dimmed" size="xs" mt={3}>Crea, edita o elimina las categorías del restaurante.</Text></Box>
          <Badge color="red" variant="light" radius="lg">{categories.length} en total</Badge>
        </Group>
        {loading ? (
          <Center p={70}><Loader color="red"/></Center>
        ) : categories.length === 0 ? (
          <Stack align="center" gap="sm" py={65} px="md">
            <ThemeIcon radius="lg" size={72} variant="light" color="red"><Tags size={31}/></ThemeIcon>
            <Title order={3}>Aún no hay categorías</Title>
            <Text ta="center" c="dimmed" size="sm" maw={400}>Crea la primera para habilitar el registro de productos.</Text>
            <Button mt="sm" leftSection={<FolderPlus size={17}/>} onClick={() => open()}>Crear primera categoría</Button>
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={520}>
            <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Categoría</Table.Th><Table.Th>Identificador</Table.Th><Table.Th style={{ textAlign: "right" }}>Acciones</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{categories.map((category) =>
                <Table.Tr key={category.id}>
                  <Table.Td><Group gap="sm"><ThemeIcon variant="light" color="red" size="lg"><Tags size={17}/></ThemeIcon><Text fw={650}>{category.name}</Text></Group></Table.Td>
                  <Table.Td><Text size="sm" c="dimmed">#{category.id}</Text></Table.Td>
                  <Table.Td><Group gap="xs" justify="flex-end">
                    <ActionIcon aria-label={`Editar ${category.name}`} color="gray" variant="subtle" size="lg" onClick={() => open(category)}><Pencil size={18}/></ActionIcon>
                    <ActionIcon aria-label={`Eliminar ${category.name}`} color="red" variant="light" size="lg" onClick={() => setDeleting(category)}><Trash2 size={18}/></ActionIcon>
                  </Group></Table.Td>
                </Table.Tr>
              )}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal opened={editor !== null} onClose={() => { if (!busy) {setEditor(null); setError("");} }} title={editor === "new" ? "Nueva categoría" : "Editar categoría"} centered>
        <form onSubmit={(event) => void save(event)}>
          <Stack gap="md">
            <TextInput data-autofocus label="Nombre de la categoría" placeholder="Ej. Platos principales" required maxLength={100} value={name} onChange={(event) => setName(event.currentTarget.value)}/>
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end"><Button variant="default" disabled={busy} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" loading={busy}>Guardar</Button></Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleting !== null} onClose={() => {if (!busy) setDeleting(null);}} title="Confirmar eliminación" centered>
        <Stack>
          <Text size="sm">¿Eliminar <strong>{deleting?.name}</strong>? Si tiene productos asociados, el servidor podría impedir la eliminación.</Text>
          <Group justify="flex-end"><Button variant="default" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button><Button color="red" loading={busy} onClick={() => void remove()} leftSection={<Trash2 size={16}/>}>Eliminar categoría</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
