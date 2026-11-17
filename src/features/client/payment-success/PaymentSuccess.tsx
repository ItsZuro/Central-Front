import { CheckCircle, ShoppingBag, Clock } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type CompletionState = {
  orderId?: number;
  paymentStatus?: "PENDING" | "CONFIRMED";
};

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const completion = state as CompletionState | null;
  const paid = completion?.paymentStatus === "CONFIRMED";
  const recorded = paid || completion?.paymentStatus === "PENDING";

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-800 rounded-2xl p-8 text-center shadow-2xl border border-neutral-700">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          {recorded ? (paid ? <CheckCircle className="w-10 h-10 text-green-500" /> : <Clock className="w-10 h-10 text-amber-400" />) : <ShoppingBag className="w-10 h-10 text-gray-400" />}
        </div>
        <h1 className="text-3xl font-bold mb-2">
          {!recorded ? "Consulta tus pedidos" : paid ? "¡Pago confirmado!" : "¡Pedido registrado!"}
        </h1>
        <p className="text-gray-400 mb-8">
          {!recorded
            ? "No hay una confirmación de pago disponible en esta pantalla. Consulta el estado de tus pedidos."
            : paid
              ? "La transacción fue confirmada por el servidor. Tu pedido está registrado."
              : "Tu pedido fue registrado. El pago sigue pendiente y se realizará al recibirlo."}
        </p>
        {recorded && completion?.orderId != null && (
          <p className="mb-5 text-sm text-gray-300">Pedido #{completion.orderId}</p>
        )}
        <div className="space-y-4">
          <Link to="/my-orders" className="block w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors">
            Ver mis pedidos
          </Link>
          <button onClick={() => navigate("/")} className="block w-full py-3 px-4 bg-transparent border border-neutral-600 hover:bg-neutral-700 text-white rounded-lg font-medium transition-colors flex justify-center items-center gap-2">
            <ShoppingBag size={20} /> Ir al Inicio
          </button>
        </div>
      </div>
    </div>
  );
}
