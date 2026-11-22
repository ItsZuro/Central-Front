import { Alert, Box, Group, Paper, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { Banknote, Check, CreditCard, Info } from "lucide-react";
import type { ReactNode } from "react";
import styles from "../Checkout.module.css";

export type CheckoutPaymentChoice = "card" | "cash";

interface PaymentSelectorProps {
  pickupMode?: boolean;
  selectedMethod: CheckoutPaymentChoice;
  onSelect: (method: CheckoutPaymentChoice) => void;
}

function PaymentOption({
  method,
  selected,
  title,
  description,
  icon,
  onSelect,
}: {
  method: CheckoutPaymentChoice;
  selected: boolean;
  title: string;
  description: string;
  icon: ReactNode;
  onSelect: (method: CheckoutPaymentChoice) => void;
}) {
  return (
    <UnstyledButton
      className={styles.payOption + (selected ? " " + styles.payOptionActive : "")}
      aria-pressed={selected}
      type="button"
      onClick={() => onSelect(method)}
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
  const paymentMessage = !pickupMode
    ? "En delivery el pago se realiza antes de preparar el pedido. Niubiz permite tarjetas, Yape y otros medios habilitados."
    : selectedMethod === "card"
    ? "Al continuar se abrirá Niubiz para elegir tarjeta, Yape u otro medio habilitado. Tu pedido no se considerará pagado hasta que Niubiz y el servidor confirmen la operación."
    : pickupMode
      ? "Pagarás en efectivo al recoger tu pedido. Se registrará con pago pendiente."
      : "Pagarás en efectivo al recibir el delivery. Se registrará con pago pendiente.";

  return (
    <Paper className={styles.panel} shadow="sm">
      <Box className={styles.panelInner}>
        <div className={styles.panelHeader}>
          <div className={styles.iconBadge}><CreditCard size={21} /></div>
          <div>
            <Text className={styles.panelTitle}>¿Cómo deseas pagar?</Text>
            <Text className={styles.panelSubtitle}>
              Elige si prefieres pagar ahora o al recibir tu pedido.
            </Text>
          </div>
        </div>
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, xs: pickupMode ? 2 : 1 }} spacing="sm">
            <PaymentOption
              method="card"
              selected={selectedMethod === "card"}
              onSelect={onSelect}
              icon={<CreditCard size={21} />}
              title="Pagar en línea"
              description="Tarjetas, Yape y más · Niubiz"
            />
            {pickupMode && (
              <PaymentOption
                method="cash"
                selected={selectedMethod === "cash"}
                onSelect={onSelect}
                icon={<Banknote size={21} />}
                title="Efectivo"
                description="Pagar al recoger"
              />
            )}
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
