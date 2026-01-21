import { useState, useEffect, useRef, useCallback } from "react";

// Types for conduct sync
export interface SyncPresence {
  devices: Array<{ userId: string; deviceType: string; clientId: string }>;
  userCount: number;
  sameUserMultiDevice: boolean;
}

export type SyncStatus = "disconnected" | "connecting" | "connected" | "syncing" | "out-of-sync" | "error";

export interface ConductParticipant {
  id: string;
  name: string;
  nric?: string;
  situpReps: number;
  situpScore: number;
  pushupReps: number;
  pushupScore: number;
  runTime: string | number;
  runScore: number;
  totalScore: number;
  result: string;
  age?: number | string;
  matchedUser?: any;
}

interface SyncMessage {
  type: string;
  payload?: any;
}

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface UseConductSyncOptions {
  userId: string;
  conductId?: string;
  onParticipantAdd?: (participant: ConductParticipant) => void;
  onParticipantUpdate?: (index: number, participant: Partial<ConductParticipant>) => void;
  onParticipantRemove?: (index: number) => void;
  onParticipantsSync?: (participants: ConductParticipant[], fromDevice?: string) => void;
  onPresenceChange?: (presence: SyncPresence) => void;
  onReconnect?: () => void;
  onDeviceJoin?: (deviceType: string) => void;
  onDeviceLeave?: (deviceType: string) => void;
  onSyncRequested?: (fromDevice: string) => void;
}

export function useConductSync({
  userId,
  conductId,
  onParticipantAdd,
  onParticipantUpdate,
  onParticipantRemove,
  onParticipantsSync,
  onPresenceChange,
  onReconnect,
  onDeviceJoin,
  onDeviceLeave,
  onSyncRequested,
}: UseConductSyncOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [presence, setPresence] = useState<SyncPresence | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [lastSyncFromDevice, setLastSyncFromDevice] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const previousPresenceRef = useRef<SyncPresence | null>(null);

  // Detect device type
  const getDeviceType = useCallback((): "mobile" | "desktop" => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /iphone|ipad|ipod|android|blackberry|windows phone/i.test(userAgent);
    const isTablet = /(ipad|tablet|playbook|silk)|(android(?!.*mobile))/i.test(userAgent);
    return isMobile || isTablet ? "mobile" : "desktop";
  }, []);

  // Send message through WebSocket
  const sendMessage = useCallback((message: SyncMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Broadcast participant addition
  const broadcastParticipantAdd = useCallback((participant: ConductParticipant) => {
    sendMessage({ type: "participant_add", payload: { participant } });
  }, [sendMessage]);

  // Broadcast participant update
  const broadcastParticipantUpdate = useCallback((index: number, updates: Partial<ConductParticipant>) => {
    sendMessage({ type: "participant_update", payload: { index, updates } });
  }, [sendMessage]);

  // Broadcast participant removal
  const broadcastParticipantRemove = useCallback((index: number) => {
    sendMessage({ type: "participant_remove", payload: { index } });
  }, [sendMessage]);

  // Broadcast full participants list sync
  const broadcastParticipantsSync = useCallback((participants: ConductParticipant[]) => {
    const deviceType = getDeviceType();
    sendMessage({ type: "participants_sync", payload: { participants, fromDevice: deviceType } });
    setLastSyncTime(Date.now());
  }, [sendMessage, getDeviceType]);

  // Request sync from other devices
  const requestSync = useCallback(() => {
    sendMessage({ type: "request_sync" });
  }, [sendMessage]);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (!userId) return;
    
    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    setStatus("connecting");
    setError(null);

    const deviceType = getDeviceType();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/conduct-sync?userId=${encodeURIComponent(userId)}&deviceType=${deviceType}`;

    console.log("[ConductSync] Connecting to:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[ConductSync] Connected");
      setStatus("connected");
      
      // Check if this is a reconnection
      if (reconnectAttempts.current > 0) {
        setIsReconnecting(false);
        onReconnect?.();
      }
      reconnectAttempts.current = 0;

      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        sendMessage({ type: "heartbeat" });
      }, 25000);

      // Join conduct if conductId is set
      if (conductId) {
        sendMessage({ type: "join", payload: { conductId } });
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: SyncMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error("[ConductSync] Failed to parse message:", err);
      }
    };

    ws.onclose = (event) => {
      console.log("[ConductSync] Disconnected:", event.code, event.reason);
      setStatus("disconnected");
      cleanup();

      // Attempt reconnect if not intentionally closed
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        setIsReconnecting(true);
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        console.log(`[ConductSync] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = (err) => {
      console.error("[ConductSync] Error:", err);
      setStatus("error");
      setError("Connection error");
    };
  }, [userId, conductId, getDeviceType, sendMessage]);

  // Handle incoming messages
  const handleMessage = useCallback((message: SyncMessage) => {
    console.log("[ConductSync] Received:", message.type);

    switch (message.type) {
      case "connected":
        console.log("[ConductSync] Server confirmed connection:", message.payload);
        break;

      case "presence":
        // Detect device join/leave by comparing with previous presence
        const newPresence = message.payload as SyncPresence;
        const prevPresence = previousPresenceRef.current;
        
        if (prevPresence) {
          const prevDeviceIds = new Set(prevPresence.devices.map(d => d.clientId));
          const newDeviceIds = new Set(newPresence.devices.map(d => d.clientId));
          
          // Check for new devices (joins)
          newPresence.devices.forEach(d => {
            if (!prevDeviceIds.has(d.clientId) && d.userId === userId) {
              onDeviceJoin?.(d.deviceType);
            }
          });
          
          // Check for removed devices (leaves)
          prevPresence.devices.forEach(d => {
            if (!newDeviceIds.has(d.clientId) && d.userId === userId) {
              onDeviceLeave?.(d.deviceType);
            }
          });
        }
        
        previousPresenceRef.current = newPresence;
        setPresence(newPresence);
        onPresenceChange?.(newPresence);
        break;

      case "participant_add":
        onParticipantAdd?.(message.payload.participant);
        break;

      case "participant_update":
        onParticipantUpdate?.(message.payload.index, message.payload.updates);
        break;

      case "participant_remove":
        onParticipantRemove?.(message.payload.index);
        break;

      case "participants_sync":
        const fromDevice = message.payload.fromDevice || "unknown";
        setLastSyncTime(Date.now());
        setLastSyncFromDevice(fromDevice);
        onParticipantsSync?.(message.payload.participants, fromDevice);
        break;

      case "request_sync":
        // Another device is requesting sync - trigger callback so component can respond
        console.log("[ConductSync] Sync requested by:", message.payload?.fromDevice);
        onSyncRequested?.(message.payload?.fromDevice || "unknown");
        break;

      case "heartbeat":
        // Server acknowledged heartbeat
        break;

      case "error":
        console.error("[ConductSync] Server error:", message.payload);
        setError(message.payload?.message || "Unknown error");
        break;

      default:
        console.log("[ConductSync] Unknown message type:", message.type);
    }
  }, [userId, onPresenceChange, onParticipantAdd, onParticipantUpdate, onParticipantRemove, onParticipantsSync, onDeviceJoin, onDeviceLeave, onSyncRequested]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    cleanup();
    reconnectAttempts.current = maxReconnectAttempts; // Prevent reconnect
    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }
    setStatus("disconnected");
    setPresence(null);
  }, [cleanup]);

  // Join a conduct session
  const joinConduct = useCallback((newConductId: string) => {
    sendMessage({ type: "join", payload: { conductId: newConductId } });
  }, [sendMessage]);

  // Leave current conduct session
  const leaveConduct = useCallback(() => {
    sendMessage({ type: "leave" });
    setPresence(null);
  }, [sendMessage]);

  // Effect to connect when userId changes
  useEffect(() => {
    if (userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [userId]);

  // Effect to join conduct when conductId changes
  useEffect(() => {
    if (status === "connected" && conductId) {
      joinConduct(conductId);
    }
  }, [status, conductId, joinConduct]);

  return {
    status,
    presence,
    error,
    isConnected: status === "connected",
    isSyncing: presence?.sameUserMultiDevice ?? false,
    isReconnecting,
    lastSyncTime,
    lastSyncFromDevice,
    otherDevices: presence?.devices.filter(d => d.userId === userId) ?? [],
    deviceType: getDeviceType(),
    connect,
    disconnect,
    joinConduct,
    leaveConduct,
    broadcastParticipantAdd,
    broadcastParticipantUpdate,
    broadcastParticipantRemove,
    broadcastParticipantsSync,
    requestSync,
  };
}
