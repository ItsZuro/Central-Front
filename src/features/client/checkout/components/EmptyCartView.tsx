import { Box, Button, Paper, Stack, Text } from "@mantine/core";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";
import styles from "../Checkout.module.css";

export default function EmptyCartView() {
  return (
    <section className={styles.page}>
      <Box className={styles.container} style={{ maxWidth: 560, paddingTop: 65 }}>
        <Paper className={styles.panel} p={40} ta="center">
          <Stack align="center" gap="md">
            <div className={styles.iconBadge} style={{ width: 78, height: 78, borderRadius: 24 }}>
              <ShoppingBag size={34} />
            </div>
            <Text className={styles.kicker}>Restaurant Central</Text>
            <Text component="h1" className={styles.heading} style={{ fontSize: 30 }}>
              Tu carrito está vacío
            </Text>
            <Text c="#aaa4a9" size="sm" maw={370} lh={1.7}>
              Todavía no has elegido qué comer. Explora nuestros platos y agrega tus favoritos.
            </Text>
            <Button
              component={Link}
              to="/menu"
              mt="sm"
              className={styles.cta}
              h={48}
              rightSection={<ArrowRight size={17} />}
              px="xl"
            >
              Explorar el menú
            </Button>
          </Stack>
        </Paper>
      </Box>
    </section>
  );
}
