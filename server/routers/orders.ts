import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createOrder,
  updateOrder,
  getAllOrders,
  getOrderByNumber,
  getOrderById,
  createOrderItem,
  getOrderItems,
  createPayment,
  getPaymentByOrderId,
  updatePayment,
  getCustomerByNumber,
  createCustomer,
  getCustomerById,
  updateCustomer,
  getAllCustomers,
  getAllSales,
  deleteOrderItems,
  completeOrderDelivery,
  deductInventoryForOrder,
  restoreInventoryForOrder,
} from "../db";
import { TRPCError } from "@trpc/server";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalDateKey(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

async function ensureCustomerRecord(input: {
  clientNumber: string;
  clientName: string;
  zone: string;
  sourceChannel?: "facebook" | "tiktok" | "marketplace" | "referral" | "other";
}) {
  let customer = await getCustomerByNumber(input.clientNumber);

  if (!customer) {
    await createCustomer({
      clientNumber: input.clientNumber,
      name: input.clientName,
      zone: input.zone,
      sourceChannel: input.sourceChannel || "other",
    });
    customer = await getCustomerByNumber(input.clientNumber);
  } else {
    const updates: Record<string, string> = {};

    if (input.clientName.trim() && input.clientName !== customer.name) {
      updates.name = input.clientName;
    }

    if (input.zone.trim() && input.zone !== customer.zone) {
      updates.zone = input.zone;
    }
    if (input.sourceChannel && (!customer.sourceChannel || customer.sourceChannel === "other")) {
      (updates as any).sourceChannel = input.sourceChannel;
    }

    if (Object.keys(updates).length > 0) {
      await updateCustomer(customer.id, updates);
      customer = await getCustomerByNumber(input.clientNumber);
    }
  }

  return customer;
}

export const ordersRouter = router({
  // Generar próximo número de pedido
  getNextOrderNumber: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const allOrders = await getAllOrders();

    // Extraer números de los pedidos existentes
    const orderNumbers = allOrders
      .map((o: any) => {
        const match = o.orderNumber?.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      })
      .filter((n: number) => !isNaN(n) && n > 0);

    // Obtener el número más alto y sumarle 1
    const maxExisting = orderNumbers.length > 0 ? Math.max(...orderNumbers) : 0;
    const nextNumber = maxExisting + 1;
    const paddedNumber = String(nextNumber).padStart(3, "0");

    return { orderNumber: `ORD-${paddedNumber}` };
  }),

  // Obtener todos los pedidos
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllOrders();
  }),

  // Hoja de reparto del dÃ­a (Admin): pedidos asignados + productos
  getDeliverySheet: protectedProcedure
    .input(z.object({
      deliveryPersonId: z.number(),
      date: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [orders, customers, sales] = await Promise.all([
        getAllOrders(),
        getAllCustomers(),
        getAllSales(),
      ]);

      const customerById = new Map<number, any>((customers as any[]).map((customer: any) => [customer.id, customer]));

      const dayOrders = (orders as any[]).filter((order: any) => {
        if (order.deliveryPersonId !== input.deliveryPersonId) return false;
        if (order.status === "cancelled") return false;

        if (order.deliveryDate) return order.deliveryDate === input.date;
        return getLocalDateKey(order.createdAt) === input.date;
      });

      const hasPreviousActivity = (order: any) => {
        const customerId = order.customerId || null;
        const customer = customerId ? customerById.get(customerId) : null;
        const clientNumber = customer?.clientNumber || null;

        const orderActivityKey = (value: any) => value?.deliveryDate || getLocalDateKey(value?.createdAt) || null;

        const previousOrder = (orders as any[]).some((other: any) => {
          if (!other || other.status === "cancelled") return false;
          if (other.id === order.id) return false;
          if (customerId && other.customerId === customerId) {
            const key = orderActivityKey(other);
            return !!key && key < input.date;
          }
          if (clientNumber) {
            const otherCustomer = other.customerId ? customerById.get(other.customerId) : null;
            if (otherCustomer?.clientNumber === clientNumber) {
              const key = orderActivityKey(other);
              return !!key && key < input.date;
            }
          }
          return false;
        });

        if (previousOrder) return true;

        const previousSale = (sales as any[]).some((sale: any) => {
          if (!sale || sale.status === "cancelled") return false;
          if (customerId && sale.customerId === customerId) {
            const key = getLocalDateKey(sale.createdAt);
            return !!key && key < input.date;
          }
          return false;
        });

        return previousSale;
      };

      const entries = await Promise.all(dayOrders.map(async (order: any) => {
        const items = await getOrderItems(order.id);
        const customer = order.customerId ? customerById.get(order.customerId) : null;
        const isNew = !hasPreviousActivity(order);
        return {
          order,
          customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, whatsapp: customer.whatsapp, clientNumber: customer.clientNumber } : null,
          items,
          cohort: isNew ? "new" : "repeat",
        };
      }));

      entries.sort((a: any, b: any) => {
        const timeA = a.order.deliveryTime || "99:99";
        const timeB = b.order.deliveryTime || "99:99";
        return timeA.localeCompare(timeB) || String(a.order.orderNumber || "").localeCompare(String(b.order.orderNumber || ""));
      });

      const totals = {
        totalBs: entries.reduce((sum: number, row: any) => sum + (row.order.totalPrice || 0), 0),
        cashBs: entries.reduce((sum: number, row: any) => sum + ((row.order.paymentMethod === "cash" ? row.order.totalPrice : 0) || 0), 0),
        qrBs: entries.reduce((sum: number, row: any) => sum + ((row.order.paymentMethod === "qr" ? row.order.totalPrice : 0) || 0), 0),
        transferBs: entries.reduce((sum: number, row: any) => sum + ((row.order.paymentMethod === "transfer" ? row.order.totalPrice : 0) || 0), 0),
        totalProducts: entries.reduce((sum: number, row: any) => sum + (row.items || []).reduce((acc: number, item: any) => acc + Number(item.quantity || 0), 0), 0),
        newCustomers: entries.filter((row: any) => row.cohort === "new").length,
        repeatCustomers: entries.filter((row: any) => row.cohort === "repeat").length,
      };

      const deliveryPersonName = (dayOrders as any[])[0]?.deliveryPersonName || null;

      return {
        date: input.date,
        deliveryPersonId: input.deliveryPersonId,
        deliveryPersonName,
        entries,
        totals,
      };
    }),

  // Obtener pedidos del repartidor
  listForDelivery: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "user") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const allOrders = await getAllOrders();
    return allOrders.filter((o: any) => o.deliveryPersonId === ctx.user?.id);
  }),

  // Carga del repartidor: productos agregados por pedidos activos
  getMyLoad: protectedProcedure
    .input(z.object({
      date: z.string().optional(),
      status: z.enum(["all", "assigned", "in_transit", "rescheduled"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "user") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const allOrders = await getAllOrders();
      const statusFilter = input?.status && input.status !== "all" ? input.status : null;
      const dateFilter = input?.date || null;

      const activeOrders = (allOrders as any[]).filter((o: any) => {
        if (o.deliveryPersonId !== ctx.user?.id) return false;
        if (!["assigned", "in_transit", "rescheduled"].includes(o.status)) return false;
        if (statusFilter && o.status !== statusFilter) return false;

        if (dateFilter) {
          if (o.deliveryDate) return o.deliveryDate === dateFilter;
          return getLocalDateKey(o.createdAt) === dateFilter;
        }

        return true;
      });

      const results = await Promise.all(activeOrders.map(async (order: any) => {
        const [items, customer] = await Promise.all([
          getOrderItems(order.id),
          order.customerId ? getCustomerById(order.customerId) : null,
        ]);
        return { order, items, customer };
      }));

      return results;
    }),

  // Crear un nuevo pedido
  create: protectedProcedure
    .input(
      z.object({
        orderNumber: z.string(),
        clientNumber: z.string(),
        clientName: z.string(),
        zone: z.string(),
        sourceChannel: z.enum(["facebook", "tiktok", "marketplace", "referral", "other"]).default("other"),
        deliveryDate: z.string().optional(),
        deliveryTime: z.string().optional(),
        items: z.array(
          z.object({
            productId: z.number(),
            quantity: z.number(),
            price: z.number(),
          })
        ),
        totalPrice: z.number(),
        paymentMethod: z.enum(["qr", "cash", "transfer"]).optional(),
        deliveryPersonId: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const customer = await ensureCustomerRecord({
        clientNumber: input.clientNumber,
        clientName: input.clientName,
        zone: input.zone,
        sourceChannel: input.sourceChannel,
      });

      if (!customer) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create customer",
        });
      }

      // Crear pedido
      const orderResult = await createOrder({
        orderNumber: input.orderNumber,
        customerId: customer.id,
        zone: input.zone,
        deliveryDate: input.deliveryDate,
        deliveryTime: input.deliveryTime,
        totalPrice: input.totalPrice,
        paymentMethod: input.paymentMethod,
        deliveryPersonId: input.deliveryPersonId,
        status: input.deliveryPersonId ? "assigned" : "pending",
        paymentStatus: "pending",
        notes: input.notes,
        sourceChannel: input.sourceChannel,
      });

      // Obtener el ID del pedido creado
      const newOrder = await getOrderByNumber(input.orderNumber);
      if (!newOrder) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to retrieve created order",
        });
      }

      // Crear items del pedido
      for (const item of input.items) {
        await createOrderItem({
          orderId: newOrder.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        });
      }

      // Descontar stock del inventario y registrar en historial
      await deductInventoryForOrder(newOrder.id, input.orderNumber, input.items);

      return newOrder;
    }),

  // Obtener detalles del pedido
  getDetails: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      // Verificar permisos
      if (ctx.user?.role === "user" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [items, customer] = await Promise.all([
        getOrderItems(input.orderId),
        order.customerId ? getCustomerById(order.customerId) : null,
      ]);
      return { order, items, customer };
    }),

  // Registrar pago (Entrega Automática)
  recordPayment: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        amount: z.number(),
        method: z.enum(["qr", "cash", "transfer"]),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      
      // Permisos: Admin o el repartidor asignado
      if (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Registrar pago
      const existingPayment = await getPaymentByOrderId(input.orderId);
      if (existingPayment) {
        await updatePayment(existingPayment.id, {
          amount: input.amount,
          method: input.method,
          status: "completed",
          reference: input.reference,
          notes: input.notes,
        });
      } else {
        await createPayment({
          orderId: input.orderId,
          amount: input.amount,
          method: input.method,
          status: "completed",
          reference: input.reference,
          notes: input.notes,
        });
      }

      // Marcar entrega automática y procesar impacto (Stock + Finanzas)
      await completeOrderDelivery(input.orderId, input.method);

      return { success: true };
    }),

  // Solicitar reprogramación (Repartidor)
  requestReschedule: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      newDate: z.string(),
      newTime: z.string().optional(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      
      if (!order || (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateOrder(input.orderId, {
        rescheduleRequested: 1,
        requestedDate: input.newDate,
        requestedTime: input.newTime,
        rescheduleReason: input.reason
      });

      return { success: true };
    }),

  // Reprogramar / Aprobar (Admin)
  rescheduleOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      newDate: z.string(),
      newTime: z.string().optional(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateOrder(input.orderId, {
        deliveryDate: input.newDate,
        deliveryTime: input.newTime,
        rescheduleReason: input.reason,
        status: 'rescheduled', 
        rescheduleRequested: 0,
      });

      return { success: true };
    }),

  // Solicitar baja (Repartidor)
  requestCancellation: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      
      if (!order || (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (order.status === "delivered" || order.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No se puede solicitar baja para un pedido ya entregado/cancelado." });
      }

      await updateOrder(input.orderId, {
        cancellationRequested: 1,
        cancellationReason: input.reason
      });

      return { success: true };
    }),

  // Rechazar reprogramación (Admin)
  rejectRescheduleRequest: protectedProcedure
    .input(z.object({
      orderId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      await updateOrder(input.orderId, {
        rescheduleRequested: 0,
      });

      return { success: true };
    }),

  // Dar de baja definitiva (Admin)
  dismissOrder: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      cancelledBy: z.enum(["client", "company", "system"]),
      reason: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      // Restaurar stock del pedido cancelado
      if (!["delivered"].includes(order.status)) {
        const items = await getOrderItems(input.orderId);
        await restoreInventoryForOrder(input.orderId, order.orderNumber, items);
      }

      await updateOrder(input.orderId, {
        status: "cancelled",
        cancelledBy: input.cancelledBy,
        cancelReason: input.reason,
        cancellationRequested: 0,
      });

      return { success: true };
    }),

  // Otros métodos originales simplificados o corregidos si es necesario...
  updateStatus: protectedProcedure
    .input(z.object({
      orderId: z.number(),
      status: z.enum(["pending", "assigned", "in_transit", "delivered", "cancelled"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const order = await getOrderById(input.orderId);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user?.role !== "admin" && order.deliveryPersonId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      if (input.status === "delivered") {
        // Usar la lógica de entrega completa que incluye stock y finanzas
        const currentMethod = order.paymentMethod || "cash";
        await completeOrderDelivery(input.orderId, currentMethod);
      } else {
        await updateOrder(input.orderId, { status: input.status });
      }
      return { success: true };
    }),
});
