import type { CartItemDraft } from "@/core/stores/cart/cart.store";
import type { ProductResponse } from "@/core/types/products/products.model";
import { Minus, Plus, X, Star } from "lucide-react";
import { api } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import type { ApiResponse } from "@/core/types/base/api-response";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface ProductDrawerProps {
  dish: ProductResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (item: CartItemDraft) => void;
}
export default function ProductDrawer({
  dish,
  isOpen,
  onClose,
  onAddToCart,
}: ProductDrawerProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedExtraIds, setSelectedExtraIds] = useState<number[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [isVisible, setIsVisible] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isClient = Boolean(user?.roles?.includes("ROLE_CLIENT"));
  const [reviews, setReviews] = useState<Array<{ id: number; customerName: string; comment: string; rating: number }>>([]);
  const [reviewError, setReviewError] = useState("");
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewEligibility, setReviewEligibility] = useState<"checking" | "eligible" | "ineligible" | "error">("checking");
  const [reviewRefresh, setReviewRefresh] = useState(0);
  useEffect(() => {
    if (!isOpen || !dish) return;
    let active = true;
    api.get<ApiResponse<typeof reviews>>(`/reviews/product/${dish.id}`)
      .then(({ data }) => { if (active) setReviews(data.data || []); })
      .catch(() => { if (active) setReviewError("No se pudieron cargar las reseñas."); });
    return () => { active = false; };
  }, [dish, isOpen, reviewRefresh]);

  useEffect(() => {
    if (!isOpen || !dish || !isClient) return;
    let active = true;
    setReviewEligibility("checking");
    api.get<ApiResponse<boolean>>(`reviews/product/${dish.id}/eligibility`)
      .then(({ data }) => { if (active) setReviewEligibility(data.data ? "eligible" : "ineligible"); })
      .catch(() => { if (active) setReviewEligibility("error"); });
    return () => { active = false; };
  }, [dish, isOpen, isClient, reviewRefresh]);

  async function submitReview() {
    if (!dish || !isClient || reviewEligibility !== "eligible") return;
    setSubmittingReview(true);
    setReviewError("");
    try {
      await api.post("/reviews", {
        productId: dish.id,
        rating,
        comment: reviewText.trim(),
      });
      setReviewText("");
      setReviewRefresh((value) => value + 1);
      toast.success("Gracias por compartir tu calificación.");
    } catch {
      setReviewError("No se pudo publicar. Comprueba que el pedido esté completado o entregado y que no hayas reseñado antes.");
    } finally {
      setSubmittingReview(false);
    }
  }


  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setQuantity(1);
      setSelectedExtraIds([]);
      setNotes("");
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isVisible && !isOpen) return null;
  if (!dish) return null;

  const toggleExtra = (extraId: number) => {
    setSelectedExtraIds((prev) =>
      prev.includes(extraId)
        ? prev.filter((id) => id !== extraId)
        : [...prev, extraId]
    );
  };

  const calculateTotal = () => {
    const basePrice = Number(dish.price);

    const extrasTotal = selectedExtraIds.reduce((total, id) => {
      const extra = dish.extras?.find((e) => e.id === id);
      return total + (extra ? Number(extra.price) : 0);
    }, 0);

    return Number(((basePrice + extrasTotal) * quantity).toFixed(2));
  };

  const totalPrice = calculateTotal();

  const handleAddToCart = () => {
    const cartItem = {
      product: dish,
      quantity,
      selectedExtras:
        dish.extras?.filter((e) => selectedExtraIds.includes(e.id)) || [],
      notes,
      // El carrito almacena precio UNITARIO; la cantidad se aplica una sola vez.
      finalPrice: Number((totalPrice / quantity).toFixed(2)),
    };

    console.log("Item para el carrito:", cartItem); 

    if (onAddToCart) onAddToCart(cartItem);

    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        className={`relative w-full max-w-md h-full bg-neutral-900 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out border-l border-neutral-800 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative h-64 shrink-0">
          <img
            src={dish.imageUrl || "https://via.placeholder.com/400x300"}
            alt={dish.name}
            className="w-full h-full object-cover mask-image-gradient"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-black/40"></div>

          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-black/50 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-md transition-all duration-200 shadow-lg group"
            aria-label="Cerrar"
          >
            <div className="group-hover:rotate-90 transition-transform duration-200">
              <X />
            </div>
          </button>

          <div className="absolute bottom-4 left-6 right-6">
            <span className="inline-block px-2 py-1 mb-2 text-xs font-bold text-white bg-red-600 rounded uppercase tracking-wider">
              {dish.categoryName || "Especial"}
            </span>
            <h2 className="text-3xl font-extrabold text-white leading-tight drop-shadow-md">
              {dish.name}
            </h2>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div>
            <p className="text-gray-300 text-base leading-relaxed">
              {dish.description || "Descripción no disponible."}
            </p>
            <div className="mt-3 flex items-center gap-2 text-amber-500 font-semibold">
              <span>⏱ {dish.preparationTimeMinutes || 15} min</span>
              <span>•</span>
              <span className="text-gray-400 font-normal">
                Precio base: S/ {dish.price}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
              Cantidad
            </label>
            <div className="flex items-center justify-between bg-neutral-800 rounded-xl p-2 border border-neutral-700">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 flex items-center justify-center bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors"
              >
                <Minus />
              </button>
              <span className="text-2xl font-bold text-white">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 flex items-center justify-center bg-neutral-700 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <Plus />
              </button>
            </div>
          </div>

          {dish.extras && dish.extras.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
                Adicionales
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dish.extras.map((extra) => {
                  const isSelected = selectedExtraIds.includes(extra.id);
                  return (
                    <button
                      key={extra.id}
                      onClick={() => toggleExtra(extra.id)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium border transition-all duration-200 flex items-center justify-between group ${
                        isSelected
                          ? "bg-red-600/10 border-red-600 text-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]"
                          : "bg-neutral-800 border-neutral-700 text-gray-400 hover:border-gray-500 hover:bg-neutral-700"
                      }`}
                    >
                      <div className="flex flex-col items-start">
                        <span>{extra.name}</span>
                        <span className="text-xs opacity-70 font-normal">
                          + S/ {Number(extra.price).toFixed(2)}
                        </span>
                      </div>

                      {isSelected ? (
                        <span className="text-red-500 font-bold bg-red-600/20 p-1 rounded-full">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                      ) : (
                        <span className="w-5 h-5 rounded-full border border-gray-600 group-hover:border-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <section className="rounded-xl border border-neutral-700 bg-neutral-800 p-4 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2"><Star size={18} /> Reseñas del producto</h3>
            {reviews.length === 0 && <p className="text-sm text-neutral-400">Todavía no hay reseñas.</p>}
            {reviews.map((review) => (
              <div key={review.id} className="border-t border-neutral-700 pt-3 text-sm">
                <p className="font-medium text-white">{review.customerName || "Cliente"} · {"★".repeat(review.rating)}</p>
                {review.comment && <p className="mt-1 text-neutral-300 whitespace-pre-wrap">{review.comment}</p>}
              </div>
            ))}
            {isClient && (
              <div className="border-t border-neutral-700 pt-4 space-y-4">
                {reviewEligibility === "checking" && <p className="text-sm text-neutral-400">Verificando si puedes calificar este producto…</p>}
                {reviewEligibility === "ineligible" && (
                  <div className="rounded-lg border border-neutral-600 bg-neutral-900/50 p-3 text-sm text-neutral-300">
                    Puedes dejar una reseña de forma opcional después de comprar este plato y recibir tu pedido. Cada cliente puede calificar un producto una vez.
                  </div>
                )}
                {reviewEligibility === "error" && (
                  <p role="alert" className="text-sm text-amber-400">No pudimos verificar la compra. Inténtalo nuevamente al abrir este producto.</p>
                )}
                {reviewEligibility === "eligible" && (
                  <>
                    <div>
                      <p className="mb-2 text-sm font-medium text-neutral-200">¿Qué te pareció este plato?</p>
                      <div className="flex items-center gap-2" role="group" aria-label="Calificación de 1 a 5 estrellas">
                        {[1,2,3,4,5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            title={value + " estrella(s)"}
                            aria-label={value + " estrella(s)"}
                            aria-pressed={rating === value}
                            onClick={() => setRating(value)}
                            className="rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
                          >
                            <Star size={27} className={value <= rating ? "fill-amber-400 text-amber-400" : "text-neutral-500 hover:text-amber-300"} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <label htmlFor="review-comment" className="block text-sm text-neutral-300">
                      Comentario (opcional)
                    </label>
                    <textarea
                      id="review-comment"
                      maxLength={2000}
                      value={reviewText}
                      onChange={(event) => setReviewText(event.target.value)}
                      placeholder="Cuéntanos tu experiencia con este plato"
                      rows={3}
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-900 p-3 text-white outline-none focus:border-red-500"
                    />
                    <button type="button" disabled={submittingReview} onClick={() => void submitReview()}
                      className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                      {submittingReview ? "Publicando…" : "Publicar reseña"}
                    </button>
                  </>
                )}
              </div>
            )}
            {reviewError && <p role="alert" className="text-sm text-red-400">{reviewError}</p>}
          </section>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
              Instrucciones Especiales
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Sin cebolla, salsas aparte..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all resize-none h-24"
            />
          </div>
        </div>

        <div className="p-6 bg-neutral-900 border-t border-neutral-800 sticky bottom-0 z-10 pb-8 sm:pb-6">
          <button
            onClick={handleAddToCart}
            className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-red-900/40 hover:bg-red-700 hover:shadow-red-900/60 transition-all transform active:scale-[0.98] flex justify-between items-center px-6"
          >
            <span>Agregar al Pedido</span>
            <span className="bg-black/20 px-3 py-1 rounded-lg tabular-nums">
              S/ {totalPrice}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
