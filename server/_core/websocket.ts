import { Server as SocketServer } from "socket.io";
import type { Server as HTTPServer } from "http";

let io: SocketServer | null = null;

export function initWebSocket(httpServer: HTTPServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("[WebSocket] Client connected:", socket.id);

    // Unirse a sala de notificaciones globales
    socket.join("global");

    // Unirse a sala de admin para alertas
    socket.on("join:admin", () => {
      socket.join("admin");
      console.log("[WebSocket] Client joined admin room:", socket.id);
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Client disconnected:", socket.id);
    });
  });

  console.log("[WebSocket] Server initialized");
  return io;
}

export function getIO() {
  return io;
}

// Funciones para emitir eventos
export function emitOrderUpdate(orderId: number, status: string) {
  if (!io) return;
  io.to("global").to("admin").emit("order:updated", { orderId, status });
}

export function emitInventoryAlert(productId: number, productName: string, currentStock: number) {
  if (!io) return;
  io.to("admin").emit("inventory:low", { productId, productName, currentStock });
}

export function emitDeliveryLocation(deliveryPersonId: number, orderId: number, lat: number, lng: number) {
  if (!io) return;
  io.to("admin").emit("delivery:location", { deliveryPersonId, orderId, lat, lng });
}

export function emitNewOrder(order: any) {
  if (!io) return;
  io.to("admin").emit("order:new", order);
}

export function emitSaleCreated(sale: any) {
  if (!io) return;
  io.to("admin").emit("sale:new", sale);
}