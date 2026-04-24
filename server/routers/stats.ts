import { protectedProcedure, router } from "../_core/trpc";
import { getAllOrders, getAllInventory, getAllProducts } from "../db";
import { TRPCError } from "@trpc/server";

export const statsRouter = router({
  // Obtener estadísticas del dashboard
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const orders = await getAllOrders();
    const inventory = await getAllInventory();
    const products = await getAllProducts();

    const stats = {
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      assignedOrders: orders.filter((o) => o.status === "assigned").length,
      inTransitOrders: orders.filter((o) => o.status === "in_transit").length,
      deliveredOrders: orders.filter((o) => o.status === "delivered").length,
      cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
      totalRevenue: orders
        .filter((o) => o.paymentStatus === "completed")
        .reduce((sum, o) => sum + o.totalPrice, 0),
      lowStockProducts: inventory.filter((inv) => inv.quantity <= inv.minStock)
        .length,
      totalProducts: products.length,
      totalInventoryValue: inventory.reduce((sum, inv) => {
        const product = products.find((p) => p.id === inv.productId);
        return sum + (product ? product.price * inv.quantity : 0);
      }, 0),
    };

    return stats;
  }),

  // Obtener estadísticas del repartidor
  getDeliveryStats: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "user") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const orders = await getAllOrders();
    const myOrders = orders.filter((o) => o.deliveryPersonId === ctx.user?.id);

    const stats = {
      totalAssigned: myOrders.length,
      pending: myOrders.filter((o) => o.status === "assigned").length,
      inTransit: myOrders.filter((o) => o.status === "in_transit").length,
      delivered: myOrders.filter((o) => o.status === "delivered").length,
      cancelled: myOrders.filter((o) => o.status === "cancelled").length,
    };

    return stats;
  }),
});
