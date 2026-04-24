import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc.js";
import { getDb } from "../db.js";
import { coupons, couponUsage } from "../../drizzle/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";

export const couponRouter = router({
  // Listar todos los cupones
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const allCoupons = await db.query.coupons.findMany({
      orderBy: (coupons, { desc }) => [desc(coupons.createdAt)],
    });

    return allCoupons || [];
  }),

  // Obtener cupón por ID
  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const coupon = await db.query.coupons.findFirst({
        where: eq(coupons.id, input.id),
      });

      return coupon;
    }),

  // Validar cupón (público - para aplicar en pedido)
  validate: publicProcedure
    .input(z.object({ code: z.string(), orderTotal: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { valid: false, error: "Base de datos no disponible" };

      const coupon = await db.query.coupons.findFirst({
        where: eq(coupons.code, input.code.toUpperCase()),
      });

      if (!coupon) {
        return { valid: false, error: "Cupón no encontrado" };
      }

      if (coupon.active !== "active") {
        return { valid: false, error: "Cupón inactivo" };
      }

      const now = new Date();
      const today = now.toISOString().split("T")[0];

      if (coupon.validFrom && coupon.validFrom > today) {
        return { valid: false, error: "Cupón aún no válido" };
      }

      if (coupon.validUntil && coupon.validUntil < today) {
        return { valid: false, error: "Cupón expirado" };
      }

      if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
        return { valid: false, error: "Cupón agotado" };
      }

      if (input.orderTotal !== undefined && input.orderTotal < coupon.minPurchase) {
        return {
          valid: false,
          error: `Compra mínima de Bs. ${(coupon.minPurchase / 100).toFixed(2)} requerida`,
        };
      }

      // Calcular descuento
      let discountAmount = 0;
      if (coupon.discountType === "percentage") {
        discountAmount = Math.round((input.orderTotal || 0) * coupon.discountValue / 100);
      } else {
        discountAmount = coupon.discountValue;
      }

      return {
        valid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          discountAmount,
        },
      };
    }),

  // Crear cupón
  create: protectedProcedure
    .input(z.object({
      code: z.string().min(3).max(50),
      description: z.string().optional(),
      discountType: z.enum(["percentage", "fixed"]),
      discountValue: z.number().min(1),
      minPurchase: z.number().min(0).default(0),
      maxUses: z.number().min(0).default(0),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Base de datos no disponible" };

      // Verificar si ya existe el código
      const existing = await db.query.coupons.findFirst({
        where: eq(coupons.code, input.code.toUpperCase()),
      });

      if (existing) {
        return { success: false, error: "Ya existe un cupón con este código" };
      }

      await db.insert(coupons).values({
        code: input.code.toUpperCase(),
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minPurchase: input.minPurchase,
        maxUses: input.maxUses,
        validFrom: input.validFrom,
        validUntil: input.validUntil,
        active: "active",
      });

      return { success: true };
    }),

  // Actualizar cupón
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      description: z.string().optional(),
      discountType: z.enum(["percentage", "fixed"]).optional(),
      discountValue: z.number().min(1).optional(),
      minPurchase: z.number().min(0).optional(),
      maxUses: z.number().min(0).optional(),
      validFrom: z.string().optional(),
      validUntil: z.string().optional(),
      active: z.enum(["active", "inactive"]).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Base de datos no disponible" };

      const { id, ...updateData } = input;

      await db.update(coupons).set(updateData).where(eq(coupons.id, id));

      return { success: true };
    }),

  // Eliminar cupón
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Base de datos no disponible" };

      await db.delete(coupons).where(eq(coupons.id, input.id));

      return { success: true };
    }),

  // Usar cupón (registrar uso)
  use: protectedProcedure
    .input(z.object({
      couponId: z.number(),
      orderId: z.number().optional(),
      saleId: z.number().optional(),
      discountApplied: z.number(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: false, error: "Base de datos no disponible" };

      // Registrar uso
      await db.insert(couponUsage).values({
        couponId: input.couponId,
        orderId: input.orderId,
        saleId: input.saleId,
        userId: ctx.user?.id,
        discountApplied: input.discountApplied,
      });

      // Incrementar contador de uso
      await db
        .update(coupons)
        .set({ usedCount: sql`usedCount + 1` })
        .where(eq(coupons.id, input.couponId));

      return { success: true };
    }),

  // Obtener historial de uso de un cupón
  getUsageHistory: protectedProcedure
    .input(z.object({ couponId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const usage = await db.query.couponUsage.findMany({
        where: eq(couponUsage.couponId, input.couponId),
        with: {
          order: true,
          sale: true,
          user: true,
        },
        orderBy: (couponUsage, { desc }) => [desc(couponUsage.usedAt)],
      });

      return usage || [];
    }),

  // Estadísticas de cupones
  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { totalCoupons: 0, activeCoupons: 0, totalUsage: 0, totalDiscount: 0 };

    const totalCoupons = await db.select({ count: sql`count(*)` }).from(coupons);
    const activeCoupons = await db
      .select({ count: sql`count(*)` })
      .from(coupons)
      .where(eq(coupons.active, "active"));
    const totalUsage = await db.select({ count: sql`count(*)` }).from(couponUsage);
    const totalDiscount = await db
      .select({ sum: sql`sum(${couponUsage.discountApplied})` })
      .from(couponUsage);

    return {
      totalCoupons: totalCoupons[0]?.count || 0,
      activeCoupons: activeCoupons[0]?.count || 0,
      totalUsage: totalUsage[0]?.count || 0,
      totalDiscount: totalDiscount[0]?.sum || 0,
    };
  }),
});