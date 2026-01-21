import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { randomUUID } from "crypto";

// Types for conduct sync
interface ConductClient {
  id: string;
  ws: WebSocket;
  userId: string;
  conductId: string | null;
  deviceType: "mobile" | "desktop";
  lastHeartbeat: number;
}

interface ConductParticipant {
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
  type:
    | "join"
    | "leave"
    | "presence"
    | "participant_add"
    | "participant_update"
    | "participant_remove"
    | "participants_sync"
    | "request_sync"
    | "heartbeat"
    | "error";
  payload?: any;
}

// Store connected clients by conductId
const conductSessions = new Map<string, Set<ConductClient>>();
// Store all clients by their connection id
const allClients = new Map<string, ConductClient>();

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 60000;

export function setupConductSync(server: Server): WebSocketServer {
  // Use noServer mode to avoid conflicting with Vite's HMR WebSocket
  const wss = new WebSocketServer({ noServer: true });

  // Handle upgrade requests only for our specific path
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    
    if (pathname === "/ws/conduct-sync") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
    // Let other WebSocket upgrades (like Vite HMR) pass through
  });

  // Heartbeat checker
  setInterval(() => {
    const now = Date.now();
    allClients.forEach((client, id) => {
      if (now - client.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        console.log(`[ConductSync] Client ${id} timed out, disconnecting`);
        client.ws.terminate();
        removeClient(id);
      }
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("connection", (ws: WebSocket, req) => {
    const clientId = randomUUID();
    console.log(`[ConductSync] New connection: ${clientId}`);

    // Parse user info from query string (passed from frontend)
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const userId = url.searchParams.get("userId") || "";
    const deviceType = (url.searchParams.get("deviceType") as "mobile" | "desktop") || "desktop";

    if (!userId) {
      ws.send(JSON.stringify({ type: "error", payload: { message: "userId required" } }));
      ws.close();
      return;
    }

    const client: ConductClient = {
      id: clientId,
      ws,
      userId,
      conductId: null,
      deviceType,
      lastHeartbeat: Date.now(),
    };

    allClients.set(clientId, client);

    // Send connection confirmation
    ws.send(
      JSON.stringify({
        type: "connected",
        payload: { clientId, userId, deviceType },
      })
    );

    ws.on("message", (data) => {
      try {
        const message: SyncMessage = JSON.parse(data.toString());
        handleMessage(client, message);
      } catch (err) {
        console.error("[ConductSync] Invalid message:", err);
      }
    });

    ws.on("close", () => {
      console.log(`[ConductSync] Connection closed: ${clientId}`);
      removeClient(clientId);
    });

    ws.on("error", (err) => {
      console.error(`[ConductSync] WebSocket error for ${clientId}:`, err);
      removeClient(clientId);
    });
  });

  console.log("[ConductSync] WebSocket server initialized on /ws/conduct-sync");
  return wss;
}

function handleMessage(client: ConductClient, message: SyncMessage) {
  client.lastHeartbeat = Date.now();

  switch (message.type) {
    case "join":
      handleJoin(client, message.payload);
      break;
    case "leave":
      handleLeave(client);
      break;
    case "participant_add":
      broadcastToConduct(client.conductId, message, client.id);
      break;
    case "participant_update":
      broadcastToConduct(client.conductId, message, client.id);
      break;
    case "participant_remove":
      broadcastToConduct(client.conductId, message, client.id);
      break;
    case "participants_sync":
      broadcastToConduct(client.conductId, message, client.id);
      break;
    case "request_sync":
      // Broadcast sync request to other devices in the same conduct
      broadcastToConduct(client.conductId, { type: "request_sync", payload: { fromDevice: client.deviceType } }, client.id);
      break;
    case "heartbeat":
      client.ws.send(JSON.stringify({ type: "heartbeat", payload: { timestamp: Date.now() } }));
      break;
    default:
      console.log(`[ConductSync] Unknown message type: ${message.type}`);
  }
}

function handleJoin(client: ConductClient, payload: { conductId: string }) {
  const { conductId } = payload;

  // Leave previous conduct if any
  if (client.conductId) {
    handleLeave(client);
  }

  client.conductId = conductId;

  // Add to conduct session
  if (!conductSessions.has(conductId)) {
    conductSessions.set(conductId, new Set());
  }
  conductSessions.get(conductId)!.add(client);

  console.log(
    `[ConductSync] User ${client.userId} (${client.deviceType}) joined conduct ${conductId}`
  );

  // Get presence info for this conduct
  const presence = getPresenceInfo(conductId);

  // Notify the joining client about other connected devices
  client.ws.send(
    JSON.stringify({
      type: "presence",
      payload: presence,
    })
  );

  // Notify other clients in the same conduct about the new device
  broadcastToConduct(
    conductId,
    {
      type: "presence",
      payload: presence,
    },
    client.id
  );
}

function handleLeave(client: ConductClient) {
  if (!client.conductId) return;

  const conductId = client.conductId;
  const session = conductSessions.get(conductId);

  if (session) {
    session.delete(client);

    // Notify remaining clients
    const presence = getPresenceInfo(conductId);
    broadcastToConduct(conductId, { type: "presence", payload: presence });

    // Clean up empty sessions
    if (session.size === 0) {
      conductSessions.delete(conductId);
    }
  }

  client.conductId = null;
  console.log(`[ConductSync] User ${client.userId} left conduct ${conductId}`);
}

function removeClient(clientId: string) {
  const client = allClients.get(clientId);
  if (client) {
    handleLeave(client);
    allClients.delete(clientId);
  }
}

function getPresenceInfo(conductId: string) {
  const session = conductSessions.get(conductId);
  if (!session) return { devices: [], userCount: 0 };

  const devices: Array<{ userId: string; deviceType: string; clientId: string }> = [];
  const userIds = new Set<string>();

  session.forEach((client) => {
    devices.push({
      userId: client.userId,
      deviceType: client.deviceType,
      clientId: client.id,
    });
    userIds.add(client.userId);
  });

  return {
    devices,
    userCount: userIds.size,
    // Check if same user has multiple devices
    sameUserMultiDevice: devices.filter((d) => d.userId === devices[0]?.userId).length > 1,
  };
}

function broadcastToConduct(
  conductId: string | null,
  message: SyncMessage,
  excludeClientId?: string
) {
  if (!conductId) return;

  const session = conductSessions.get(conductId);
  if (!session) return;

  const messageStr = JSON.stringify(message);

  session.forEach((client) => {
    if (client.id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

// Export for external use (e.g., when saving participants via REST API)
export function notifyConductUpdate(
  conductId: string,
  type: SyncMessage["type"],
  payload: any
) {
  broadcastToConduct(conductId, { type, payload });
}
