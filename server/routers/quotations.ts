import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  convertQuotationToSale,
  createQuotation,
  getAllQuotations,
  getNextQuoteNumber,
  getQuotationById,
  getQuotationItemsByQuoteId,
  updateQuotationStatus,
} from "../db";

const discountTypeSchema = z.enum(["none", "percentage", "fixed"]);

function getLinePricing(
  unitPrice: number,
  quantity: number,
  discountType: "none" | "percentage" | "fixed",
  discountValue: number
) {
  const safePrice = Math.max(0, Math.round(unitPrice));
  const safeQty = Math.max(1, Math.trunc(quantity));
  const safeDiscount = Math.max(0, Math.round(discountValue));

  let finalUnitPrice = safePrice;
  if (discountType === "percentage") {
    finalUnitPrice = Math.max(0, Math.round(safePrice * (1 - Math.min(100, safeDiscount) / 100)));
  } else if (discountType === "fixed") {
    finalUnitPrice = Math.max(0, safePrice - safeDiscount);
  }

  const subtotal = finalUnitPrice * safeQty;
  const discountAmount = Math.max(0, safePrice * safeQty - subtotal);

  return { finalUnitPrice, subtotal, discountAmount };
}

function getGlobalDiscount(subtotal: number, discountType: "none" | "percentage" | "fixed", discountValue: number) {
  if (discountType === "percentage") {
    return Math.min(subtotal, Math.round(subtotal * (Math.min(100, discountValue) / 100)));
  }
  if (discountType === "fixed") {
    return Math.min(subtotal, Math.max(0, discountValue));
  }
  return 0;
}

export const quotationsRouter = router({
  getNextQuoteNumber: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
    return { quoteNumber: await getNextQuoteNumber() };
  }),

  list: protectedProcedure
    .input(z.object({ customerId: z.number().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const all = await getAllQuotations();
      if (input?.customerId) {
        return (all as any[]).filter((q: any) => q.customerId === input.customerId);
      }
      return all;
    }),

  getDetails: protectedProcedure
    .input(z.object({ quoteId: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      const quote = await getQuotationById(input.quoteId);
      if (!quote) throw new TRPCError({ code: "NOT_FOUND", message: "Cotización no encontrada" });
      const items = await getQuotationItemsByQuoteId(input.quoteId);
      return { quote, items };
    }),

  create: protectedProcedure
    .input(
      z.object({
        customerId: z.number({ required_error: "Cliente requerido" }),
        validUntil: z.string().optional(),
        notes: z.string().optional(),
        termsAndConditions: z.string().optional(),
        discountType: discountTypeSchema.default("none"),
        discountValue: z.number().default(0),
        items: z
          .array(
            z.object({
              productId: z.number(),
              quantity: z.number().int().min(1),
              unitPrice: z.number().min(0),
              discountType: discountTypeSchema.default("none"),
              discountValue: z.number().default(0),
            })
          )
          .min(1, "Debes agregar al menos un producto"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const normalizedItems = input.items.map((item) => {
        const pricing = getLinePricing(item.unitPrice, item.quantity, item.discountType, item.discountValue);
        return {
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: Math.round(item.unitPrice),
          discountType: item.discountType === "none" ? null : item.discountType as "percentage" | "fixed",
          discountValue: Math.round(item.discountValue),
          discountAmount: pricing.discountAmount,
          finalUnitPrice: pricing.finalUnitPrice,
          subtotal: pricing.subtotal,
        };
      });

      const subtotal = normalizedItems.reduce((sum, item) => sum + item.subtotal, 0);
      const discountAmount = getGlobalDiscount(subtotal, input.discountType, input.discountValue);
      const totalAmount = Math.max(0, subtotal - discountAmount);
      const quoteNumber = await getNextQuoteNumber();

      try {
        const result = await createQuotation({
          quoteNumber,
          customerId: input.customerId,
          adminId: ctx.user!.id,
          subtotal,
          discountType: input.discountType === "none" ? null : input.discountType as "percentage" | "fixed",
          discountValue: Math.round(input.discountValue),
          discountAmount,
          totalAmount,
          validUntil: input.validUntil || null,
          notes: input.notes || null,
          termsAndConditions: input.termsAndConditions || null,
          items: normalizedItems,
        });
        return { success: true, quoteId: (result as any).insertId, quoteNumber };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo crear la cotización",
        });
      }
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        quoteId: z.number(),
        status: z.enum(["pending", "accepted", "rejected"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      try {
        return await updateQuotationStatus(input.quoteId, input.status);
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo actualizar el estado",
        });
      }
    }),

  convertToSale: protectedProcedure
    .input(
      z.object({
        quoteId: z.number(),
        paymentMethod: z.enum(["cash", "qr", "transfer"]),
        paymentStatus: z.enum(["completed", "pending"]).default("completed"),
        saleChannel: z.enum(["local", "delivery"]).default("local"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      try {
        return await convertQuotationToSale({
          quoteId: input.quoteId,
          soldBy: ctx.user!.id,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          saleChannel: input.saleChannel,
        });
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "No se pudo convertir la cotización",
        });
      }
    }),
});
