import { useNiubizScript } from "@/core/hooks/order/useNiubizScript";
import { useCreateOrderMutation } from "@/core/hooks/order/useOrder.hook";
import { paymentService } from "@/core/services/payment/payment.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { useCartStore } from "@/core/stores/cart/cart.store";
import type { OrderRequest } from "@/core/types/order/order.model";
import { ChevronLeft, LockKeyhole, MapPin, Store, Truck } from "lucide-react";
import { Alert, Badge, Box, Group, Paper, SegmentedControl, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse } from "@/core/types/base/api-response";
import { useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import DeliveryForm from "./components/DeliveryForm";
import EmptyCartView from "./components/EmptyCartView";
import MapModal from "./components/MapModal";
import OrderSummary from "./components/OrderSummary";
import PaymentSelector from "./components/PaymentSelector";
import { BASE_URL, api } from "@/core/api/api";
import type { AxiosError } from "axios";
import styles from "./Checkout.module.css";

type OrderMode = "pickup" | "delivery";
type CatalogRef = { id: number; code: string };
type StoreRef = { id: number; name: string; address: string; latitude: number | null; longitude: number | null };
type PaymentRef = CatalogRef & { provider: string };

type CheckoutDraft = {
  orderMode: OrderMode;
  paymentMethod: "card" | "cash" | "yape";
  address: string;
  coordinates: { lat: number; lng: number } | null;
  references: string;
  phone: string;
  docType: string;
  docNumber: string;
};
type CheckoutRouteState = { checkoutDraft?: Partial<CheckoutDraft> };

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const draft = (location.state as CheckoutRouteState | null)?.checkoutDraft;

  // Stores Globales
  const { items, getTotalPrice, removeItem, clearCart } = useCartStore();
  const { user, accessToken } = useAuthStore();
  const isClient = Boolean(accessToken && user?.roles.includes("ROLE_CLIENT"));

  // Hooks Personalizados
  const { isScriptLoaded, scriptError } = useNiubizScript();
  const createOrderMutation = useCreateOrderMutation();
  const { isPending: isCreatingOrder } = createOrderMutation;

  // Elegir recogida permite probar pedidos sin configurar una ruta ficticia.
  const [orderMode, setOrderMode] = useState<OrderMode>(draft?.orderMode || "pickup");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash" | "yape">(draft?.paymentMethod || "cash");

  // Identificadores reales del backend: nunca asumir que los IDs coinciden con
  // el orden de inserción en PostgreSQL.
  const checkoutConfig = useQuery({
    queryKey: ["checkout-config"],
    queryFn: async () => {
      const [types, statuses, methods, stores] = await Promise.all([
        api.get<ApiResponse<CatalogRef[]>>("order-types"),
        api.get<ApiResponse<CatalogRef[]>>("order-statuses"),
        api.get<ApiResponse<PaymentRef[]>>("payment-methods"),
        api.get<ApiResponse<StoreRef[]>>("stores"),
      ]);
      if (![types.data.success, statuses.data.success, methods.data.success, stores.data.success].every(Boolean)) {
        throw new Error("No se pudo cargar la configuración de pedidos.");
      }
      return {
        types: types.data.data,
        statuses: statuses.data.data,
        methods: methods.data.data,
        stores: stores.data.data,
      };
    },
    staleTime: 60_000,
    enabled: isClient,
  });
  const pickupStore = checkoutConfig.data?.stores.find((store) =>
    store.name.toLocaleLowerCase("es-PE").includes("central") && store.name.toLocaleLowerCase("es-PE").includes("ica")
  ) || checkoutConfig.data?.stores[0];
  const canQuoteDelivery = checkoutConfig.data?.stores.some(
    (store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude)
  ) || false;
  const pickupConfigured = Boolean(
    pickupStore &&
    checkoutConfig.data?.types.some((type) => type.code === "TAKE_AWAY") &&
    checkoutConfig.data?.statuses.some((status) => status.code === "PENDING") &&
    checkoutConfig.data?.methods.some((method) => method.code === "CASH" && method.provider === "INTERNAL")
  );

  // Datos de Entrega
  const [address, setAddress] = useState(draft?.address || "");
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(draft?.coordinates || null);
  const [references, setReferences] = useState(draft?.references || "");
  const [deliveryQuote, setDeliveryQuote] = useState<{ distanceKm: number; durationMinutes: number } | null>(null);
  const [isCheckingDelivery, setIsCheckingDelivery] = useState(false);
  const deliveryQuoteSequence = useRef(0);

  // Datos de Contacto e Identidad
  const [phone, setPhone] = useState(draft?.phone || "");
  const [docType, setDocType] = useState(draft?.docType || "DNI");
  const [docNumber, setDocNumber] = useState(draft?.docNumber || "");

  // Estados de Interfaz
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Cálculos de Totales
  const subtotal = getTotalPrice();
  // El backend aún no incorpora una tarifa de envío al total de la orden.
  // No mostrar ni cobrar una tarifa ficticia hasta implementar cotización del servidor.
  const deliveryFee = 0;
  // Coincide con el cálculo de IGV configurado en Spring Boot (18%).
  const total = Number((subtotal * 1.18 + deliveryFee).toFixed(2));
  const isLoading = isCreatingOrder || isProcessingPayment;

  // El borrador se conserva en el estado de React Router durante la autenticación.
  const loginState = {
    from: "/checkout",
    checkoutDraft: {
      orderMode, paymentMethod, address, coordinates, references, phone, docType, docNumber,
    } satisfies CheckoutDraft,
  };

  // --- HANDLERS DEL MAPA ---
  const handleLocationSelect = (
    selectedAddress: string,
    lat: number,
    lng: number
  ) => {
    setAddress(selectedAddress);
    setCoordinates({ lat, lng });
    setDeliveryQuote(null);
    setIsCheckingDelivery(true);
    const currentRequest = ++deliveryQuoteSequence.current;
    void api.get<{ data: { distanceKm: number; durationMinutes: number } }>(
      "/orders/delivery/quote", { params: { latitude: lat, longitude: lng } }
    ).then((response) => {
      if (currentRequest === deliveryQuoteSequence.current) {
        setDeliveryQuote(response.data.data);
      }
    }).catch(() => {
      if (currentRequest === deliveryQuoteSequence.current) {
        toast.error("Esta ubicación está fuera de cobertura o no se pudo verificar la ruta.");
      }
    }).finally(() => {
      if (currentRequest === deliveryQuoteSequence.current) setIsCheckingDelivery(false);
    });
  };

  const handleConfirmMap = () => {
    if (!coordinates) {
      toast.error("Por favor selecciona una ubicación en el mapa");
      return;
    }
    if (isCheckingDelivery || !deliveryQuote) {
      toast.error("Espera a que se verifique la cobertura de delivery.");
      return;
    }
    setIsMapOpen(false);
  };

  // --- PROCESO PRINCIPAL DE ORDEN ---
  const handleProcessOrder = () => {
    if (orderMode === "delivery" && (!address.trim() || !coordinates || !deliveryQuote || isCheckingDelivery)) {
      return toast.error("Selecciona una dirección con cobertura de delivery verificada.");
    }
    if (!phone.trim() || phone.length < 9) {
      return toast.error("Ingresa un teléfono válido de 9 dígitos.");
    }
    if (!docNumber.trim()) {
      return toast.error("El número de documento es obligatorio.");
    }
    if (docType === "DNI" && docNumber.length !== 8) {
      return toast.error("El DNI debe tener 8 dígitos.");
    }
    if (docType === "RUC" && docNumber.length !== 11) {
      return toast.error("El RUC debe tener 11 dígitos.");
    }

    // No crear pedidos anónimos: solicitar login solo al confirmar.
    // El carrito persistido se mantiene y el borrador viaja en location.state.
    if (!isClient) {
      if (accessToken && user) {
        return toast.error("Para comprar necesitas una cuenta con rol de cliente.");
      }
      navigate("/auth/login", { state: loginState });
      return;
    }

    if (checkoutConfig.isPending || checkoutConfig.isError || !checkoutConfig.data) {
      return toast.error("No se pudo cargar la configuración del pedido. Actualiza e inténtalo de nuevo.");
    }
    const typeCode = orderMode === "pickup" ? "TAKE_AWAY" : "DELIVERY";
    const statusId = checkoutConfig.data.statuses.find((item) => item.code === "PENDING")?.id;
    const typeId = checkoutConfig.data.types.find((item) => item.code === typeCode)?.id;
    const payCode = paymentMethod === "cash" ? "CASH" : "YAPE";
    const paymentId = checkoutConfig.data.methods.find(
      (item) => item.code === payCode && item.provider === "INTERNAL"
    )?.id;
    if (!statusId || !typeId || (paymentMethod !== "card" && !paymentId)) {
      return toast.error("Faltan estados, tipos de pedido o métodos de pago en el servidor.");
    }
    if (orderMode === "pickup" && !pickupStore?.id) {
      return toast.error("No hay una sucursal configurada para recoger pedidos.");
    }

    // 2. Validación de Niubiz (Si es tarjeta)
    if (paymentMethod === "card") {
      if (scriptError) {
        return toast.error(
          "Error cargando la pasarela de pagos. Por favor desactiva AdBlock y recarga."
        );
      }
      if (!isScriptLoaded) {
        return toast.info(
          "Cargando sistema de seguridad de pagos, intenta en unos segundos..."
        );
      }
    }

    // 3. Construir Payload para la Orden
    const orderPayload: OrderRequest = {
      statusId,
      typeId,
      pickupStoreId: orderMode === "pickup" ? pickupStore?.id : undefined,
      details: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
        extraIds: item.selectedExtras.map((extra) => extra.id),
        notes: item.notes,
      })),
      deliveryAddress: orderMode === "delivery" && coordinates ? {
        street: address,
        reference: references,
        city: "Ica",
        province: "Ica",
        zipCode: "11000",
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        instructions: items[0]?.notes || "",
      } : undefined,
      // Si es tarjeta, NO enviamos el pago en la creación (se hace en el flujo de Niubiz después)
      payments:
        paymentMethod !== "card"
          ? [
              {
                paymentMethodId: paymentId!,
                amount: total,
                isOnline: false,
                status: "PENDING",
              },
            ]
          : [],
    };

    // 4. Ejecutar Mutación de Creación de Orden
    createOrderMutation.mutate(
      { data: orderPayload, lang: "es" },
      {
        onSuccess: (response) => {
          const orderId = response.data.id;

          if (paymentMethod === "card") {
            startNiubizFlow(orderId, Number(response.data.total));
          } else {
            finishSuccess(orderId);
          }
        },
        onError: (error) => {
          console.error(error);
          const axiosError = error as AxiosError<{ message: string }>;

          toast.error(
            axiosError.response?.data?.message || "Error al crear la orden"
          );
        },
      }
    );
  };

  const startNiubizFlow = async (orderId: number, serverTotal: number) => {
    setIsProcessingPayment(true);
    try {
      const response = await paymentService.startNiubizPayment({
        orderId,
        amount: serverTotal,
      });

      const { sessionKey, merchantId, purchaseNumber } = response.data;

      // --- CORRECCIÓN 1: Guardar ANTES de abrir el modal ---
      // Usamos el MISMO nombre que en PaymentValidate: "pending_payment_metadata"
      const paymentMetadata = {
        purchaseNumber: purchaseNumber,
        amount: response.data.amount,
        orderId,
      };
      localStorage.setItem(
        "pending_payment_metadata",
        JSON.stringify(paymentMetadata)
      );
      // -----------------------------------------------------

      const config = {
        sessiontoken: sessionKey,
        channel: "web",
        merchantid: merchantId,
        purchasenumber: purchaseNumber,
        amount: Number(response.data.amount),
        expirationminutes: "5",
        timeouturl: window.location.origin + "/menu",
        merchantlogo:
          "https://static-content.vnforapps.com/v2/img/logo-comercio-demo.png",
        merchantname: "Central Restaurante",

        // Apunta a tu Backend Java
        action: `${BASE_URL.replace(/\/$/, "")}/payments/niubiz/callback`,

        // Ya NO necesitamos el complete para guardar, el backend redirige
        complete: () => {
          console.log("Esperando redirección del backend...");
        },
      };

      if (window.VisanetCheckout) {
        window.VisanetCheckout.configure(config);
        window.VisanetCheckout.open();
        // NO quitamos el loading (setIsProcessingPayment(false)) aquí,
        // para que el usuario espere la redirección.
      } else {
        console.error("VisanetCheckout no disponible.");
        setIsProcessingPayment(false);
      }
    } catch (error) {
      console.error("Error iniciando Niubiz:", error);
      toast.error("Error al conectar con el servidor de pagos");
      setIsProcessingPayment(false);
    }
  };


  const finishSuccess = (orderId: number) => {
    setIsProcessingPayment(false);
    clearCart();
    navigate("/payment/success", {
      state: { orderId, paymentStatus: "PENDING", orderMode },
      replace: true,
    });
  };

  // --- RENDERIZADO ---
  if (items.length === 0) return <EmptyCartView />;

  return (
    <section className={styles.page}>
      <main className={styles.container}>
        <Link to="/menu" className={styles.backLink}>
          <span className={styles.backCircle}><ChevronLeft size={17} /></span>
          Seguir viendo el menú
        </Link>

        <header className={styles.header}>
          <Box>
            <Text className={styles.kicker} mb={9}>Restaurant Central · Tu compra</Text>
            <Text component="h1" className={styles.heading}>Finalizar tu pedido</Text>
            <Text className={styles.lead} mt="sm">
              Unos datos más y podrás disfrutar tu pedido.
            </Text>
          </Box>
          <div className={styles.stepTrack} aria-label="Etapas de tu compra">
            <span className={styles.step + " " + styles.stepActive}>
              <span className={styles.stepDot}>01</span> Tu pedido
            </span>
            <span className={styles.step}>
              <span className={styles.stepDot}>02</span> Tus datos
            </span>
            <span className={styles.step}>
              <span className={styles.stepDot}>03</span> Confirmación
            </span>
          </div>
        </header>

        <div className={styles.grid}>
          <div className={styles.left}>
            {!isClient && (
              <Paper className={styles.guest} p="lg">
                <Group align="flex-start" wrap="nowrap" gap="md">
                  <div className={styles.guestIcon}><LockKeyhole size={20} /></div>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" gap="xs" mb={6}>
                      <Text fw={800} c="#ffe8c8" size="sm">
                        {accessToken ? "Se necesita una cuenta de cliente" : "Compra tranquilamente como invitado"}
                      </Text>
                      {!accessToken && (
                        <Badge variant="outline" color="yellow" radius="xl" size="xs">
                          Sin registrarte todavía
                        </Badge>
                      )}
                    </Group>
                    <Text c="#dfc9ac" size="sm" lh={1.65}>
                      {accessToken
                        ? "La cuenta actual no tiene el rol de cliente necesario para confirmar pedidos."
                        : "Puedes personalizar y revisar todo tu pedido. Solo te pediremos iniciar sesión al confirmar."}
                    </Text>
                    {!accessToken && (
                      <Box mt="sm">
                        <Link to="/auth/login" state={loginState} className={styles.guestLink}>
                          ¿Ya tienes cuenta? Inicia sesión
                        </Link>
                      </Box>
                    )}
                  </Box>
                </Group>
              </Paper>
            )}

            <Paper className={styles.panel} shadow="sm">
              <Box className={styles.panelInner}>
                <div className={styles.panelHeader}>
                  <div className={styles.iconBadge}><Store size={21} /></div>
                  <div>
                    <Text className={styles.panelTitle}>¿Cómo recibirás tu pedido?</Text>
                    <Text className={styles.panelSubtitle}>Elige la opción que mejor se adapte a ti.</Text>
                  </div>
                </div>

                <SegmentedControl
                  fullWidth
                  size="md"
                  radius="md"
                  h={51}
                  value={orderMode}
                  onChange={(value) => setOrderMode(value as OrderMode)}
                  data={[
                    { value: "pickup", label: "Recoger en tienda" },
                    { value: "delivery", label: "Delivery", disabled: !canQuoteDelivery },
                  ]}
                  classNames={{
                    root: styles.modeRoot,
                    label: styles.modeLabel,
                    indicator: styles.modeIndicator,
                  }}
                />

                {orderMode === "pickup" && (
                  <Alert
                    mt="lg"
                    radius="md"
                    icon={<MapPin size={19} />}
                    title={pickupConfigured ? "Punto de recogida de pruebas" : "Punto de recogida en preparación"}
                    styles={{
                      root: { background: "#29242a", border: "1px solid #453940" },
                      icon: { color: "#d6b178" },
                      title: { color: "#f1debd", fontWeight: 800 },
                      message: { color: "#c9bbc4", lineHeight: 1.6 },
                    }}
                  >
                    {pickupStore
                      ? (
                        <Text size="sm" c="#c9bbc4">
                          <Text span fw={750} c="#fff">{pickupStore.name}</Text> — {pickupStore.address}.
                          Para esta demostración la dirección exacta sigue pendiente;
                          no acudas a ella a recoger pedidos.
                        </Text>
                      )
                      : (
                        <Text size="sm" c="#c9bbc4">
                          {isClient
                            ? "Todavía no se ha configurado una sucursal de recogida en el sistema."
                            : "Los detalles de la sucursal aparecerán cuando inicies sesión."}
                        </Text>
                      )}
                  </Alert>
                )}

                {!canQuoteDelivery && isClient && (
                  <Group gap="xs" mt="md" wrap="nowrap">
                    <Truck size={16} color="#b4a5af" style={{ flexShrink: 0 }} />
                    <Text c="#b4a5af" size="xs" lh={1.5}>
                      Delivery estará disponible cuando la sucursal tenga coordenadas reales.
                    </Text>
                  </Group>
                )}
              </Box>
            </Paper>

            <DeliveryForm
              pickupMode={orderMode === "pickup"}
              address={address}
              coordinates={coordinates}
              references={references}
              phone={phone}
              docType={docType}
              docNumber={docNumber}
              onOpenMap={() => setIsMapOpen(true)}
              setReferences={setReferences}
              setPhone={setPhone}
              setDocType={setDocType}
              setDocNumber={setDocNumber}
            />

            {orderMode === "delivery" && isCheckingDelivery && (
              <Alert
                color="yellow"
                radius="lg"
                title="Comprobando cobertura"
                styles={{ root: { background: "#322920", border: "1px solid #604c30" }, title: { color: "#ffda9d" }, message: { color: "#ffda9d" } }}
              >
                Estamos verificando la ruta de entrega.
              </Alert>
            )}
            {orderMode === "delivery" && deliveryQuote && (
              <Alert
                color="green"
                radius="lg"
                title="Reparto disponible"
                styles={{ root: { background: "#1e3028", border: "1px solid #3c6850" }, title: { color: "#a9e7bc" }, message: { color: "#bde9c9" } }}
              >
                Ruta de {deliveryQuote.distanceKm.toFixed(2)} km; traslado estimado de {deliveryQuote.durationMinutes} min, sin incluir preparación.
              </Alert>
            )}

            <PaymentSelector
              selectedMethod={paymentMethod}
              onSelect={setPaymentMethod}
              pickupMode={orderMode === "pickup"}
            />

            {paymentMethod === "card" && !isScriptLoaded && !scriptError && (
              <Text size="sm" c="#f2c77e">Preparando la conexión segura con Niubiz...</Text>
            )}
            {paymentMethod === "card" && scriptError && (
              <Alert
                color="red"
                radius="lg"
                title="No se pudo cargar la pasarela de pagos"
                styles={{ root: { background: "#362125", border: "1px solid #713b43" }, title: { color: "#ffb9c0" }, message: { color: "#ffc8cd" } }}
              >
                Comprueba si un bloqueador de anuncios está interfiriendo y recarga la página.
              </Alert>
            )}
          </div>

          <aside aria-label="Resumen de tu pedido">
            <OrderSummary
              pickupMode={orderMode === "pickup"}
              isCheckoutReady={Boolean(
                !isClient || (!checkoutConfig.isLoading && !checkoutConfig.isError &&
                (orderMode === "pickup" ? pickupConfigured : canQuoteDelivery))
              )}
              items={items}
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              total={total}
              isLoading={isLoading}
              isUserLoggedIn={isClient}
              onRemoveItem={removeItem}
              onProcessOrder={handleProcessOrder}
            />
          </aside>
        </div>
      </main>

      <MapModal
        isOpen={isMapOpen && orderMode === "delivery"}
        onClose={() => setIsMapOpen(false)}
        onConfirm={handleConfirmMap}
        onLocationSelect={handleLocationSelect}
        initialLat={coordinates?.lat}
        initialLng={coordinates?.lng}
      />
    </section>
  );
}
