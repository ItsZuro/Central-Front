import { describe, expect, it } from "vitest";
import { getWebSocketUrl } from "./useOrderEvents";

describe("WebSocket endpoint", () => {
  it("uses the backend CloudFront domain and secure WebSockets", () => {
    expect(getWebSocketUrl("https://api.example.com/api/v1/"))
      .toBe("wss://api.example.com/ws-native");
  });

  it("uses ws on local development backend", () => {
    expect(getWebSocketUrl("http://localhost:8080/api/v1/"))
      .toBe("ws://localhost:8080/ws-native");
  });
});
