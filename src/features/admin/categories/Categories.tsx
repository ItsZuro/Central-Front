import { api } from "@/core/api/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon, Alert, Badge, Box, Button, Center, FileInput, Group, Image,
  Loader, Modal, Paper, SimpleGrid, Stack, Table, Text, Textarea,
  TextInput, ThemeIcon, Title,
} from "@mantine/core";
import axios from "axios";
import {
  AlertCircle, ArrowRight, FolderPlus, ImagePlus, Images, Pencil, Tags,
  Trash2, UtensilsCrossed, X,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface Category {
  id: number;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}
interface FileUploadResponse {
  success: boolean;
  message: string;
  data?: { id: number; fileUrl: string };
}
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "No se pudo completar la operación.";
  }
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}

export default function Categories() {
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Category | "new" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setPreviewUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

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

  const closeEditor = () => {
    if (busy) return;
    setEditor(null);
    setName("");
    setDescription("");
    setImageUrl("");
    setFile(null);
    setError("");
  };

  const open = (category?: Category) => {
    setEditor(category || "new");
    setName(category?.name || "");
    setDescription(category?.description || "");
    setImageUrl(category?.imageUrl || "");
    setFile(null);
    setError("");
  };

  const selectImage = (next: File | null) => {
    if (next && (!imageTypes.has(next.type) || next.size > 5 * 1024 * 1024)) {
      setError("Selecciona una imagen JPG, PNG o WEBP de máximo 5 MB.");
      setFile(null);
      return;
    }
    setFile(next);
    setError("");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return setError("Escribe un nombre para la categoría.");
    if (description.trim().length > 650) return setError("Máximo 650 caracteres en la descripción.");
    if (imageUrl.trim() && !/^https?:\/\//i.test(imageUrl.trim())) {
      return setError("Utiliza una URL que empiece con https:// o http://.");
    }
    if (categories.some((category) =>
      category.name.toLowerCase() === value.toLowerCase() &&
      (editor === "new" || category.id !== editor?.id)
    )) return setError("Ya existe una categoría con ese nombre.");

    setBusy(true);
    setError("");
    let newFileId: number | null = null;
    try {
      let uploadedUrl = imageUrl.trim() || null;
      if (file) {
        const body = new FormData();
        body.append("file", file);
        body.append("folder", "categories");
        const result = await api.post<FileUploadResponse>("files/upload", body, {
          headers: { "Content-Type": undefined },
          timeout: 45000,
        });
        if (!result.data.success || !result.data.data?.fileUrl) {
          throw new Error(result.data.message || "No se pudo subir la imagen.");
        }
        newFileId = result.data.data.id;
        uploadedUrl = result.data.data.fileUrl;
      }
      const payload = {
        name: value,
        description: description.trim() || null,
        imageUrl: uploadedUrl,
      };
      if (editor === "new") await api.post("categories", payload);
      else if (editor) await api.put("categories/" + editor.id, payload);
      // La imagen ya está asociada a una categoría; nunca eliminarla por error.
      newFileId = null;
      toast.success(editor === "new" ? "Categoría creada." : "Categoría actualizada.");
      setEditor(null);
      setFile(null);
      await Promise.all([load(), queryClient.invalidateQueries({ queryKey: ["categories"] })]);
    } catch (err) {
      // Evita un archivo huérfano si la categoría no se pudo guardar.
      if (newFileId !== null) {
        try { await api.delete("files/delete/" + newFileId); } catch { /* limpieza opcional */ }
      }
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
      await Promise.all([load(), queryClient.invalidateQueries({ queryKey: ["categories"] })]);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const currentImage = previewUrl || imageUrl;

  return (
    <Stack gap="xl" maw={1200} mx="auto">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Box>
          <Text size="xs" fw={800} c="red.7" tt="uppercase" lts={2}>Catálogo / Configuración</Text>
          <Title order={1} mt={6} fw={850}>Categorías</Title>
          <Text c="dimmed" mt={6} size="sm">Organiza los platos y bebidas con una imagen y descripción propias.</Text>
        </Box>
        <Button size="md" leftSection={<FolderPlus size={18}/>} onClick={() => open()}>
          Nueva categoría
        </Button>
      </Group>

      {error && !editor && <Alert color="red" icon={<AlertCircle size={18}/>} title="No se pudo completar la operación" withCloseButton onClose={() => setError("")}>{error}</Alert>}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
        <Paper withBorder p="xl" shadow="xs" radius="lg">
          <ThemeIcon size={48} radius="md" variant="light" color="red"><Tags size={23}/></ThemeIcon>
          <Text c="dimmed" size="sm" mt="lg">Categorías registradas</Text>
          <Title mt={4} order={2}>{loading ? "…" : categories.length}</Title>
          <Text c="dimmed" size="xs" mt="sm">
            {categories.filter((category) => Boolean(category.imageUrl)).length} con imagen personalizada
          </Text>
        </Paper>
        <Paper p="xl" bg="red.8" radius="lg" style={{ gridColumn: "span 2" }}>
          <Group gap="xs"><UtensilsCrossed size={19} color="white"/><Text c="white" size="sm" fw={700}>Configuración del menú</Text></Group>
          <Title mt="lg" order={3} c="white">Primero las categorías. Después los platos.</Title>
          <Text c="white" mt="xs" size="sm">Describe cada sección de la carta y agrega una imagen para que los clientes la reconozcan.</Text>
          <Button mt="lg" variant="white" color="red" component={Link} to="/admin/products" rightSection={<ArrowRight size={16}/>}>Ir a productos</Button>
        </Paper>
      </SimpleGrid>

      <Paper withBorder shadow="xs" radius="lg" style={{ overflow: "hidden" }}>
        <Group justify="space-between" px="lg" py="md" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Box>
            <Title order={3} size="lg">Listado de categorías</Title>
            <Text c="dimmed" size="xs" mt={3}>Crea, edita y personaliza las categorías del restaurante.</Text>
          </Box>
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
          <Table.ScrollContainer minWidth={550}>
            <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Categoría</Table.Th>
                  <Table.Th>Descripción</Table.Th>
                  <Table.Th ta="right">Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{categories.map((category) =>
                <Table.Tr key={category.id}>
                  <Table.Td>
                    <Group gap="sm" wrap="nowrap">
                      {category.imageUrl ? (
                        <Image src={category.imageUrl} fit="cover" h={54} w={62} radius="md" alt={category.name}
                          fallbackSrc="/images/inicio/home-causa.png"/>
                      ) : (
                        <ThemeIcon variant="light" color="red" size={52} radius="md">
                          <Images size={20}/>
                        </ThemeIcon>
                      )}
                      <Box>
                        <Text fw={750} size="sm">{category.name}</Text>
                        <Text c="dimmed" size="xs">#{category.id}</Text>
                      </Box>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={category.description ? "dark" : "dimmed"} lineClamp={2}>
                      {category.description || "Sin descripción"}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="flex-end" wrap="nowrap">
                      <ActionIcon aria-label={`Editar ${category.name}`} color="gray" variant="subtle" size="lg" onClick={() => open(category)}><Pencil size={18}/></ActionIcon>
                      <ActionIcon aria-label={`Eliminar ${category.name}`} color="red" variant="light" size="lg" onClick={() => setDeleting(category)}><Trash2 size={18}/></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal opened={editor !== null} onClose={closeEditor} title={editor === "new" ? "Nueva categoría" : "Editar categoría"}
        size="lg" radius="lg" centered closeOnClickOutside={!busy} closeOnEscape={!busy}>
        <form onSubmit={(event) => void save(event)}>
          <Stack gap="md">
            <TextInput data-autofocus label="Nombre de la categoría" placeholder="Ej. Platos principales" required
              maxLength={100} value={name} onChange={(event) => setName(event.currentTarget.value)}/>
            <Textarea label="Descripción (opcional)" placeholder="Ej. Bebidas frescas y jugos preparados al momento..."
              minRows={3} maxLength={650} value={description}
              description={`${description.length}/650 caracteres`}
              onChange={(event) => setDescription(event.currentTarget.value)}/>

            <Paper withBorder p="md" radius="lg" bg="#fcfaf9">
              <Group gap="xs" mb="sm">
                <ImagePlus size={20} color="#d63446"/>
                <Text size="sm" fw={800}>Imagen de la categoría</Text>
                <Badge color="red" size="xs" variant="light">Amazon S3</Badge>
              </Group>
              <FileInput
                label="Subir desde el equipo (opcional)"
                placeholder="Seleccionar imagen..."
                description="JPG, PNG o WEBP. Máximo 5 MB."
                accept="image/jpeg,image/png,image/webp"
                leftSection={<ImagePlus size={17}/>}
                value={file}
                onChange={selectImage}
                clearable
              />
              {currentImage && (
                <Group mt="sm" gap="md" wrap="nowrap">
                  <Image
                    src={currentImage}
                    alt="Vista previa de la categoría"
                    fit="cover"
                    h={108}
                    w={138}
                    radius="md"
                    fallbackSrc="/images/inicio/home-causa.png"
                  />
                  <Box>
                    <Text size="xs" c="dimmed">
                      {file ? "Vista previa del archivo que subirás" : "Imagen actual"}
                    </Text>
                    <Button size="compact-sm" mt="sm" color="red" variant="subtle"
                      leftSection={<X size={15}/>}
                      onClick={() => { setFile(null); setImageUrl(""); }}>
                      Quitar imagen
                    </Button>
                  </Box>
                </Group>
              )}
              <TextInput mt="md" label="O utilizar una URL externa (opcional)" type="url"
                placeholder="https://..." value={imageUrl} disabled={Boolean(file)}
                onChange={(event) => setImageUrl(event.currentTarget.value)}/>
            </Paper>

            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end">
              <Button variant="default" disabled={busy} onClick={closeEditor}>Cancelar</Button>
              <Button type="submit" loading={busy}>Guardar categoría</Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      <Modal opened={deleting !== null} onClose={() => {if (!busy) setDeleting(null);}} title="Confirmar eliminación" centered>
        <Stack>
          <Text size="sm">¿Eliminar <strong>{deleting?.name}</strong>? Si tiene productos asociados, el servidor puede impedir la eliminación.</Text>
          <Group justify="flex-end">
            <Button variant="default" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button color="red" loading={busy} onClick={() => void remove()} leftSection={<Trash2 size={16}/>}>
              Eliminar categoría
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
