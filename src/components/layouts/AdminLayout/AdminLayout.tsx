import Sidebar from "@/components/Sidebar/Sidebar";
import { Box, Flex, Group, Paper, Text } from "@mantine/core";
import { CircleCheck } from "lucide-react";
import { Outlet } from "react-router-dom";

export default function AdminLayout() {
  return (
    <Flex direction={{ base: "column", md: "row" }} mih="100vh" bg="gray.0">
      <Sidebar/>
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Paper radius={0} px={{ base: "md", sm: "xl" }} py="sm" bg="white" style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
          <Group justify="space-between" wrap="wrap" gap="xs">
            <Text c="dimmed" fw={650} size="xs">Restaurant Central / Administración</Text>
            <Group gap={6}><CircleCheck size={14} color="#16a34a"/><Text c="green.7" fw={650} size="xs">Panel de gestión</Text></Group>
          </Group>
        </Paper>
        <Box px={{ base: "md", sm: "xl" }} py="xl">
          <Outlet/>
        </Box>
      </Box>
    </Flex>
  );
}
