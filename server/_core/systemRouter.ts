import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { clearAllData } from "../db";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  clearAllData: adminProcedure
    .input(z.object({ confirm: z.literal(true) }).optional())
    .mutation(async ({ input }) => {
      if (!input?.confirm) {
        throw new Error("Must confirm with confirm: true");
      }
      clearAllData();
      return {
        success: true,
      } as const;
    }),
});
