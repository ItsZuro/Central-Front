import { api } from "@/core/api/api";
import { orderService } from "@/core/services/order/order.service";
import type { ApiResponse } from "@/core/types/base/api-response";
import type { OrderRequest, OrderResponse } from "@/core/types/order/order.model";
import {
  Alert, Badge, Box, Button, Divider, Group, Loader, Modal, NumberInput,
  Paper, ScrollArea, SegmentedControl, Select, SimpleGrid, Stack, Text,
  TextInput, Title,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { AlertCircle, Plus, Search, ShoppingBag, Users } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "react-toastify";
import styles from "./Waiter.module.css";

type Catalog = { id: number; code: string };
type Customer = { id: number; fullName: string; username: string; email: string };
type Product = { id: number; name: string; price: number; active: boolean };
type Table = { id: number; code: string; alias?: string | null; status: string; capacity: number };
type Store = { id: number; name: string; address: string };
type Channel = "DINE_IN" | "TAKE_AWAY";
type CustomerMode = "GUEST" | "REGISTERED";

type Props = {
  onCreated: () => void;
  onCreatedOrder?: (order: OrderResponse) => void;
  defaultTableId?: number;
  defaultOrderType?: Channel;
  label?: string;
  variant?: "primary" | "outline";
};

const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const field = { input: styles.fieldInput, label: styles.fieldLabel };
const selectClassNames = {
  input: styles.fieldInput,
  label: styles.fieldLabel,
  dropdown: styles.dropdown,
  option: styles.option,
};

function errorText(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || "El servidor no pudo registrar la venta.";
  }
  return error instanceof Error ? error.message : "No se pudo registrar la venta.";
}

export default function NewDineInOrder({
  onCreated,
  onCreatedOrder,
  defaultTableId,
  defaultOrderType = "DINE_IN",
  label = "Pedido en mesa",
  variant = "primary",
}: Props) {
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [customerMode, setCustomerMode] = useState<CustomerMode>("GUEST");
  const [orderType, setOrderType] = useState<Channel>(defaultOrderType);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const config = useQuery({
    queryKey: ["waiter", "pos-config"],
    enabled: opened,
    queryFn: async () => {
      const [types, statuses, tables, stores, products] = await Promise.all([
        api.get<ApiResponse<Catalog[]>>("/order-types"),
        api.get<ApiResponse<Catalog[]>>("/order-statuses"),
        api.get<ApiResponse<Table[]>>("/tables"),
        api.get<ApiResponse<Store[]>>("/stores"),
        api.get<ApiResponse<Product[]>>("/products"),
      ]);
      if (![types, statuses, tables, stores, products].every((result) => result.data.success)) {
        throw new Error("No se pudo cargar el catálogo de venta presencial.");
      }
      return {
        types: types.data.data,
        statuses: statuses.data.data,
        tables: tables.data.data,
        stores: stores.data.data,
        products: products.data.data.filter((item) => item.active),
      };
    },
    staleTime: 10_000,
  });

  const customers = useQuery({
    queryKey: ["waiter", "customer-search", customerSearch.trim()],
    enabled: opened && customerMode === "REGISTERED" && customerSearch.trim().length >= 2,
    queryFn: async () => {
      const response = await api.get<ApiResponse<Customer[]>>("/customers/search", {
        params: { query: customerSearch.trim() },
      });
      if (!response.data.success) throw new Error(response.data.message);
      return response.data.data ?? [];
    },
  });

  const clearForm = () => {
    setCustomerMode("GUEST");
    setOrderType(defaultOrderType);
    setCustomerSearch("");
    setCustomerId(null);
    setSelectedCustomer("");
    setTableId(null);
    setStoreId(null);
    setQuantities({});
  };

  const createOrder = useMutation({
    mutationFn: async (request: OrderRequest) => {
      const response = await orderService.createPosSale(request);
      if (!response.success) throw new Error(response.message);
      return response;
    },
    onSuccess: async (response) => {
      toast.success("Pedido registrado. El pago está pendiente en caja.");
      setOpened(false);
      clearForm();
      await queryClient.invalidateQueries({ queryKey: ["waiter"] });
      onCreated();
      if (response.data && onCreatedOrder) onCreatedOrder(response.data);
    },
    onError: (error) => toast.error(errorText(error)),
  });

  const selectedType = config.data?.types.find((item) => item.code === orderType);
  const initialStatus = config.data?.statuses.find((item) => item.code === "PENDING_CONFIRMATION");
  const activePickupStoreId = storeId ||
    (config.data?.stores.length === 1 ? String(config.data.stores[0].id) : null);
  const selectedItems = config.data?.products.filter((item) => (quantities[item.id] || 0) > 0) ?? [];
  const totalPreview = selectedItems.reduce((sum, item) => sum + item.price * quantities[item.id], 0);

  const canSubmit = Boolean(
    (customerMode === "GUEST" || customerId !== null) &&
    selectedType && initialStatus &&
    (orderType === "DINE_IN" ? tableId : activePickupStoreId) &&
    selectedItems.length > 0 && !createOrder.isPending
  );

  const open = () => {
    clearForm();
    setTableId(defaultTableId != null ? String(defaultTableId) : null);
    setOpened(true);
  };
  const close = () => {
    if (!createOrder.isPending) {
      setOpened(false);
      clearForm();
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || !selectedType || !initialStatus) return;
    createOrder.mutate({
      customerId: customerMode === "REGISTERED" ? customerId : null,
      typeId: selectedType.id,
      statusId: initialStatus.id,
      ...(orderType === "DINE_IN" ? { tableId: Number(tableId) } :
        { pickupStoreId: Number(activePickupStoreId) }),
      details: selectedItems.map((product) => ({
        productId: product.id,
        quantity: quantities[product.id],
      })),
    });
  };

  return (
    <>
      <Button
        fullWidth={variant === "outline"}
        variant={variant === "primary" ? "filled" : "light"}
        color="red" size={variant === "primary" ? "md" : "sm"}
        leftSection={<Plus size={17}/>} onClick={open}
      >
        {label}
      </Button>
      <Modal
        opened={opened} onClose={close}
        closeOnEscape={!createOrder.isPending}
        closeOnClickOutside={!createOrder.isPending}
        title="Nuevo pedido presencial" size="lg" centered
        classNames={{
          content: styles.modalContent,
          header: styles.modalHeader,
          title: styles.modalTitle,
          close: styles.modalClose,
        }}
      >
        <form onSubmit={submit}>
          <Stack gap="lg" pb="sm">
            <Text size="sm" c="#bcb7c1">
              Registra los platos y después confirma el pago en caja. No es necesario que el
              comprador cree una cuenta.
            </Text>
            {config.isPending ? (
              <Group justify="center" py="xl">
                <Loader color="red" size="sm"/>
                <Text c="#c5bdc8" size="sm">Cargando catálogo del restaurante...</Text>
              </Group>
            ) : config.isError ? (
              <Alert icon={<AlertCircle size={18}/>} color="red" title="No se pudo cargar el catálogo">
                <Text size="sm">{errorText(config.error)}</Text>
                <Button size="xs" variant="light" color="red" mt="sm" onClick={() => void config.refetch()}>
                  Reintentar
                </Button>
              </Alert>
            ) : (
              <>
                <Stack gap="xs">
                  <Text c="white" fw={700} size="sm">Tipo de cliente</Text>
                  <SegmentedControl
                    className={styles.darkSegmented} color="red" fullWidth
                    value={customerMode}
                    onChange={(value) => {
                      setCustomerMode(value as CustomerMode);
                      setCustomerId(null);
                      setCustomerSearch("");
                      setSelectedCustomer("");
                    }}
                    data={[
                      { value: "GUEST", label: "Consumidor final · Sin cuenta" },
                      { value: "REGISTERED", label: "Cliente registrado" },
                    ]}
                  />
                  {customerMode === "GUEST" ? (
                    <Text c="#b1d9c5" size="xs">
                      La compra se registra como «Consumidor final», sin pedir datos personales.
                      No acumula puntos de un cliente registrado.
                    </Text>
                  ) : (
                    <>
                      <TextInput
                        label="Buscar cliente"
                        placeholder="Nombre, usuario o correo"
                        leftSection={<Search size={16}/>}
                        value={customerSearch}
                        onChange={(event) => {
                          setCustomerSearch(event.currentTarget.value);
                          setCustomerId(null);
                          setSelectedCustomer("");
                        }}
                        classNames={field} autoComplete="off" required
                      />
                      {selectedCustomer && (
                        <Badge color="green" variant="light" size="lg" style={{ alignSelf: "flex-start" }}>
                          Cliente: {selectedCustomer}
                        </Badge>
                      )}
                      {!customerId && customerSearch.trim().length >= 2 && (
                        <Paper bg="#2b2930" withBorder p="xs" radius="md" style={{ borderColor: "#47424c" }}>
                          {customers.isPending ? <Text size="xs" c="#bcb5c0" p="xs">Buscando clientes...</Text> :
                            customers.isError ? <Text size="xs" c="#ff9797" p="xs">
                              No fue posible buscar clientes.
                            </Text> :
                            (customers.data ?? []).length === 0 ?
                              <Text size="xs" c="#bcb5c0" p="xs">No se encontraron clientes registrados.</Text> :
                              <ScrollArea.Autosize mah={170}>
                                <Stack gap={4}>
                                  {customers.data?.map((customer) => (
                                    <Button key={customer.id} variant="subtle" color="gray"
                                      justify="flex-start" fullWidth
                                      onClick={() => {
                                        setCustomerId(customer.id);
                                        setSelectedCustomer(customer.fullName || customer.username || customer.email);
                                      }}>
                                      {customer.fullName || customer.username} · {customer.email}
                                    </Button>
                                  ))}
                                </Stack>
                              </ScrollArea.Autosize>}
                        </Paper>
                      )}
                    </>
                  )}
                </Stack>

                <Stack gap="xs">
                  <Text fw={700} c="white" size="sm">Modalidad de atención</Text>
                  <SegmentedControl
                    className={styles.darkSegmented} color="red" fullWidth
                    value={orderType}
                    onChange={(value) => {
                      setOrderType(value as Channel);
                      setTableId(null);
                      setStoreId(null);
                    }}
                    data={[
                      { value: "DINE_IN", label: "En mesa" },
                      { value: "TAKE_AWAY", label: "Para llevar · Sin mesa" },
                    ]}
                  />
                  {orderType === "DINE_IN" ? (
                    <>
                      <Select
                        label="Mesa disponible"
                        placeholder="Selecciona una mesa libre"
                        data={(config.data?.tables || [])
                          .filter((table) => table.status === "FREE")
                          .map((table) => ({
                            value: String(table.id),
                            label: "Mesa " + (table.alias || table.code || table.id) +
                              " · " + table.capacity + " personas",
                          }))}
                        value={tableId} onChange={setTableId}
                        leftSection={<Users size={16}/>}
                        classNames={selectClassNames}
                        comboboxProps={{ withinPortal: false }} searchable required
                      />
                      {!config.data?.tables.some((table) => table.status === "FREE") && (
                        <Alert color="yellow" icon={<AlertCircle size={16}/>}>
                          No hay mesas libres en este momento.
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Select
                      label="Sucursal de recogida" placeholder="Selecciona la sucursal"
                      required
                      data={(config.data?.stores || []).map((store) => ({
                        value: String(store.id), label: store.name,
                      }))}
                      value={activePickupStoreId} onChange={setStoreId}
                      classNames={selectClassNames}
                      comboboxProps={{ withinPortal: false }}
                    />
                  )}
                </Stack>

                <Box>
                  <Group justify="space-between" mb="sm">
                    <Text size="sm" fw={700} c="white">Productos del pedido</Text>
                    <Badge variant="light" color="red">{selectedItems.length} seleccionados</Badge>
                  </Group>
                  <ScrollArea.Autosize mah={300} type="auto" offsetScrollbars>
                    <Stack gap="xs" pr="xs">
                      {config.data?.products.map((product) => (
                        <Paper key={product.id} className={styles.productLine}>
                          <Group align="center" justify="space-between" wrap="nowrap" gap="xs">
                            <Box style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={600} c="white">{product.name}</Text>
                              <Text size="xs" c="#a9a4ae" mt={3}>{currency.format(product.price)}</Text>
                            </Box>
                            <NumberInput
                              aria-label={"Cantidad de " + product.name}
                              value={quantities[product.id] || 0}
                              onChange={(value) => {
                                const quantity = typeof value === "number" && Number.isFinite(value)
                                  ? Math.min(99, Math.max(0, Math.floor(value))) : 0;
                                setQuantities((previous) => ({ ...previous, [product.id]: quantity }));
                              }}
                              min={0} max={99} allowDecimal={false} w={94}
                              classNames={field}
                            />
                          </Group>
                        </Paper>
                      ))}
                      {!config.data?.products.length && (
                        <Text size="sm" c="#c4bdc7">No hay productos activos disponibles.</Text>
                      )}
                    </Stack>
                  </ScrollArea.Autosize>
                </Box>
                <Divider color="#454049"/>
                <Group justify="space-between" align="center">
                  <Box>
                    <Text size="xs" c="#aca6b0">Subtotal referencial</Text>
                    <Title order={3} c="white">{currency.format(totalPreview)}</Title>
                  </Box>
                  <ShoppingBag color="#ef6a75" size={24}/>
                </Group>
                <Text size="xs" c="#b8b1bb">
                  El total definitivo, incluidos impuestos y extras, lo calcula el servidor.
                  Registrar el pedido no confirma su pago.
                </Text>
                {createOrder.isError && (
                  <Alert color="red" icon={<AlertCircle size={17}/>} title="No se pudo registrar el pedido">
                    {errorText(createOrder.error)}
                  </Alert>
                )}
                <SimpleGrid cols={2} spacing="sm">
                  <Button variant="default" type="button" onClick={close} disabled={createOrder.isPending}>
                    Cancelar
                  </Button>
                  <Button color="red" type="submit" loading={createOrder.isPending} disabled={!canSubmit}>
                    Registrar pedido
                  </Button>
                </SimpleGrid>
              </>
            )}
          </Stack>
        </form>
      </Modal>
    </>
  );
}
