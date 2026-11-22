import Sidebar from "@/components/Sidebar/Sidebar";
import { Box, Flex } from "@mantine/core";
import { Outlet } from "react-router-dom";
import AdminHeader from "./AdminHeader";
import styles from "./AdminShell.module.css";

export default function AdminLayout() {
  return (
    <Flex direction={{ base: "column", md: "row" }} className={styles.shell}>
      <Sidebar />
      <Box className={styles.main}>
        <AdminHeader />
        <main className={styles.pageContent} id="admin-main-content">
          <Outlet />
        </main>
      </Box>
    </Flex>
  );
}
