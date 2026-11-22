import { useNiubizScript } from "@/core/hooks/order/useNiubizScript";
import { useCreateOrderMutation } from "@/core/hooks/order/useOrder.hook";
import { paymentService } from "@/core/services/payment/payment.service";
import { orderService } from "@/core/services/order/order.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { useCartStore } from "@/core/stores/cart/cart.store";
import type { OrderRequest } from "@/core/types/order/order.model";
import { ChevronLeft, LockKeyhole, MapPin, Store, TriangleAlert } from "lucide-react";
import { Alert, Badge, Box, Group, Paper, SegmentedControl, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import type { ApiResponse } from "@/core/types/base/api-response";
import { useState } from "react";
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
import {
  PENDING_PAYMENT_KEY,
  createCheckoutSignature,
  getRetryablePayment,
  matchesLegacyPendingOrder,
  parsePendingCardPayment,
  type PendingCardPayment,
} from "./pendingPayment";

type OrderMode = "pickup" | "delivery";
type CatalogRef = { id: number; code: string };
type StoreRef = { id: number; name: string; address: string; latitude: number | null; longitude: number | null };
type PaymentRef = CatalogRef & { provider: string };

type CheckoutDraft = {
  orderMode: OrderMode;
  // "yape" se mantiene solamente para leer borradores antiguos.
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
  // Borradores antiguos con Yape deben entrar a Niubiz, no registrar un pago sin cobrar.
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">(
    draft?.paymentMethod === "yape" ? "card" : (draft?.paymentMethod || "cash")
  );

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
  });
  const pickupStore = checkoutConfig.data?.stores.find((store) => {
    const name = store.name.toLocaleLowerCase("es-PE");
    return name.includes("central") && (name.includes("barranco") || name.includes("lima"));
  }) || checkoutConfig.data?.stores[0];
  const deliveryStore = [...(checkoutConfig.data?.stores ?? [])]
    .filter((store) => Number.isFinite(store.latitude) && Number.isFinite(store.longitude))
    .sort((a, b) => a.id - b.id)[0];
  const deliveryTypeConfigured = Boolean(checkoutConfig.data?.types.some((type) => type.code === "DELIVERY"));
  const canQuoteDelivery = Boolean(deliveryStore && deliveryTypeConfigured);
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
  // La dirección puede seleccionarse como invitado. Google Maps se consulta
  // exclusivamente desde Spring Boot, después del login.
  const deliveryQuoteQuery = useQuery({
    queryKey: ["delivery-quote", user?.id ?? null, coordinates?.lat ?? null, coordinates?.lng ?? null],
    queryFn: async () => {
      if (!coordinates) throw new Error("Selecciona una ubicación.");
      const response = await api.get<ApiResponse<{ distanceKm: number; durationMinutes: number }>>(
        "/orders/delivery/quote",
        { params: { latitude: coordinates.lat, longitude: coordinates.lng } },
      );
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "No se pudo comprobar la cobertura.");
      }
      return response.data.data;
    },
    enabled: isClient && orderMode === "delivery" && Boolean(coordinates) && canQuoteDelivery,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const deliveryQuote = deliveryQuoteQuery.data ?? null;
  const isCheckingDelivery = deliveryQuoteQuery.isFetching;
  const deliveryReady = canQuoteDelivery && Boolean(coordinates && deliveryQuote) &&
    !isCheckingDelivery && !deliveryQuoteQuery.isError;

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
  const checkoutSignature = createCheckoutSignature(user?.id ?? null, orderMode, items, coordinates);
  const pendingCardPayment = paymentMethod === "card"
    ? getRetryablePayment(localStorage.getItem(PENDING_PAYMENT_KEY), checkoutSignature)
    : null;

  // El borrador se conserva en el estado de React Router durante la autenticación.
  const loginState = {
    from: "/checkout",
    checkoutDraft: {
      orderMode, paymentMethod, address, coordinates, references, phone, docType, docNumber,
    } satisfies CheckoutDraft,
  };

  // --- HANDLERS DEL MAPA ---
  const handleLocationSelect = (selectedAddress: string, lat: number, lng: number) => {
    setAddress(selectedAddress);
    setCoordinates({ lat, lng });
  };

  const handleConfirmMap = () => {
    if (!coordinates) {
      toast.error("Por favor selecciona una ubicación en el mapa");
      return;
    }
    // Marcar una ubicación no significa confirmar que haya cobertura:
    // permitimos cerrar el mapa y comprobamos la ruta antes de crear el pedido.
    setIsMapOpen(false);
  };

  // --- PROCESO PRINCIPAL DE ORDEN ---
  const handleProcessOrder = () => {
    if (isLoading) return;
    if (orderMode === "delivery" && (!address.trim() || !coordinates)) {
      return toast.error("Selecciona tu dirección en el mapa para recibir el pedido.");
    }
    if (isClient && orderMode === "delivery" && !canQuoteDelivery) {
      return toast.error("Delivery todavía no está habilitado: falta configurar la ubicación de la sucursal en Lima.");
    }
    if (isClient && orderMode === "delivery" && (!deliveryQuote || isCheckingDelivery)) {
      return toast.error("No se ha podido verificar la cobertura de tu dirección.");
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
    const payCode = "CASH";
    const paymentId = checkoutConfig.data.methods.find(
      (item) => item.code === payCode && item.provider === "INTERNAL"
    )?.id;
    if (!statusId || !typeId || (paymentMethod !== "card" && !paymentId)) {
      return toast.error("Faltan estados, tipos de pedido o métodos de pago en el servidor.");
    }
    if (orderMode === "pickup" && !pickupStore?.id) {
      return toast.error("No hay una sucursal configurada para recoger pedidos.");
    }

    // 2. Validación de Niubiz (tarjeta, Yape y otros medios habilitados)
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

    if (paymentMethod === "card") {
      const stored = localStorage.getItem(PENDING_PAYMENT_KEY);
      const pending = getRetryablePayment(stored, checkoutSignature);
      if (pending) {
        // El pedido ya existe en PostgreSQL: abrir otra sesión de pago, no crear otra orden.
        void startNiubizFlow(pending.orderId, pending.amount, checkoutSignature);
        return;
      }

      const legacyPending = parsePendingCardPayment(stored);
      if (legacyPending && !legacyPending.checkoutSignature) {
        // Los intentos anteriores a esta corrección no guardaban la firma.
        // Comprobar el pedido real antes de reutilizarlo para otro pago.
        void resumeLegacyPayment(legacyPending, checkoutSignature);
        return;
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
        city: "Lima",
        province: "Lima",
        // No fijar un código postal a Barranco cuando el domicilio puede
        // estar en otro distrito dentro de la cobertura.
        latitude: coordinates.lat,
        longitude: coordinates.lng,
        instructions: items[0]?.notes || "",
      } : undefined,
      // Si es pago online, NO enviamos el pago en la creación (lo confirma Niubiz después)
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
            const amount = Number(response.data.total);
            // Persistir la orden antes de contactar Niubiz: incluso si falla la
            // sesión o el usuario cierra el modal, no se duplica el pedido.
            localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({
              orderId,
              amount,
              purchaseNumber: String(orderId),
              checkoutSignature,
            }));
            void startNiubizFlow(orderId, amount, checkoutSignature);
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

  const resumeLegacyPayment = async (pending: PendingCardPayment, signature: string) => {
    setIsProcessingPayment(true);
    try {
      const response = await orderService.getOrderById(pending.orderId);
      if (!response.success || !matchesLegacyPendingOrder(response.data, items, orderMode, pending.amount)) {
        localStorage.removeItem(PENDING_PAYMENT_KEY);
        toast.info("El pedido anterior no coincide con tu carrito. Revisa Mis pedidos antes de generar uno nuevo.");
        return;
      }
      await startNiubizFlow(pending.orderId, pending.amount, signature);
    } catch (error) {
      console.error("No se pudo recuperar la orden pendiente:", error);
      toast.error("No se pudo comprobar el pedido pendiente. Consulta Mis pedidos antes de reintentar.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const startNiubizFlow = async (orderId: number, serverTotal: number, signature: string) => {
    setIsProcessingPayment(true);
    try {
      // El backend comprueba el importe, la titularidad y si el pedido ya está pagado.
      const response = await paymentService.startNiubizPayment({
        orderId,
        amount: serverTotal,
      });

      const { sessionKey, merchantId, purchaseNumber } = response.data;

      // PaymentValidate requiere estos datos cuando Niubiz devuelve el token.
      localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify({
        purchaseNumber,
        amount: Number(response.data.amount),
        orderId,
        checkoutSignature: signature,
      }));

      const config = {
        sessiontoken: sessionKey,
        channel: "web",
        merchantid: merchantId,
        purchasenumber: purchaseNumber,
        amount: Number(response.data.amount),
        expirationminutes: "5",
        timeouturl: window.location.origin + "/checkout",
        merchantlogo: "https://static-content.vnforapps.com/v2/img/logo-comercio-demo.png",
        merchantname: "Central Restaurante",
        action: BASE_URL.replace(/\/$/, "") + "/payments/niubiz/callback",
        complete: () => {
          // El backend redirige al validador; esta señal no confirma un pago.
          console.info("Niubiz completó su formulario; esperando validación.");
        },
      };

      if (!window.VisanetCheckout) {
        throw new Error("No está disponible el formulario de Niubiz.");
      }

      window.VisanetCheckout.configure(config);
      window.VisanetCheckout.open();
      // open() solo muestra el modal. No esperar indefinidamente una redirección:
      // cerrar con X tampoco dispara el callback de confirmación.
    } catch (error) {
      console.error("Error iniciando Niubiz:", error);
      toast.error("No se pudo abrir Niubiz. El pedido sigue pendiente y puedes reintentar.");
    } finally {
      // El modal gestiona su propia UI. Al cerrarlo, el botón vuelve a estar activo.
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
                    { value: "delivery", label: "Delivery" },
                  ]}
                  classNames={{
                    root: styles.modeRoot,
                    label: styles.modeLabel,
                    indicator: styles.modeIndicator,
                  }}
                />

                {orderMode === "delivery" && checkoutConfig.isPending && (
                  <Alert
                    mt="lg"
                    color="gray"
                    variant="light"
                    radius="md"
                    title="Consultando disponibilidad de delivery"
                  >
                    Estamos comprobando la configuración de reparto.
                  </Alert>
                )}
                {orderMode === "delivery" && checkoutConfig.isError && (
                  <Alert
                    mt="lg"
                    color="red"
                    variant="light"
                    radius="md"
                    title="No se pudo consultar la configuración"
                  >
                    Recarga la página para volver a comprobar la disponibilidad.
                  </Alert>
                )}
                {orderMode === "delivery" && checkoutConfig.isSuccess && !canQuoteDelivery && (
                  <Alert
                    mt="lg"
                    radius="md"
                    icon={<TriangleAlert size={19} />}
                    title="Delivery pendiente de habilitación"
                    styles={{
                      root: { background: "#302820", border: "1px solid #65503b" },
                      icon: { color: "#efc184" },
                      title: { color: "#ffe0ae", fontWeight: 800 },
                      message: { color: "#e3cfb7", lineHeight: 1.6 },
                    }}
                  >
                    {deliveryTypeConfigured
                      ? "Puedes indicar tu dirección, pero todavía falta guardar la ubicación de la sucursal de Lima para verificar la cobertura y confirmar el envío."
                      : "Puedes preparar tu dirección, pero el restaurante aún no tiene configurada la modalidad de delivery para confirmar pedidos."}
                  </Alert>
                )}
                {orderMode === "pickup" && (
                  <Alert
                    mt="lg"
                    radius="md"
                    icon={<MapPin size={19} />}
                    title="Punto de recogida"
                    styles={{
                      root: { background: "#29242a", border: "1px solid #453940" },
                      icon: { color: "#d6b178" },
                      title: { color: "#f1debd", fontWeight: 800 },
                      message: { color: "#c9bbc4", lineHeight: 1.6 },
                    }}
                  >
                    {pickupStore ? (
                      <Text size="sm" c="#c9bbc4">
                        <Text span fw={750} c="#fff">
                          {pickupStore.name.replace(/\s*\((?:pruebas?|tests?|demo)\)/gi, "").trim()}
                        </Text>
                        {pickupStore.address && !/prueba|test|demo|pendiente|fictici/i.test(pickupStore.address)
                          ? <> — {pickupStore.address}.</>
                          : "."}
                        {" "}Podrás consultar el estado de preparación en Mis pedidos.
                      </Text>
                    ) : (
                      <Text size="sm" c="#c9bbc4">
                        {isClient
                          ? "No hay una sede de recogida disponible en este momento."
                          : "Recoge tu pedido en el restaurante. Podrás consultar los datos de la sede al iniciar sesión."}
                      </Text>
                    )}
                  </Alert>
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
            {orderMode === "delivery" && !isClient && coordinates && (
              <Alert
                color="blue"
                radius="lg"
                title="Dirección guardada"
                styles={{
                  root: { background: "#202933", border: "1px solid #385066" },
                  title: { color: "#cee1f7" }, message: { color: "#c3d8ee" },
                }}
              >
                Comprobaremos la distancia y la cobertura cuando inicies sesión para confirmar el pedido.
              </Alert>
            )}
            {orderMode === "delivery" && isClient && deliveryQuoteQuery.isError && (
              <Alert
                color="red"
                radius="lg"
                title="No es posible enviar a esta dirección"
                styles={{
                  root: { background: "#362125", border: "1px solid #713b43" },
                  title: { color: "#ffb9c0" }, message: { color: "#ffc8cd" },
                }}
              >
                La ruta no se pudo verificar o está fuera del área de reparto.
                Prueba con otra ubicación dentro de la cobertura.
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
                (orderMode === "pickup" ? pickupConfigured : deliveryReady))
              )}
              disabledReason={orderMode === "delivery" && isClient
                ? !canQuoteDelivery
                  ? "Delivery pendiente de configuración"
                  : !coordinates
                    ? "Selecciona tu dirección para continuar"
                    : isCheckingDelivery
                      ? "Verificando cobertura..."
                      : !deliveryQuote
                        ? "Dirección sin cobertura verificada"
                        : null
                : null}
              items={items}
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              total={total}
              isLoading={isLoading}
              isUserLoggedIn={isClient}
              onRemoveItem={removeItem}
              onProcessOrder={handleProcessOrder}
              pendingCardOrderId={pendingCardPayment?.orderId ?? null}
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
