import { Box, Button, Group, Paper, Select, SimpleGrid, Stack, Text, TextInput } from "@mantine/core";
import { Map, MapPin, UserRound } from "lucide-react";
import styles from "../Checkout.module.css";

interface DeliveryFormProps {
  pickupMode?: boolean;
  address: string;
  coordinates: { lat: number; lng: number } | null;
  references: string;
  phone: string;
  docType: string;
  docNumber: string;
  onOpenMap: () => void;
  setReferences: (value: string) => void;
  setPhone: (value: string) => void;
  setDocType: (value: string) => void;
  setDocNumber: (value: string) => void;
}

const fieldClasses = { input: styles.input, label: styles.inputLabel };

export default function DeliveryForm({
  pickupMode = false,
  address,
  coordinates,
  references,
  phone,
  docType,
  docNumber,
  onOpenMap,
  setReferences,
  setPhone,
  setDocType,
  setDocNumber,
}: DeliveryFormProps) {
  const numericDoc = docType === "DNI" || docType === "RUC";

  return (
    <>
      {!pickupMode && (
        <Paper className={styles.panel} shadow="sm">
          <Box className={styles.panelInner}>
            <div className={styles.panelHeader}>
              <div className={styles.iconBadge}><MapPin size={21} /></div>
              <div>
                <Text className={styles.panelTitle}>Dirección de entrega</Text>
                <Text className={styles.panelSubtitle}>Elige tu ubicación para comprobar la cobertura.</Text>
              </div>
            </div>
            <Stack gap="lg">
              <Box>
                <Text className={styles.inputLabel}>Ubicación en el mapa</Text>
                <Group wrap="nowrap" align="stretch" gap="sm">
                  <Box style={{ minWidth: 0, flex: 1 }} className={styles.addressPreview}>
                    <Text size="sm" c={address ? "#f8f4f1" : "#88828a"} truncate>
                      {address || "Todavía no has seleccionado una ubicación"}
                    </Text>
                    {coordinates && <MapPin size={17} color="#76d4a4" style={{ flexShrink: 0 }} />}
                  </Box>
                  <Button variant="light" color="red" leftSection={<Map size={17} />} onClick={onOpenMap} radius="md" h={48}>
                    Elegir
                  </Button>
                </Group>
                {coordinates && (
                  <Text mt={7} size="xs" c="#938d94">
                    Ubicación marcada: {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
                  </Text>
                )}
              </Box>
              <TextInput
                label="Referencia (opcional)"
                value={references}
                onChange={(event) => setReferences(event.currentTarget.value)}
                placeholder="Ej. Frente al parque, puerta negra..."
                classNames={fieldClasses}
              />
            </Stack>
          </Box>
        </Paper>
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
