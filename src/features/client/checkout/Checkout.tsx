import { useNiubizScript } from "@/core/hooks/order/useNiubizScript";
import { useCreateOrderMutation } from "@/core/hooks/order/useOrder.hook";
import { paymentService } from "@/core/services/payment/payment.service";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { useCartStore } from "@/core/stores/cart/cart.store";
import type { OrderRequest } from "@/core/types/order/order.model";
import { ChevronLeft, MapPin, Store, Truck } from "lucide-react";
import { Alert, Box, Group, SegmentedControl, Text } from "@mantine/core";
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
    <section className="min-h-screen bg-neutral-900 text-white pt-24 pb-12 px-4 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/menu"
            className="p-2 bg-neutral-800 rounded-full hover:bg-neutral-700 transition-colors"
          >
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-3xl font-bold">Finalizar Pedido</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* COLUMNA IZQUIERDA: Formularios o Login */}
          <div className="lg:col-span-2 space-y-8">
            {!user ? (
              <LoginPrompt />
            ) : (
              <>
                <Box
                  p="lg"
                  style={{ backgroundColor: "#26272e", border: "1px solid #41424a", borderRadius: 16 }}
                >
                  <Group gap="sm" mb="sm">
                    <Store size={20} color="#fb7185" />
                    <Text c="white" fw={800}>¿Cómo recibirás el pedido?</Text>
                  </Group>
                  <SegmentedControl
                    fullWidth
                    size="md"
                    radius="md"
                    value={orderMode}
                    onChange={(value) => setOrderMode(value as OrderMode)}
                    data={[
                      { value: "pickup", label: "Recoger en tienda" },
                      { value: "delivery", label: "Delivery", disabled: !canQuoteDelivery },
                    ]}
                    styles={{
                      root: { backgroundColor: "#14151a", padding: 5 },
                      label: { fontWeight: 750 },
                      indicator: { backgroundColor: "#e83b48" },
                    }}
                  />
                  {orderMode === "pickup" && (
                    <Alert color={pickupConfigured ? "blue" : "yellow"} mt="lg" icon={<MapPin size={19} />}
                      title={pickupConfigured ? "Punto de recogida de pruebas" : "Configurando punto de recogida"}>
                      {pickupStore ? (
                        <Text size="sm">
                          <strong>{pickupStore.name}</strong> — {pickupStore.address}. Para esta demostración
                          la dirección exacta sigue pendiente; no acudas a ella para recoger pedidos.
                        </Text>
                      ) : (
                        <Text size="sm">No encontramos la sucursal. Verifica que esté registrada en PostgreSQL.</Text>
                      )}
                    </Alert>
                  )}
                  {!canQuoteDelivery && (
                    <Group gap="xs" mt="sm">
                      <Truck size={15} color="#a9aab4" />
                      <Text c="#a9aab4" size="xs">
                        Delivery se habilitará cuando una sucursal tenga coordenadas reales.
                      </Text>
                    </Group>
                  )}
                </Box>
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
                {orderMode === "delivery" && isCheckingDelivery && <p className="text-amber-400 text-sm">Verificando ruta y cobertura de delivery...</p>}
                {orderMode === "delivery" && deliveryQuote && (
                  <p className="text-green-400 text-sm">
                    Reparto disponible: {deliveryQuote.distanceKm.toFixed(2)} km de ruta, aproximadamente {deliveryQuote.durationMinutes} min de traslado (sin contar preparación).
                  </p>
                )}
                <PaymentSelector
                  selectedMethod={paymentMethod}
                  onSelect={setPaymentMethod}
                  pickupMode={orderMode === "pickup"}
                />

                {/* Avisos de estado de la pasarela (Solo tarjeta) */}
                {paymentMethod === "card" && (
                  <div className="fade-in transition-opacity duration-500">
                    {!isScriptLoaded && !scriptError && (
                      <p className="text-yellow-500 text-sm mt-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                        Conectando con servicios de seguridad...
                      </p>
                    )}
                    {scriptError && (
                      <p className="text-red-400 text-sm mt-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
                        ⚠️ No se pudo cargar el sistema de pagos. Es posible que
                        un bloqueador de anuncios (AdBlock) esté interfiriendo.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* COLUMNA DERECHA: Resumen */}
          <div className="lg:col-span-1">
            <OrderSummary
              pickupMode={orderMode === "pickup"}
              isCheckoutReady={Boolean(
                !checkoutConfig.isLoading && !checkoutConfig.isError &&
                (orderMode === "pickup" ? pickupConfigured : canQuoteDelivery)
              )}
              items={items}
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              total={total}
              isLoading={isLoading}
              isUserLoggedIn={!!user}
              onRemoveItem={removeItem}
              onProcessOrder={handleProcessOrder}
            />
          </div>
        </div>
      </div>

      {/* Modal Flotante del Mapa */}
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
