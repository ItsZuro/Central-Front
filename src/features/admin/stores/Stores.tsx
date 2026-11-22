import LocationPicker from "@/components/Maps/LocationPicker";
import { api } from "@/core/api/api";
import type { ApiResponse } from "@/core/types/base/api-response";
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  Modal,
  NumberInput,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, MapPin, RefreshCw, Save, Store, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

type Branch = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  openTime: string;
  closeTime: string;
  latitude: number | null;
  longitude: number | null;
};

type StoreDraft = Omit<Branch, "id">;

const emptyDraft: StoreDraft = {
  name: "",
  address: "",
  phone: "",
  openTime: "09:00",
  closeTime: "22:00",
  latitude: null,
  longitude: null,
};

const formatTime = (value: string | null | undefined) => (value || "09:00").slice(0, 5);
const toDraft = (branch: Branch): StoreDraft => ({
  name: branch.name,
  address: branch.address,
  phone: branch.phone ?? "",
  openTime: formatTime(branch.openTime),
  closeTime: formatTime(branch.closeTime),
  latitude: branch.latitude,
  longitude: branch.longitude,
});

const validCoordinate = (value: number | null, minimum: number, maximum: number) =>
  value !== null && Number.isFinite(value) && value >= minimum && value <= maximum;

export default function Stores() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState<number | null>(null);
  const [draft, setDraft] = useState<StoreDraft>(emptyDraft);
  const [editingNew, setEditingNew] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const storesQuery = useQuery({
    queryKey: ["restaurant", "stores"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Branch[]>>("/stores");
      if (!response.data.success || !Array.isArray(response.data.data)) {
        throw new Error("No se pudieron consultar las sucursales");
      }
      return response.data.data;
    },
  });

  useEffect(() => {
    if (storesQuery.data?.length && branchId == null && !editingNew) {
      const selected = [...storesQuery.data].sort((a, b) => a.id - b.id)[0];
      setBranchId(selected.id);
      setDraft(toDraft(selected));
    }
  }, [storesQuery.data, branchId, editingNew]);

  const branches = storesQuery.data || [];
  const selectedBranch = branches.find((branch) => branch.id === branchId);
  const coordsComplete = validCoordinate(draft.latitude, -90, 90)
    && validCoordinate(draft.longitude, -180, 180);
  const hasNoCoords = draft.latitude === null && draft.longitude === null;

  const save = async () => {
    if (!draft.name.trim() || !draft.address.trim() || !draft.openTime || !draft.closeTime) {
      toast.error("Completa el nombre, la dirección y los horarios de la sucursal.");
      return;
    }
    if (!coordsComplete && !hasNoCoords) {
      toast.error("Ingresa ambas coordenadas válidas o deja ambas vacías.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        address: draft.address.trim(),
        phone: draft.phone?.trim() || null,
        openTime: draft.openTime,
        closeTime: draft.closeTime,
      };
      const response = editingNew
        ? await api.post<ApiResponse<Branch>>("/stores", payload)
        : await api.put<ApiResponse<Branch>>("/stores/" + branchId, payload);
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "No se pudo guardar la sucursal");
      }
      setBranchId(response.data.data.id);
      setDraft(toDraft(response.data.data));
      setEditingNew(false);
      await queryClient.invalidateQueries({ queryKey: ["restaurant", "stores"] });
      await queryClient.invalidateQueries({ queryKey: ["checkout-config"] });
      toast.success("Sucursal actualizada correctamente.");
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : error instanceof Error ? error.message : null;
      toast.error(message || "No se pudo guardar la sucursal.");
    } finally {
      setSaving(false);
    }
  };

  if (storesQuery.isPending) {
    return <Group><Loader color="red"/><Text>Cargando sucursales...</Text></Group>;
  }

  return (
    <Stack maw={1120} mx="auto" gap="xl">
      <Group justify="space-between" align="end">
        <Box>
          <Text c="red.7" size="xs" fw={800} tt="uppercase" lts={1.5}>Central / Configuración</Text>
          <Title order={1} mt="xs">Sucursales y delivery</Title>
          <Text c="dimmed" size="sm" mt="xs">
            Configura la ubicación desde la que se calculan las rutas de reparto.
          </Text>
        </Box>
        <Button variant="default" leftSection={<RefreshCw size={17}/>} onClick={() => void storesQuery.refetch()}>
          Actualizar
        </Button>
      </Group>

      {storesQuery.isError && (
        <Alert color="red" title="No se pudieron consultar las sucursales">
          Comprueba tu conexión y vuelve a intentarlo.
        </Alert>
      )}

      <Paper withBorder radius="lg" p={{ base: "lg", sm: "xl" }} shadow="xs">
        <Group justify="space-between" align="center" mb="lg">
          <Group gap="sm">
            <Store size={23} color="#c92a2a" />
            <Title order={3} size="lg">Datos del restaurante</Title>
          </Group>
          {coordsComplete
            ? <Badge color="green" variant="light" leftSection={<CheckCircle2 size={13}/>}>Ubicación lista</Badge>
            : <Badge color="orange" variant="light" leftSection={<AlertTriangle size={13}/>}>Sin ubicación de reparto</Badge>}
        </Group>

        <Group gap="sm" mb="lg" align="end">
          <Select
            label="Sucursal"
            placeholder={branches.length ? "Selecciona la sucursal" : "Sin sucursales"}
            data={branches.map((branch) => ({ value: String(branch.id), label: branch.name }))}
            value={editingNew ? null : branchId != null ? String(branchId) : null}
            onChange={(value) => {
              if (!value) return;
              const branch = branches.find((item) => item.id === Number(value));
              if (!branch) return;
              setBranchId(branch.id);
              setDraft(toDraft(branch));
              setEditingNew(false);
            }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Button variant="light" color="red" onClick={() => {
            setEditingNew(true);
            setBranchId(null);
            setDraft(emptyDraft);
          }}>Nueva sucursal</Button>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TextInput
            label="Nombre de la sucursal"
            required
            value={draft.name}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setDraft((old) => ({ ...old, name: nextValue }));
            }}
          />
          <TextInput
            label="Teléfono"
            value={draft.phone || ""}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setDraft((old) => ({ ...old, phone: nextValue }));
            }}
          />
          <TextInput
            label="Dirección del local"
            required
            value={draft.address}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setDraft((old) => ({ ...old, address: nextValue }));
            }}
          />
          <Group grow>
            <TextInput
              type="time"
              label="Apertura"
              required
              value={draft.openTime}
              onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setDraft((old) => ({ ...old, openTime: nextValue }));
            }}
            />
            <TextInput
              type="time"
              label="Cierre"
              required
              value={draft.closeTime}
              onChange={(event) => {
              const nextValue = event.currentTarget.value;
              setDraft((old) => ({ ...old, closeTime: nextValue }));
            }}
            />
          </Group>
        </SimpleGrid>
        <Alert mt="lg" color="blue" variant="light" title="Ubicación para reparto" icon={<MapPin size={18}/>}>
          Elige el origen del reparto. Para la simulación académica puedes usar la referencia
          de Central Restaurante en Barranco, Lima; nuestro sistema no está afiliado al local.
          Confirma el pin sobre el mapa antes de guardar.
        </Alert>
        <Group justify="flex-end" mt="sm">
          <Button
            type="button"
            variant="subtle"
            color="red"
            size="sm"
            onClick={() => {
              setDraft((old) => ({
                ...old,
                name: "Restaurant Central - Barranco",
                address: "Av. Pedro de Osma 301, Barranco, Lima, Perú",
                latitude: -12.1526483,
                longitude: -77.0224579,
              }));
              toast.info("Referencia de Barranco cargada. Verifica la ubicación antes de guardar.");
            }}
          >
            Usar referencia de Lima
          </Button>
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="lg">
          <NumberInput
            label="Latitud"
            decimalScale={7}
            hideControls
            value={draft.latitude ?? ""}
            onChange={(value) => setDraft((old) => ({ ...old, latitude: typeof value === "number" ? value : null }))}
            placeholder="Selecciona en el mapa"
            min={-90}
            max={90}
          />
          <NumberInput
            label="Longitud"
            decimalScale={7}
            hideControls
            value={draft.longitude ?? ""}
            onChange={(value) => setDraft((old) => ({ ...old, longitude: typeof value === "number" ? value : null }))}
            placeholder="Selecciona en el mapa"
            min={-180}
            max={180}
          />
        </SimpleGrid>
        <Group mt="lg" justify="space-between" gap="md">
          <Button
            variant="light"
            color="red"
            leftSection={<MapPin size={17}/>}
            onClick={() => setMapOpen(true)}
          >Seleccionar en mapa</Button>
          <Group gap="sm">
            {editingNew && <Button variant="default" onClick={() => {
              const original = branches[0];
              setEditingNew(false);
              setBranchId(original?.id ?? null);
              setDraft(original ? toDraft(original) : emptyDraft);
            }}>Cancelar</Button>}
            <Button color="red" leftSection={<Save size={17}/>} loading={saving} onClick={() => void save()}
              disabled={!editingNew && !selectedBranch}>Guardar sucursal</Button>
          </Group>
        </Group>
      </Paper>

      <Paper withBorder p="lg" radius="lg">
        <Text fw={800}>Antes de habilitar el reparto</Text>
        <Text c="dimmed" size="sm" mt="xs">
          La sucursal necesita sus coordenadas guardadas, Google Maps Distance Matrix habilitado
          en el servidor y una cobertura configurada. El sistema verifica la ruta antes de aceptar cada pedido.
        </Text>
      </Paper>

      <Modal
        opened={mapOpen}
        onClose={() => setMapOpen(false)}
        title="Marca la ubicación del restaurante"
        centered
        size="lg"
      >
        <LocationPicker
          initialLat={draft.latitude ?? undefined}
          initialLng={draft.longitude ?? undefined}
          preferGeolocation={false}
          onLocationSelect={(_address, lat, lng) => setDraft((old) => ({ ...old, latitude: lat, longitude: lng }))}
        />
        <Button fullWidth mt="md" onClick={() => setMapOpen(false)} leftSection={<CheckCircle2 size={16}/>}>
          Usar esta ubicación
        </Button>
      </Modal>
    </Stack>
  );
}
