import { Alert, Box, Button, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { useJsApiLoader } from "@react-google-maps/api";
import { CheckCircle2, LocateFixed, Map, MapPin, Search, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import StoreMapPreview from "./StoreMapPreview";
import styles from "../Checkout.module.css";

export type LocatedAddress = {
  address: string;
  lat: number;
  lng: number;
};

interface DeliveryFormProps {
  pickupMode?: boolean;
  address: string;
  coordinates: { lat: number; lng: number } | null;
  references: string;
  phone: string;
  docType: string;
  docNumber: string;
  onOpenMap: (candidate?: LocatedAddress) => void;
  onAddressChange: (value: string) => void;
  onSelectLocation: (address: string, lat: number, lng: number) => void;
  setReferences: (value: string) => void;
  setPhone: (value: string) => void;
  setDocType: (value: string) => void;
  setDocNumber: (value: string) => void;
}

const fieldClasses = { input: styles.input, label: styles.inputLabel };

function DeliveryAddressSection({
  address,
  coordinates,
  references,
  onOpenMap,
  onAddressChange,
  onSelectLocation,
  setReferences,
}: Pick<DeliveryFormProps,
  "address" | "coordinates" | "references" | "onOpenMap" | "onAddressChange" | "onSelectLocation" | "setReferences"
>) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });
  const [candidate, setCandidate] = useState<LocatedAddress | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const requestSequence = useRef(0);

  const changeAddress = (value: string) => {
    requestSequence.current += 1;
    setSearching(false);
    setCandidate(null);
    setSearchError("");
    onAddressChange(value);
  };

  const searchAddress = () => {
    const typed = address.trim();
    if (typed.length < 5) {
      setSearchError("Escribe una dirección más específica para buscarla.");
      return;
    }
    if (!isLoaded || !window.google?.maps?.Geocoder) {
      setSearchError("Google Maps todavía no está disponible. Puedes seleccionar la ubicación directamente en el mapa.");
      return;
    }
    const requestId = ++requestSequence.current;
    setSearching(true);
    setCandidate(null);
    setSearchError("");

    const query = /lima|perú|peru/i.test(typed) ? typed : typed + ", Lima, Perú";
    new window.google.maps.Geocoder().geocode(
      { address: query, componentRestrictions: { country: "PE" }, region: "pe" },
      (results, status) => {
        if (requestId !== requestSequence.current) return;
        setSearching(false);
        const match = results?.[0];
        if (status !== "OK" || !match?.geometry?.location) {
          setSearchError("No encontramos esa dirección. Puedes marcar el pin en el mapa y escribir los datos del domicilio.");
          return;
        }
        setCandidate({
          address: match.formatted_address,
          lat: match.geometry.location.lat(),
          lng: match.geometry.location.lng(),
        });
      },
    );
  };

  return (
    <Paper className={styles.panel} shadow="sm">
      <Box className={styles.panelInner}>
        <div className={styles.panelHeader}>
          <div className={styles.iconBadge}><MapPin size={21} /></div>
          <div>
            <Text className={styles.panelTitle}>Dirección de entrega</Text>
            <Text className={styles.panelSubtitle}>
              Busca una dirección o elige el punto exacto en el mapa.
            </Text>
          </div>
        </div>
        <Stack gap="md">
          <Box>
            <TextInput
              label="Escribe tu dirección"
              placeholder="Ej. Av. Grau 120, Barranco, Lima"
              value={address}
              onChange={(event) => {
                const value = event.currentTarget.value;
                changeAddress(value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  searchAddress();
                }
              }}
              maxLength={220}
              autoComplete="street-address"
              classNames={fieldClasses}
              leftSection={<Search size={17} />}
            />
            <Text size="xs" c="#aea4ac" mt={6} lh={1.5}>
              Escribe la calle y número, preferiblemente con el distrito. Revisa el resultado antes de confirmar.
            </Text>
            <Group mt="sm" gap="sm" align="stretch">
              <Button
                variant="light"
                color="red"
                radius="md"
                leftSection={<Search size={16} />}
                onClick={searchAddress}
                loading={searching}
                disabled={!isLoaded || address.trim().length < 5}
              >
                Buscar dirección
              </Button>
              <Button
                variant="outline"
                color="gray"
                radius="md"
                leftSection={<Map size={16} />}
                onClick={() => onOpenMap()}
              >
                Elegir en mapa
              </Button>
            </Group>
          </Box>

          {loadError && (
            <Alert color="yellow" variant="light" title="No se pudo cargar Google Maps">
              Puedes volver a intentarlo cuando se restablezca el mapa.
            </Alert>
          )}
          {searchError && (
            <Alert color="yellow" variant="light" title="No se pudo ubicar la dirección">
              {searchError}
            </Alert>
          )}

          {candidate && (
            <Box className={styles.locationCard}>
              <Group align="flex-start" wrap="nowrap" gap="sm">
                <div className={styles.locationIcon}><LocateFixed size={19} /></div>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={800} size="sm" c="#f7dfb5">Resultado de la búsqueda</Text>
                  <Text c="#f8f4f1" mt={5} size="sm" lh={1.5}>{candidate.address}</Text>
                  <Text c="#bdb2b7" mt={4} size="xs">
                    Confirma que el pin corresponde al lugar donde recibirás tu pedido.
                  </Text>
                </Box>
              </Group>
              <Box mt="md" className={styles.previewFrame}>
                <StoreMapPreview lat={candidate.lat} lng={candidate.lng} />
              </Box>
              <Group mt="md" gap="sm">
                <Button
                  color="red"
                  radius="md"
                  leftSection={<CheckCircle2 size={16} />}
                  onClick={() => {
                    onSelectLocation(candidate.address, candidate.lat, candidate.lng);
                    setCandidate(null);
                    setSearchError("");
                  }}
                >
                  Confirmar dirección
                </Button>
                <Button
                  variant="outline"
                  color="gray"
                  radius="md"
                  onClick={() => onOpenMap(candidate)}
                  leftSection={<MapPin size={16} />}
                >
                  Ajustar pin
                </Button>
              </Group>
            </Box>
          )}

          {coordinates && !candidate && (
            <Box className={styles.locationCard}>
              <Group align="flex-start" wrap="nowrap" gap="sm">
                <div className={styles.locationIcon}><CheckCircle2 size={19} /></div>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text fw={800} size="sm" c="#bde5c8">Ubicación seleccionada</Text>
                  <Text c="#f8f4f1" mt={5} size="sm" lh={1.5}>
                    {address}
                  </Text>
                  <Text c="#bcb2b9" mt={5} size="xs">
                    Pin: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
                  </Text>
                </Box>
              </Group>
              <Box mt="md" className={styles.previewFrame}>
                <StoreMapPreview lat={coordinates.lat} lng={coordinates.lng} />
              </Box>
              <Button
                variant="light"
                color="red"
                size="sm"
                radius="md"
                mt="sm"
                onClick={() => onOpenMap()}
                leftSection={<MapPin size={16} />}
              >
                Cambiar ubicación en mapa
              </Button>
            </Box>
          )}

          {!coordinates && !candidate && !searchError && (
            <Text c="#b8aab2" size="xs" lh={1.5}>
              Para continuar es necesario confirmar una ubicación. Escribir la dirección por sí solo no verifica la cobertura.
            </Text>
          )}

          <TextInput
            label="Referencia de entrega (opcional)"
            placeholder="Ej. Portón negro, departamento 201, frente al parque..."
            value={references}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setReferences(value);
            }}
            classNames={fieldClasses}
            maxLength={300}
          />
        </Stack>
      </Box>
    </Paper>
  );
}

export default function DeliveryForm({
  pickupMode = false,
  address,
  coordinates,
  references,
  phone,
  docType,
  docNumber,
  onOpenMap,
  onAddressChange,
  onSelectLocation,
  setReferences,
  setPhone,
  setDocType,
  setDocNumber,
}: DeliveryFormProps) {
  const numericDoc = docType === "DNI" || docType === "RUC";

  return (
    <>
      {!pickupMode && (
        <DeliveryAddressSection
          address={address}
          coordinates={coordinates}
          references={references}
          onOpenMap={onOpenMap}
          onAddressChange={onAddressChange}
          onSelectLocation={onSelectLocation}
          setReferences={setReferences}
        />
      )}

      <Paper className={styles.panel} shadow="sm">
        <Box className={styles.panelInner}>
          <div className={styles.panelHeader}>
            <div className={styles.iconBadge}><UserRound size={21} /></div>
            <div>
              <Text className={styles.panelTitle}>
                {pickupMode ? "Datos de quien recogerá" : "Datos de quien recibirá"}
              </Text>
              <Text className={styles.panelSubtitle}>
                Utilizaremos estos datos únicamente para identificar y coordinar tu pedido.
              </Text>
            </div>
          </div>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Select
              label="Tipo de documento"
              value={docType}
              onChange={(value) => { if (value) setDocType(value); }}
              data={[
                { value: "DNI", label: "DNI" },
                { value: "CE", label: "Carné de extranjería" },
                { value: "RUC", label: "RUC" },
                { value: "PASSPORT", label: "Pasaporte" },
              ]}
              allowDeselect={false}
              classNames={{
                input: styles.selectInput,
                label: styles.inputLabel,
                dropdown: styles.selectDropdown,
                option: styles.selectOption,
              }}
            />
            <TextInput
              label="Número de documento"
              value={docNumber}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (numericDoc && !/^\d*$/.test(value)) return;
                setDocNumber(value);
              }}
              maxLength={docType === "DNI" ? 8 : docType === "RUC" ? 11 : 15}
              inputMode={numericDoc ? "numeric" : "text"}
              placeholder={docType === "DNI" ? "8 dígitos" : "Número de documento"}
              classNames={fieldClasses}
            />
            <TextInput
              label="Teléfono de contacto"
              value={phone}
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (!/^\d*$/.test(value)) return;
                setPhone(value);
              }}
              inputMode="tel"
              autoComplete="tel"
              maxLength={9}
              placeholder="999 999 999"
              classNames={fieldClasses}
              style={{ gridColumn: "1 / -1" }}
            />
          </SimpleGrid>
        </Box>
      </Paper>
    </>
  );
}
