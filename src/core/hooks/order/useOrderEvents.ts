import { BASE_URL } from "@/core/api/api";
import { useAuthStore } from "@/core/stores/auth/auth.store";
import { useEffect, useRef } from "react";

/**
 * Build the WebSocket endpoint from the same CloudFront API host.
 * No JWT appears in the URL: authentication happens in STOMP CONNECT.
 */
export function getWebSocketUrl(apiBase: string): string {
  const url = new URL(apiBase, window.location.origin);
  url.pathname = url.pathname.replace(/\/api\/v1\/?$/, "") + "/ws-native";
  url.search = "";
  url.hash = "";
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

/**
 * Small STOMP 1.2 client for one subscribe-only channel.
 * The REST queries still poll every 15 seconds if the socket is unavailable.
 */
export function useOrderEvents(onOrdersChanged: () => void): void {
  const token = useAuthStore((state) => state.accessToken);
  const onChangedRef = useRef(onOrdersChanged);
  onChangedRef.current = onOrdersChanged;

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | null = null;
    let retryMs = 2000;
    let buffer = "";
    const endpoint = getWebSocketUrl(BASE_URL);

    const reconnect = () => {
      if (disposed) return;
      retryTimer = window.setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, 15000);
    };

    const connect = () => {
      if (disposed) return;
      let current: WebSocket;
      try {
        current = new WebSocket(endpoint);
      } catch {
        reconnect();
        return;
      }
      socket = current;
      buffer = "";

      current.onopen = () => {
        const host = new URL(endpoint).host;
        current.send(
          `CONNECT\naccept-version:1.2\nhost:${host}\nheart-beat:0,0\nAuthorization:Bearer ${token}\n\n\0`
        );
      };

      current.onmessage = (event: MessageEvent<string>) => {
        if (typeof event.data !== "string") return;
        buffer += event.data;
        let end: number;
        while ((end = buffer.indexOf("\0")) !== -1) {
          const frame = buffer.slice(0, end).replace(/^\n+/, "");
          buffer = buffer.slice(end + 1);
          const command = frame.split("\n", 1)[0].trim();
          if (command === "CONNECTED") {
            retryMs = 2000;
            current.send("SUBSCRIBE\nid:central-orders\ndestination:/topic/orders\nack:auto\n\n\0");
            // Refresh immediately after reconnect: NOTIFY is not a durable queue.
            onChangedRef.current();
          } else if (command === "MESSAGE") {
            const separator = frame.indexOf("\n\n");
            if (separator === -1) continue;
            try {
              const payload: unknown = JSON.parse(frame.slice(separator + 2));
              if (
                typeof payload === "object" &&
                payload !== null &&
                "event" in payload &&
                payload.event === "ORDERS_CHANGED"
              ) {
                onChangedRef.current();
              }
            } catch {
              // Keep the previous REST data if a message is malformed.
            }
          } else if (command === "ERROR") {
            current.close();
          }
        }
        if (buffer.length > 65536) buffer = "";
      };

      current.onerror = () => current.close();
      current.onclose = () => {
        if (socket === current) socket = null;
        reconnect();
      };
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [token]);
}
