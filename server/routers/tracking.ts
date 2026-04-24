import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createGPSTracking,
  getLatestGPSTracking,
  getGPSTrackingHistory,
  getAllOrders,
} from "../db";
import { TRPCError } from "@trpc/server";

export const trackingRouter = router({
  // Actualizar ubicación GPS del repartidor
  updateLocation: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        latitude: z.string(),
        longitude: z.string(),
        accuracy: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "user") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Verificar que el repartidor está asignado a este pedido
      const allOrders = await getAllOrders();
      const order = allOrders.find((o) => o.id === input.orderId);

      if (!order || order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await createGPSTracking({
        orderId: input.orderId,
        deliveryPersonId: ctx.user.id,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
      });

      return { success: true };
    }),

  // Obtener ubicación actual del repartidor
  getCurrentLocation: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const allOrders = await getAllOrders();
      const order = allOrders.find((o) => o.id === input.orderId);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verificar permisos
      if (ctx.user?.role === "user" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await getLatestGPSTracking(input.orderId);
    }),

  // Obtener historial de rastreo
  getHistory: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const allOrders = await getAllOrders();
      const order = allOrders.find((o) => o.id === input.orderId);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verificar permisos
      if (ctx.user?.role === "user" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await getGPSTrackingHistory(input.orderId);
    }),
});
