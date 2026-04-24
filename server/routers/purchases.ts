import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAllPurchases, createPurchase, getPurchaseItems, getPurchaseById } from "../db";
import { TRPCError } from "@trpc/server";

export const purchasesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllPurchases();
  }),

  getItems: protectedProcedure
    .input(z.object({ purchaseId: z.number() }))
    .query(async ({ input }) => {
      return await getPurchaseItems(input.purchaseId);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return await getPurchaseById(input.id);
    }),

  create: protectedProcedure
    .input(z.object({
      supplierId: z.number().optional().nullable(),
      purchaseNumber: z.string().min(1),
      orderDate: z.string().optional(),
      totalAmount: z.number(),
      status: z.enum(["pending", "received", "cancelled"]).default("pending"),
      paymentStatus: z.enum(["pending", "paid"]).default("pending"),
      paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
      isCredit: z.number().default(0),
      items: z.array(z.object({
        productId: z.number(),
        quantity: z.number(),
        price: z.number(),
        expiryDate: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { items, ...purchaseData } = input;
      return await createPurchase(purchaseData, items);
    }),
});
