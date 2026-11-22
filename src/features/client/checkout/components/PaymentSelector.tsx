import { Alert, Box, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { Banknote, Check, CreditCard, Info, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import styles from "../Checkout.module.css";

type PaymentMethodType = "card" | "cash" | "yape";

interface PaymentSelectorProps {
  pickupMode?: boolean;
  selectedMethod: PaymentMethodType;
  onSelect: (method: PaymentMethodType) => void;
}

function PaymentOption({
  method,
  selected,
  title,
  description,
  icon,
  onSelect,
}: {
  method: PaymentMethodType;
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: (method: PaymentMethodType) => void;
}) {
  return (
    <UnstyledButton
      className={styles.payOption + (selected ? " " + styles.payOptionActive : "")}
      aria-pressed={selected}
      onClick={() => onSelect(method)}
      type="button"
    >
      <Group justify="space-between" w="100%">
        <div className={styles.payIcon + (selected ? " " + styles.payIconSelected : "")}>
          {icon}
        </div>
        {selected && <Check size={18} color="#ff828a" strokeWidth={3} />}
      </Group>
      <Box>
        <Text className={styles.payTitle}>{title}</Text>
        <Text className={styles.paySubtitle}>{description}</Text>
      </Box>
    </UnstyledButton>
  );
}

export default function PaymentSelector({
  pickupMode = false,
  selectedMethod,
  onSelect,
}: PaymentSelectorProps) {
  const paymentMessage = selectedMethod === "card"
    ? "El pago con tarjeta se realiza a través de la pasarela segura Niubiz."
    : selectedMethod === "yape"
      ? (pickupMode
        ? "Yape / Plin se registra como pago pendiente. Pagarás al recoger el pedido; no se cobrará en línea."
        : "El pago con Yape / Plin queda pendiente hasta la entrega. No se cobrará en línea.")
      : (pickupMode
        ? "Puedes pagar en efectivo al recoger el pedido. Se registrará con pago pendiente."
        : "Pagarás en efectivo al recibir tu pedido.");

  return (
    <Paper className={styles.panel} shadow="sm">
      <Box className={styles.panelInner}>
        <div className={styles.panelHeader}>
          <div className={styles.iconBadge}><CreditCard size={21} /></div>
          <div>
            <Text className={styles.panelTitle}>¿Cómo deseas pagar?</Text>
            <Text className={styles.panelSubtitle}>Selecciona tu método de pago preferido.</Text>
          </div>
        </div>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
            <PaymentOption
              method="card"
              selected={selectedMethod === "card"}
              onSelect={onSelect}
              icon={<CreditCard size={21} />}
              title="Tarjeta"
              description="Pago seguro en línea"
            />
            <PaymentOption
              method="yape"
              selected={selectedMethod === "yape"}
              onSelect={onSelect}
              icon={<Smartphone size={21} />}
              title="Yape / Plin"
              description="Pago al recibir"
            />
            <PaymentOption
              method="cash"
              selected={selectedMethod === "cash"}
              onSelect={onSelect}
              icon={<Banknote size={21} />}
              title="Efectivo"
              description={pickupMode ? "Al recoger" : "Contraentrega"}
            />
          </SimpleGrid>
          <Alert
            icon={<Info size={17} />}
            color="gray"
            variant="light"
            radius="md"
            styles={{
              root: { background: "#29252b", border: "1px solid #403840" },
              icon: { color: "#d8b37d" },
              body: { color: "#d4ccd2" },
              message: { color: "#d4ccd2", fontSize: 12, lineHeight: 1.6 },
            }}
          >
            {paymentMessage}
          </Alert>
        </Stack>
      </Box>
    </Paper>
  );
}
