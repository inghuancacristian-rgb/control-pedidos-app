import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getAllSuppliers, createSupplier } from "../db";
import { TRPCError } from "@trpc/server";

export const suppliersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllSuppliers();
  }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Nombre es requerido"),
      contactName: z.string().optional(),
      phone: z.string().optional(),
      taxId: z.string().optional(),
      address: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await createSupplier(input);
    }),
});
