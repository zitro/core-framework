"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface RealtimeMessage {
  type: string;
  [key: string]: unknown;
}

interface UseRealtimeOptions {
  discoveryId: string | null;
  onMessage?: (msg: RealtimeMessage) => void;
}

export function useRealtime({ discoveryId, onMessage }: UseRealtimeOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [activeUsers, setActiveUsers] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!discoveryId) return;

    const ws = new WebSocket(`${WS_URL}/ws/${discoveryId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setActiveUsers(0);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeMessage;
        if (data.type === "presence") {
          setActiveUsers(data.active_users as number);
        }
        onMessage?.(data);
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [discoveryId, onMessage]);

  const send = useCallback((message: RealtimeMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { send, activeUsers, connected };
}
