import LocationPicker from "@/components/Maps/LocationPicker";
import { Box, Button, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { CheckCircle2, MapPin } from "lucide-react";
import { useState } from "react";
import type { LocatedAddress } from "./DeliveryForm";
import styles from "../Checkout.module.css";

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selection: LocatedAddress) => void;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
}

function MapModalContent({
  onClose,
  onConfirm,
  initialAddress,
  initialLat,
  initialLng,
}: Omit<MapModalProps, "isOpen">) {
  const [draftAddress, setDraftAddress] = useState(initialAddress || "");
  const [draftCoordinates, setDraftCoordinates] = useState<{ lat: number; lng: number } | null>(
    Number.isFinite(initialLat) && Number.isFinite(initialLng)
      ? { lat: initialLat!, lng: initialLng! }
      : null,
  );
  const [feedback, setFeedback] = useState("");

  const confirm = () => {
    if (!draftCoordinates) {
      setFeedback("Toca el mapa o arrastra el pin para marcar el punto de entrega.");
      return;
    }
    const street = draftAddress.trim();
    if (street.length < 5) {
      setFeedback("Escribe una dirección reconocible: calle, número o indicaciones del domicilio.");
      return;
    }
    onConfirm({ address: street, lat: draftCoordinates.lat, lng: draftCoordinates.lng });
  };

  return (
    <Stack gap="md">
      <Text c="#bfb4bd" size="sm" lh={1.6}>
        Marca exactamente el ingreso de tu domicilio. Si Google no identifica la calle,
        puedes escribirla tú mismo antes de confirmar.
      </Text>
      <LocationPicker
        initialLat={initialLat}
        initialLng={initialLng}
        initialAddress={initialAddress}
        onLocationSelect={(formattedAddress, lat, lng) => {
          setDraftCoordinates({ lat, lng });
          setDraftAddress(
            /ubicaci[oó]n seleccionada en mapa/i.test(formattedAddress)
              ? ""
              : formattedAddress,
          );
          setFeedback("");
        }}
      />
      <Box>
        <TextInput
          label="Dirección para el repartidor"
          description="Puedes completar o corregir la dirección que encontró Google."
          placeholder="Calle, número y distrito, Lima"
          value={draftAddress}
          maxLength={220}
          classNames={{ input: styles.input, label: styles.inputLabel }}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDraftAddress(value);
            setFeedback("");
          }}
        />
        {draftCoordinates && (
          <Text size="xs" c="#ada0aa" mt="xs">
            Pin seleccionado: {draftCoordinates.lat.toFixed(5)}, {draftCoordinates.lng.toFixed(5)}
          </Text>
        )}
        {feedback && <Text c="#ffb3a5" size="sm" mt="sm">{feedback}</Text>}
      </Box>
      <Group justify="flex-end" gap="sm">
        <Button variant="subtle" color="gray" onClick={onClose}>Cancelar</Button>
        <Button color="red" radius="md" leftSection={<CheckCircle2 size={16} />} onClick={confirm}>
          Confirmar ubicación
        </Button>
      </Group>
    </Stack>
  );
}

export default function MapModal({
  isOpen,
  onClose,
  onConfirm,
  initialAddress,
  initialLat,
  initialLng,
}: MapModalProps) {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      centered
      size="lg"
      radius="lg"
      title={
        <Group gap="sm">
          <MapPin size={20} color="#f04a52" />
          <Text fw={850} c="#fff">Selecciona tu ubicación</Text>
        </Group>
      }
      styles={{
        content: { background: "#1e1d21", border: "1px solid #55454e", color: "#fff" },
        header: { background: "#1e1d21" },
        title: { color: "#fff" },
        close: { color: "#eee" },
      }}
    >
      {isOpen && (
        <MapModalContent
          initialAddress={initialAddress}
          initialLat={initialLat}
          initialLng={initialLng}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
}
