import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createCustomer,
  getAllCustomers,
  getAllOrders,
  getAllSales,
  getCustomerById,
  getCustomerByNumber,
  searchCustomers,
  updateCustomer,
} from "../db";
import { TRPCError } from "@trpc/server";

const sourceChannelSchema = z.enum(["facebook", "tiktok", "marketplace", "referral", "other"]);

function getActivityDate(activity: any) {
  return activity.deliveryDate || activity.createdAt || null;
}

function getDaysSince(dateValue?: string | Date | null) {
  if (!dateValue) return Number.POSITIVE_INFINITY;
  const date = new Date(dateValue);
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function getFrequencyLabel(totalInteractions: number, lastActivityAt?: string | Date | null) {
  const daysSinceLastActivity = getDaysSince(lastActivityAt);

  if (totalInteractions >= 8 && daysSinceLastActivity <= 30) return "Alta";
  if (totalInteractions >= 3 && daysSinceLastActivity <= 60) return "Media";
  if (totalInteractions > 0) return "Baja";
  return "Sin compras";
}

function buildCustomerInsights(customers: any[], orders: any[], sales: any[]) {
  const customerRows = customers.map((customer: any) => {
    const customerOrders = orders.filter((order: any) => order.customerId === customer.id);
    const activeOrders = customerOrders.filter((order: any) => order.status !== "cancelled");
    const customerSales = sales.filter((sale: any) => sale.customerId === customer.id);
    const activeSales = customerSales.filter((sale: any) => sale.status !== "cancelled");

    const totalOrderAmount = activeOrders.reduce(
      (sum: number, order: any) => sum + (order.totalPrice || 0),
      0
    );
    const totalSalesAmount = activeSales.reduce(
      (sum: number, sale: any) => sum + (sale.total || 0),
      0
    );
    const totalDebt =
      activeOrders
        .filter((order: any) => order.paymentStatus !== "completed")
        .reduce((sum: number, order: any) => sum + (order.totalPrice || 0), 0) +
      activeSales
        .filter((sale: any) => sale.paymentStatus !== "completed")
        .reduce((sum: number, sale: any) => sum + (sale.total || 0), 0);

    const activities = [
      ...customerOrders.map((order: any) => ({
        id: `order-${order.id}`,
        type: "order",
        amount: order.totalPrice || 0,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: getActivityDate(order),
      })),
      ...customerSales.map((sale: any) => ({
        id: `sale-${sale.id}`,
        type: "sale",
        amount: sale.total || 0,
        status: sale.status,
        paymentStatus: sale.paymentStatus,
        createdAt: sale.createdAt,
      })),
    ]
      .filter((activity) => !!activity.createdAt)
      .sort(
        (a, b) =>
          new Date(b.createdAt as string | Date).getTime() -
          new Date(a.createdAt as string | Date).getTime()
      );

    const lastActivityAt = activities[0]?.createdAt || null;
    const firstActivityAt = activities.length > 0 ? activities[activities.length - 1].createdAt : null;
    const recentActivityCount = activities.filter(
      (activity) => getDaysSince(activity.createdAt) <= 30
    ).length;

    return {
      ...customer,
      sourceChannel: customer.sourceChannel || "other",
      orderCount: activeOrders.length,
      saleCount: activeSales.length,
      totalInteractions: activeOrders.length + activeSales.length,
      totalSpent: totalOrderAmount + totalSalesAmount,
      averageTicket: activeOrders.length + activeSales.length > 0 ? Math.round((totalOrderAmount + totalSalesAmount) / (activeOrders.length + activeSales.length)) : 0,
      debt: totalDebt,
      lastActivityAt,
      firstActivityAt,
      recentActivityCount,
      frequencyLabel: getFrequencyLabel(activeOrders.length + activeSales.length, lastActivityAt),
      pendingOrdersCount: activeOrders.filter((order: any) => order.paymentStatus !== "completed")
        .length,
      pendingSalesCount: activeSales.filter((sale: any) => sale.paymentStatus !== "completed")
        .length,
    };
  });

  const zoneMap = new Map<string, { zone: string; customers: number; totalSpent: number; totalDebt: number }>();

  customerRows.forEach((customer: any) => {
    const zone = customer.zone || "Sin zona";
    const current = zoneMap.get(zone) || {
      zone,
      customers: 0,
      totalSpent: 0,
      totalDebt: 0,
    };

    current.customers += 1;
    current.totalSpent += customer.totalSpent;
    current.totalDebt += customer.debt;
    zoneMap.set(zone, current);
  });

  const zoneStats = Array.from(zoneMap.values()).sort(
    (a, b) => b.customers - a.customers || b.totalSpent - a.totalSpent
  );

  const channelMap = new Map<string, { channel: string; customers: number; activeCustomers: number; totalSpent: number; totalDebt: number }>();
  customerRows.forEach((customer: any) => {
    const channel = customer.sourceChannel || "other";
    const current = channelMap.get(channel) || { channel, customers: 0, activeCustomers: 0, totalSpent: 0, totalDebt: 0 };
    current.customers += 1;
    if (customer.recentActivityCount > 0) current.activeCustomers += 1;
    current.totalSpent += customer.totalSpent || 0;
    current.totalDebt += customer.debt || 0;
    channelMap.set(channel, current);
  });
  const channelStats = Array.from(channelMap.values()).sort((a, b) => b.customers - a.customers || b.totalSpent - a.totalSpent);

  return {
    summary: {
      totalCustomers: customerRows.length,
      activeCustomers: customerRows.filter((customer: any) => customer.recentActivityCount > 0).length,
      totalDebt: customerRows.reduce((sum: number, customer: any) => sum + customer.debt, 0),
      activeZones: zoneStats.length,
      frequentCustomers: customerRows.filter((customer: any) => customer.frequencyLabel === "Alta").length,
    },
    channelStats,
    zoneStats,
    customers: customerRows.sort((a: any, b: any) => {
      const lastA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const lastB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      return lastB - lastA || b.totalSpent - a.totalSpent;
    }),
  };
}

export const customersRouter = router({
  list: protectedProcedure.query(async () => {
    return await getAllCustomers();
  }),

  search: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      return await searchCustomers(input.query);
    }),

  getByNumber: protectedProcedure
    .input(z.object({ clientNumber: z.string() }))
    .query(async ({ input }) => {
      return await getCustomerByNumber(input.clientNumber);
    }),

  getInsights: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const [customers, orders, sales] = await Promise.all([
      getAllCustomers(),
      getAllOrders(),
      getAllSales(),
    ]);

    return buildCustomerInsights(customers as any[], orders as any[], sales as any[]);
  }),

  getDetails: protectedProcedure
    .input(z.object({ customerId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const [customer, customers, orders, sales] = await Promise.all([
        getCustomerById(input.customerId),
        getAllCustomers(),
        getAllOrders(),
        getAllSales(),
      ]);

      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cliente no encontrado" });
      }

      const insights = buildCustomerInsights(customers as any[], orders as any[], sales as any[]);
      const customerSummary = insights.customers.find((item: any) => item.id === input.customerId);

      const history = [
        ...(orders as any[])
          .filter((order: any) => order.customerId === input.customerId)
          .map((order: any) => ({
            id: `order-${order.id}`,
            type: "order",
            title: `Pedido ${order.orderNumber}`,
            description: `Estado: ${order.status}. Pago: ${order.paymentStatus}. Zona: ${order.zone || "sin zona"}.`,
            amount: order.totalPrice || 0,
            createdAt: getActivityDate(order),
            status: order.status,
            paymentStatus: order.paymentStatus,
          })),
        ...(sales as any[])
          .filter((sale: any) => sale.customerId === input.customerId)
          .map((sale: any) => ({
            id: `sale-${sale.id}`,
            type: "sale",
            title: `Venta ${sale.saleNumber}`,
            description: `Estado: ${sale.status}. Pago: ${sale.paymentStatus}. Método: ${sale.paymentMethod}.`,
            amount: sale.total || 0,
            createdAt: sale.createdAt,
            status: sale.status,
            paymentStatus: sale.paymentStatus,
          })),
      ]
        .filter((item) => !!item.createdAt)
        .sort(
          (a, b) =>
            new Date(b.createdAt as string | Date).getTime() -
            new Date(a.createdAt as string | Date).getTime()
        );

      return {
        customer,
        summary: customerSummary,
        history,
      };
    }),

  create: protectedProcedure
    .input(
      z.object({
        clientNumber: z.string(),
        name: z.string(),
        sourceChannel: sourceChannelSchema.optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        zone: z.string().optional(),
        address: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        age: z.number().int().min(0).max(120).optional(),
        gender: z.string().optional(),
        socioeconomicLevel: z.string().optional(),
        interestHealthFitness: z.boolean().optional(),
        interestNaturalFood: z.boolean().optional(),
        interestDigestiveIssues: z.boolean().optional(),
        lifestyleGym: z.boolean().optional(),
        lifestyleVegan: z.boolean().optional(),
        lifestyleBiohacking: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const existing = await getCustomerByNumber(input.clientNumber);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Customer already exists",
        });
      }

      await createCustomer({
        clientNumber: input.clientNumber,
        name: input.name,
        sourceChannel: input.sourceChannel || "other",
        phone: input.phone,
        whatsapp: input.whatsapp,
        zone: input.zone,
        address: input.address,
        latitude: input.latitude,
        longitude: input.longitude,
        age: input.age,
        gender: input.gender,
        socioeconomicLevel: input.socioeconomicLevel,
        interestHealthFitness: input.interestHealthFitness ? 1 : 0,
        interestNaturalFood: input.interestNaturalFood ? 1 : 0,
        interestDigestiveIssues: input.interestDigestiveIssues ? 1 : 0,
        lifestyleGym: input.lifestyleGym ? 1 : 0,
        lifestyleVegan: input.lifestyleVegan ? 1 : 0,
        lifestyleBiohacking: input.lifestyleBiohacking ? 1 : 0,
      });

      return { success: true };
    }),

  update: protectedProcedure
    .input(
      z.object({
        customerId: z.number(),
        name: z.string().optional(),
        sourceChannel: sourceChannelSchema.optional(),
        phone: z.string().optional(),
        whatsapp: z.string().optional(),
        zone: z.string().optional(),
        address: z.string().optional(),
        age: z.number().int().min(0).max(120).optional(),
        gender: z.string().optional(),
        socioeconomicLevel: z.string().optional(),
        interestHealthFitness: z.boolean().optional(),
        interestNaturalFood: z.boolean().optional(),
        interestDigestiveIssues: z.boolean().optional(),
        lifestyleGym: z.boolean().optional(),
        lifestyleVegan: z.boolean().optional(),
        lifestyleBiohacking: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { customerId, ...data } = input;
      await updateCustomer(customerId, {
        ...data,
        interestHealthFitness: data.interestHealthFitness === undefined ? undefined : data.interestHealthFitness ? 1 : 0,
        interestNaturalFood: data.interestNaturalFood === undefined ? undefined : data.interestNaturalFood ? 1 : 0,
        interestDigestiveIssues: data.interestDigestiveIssues === undefined ? undefined : data.interestDigestiveIssues ? 1 : 0,
        lifestyleGym: data.lifestyleGym === undefined ? undefined : data.lifestyleGym ? 1 : 0,
        lifestyleVegan: data.lifestyleVegan === undefined ? undefined : data.lifestyleVegan ? 1 : 0,
        lifestyleBiohacking: data.lifestyleBiohacking === undefined ? undefined : data.lifestyleBiohacking ? 1 : 0,
      });
      return { success: true };
    }),
});
