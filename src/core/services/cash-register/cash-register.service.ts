import { api } from "@/core/api/api";
import type { ApiResponse } from "@/core/types/base/api-response";

export type CashEntry = {
  id: number;
  orderId: number | null;
  type: "SALE" | "CASH_IN" | "CASH_OUT";
  methodCode: string;
  amount: number;
  reference: string | null;
  description: string | null;
  at: string;
};

export type CashShift = {
  id: number;
  cashierUserId: number;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  closingNote: string | null;
  salesByMethod: Record<string, number>;
  cashIn: number;
  cashOut: number;
  salesCount: number;
  entries: CashEntry[];
};

export type PaymentMethod = {
  id: number;
  code: string;
  name: string | null;
  provider: string;
};

export const cashRegisterService = {
  async current(): Promise<CashShift | null> {
    const response = await api.get<ApiResponse<CashShift | null>>("/cash-register/current");
    if (!response.data.success) throw new Error(response.data.message);
    return response.data.data;
  },
  async history(): Promise<CashShift[]> {
    const response = await api.get<ApiResponse<CashShift[]>>("/cash-register/history");
    if (!response.data.success) throw new Error(response.data.message);
    return response.data.data || [];
  },
  async methods(): Promise<PaymentMethod[]> {
    const response = await api.get<ApiResponse<PaymentMethod[]>>("/payment-methods", { params: { lang: "es" } });
    if (!response.data.success) throw new Error(response.data.message);
    return response.data.data || [];
  },
  async open(openingCash: number): Promise<CashShift> {
    const response = await api.post<ApiResponse<CashShift>>("/cash-register/open", { openingCash });
    if (!response.data.success) throw new Error(response.data.message);
    return response.data.data;
  },
  async move(type: "CASH_IN" | "CASH_OUT", amount: number, reason: string): Promise<CashShift> {
    const response = await api.post<ApiResponse<CashShift>>("/cash-register/movement", {
      type, amount, reason,
    });
    if (!response.data.success) throw new Error(response.data.message);
    return response.data.data;
  },
  async collect(orderId: number, paymentMethodId: number, reference?: string): Promise<CashShift> {
    const response = await api.post<ApiResponse<CashShift>>(
      "/cash-register/orders/" + orderId + "/collect", { paymentMethodId, reference: reference || null }
    );
    if (!response.data.success) throw new Error(response.data.message);
    return response.data.data;
  },
  async close(countedCash: number, note: string): Promise<CashShift> {
    const response = await api.post<ApiResponse<CashShift>>("/cash-register/close", { countedCash, note });
    if (!response.data.success) throw new Error(response.data.message);
    return response.data.data;
  },
};
