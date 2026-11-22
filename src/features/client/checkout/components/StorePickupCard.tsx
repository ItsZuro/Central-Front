import { Box, Button, Collapse, Group, Text } from "@mantine/core";
import { ExternalLink, MapPin, Navigation, Store } from "lucide-react";
import { useState } from "react";
import StoreMapPreview from "./StoreMapPreview";
import styles from "../Checkout.module.css";

interface PickupStore {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface StorePickupCardProps {
  store?: PickupStore | null;
  isClient: boolean;
}

export default function StorePickupCard({ store, isClient }: StorePickupCardProps) {
  const [mapVisible, setMapVisible] = useState(false);
  const hasCoords = Number.isFinite(store?.latitude) && Number.isFinite(store?.longitude);
  const name = store?.name.replace(/\s*\((?:pruebas?|tests?|demo)\)/gi, "").trim();
  const address = store?.address && !/prueba|test|demo|pendiente|fictici/i.test(store.address)
    ? store.address
    : "";
  const locationQuery = hasCoords
    ? String(store?.latitude) + "," + String(store?.longitude)
    : address;
  const mapsSearchUrl = "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(locationQuery || "");
  const directionsUrl = "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(locationQuery || "");

  if (!store) {
    return (
      <Box className={styles.locationCard} mt="lg">
        <Text size="sm" c="#dac9c9">
          {isClient
            ? "No hay una sucursal de recogida disponible."
            : "Consulta los detalles de la sucursal cuando inicies sesión."}
        </Text>
      </Box>
    );
  }

  return (
    <Box className={styles.locationCard} mt="lg">
      <Group gap="sm" align="flex-start" wrap="nowrap">
        <div className={styles.locationIcon}><Store size={19} /></div>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={800} c="#ecd0a2" tt="uppercase" style={{ letterSpacing: "0.05em" }}>
            Único punto de recogida
          </Text>
          <Text size="sm" fw={800} c="#fff" mt={7}>{name}</Text>
          {address && (
            <Text size="sm" c="#c8bcc4" mt={4} lh={1.5}>
              <MapPin size={13} style={{ display: "inline", marginRight: 6 }} />
              {address}
            </Text>
          )}
          <Text size="xs" c="#aea3ac" mt={7} lh={1.5}>
            Te avisaremos cuando tu pedido esté disponible para recoger.
          </Text>
          {locationQuery && (
            <Group mt="md" gap="xs" wrap="wrap">
              {hasCoords ? (
                <Button
                  variant="light"
                  color="red"
                  radius="md"
                  size="sm"
                  leftSection={<MapPin size={15} />}
                  onClick={() => setMapVisible((value) => !value)}
                  aria-expanded={mapVisible}
                >
                  {mapVisible ? "Ocultar mapa" : "Ver mapa"}
                </Button>
              ) : (
                <Button
                  component="a"
                  href={mapsSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="light"
                  color="red"
                  radius="md"
                  size="sm"
                  leftSection={<ExternalLink size={15} />}
                >
                  Ver mapa
                </Button>
              )}
              <Button
                component="a"
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                radius="md"
                size="sm"
                variant="outline"
                color="gray"
                leftSection={<Navigation size={15} />}
              >
                Cómo llegar
              </Button>
            </Group>
          )}
        </Box>
      </Group>
      {hasCoords && (
        <Collapse in={mapVisible}>
          <Box mt="md" className={styles.previewFrame}>
            <StoreMapPreview lat={store.latitude!} lng={store.longitude!} />
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
