import { api } from "@/core/api/api";
import { ActionIcon, Alert, Badge, Box, Button, Center, Checkbox, Divider, Group, Loader, Modal, NumberInput, Paper, ScrollArea, Select, SimpleGrid, Stack, Table, Text, Textarea, TextInput, ThemeIcon, Title, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import axios from "axios";
import { AlertCircle, CheckCircle2, CircleOff, Clock3, ImageOff, Pencil, Plus, Search, Tags, Trash2, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  categoryId: number;
  categoryName?: string;
  preparationTimeMinutes: number;
  active: boolean;
  isCombo?: boolean;
}

interface Category { id: number; name: string }

interface ProductForm {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  categoryId: number;
  preparationTimeMinutes: number;
  active: boolean;
}

const blankProduct = (): ProductForm => ({
  name: "", description: "", price: 0, imageUrl: "",
  categoryId: 0, preparationTimeMinutes: 15, active: true,
});

const money = (n: number) => "S/ " + Number(n || 0).toFixed(2);

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string> }>(error)) {
    const errors = error.response?.data?.errors;
    if (errors && !Array.isArray(errors)) return Object.values(errors).join(" · ");
    return error.response?.data?.message || "El servidor rechazó la operación.";
  }
  return "Ocurrió un error inesperado.";
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 180);
  const [status, setStatus] = useState("all");
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(blankProduct());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        api.get("products/all"),
        api.get("categories"),
      ]);
      setProducts(Array.isArray(productsResponse.data?.data) ? productsResponse.data.data : []);
      setCategories(Array.isArray(categoriesResponse.data?.data) ? categoriesResponse.data.data : []);
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => products.filter((product) => {
    if (status === "active" && !product.active) return false;
    if (status === "inactive" && product.active) return false;
    const category = product.categoryName || categories.find((cat) => cat.id === product.categoryId)?.name || "";
    return [product.name, product.description, category].join(" ").toLowerCase().includes(debouncedSearch.trim().toLowerCase());
  }), [products, categories, status, debouncedSearch]);

  const openNew = () => {
    setForm({ ...blankProduct(), categoryId: categories[0]?.id ?? 0 });
    setError("");
    setEditingId("new");
  };

  const openEdit = (product: Product) => {
    if (product.isCombo) {
      const message = "Los combos se editan desde un formulario específico. Se bloquea esta edición para conservar sus relaciones.";
      setError(message);
      toast.info(message);
      return;
    }
    setForm({
      name: product.name,
      description: product.description || "",
      price: Number(product.price),
      imageUrl: product.imageUrl || "",
      categoryId: product.categoryId,
      preparationTimeMinutes: product.preparationTimeMinutes || 15,
      active: product.active,
    });
    setError("");
    setEditingId(product.id);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim() || !form.description.trim()) return setError("Nombre y descripción son obligatorios.");
    if (!categories.some((item) => item.id === Number(form.categoryId))) return setError("Selecciona una categoría.");
    if (!Number.isFinite(form.price) || form.price < 0) return setError("Introduce un precio válido.");
    if (!Number.isInteger(form.preparationTimeMinutes) || form.preparationTimeMinutes < 1) return setError("La preparación debe durar al menos un minuto.");
    if (form.imageUrl && !/^https?:\/\//i.test(form.imageUrl)) return setError("La imagen debe tener una URL http o https.");

    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: form.price,
        categoryId: form.categoryId,
        imageUrl: form.imageUrl.trim() || null,
        preparationTimeMinutes: form.preparationTimeMinutes,
        active: form.active,
        isCombo: false,
        // Los arrays se omiten al editar para preservar ingredientes y extras actuales.
        ...(editingId === "new" ? { ingredients: [], comboItems: [], extras: [] } : {}),
      };
      if (editingId === "new") {
        await api.post("products", payload);
        toast.success("Producto registrado.");
      } else if (typeof editingId === "number") {
        await api.put("products/" + editingId, payload);
        toast.success("Producto actualizado.");
      }
      setEditingId(null);
      setNotice("El catálogo se actualizó correctamente.");
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (product: Product) => {
    setError("");
    try {
      await api.patch("products/" + product.id + "/toggle-active");
      toast.success(product.active ? "Producto ocultado del menú." : "Producto publicado.");
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setSaving(true);
    setError("");
    try {
      await api.delete("products/" + deleting.id);
      toast.success("Producto eliminado.");
      setDeleting(null);
      await load();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack maw={1450} mx="auto" gap="xl">
      <Group justify="space-between" align="flex-end" wrap="wrap">
        <Box>
          <Text c="red.7" fw={800} size="xs" lts={2} tt="uppercase">Catálogo / Restaurant Central</Text>
          <Title order={1} fw={850} mt={6}>Gestión del menú</Title>
          <Text size="sm" c="dimmed" mt={6}>Administra productos, precios y disponibilidad desde el panel.</Text>
        </Box>
        <Group gap="sm">
          <Button variant="default" component={Link} to="/admin/categories" leftSection={<Tags size={17}/>}>Categorías</Button>
          <Button leftSection={<Plus size={18}/>} disabled={!categories.length} title={!categories.length ? "Primero crea una categoría" : "Crear producto"} onClick={openNew}>Nuevo plato</Button>
        </Group>
      </Group>

      {error && <Alert color="red" title="Atención" icon={<AlertCircle size={19}/>} withCloseButton onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert color="green" title="Catálogo actualizado" withCloseButton onClose={() => setNotice("")}>{notice}</Alert>}

      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        {[
          { title: "Productos registrados", value: products.length, icon: UtensilsCrossed },
          { title: "Platos publicados", value: products.filter((product) => product.active).length, icon: CheckCircle2 },
          { title: "Categorías", value: categories.length, icon: Tags },
        ].map((item) => (
          <Paper withBorder shadow="xs" p="lg" key={item.title}>
            <Group gap="md">
              <ThemeIcon variant="light" color="red" size={47} radius="md"><item.icon size={22}/></ThemeIcon>
              <Box><Text size="xs" c="dimmed" fw={600}>{item.title}</Text><Title order={2} mt={4}>{loading ? "…" : item.value}</Title></Box>
            </Group>
          </Paper>
        ))}
      </SimpleGrid>

      {categories.length === 0 && !loading && (
        <Alert color="yellow" title="Falta configurar el menú" icon={<AlertCircle size={18}/>}>
          Crea al menos una categoría antes de registrar productos.
          <Button ml="sm" size="xs" variant="light" color="orange" component={Link} to="/admin/categories">Crear categorías</Button>
        </Alert>
      )}

      <Paper withBorder shadow="xs">
        <Group p="lg" justify="space-between" align="end" wrap="wrap">
          <Box><Title order={3} size="lg">Todos los platos</Title><Text size="xs" c="dimmed" mt={5}>{filtered.length} resultado(s)</Text></Box>
          <Group gap="sm" align="end">
            <TextInput leftSection={<Search size={17}/>} placeholder="Buscar productos…" aria-label="Buscar productos" value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
            <Select aria-label="Filtrar por estado" value={status} onChange={(value) => setStatus(value || "all")} w={135} data={[{ value: "all", label: "Todos" }, { value: "active", label: "Activos" }, { value: "inactive", label: "Inactivos" }]}/>
          </Group>
        </Group>
        <Divider/>
        {loading ? <Center p={70}><Loader color="red"/></Center> : filtered.length === 0 ? (
          <Stack align="center" gap="sm" p={65}>
            <ThemeIcon size={70} radius="lg" variant="light" color="red"><UtensilsCrossed size={30}/></ThemeIcon>
            <Title order={3}>{products.length ? "No se encontraron platos" : "Todavía no hay productos"}</Title>
            <Text c="dimmed" size="sm" ta="center">{products.length ? "Prueba otra búsqueda." : "Crea categorías y registra platos para publicarlos en la web."}</Text>
            {!products.length && categories.length > 0 && <Button onClick={openNew} mt="sm" leftSection={<Plus size={17}/>}>Agregar primer plato</Button>}
          </Stack>
        ) : (
          <Table.ScrollContainer minWidth={830}>
            <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="lg">
              <Table.Thead><Table.Tr><Table.Th>Producto</Table.Th><Table.Th>Categoría</Table.Th><Table.Th>Precio</Table.Th><Table.Th>Preparación</Table.Th><Table.Th>Estado</Table.Th><Table.Th ta="right">Acciones</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>{filtered.map((product) => (
                <Table.Tr key={product.id}>
                  <Table.Td><Group gap="sm" wrap="nowrap">
                    {product.imageUrl ? <img src={product.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 10 }}/> : <ThemeIcon color="gray" variant="light" radius="md" size={48}><ImageOff size={20}/></ThemeIcon>}
                    <Box maw={230}><Text size="sm" fw={700}>{product.name}</Text><Text size="xs" c="dimmed" truncate>{product.description}</Text></Box>
                  </Group></Table.Td>
                  <Table.Td><Text size="sm">{product.categoryName || categories.find((c) => c.id === product.categoryId)?.name || "—"}</Text></Table.Td>
                  <Table.Td><Text fw={700} size="sm" style={{whiteSpace:"nowrap"}}>{money(product.price)}</Text></Table.Td>
                  <Table.Td><Group gap={4} wrap="nowrap"><Clock3 size={15}/><Text size="sm">{product.preparationTimeMinutes} min</Text></Group></Table.Td>
                  <Table.Td><Badge color={product.active ? "green" : "gray"} variant="light">{product.active ? "Publicado" : "Oculto"}</Badge></Table.Td>
                  <Table.Td><Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" size="lg" aria-label={`Editar ${product.name}`} onClick={() => openEdit(product)}><Pencil size={17}/></ActionIcon></Tooltip>
                    <Tooltip label={product.active ? "Ocultar" : "Publicar"}><ActionIcon variant="subtle" color="orange" size="lg" aria-label={(product.active ? "Ocultar " : "Publicar ") + product.name} onClick={() => void toggle(product)}>{product.active ? <CircleOff size={17}/> : <CheckCircle2 size={17}/>}</ActionIcon></Tooltip>
                    <Tooltip label="Eliminar"><ActionIcon variant="subtle" color="red" size="lg" aria-label={`Eliminar ${product.name}`} onClick={() => setDeleting(product)}><Trash2 size={17}/></ActionIcon></Tooltip>
                  </Group></Table.Td>
                </Table.Tr>
              ))}</Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Paper>

      <Modal opened={editingId !== null} onClose={() => { if (!saving) {setEditingId(null); setError("");} }} title={editingId === "new" ? "Nuevo plato" : "Editar plato"} size="lg" centered>
        <form onSubmit={(event) => void save(event)}>
          <Stack gap="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput data-autofocus required label="Nombre del plato" placeholder="Ej. Lomo saltado" maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.currentTarget.value })}/>
              <Select required label="Categoría" placeholder="Seleccionar" data={categories.map((c) => ({ value: String(c.id), label: c.name }))} value={form.categoryId ? String(form.categoryId) : null} onChange={(value) => setForm({ ...form, categoryId: Number(value) })}/>
              <NumberInput label="Precio (S/)" required min={0} decimalScale={2} fixedDecimalScale value={form.price} onChange={(value) => setForm({ ...form, price: Number(value) })}/>
              <NumberInput label="Preparación (min)" required min={1} allowDecimal={false} value={form.preparationTimeMinutes} onChange={(value) => setForm({ ...form, preparationTimeMinutes: Number(value) })}/>
            </SimpleGrid>
            <Textarea label="Descripción" required minRows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.currentTarget.value })}/>
            <TextInput label="URL de imagen (opcional)" type="url" placeholder="https://..." value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.currentTarget.value })}/>
            <Checkbox color="red" label="Publicar inmediatamente en el menú" checked={form.active} onChange={(event) => setForm({ ...form, active: event.currentTarget.checked })}/>
            {error && <Alert color="red">{error}</Alert>}
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={() => setEditingId(null)} disabled={saving}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editingId === "new" ? "Crear producto" : "Guardar cambios"}</Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      <Modal opened={deleting !== null} onClose={() => { if (!saving) setDeleting(null); }} title="Confirmar eliminación" centered>
        <Stack>
          <Text size="sm">¿Eliminar <strong>{deleting?.name}</strong>? Si existen pedidos asociados, el servidor podría impedir esta operación.</Text>
          <Group justify="flex-end"><Button variant="default" onClick={() => setDeleting(null)} disabled={saving}>Cancelar</Button><Button color="red" loading={saving} leftSection={<Trash2 size={17}/>} onClick={() => void remove()}>Eliminar producto</Button></Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
