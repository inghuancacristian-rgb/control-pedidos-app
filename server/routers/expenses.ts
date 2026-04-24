import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getOperationalExpenses,
  getOperationalExpenseById,
  createOperationalExpense,
  updateOperationalExpense,
  deleteOperationalExpense,
} from "../db";
import { TRPCError } from "@trpc/server";

export const expensesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getOperationalExpenses();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const expense = await getOperationalExpenseById(input.id);
      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado" });
      }
      return expense;
    }),

  create: protectedProcedure
    .input(
      z.object({
        description: z.string().min(1, "Descripción requerida"),
        category: z.enum([
          "facebook_ads",
          "google_ads",
          "electricity",
          "water",
          "internet",
          "telephone",
          "rent",
          "salaries",
          "maintenance",
          "supplies",
          "taxes",
          "insurance",
          "bank_fees",
          "other"
        ]),
        amount: z.number().min(1, "Monto debe ser mayor a 0"),
        paymentMethod: z.enum(["cash", "qr", "transfer"]),
        expenseDate: z.string().optional(),
        dueDate: z.string().optional(),
        status: z.enum(["pending", "paid"]).default("pending"),
        supplierName: z.string().optional(),
        invoiceNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await createOperationalExpense({
        ...input,
        userId: ctx.user.id,
        expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        description: z.string().min(1).optional(),
        category: z.enum([
          "facebook_ads",
          "google_ads",
          "electricity",
          "water",
          "internet",
          "telephone",
          "rent",
          "salaries",
          "maintenance",
          "supplies",
          "taxes",
          "insurance",
          "bank_fees",
          "other"
        ]).optional(),
        amount: z.number().min(1).optional(),
        paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
        expenseDate: z.string().optional(),
        dueDate: z.string().optional(),
        status: z.enum(["pending", "paid"]).optional(),
        supplierName: z.string().optional(),
        invoiceNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { id, ...data } = input;
      return await updateOperationalExpense(id, {
        ...data,
        expenseDate: data.expenseDate ? new Date(data.expenseDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      });
    }),

  markAsPaid: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        paymentMethod: z.enum(["cash", "qr", "transfer"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const expense = await getOperationalExpenseById(input.id);
      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Gasto no encontrado" });
      }

      return await updateOperationalExpense(input.id, {
        status: "paid",
        paymentMethod: input.paymentMethod || expense.paymentMethod,
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await deleteOperationalExpense(input.id);
    }),

  // Resumen por categoría
  summaryByCategory: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const expenses = await getOperationalExpenses();

    const summary: Record<string, { pending: number; paid: number; total: number; count: number }> = {};

    const categories = [
      "facebook_ads", "google_ads", "electricity", "water", "internet",
      "telephone", "rent", "salaries", "maintenance", "supplies",
      "taxes", "insurance", "bank_fees", "other"
    ];

    for (const cat of categories) {
      summary[cat] = { pending: 0, paid: 0, total: 0, count: 0 };
    }

    for (const expense of expenses) {
      const amount = expense.amount / 100; // Convertir de centavos
      summary[expense.category].total += amount;
      summary[expense.category].count += 1;
      if (expense.status === "pending") {
        summary[expense.category].pending += amount;
      } else {
        summary[expense.category].paid += amount;
      }
    }

    return summary;
  }),

  // Totales generales
  totals: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    const expenses = await getOperationalExpenses();

    let totalPending = 0;
    let totalPaid = 0;
    let countPending = 0;
    let countPaid = 0;

    for (const expense of expenses) {
      const amount = expense.amount / 100;
      if (expense.status === "pending") {
        totalPending += amount;
        countPending += 1;
      } else {
        totalPaid += amount;
        countPaid += 1;
      }
    }

    return {
      totalPending,
      totalPaid,
      total: totalPending + totalPaid,
      countPending,
      countPaid,
      count: expenses.length,
    };
  }),
});
