import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getCashClosureByUserIdAndDate,
  createCashClosure,
  getAllCashClosures,
  updateCashClosure,
  getCashClosureById,
  getCashClosuresByUserId,
  getExpectedDailyTotals,
  getFinancialTransactions,
  createDeliveryExpense,
  getAllCashOpenings,
  getCashOpeningByUserIdAndDateMethod,
  createCashOpening,
  getAllUsers,
  getPendingOrdersTotal,
  createFinancialTransactionsForDeliveries,
  getAllOrders,
  getOrderItems,
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

export const financeRouter = router({
  getTransactions: protectedProcedure.query(async ({ ctx }) => {
    // Si es repartidor, solo ve las suyas. Si es admin, ve todas.
    const userId = ctx.user?.role === "admin" ? undefined : ctx.user?.id;
    return await getFinancialTransactions(userId);
  }),

  getCashOpenings: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return await getAllCashOpenings();
  }),

  listResponsibleUsers: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }

    return await getAllUsers();
  }),

  openCashRegister: protectedProcedure
    .input(
      z.object({
        openingAmount: z.number().min(0, "El fondo inicial no puede ser negativo"),
        paymentMethod: z.enum(["cash", "qr", "transfer"]),
        openingDate: z.string().min(1, "La fecha de apertura es requerida"),
        responsibleUserId: z.number(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const existing = await getCashOpeningByUserIdAndDateMethod(input.responsibleUserId, input.openingDate, input.paymentMethod);
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Ya existe una apertura de caja (${input.paymentMethod.toUpperCase()}) para este usuario en esa fecha.`,
        });
      }

      return await createCashOpening({
        openingAmount: Math.round(input.openingAmount * 100),
        paymentMethod: input.paymentMethod,
        openingDate: input.openingDate,
        responsibleUserId: input.responsibleUserId,
        openedByUserId: ctx.user.id,
        notes: input.notes,
        status: "open",
      });
    }),

  transferFunds: protectedProcedure
    .input(z.object({
      fromMethod: z.enum(["cash", "qr", "transfer"]),
      toMethod: z.enum(["cash", "qr", "transfer"]),
      amount: z.number().min(0.01, "Monto inválido"),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
      if (input.fromMethod === input.toMethod) throw new TRPCError({ code: "BAD_REQUEST", message: "Las cajas de origen y destino deben ser distintas." });

      const amountInCents = Math.round(input.amount * 100);
      const { createFinancialTransaction } = await import("../db");
      
      await createFinancialTransaction({
        type: "expense",
        category: "transfer_between_registers",
        amount: amountInCents,
        paymentMethod: input.fromMethod,
        notes: `Traspaso hacia ${input.toMethod.toUpperCase()}` + (input.notes ? ` - ${input.notes}` : ""),
      });

      await createFinancialTransaction({
        type: "income",
        category: "transfer_between_registers",
        amount: amountInCents,
        paymentMethod: input.toMethod,
        notes: `Traspaso desde ${input.fromMethod.toUpperCase()}` + (input.notes ? ` - ${input.notes}` : ""),
      });

      return { success: true };
    }),

  addDeliveryExpense: protectedProcedure
    .input(z.object({
      deliveryPersonId: z.number(),
      amount: z.number(),
      type: z.enum(["fuel", "subsistence", "other"]),
      notes: z.string().optional(),
      orderId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await createDeliveryExpense({
        deliveryPersonId: input.deliveryPersonId,
        amount: Math.round(input.amount * 100),
        type: input.type,
        notes: input.notes,
        orderId: input.orderId,
      });
    }),
  // Obtener historial de entregas del repartidor hoy
  getDeliveryHistory: protectedProcedure
    .input(z.object({ date: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const targetUserId = ctx.user?.role === "admin" ? undefined : ctx.user?.id;
      if (!targetUserId && ctx.user?.role !== "admin") throw new TRPCError({ code: "BAD_REQUEST" });

      const allOrders = await getAllOrders();
      const ordersForUser = allOrders.filter((o: any) =>
        o.deliveryPersonId === targetUserId &&
        o.status === "delivered" &&
        (!input.date || getLocalDateKey(o.deliveredAt) === input.date)
      );

      const results = await Promise.all(ordersForUser.map(async (order: any) => {
        const items = await getOrderItems(order.id);
        return { order, items };
      }));

      return results;
    }),

  // Obtener totales esperados para un repartidor en una fecha específica
  getExpectedDaily: protectedProcedure
    .input(z.object({ 
      userId: z.number().optional(), 
      date: z.string() 
    }))
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId || ctx.user?.id;
      if (!targetUserId) throw new TRPCError({ code: "BAD_REQUEST" });
      
      // Solo el mismo usuario o un admin pueden ver esto
      if (ctx.user?.role !== "admin" && targetUserId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return await getExpectedDailyTotals(targetUserId, input.date);
    }),

  // Enviar un nuevo cierre de caja
  submitClosure: protectedProcedure
    .input(z.object({
      date: z.string(),
      initialCash: z.number(),
      reportedCash: z.number(),
      reportedQr: z.number(),
      reportedTransfer: z.number(),
      expenses: z.number().optional(),
      expectedCash: z.number(),
      expectedQr: z.number(),
      expectedTransfer: z.number(),
      pendingOrders: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      // Verificar si ya existe un cierre para esta fecha
      const existing = await getCashClosureByUserIdAndDate(userId, input.date);
      if (existing?.status === "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ya existe un cierre de caja pendiente para esta fecha."
        });
      }

      const pending = input.pendingOrders ?? 0;

      return await createCashClosure({
        userId,
        date: input.date,
        initialCash: Math.round(input.initialCash * 100),
        reportedCash: Math.round(input.reportedCash * 100),
        reportedQr: Math.round(input.reportedQr * 100),
        reportedTransfer: Math.round(input.reportedTransfer * 100),
        expectedCash: input.expectedCash, // Ya vienen en centavos del query anterior
        expectedQr: input.expectedQr,
        expectedTransfer: input.expectedTransfer,
        expenses: Math.round((input.expenses || 0) * 100),
        pendingOrders: Math.round(pending * 100),
        status: "pending"
      });
    }),

  // Obtener mi estado de cierre para hoy
  getMyStatus: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user?.id;
      if (!userId) return null;
      return await getCashClosureByUserIdAndDate(userId, input.date);
    }),

  // Obtener monto pendiente de órdenes sin entregar del repartidor
  getPendingOrders: protectedProcedure
    .input(z.object({ userId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const targetUserId = input.userId || ctx.user?.id;
      if (!targetUserId) throw new TRPCError({ code: "BAD_REQUEST" });
      if (ctx.user?.role !== "admin" && targetUserId !== ctx.user?.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await getPendingOrdersTotal(targetUserId);
    }),

  // Listar todos los cierres (Solo Admin)
  listAllClosures: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return await getAllCashClosures();
  }),

  // Listar mis cierres (Repartidor)
  listMyClosures: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user?.id;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await getCashClosuresByUserId(userId);
  }),

  // Aprobar/Rechazar cierre (Solo Admin)
  updateClosureStatus: protectedProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["approved", "rejected"]),
      adminNotes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const result = await updateCashClosure(input.id, {
        status: input.status,
        adminNotes: input.adminNotes
      });

      // Si se aprueba, creamos las transacciones financieras y la próxima apertura
      if (input.status === "approved") {
        const closure = await getCashClosureById(input.id);
        if (closure) {
          // Registrar las transacciones de las entregas pendientes de registrar
          await createFinancialTransactionsForDeliveries(input.id, closure.userId, closure.date);

          const dateStr = getLocalDateKey(new Date()) || closure.date;

          await createCashOpening({
            responsibleUserId: closure.userId,
            openedByUserId: ctx.user!.id,
            openingAmount: 0,
            paymentMethod: "cash",
            openingDate: dateStr,
            status: "open",
            notes: `Apertura automática tras cierre #${input.id}`
          });
        }
      }

      return result;
    }),

  // Historial de transacciones por caja con filtros de fecha
  getBoxHistory: protectedProcedure
    .input(z.object({
      paymentMethod: z.enum(["cash", "qr", "transfer"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.enum(["all", "income", "expense"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const allTransactions = await getFinancialTransactions();
      const allOpenings = await getAllCashOpenings();

      // Filtrar transacciones por método de pago
      let filtered = allTransactions.filter((t: any) => t.paymentMethod === input.paymentMethod);

      // Filtrar openings por método de pago
      const filteredOpenings = allOpenings.filter((o: any) => o.paymentMethod === input.paymentMethod);

      // Filtrar por tipo
      if (input.type !== "all") {
        filtered = filtered.filter((t: any) => t.type === input.type);
      }

      // Filtrar openings por tipo (siempre "income")
      const visibleOpenings = input.type === "expense" ? [] : filteredOpenings;

      // Construir filas de aperturas para intercalar en el historial
      const openingRows = visibleOpenings.map((o: any) => ({
        id: `opening-${o.id}`,
        type: "income",
        category: "cash_opening",
        amount: o.openingAmount,
        paymentMethod: o.paymentMethod,
        notes: `Apertura de caja - ${o.responsibleUserName || `Usuario #${o.responsibleUserId}`}`,
        createdAt: new Date(o.openingDate + "T00:00:00"),
        runningBalance: 0,
        direction: "entry",
        isOpening: true,
      }));

      // Construir filas de transacciones
      const txRows = filtered.map((t: any) => ({
        ...t,
        runningBalance: 0,
        direction: t.type === "income" ? "entry" : "exit",
        isOpening: false,
      }));

      // Combinar y ordenar por fecha descendente
      const allRows = [...openingRows, ...txRows].sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Calcular saldo acumulado partiendo de cero (sin base inicial)
      let runningBalance = 0;
      // Para un saldo correcto, necesitamos empezar desde la apertura más antigua
      // que esté dentro o antes del rango, y aplicar el balance de todas las filas
      // que vienen antes cronológicamente
      const transactionsWithBalance = allRows.map((t: any) => {
        if (t.isOpening) {
          runningBalance += t.amount;
        } else if (t.type === "income") {
          runningBalance += t.amount;
        } else {
          runningBalance -= t.amount;
        }
        return {
          ...t,
          runningBalance,
        };
      });

      return {
        transactions: transactionsWithBalance,
        summary: {
          totalIncome: filtered.filter((t: any) => t.type === "income").reduce((sum: number, t: any) => sum + t.amount, 0)
            + visibleOpenings.reduce((sum: number, o: any) => sum + o.openingAmount, 0),
          totalExpense: filtered.filter((t: any) => t.type === "expense").reduce((sum: number, t: any) => sum + t.amount, 0),
          finalBalance: runningBalance,
          count: transactionsWithBalance.length,
        },
      };
    }),

  // Exportar transacciones de caja a CSV
  exportBoxCsv: protectedProcedure
    .input(z.object({
      paymentMethod: z.enum(["cash", "qr", "transfer"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const allTransactions = await getFinancialTransactions();
      const allUsers = await getAllUsers();

      // Filtrar por método de pago
      let filtered = allTransactions.filter((t: any) => t.paymentMethod === input.paymentMethod);

      // Filtrar por rango de fechas
      if (input.startDate) {
        filtered = filtered.filter((t: any) => {
          const txDate = getLocalDateKey(t.createdAt);
          return txDate && txDate >= input.startDate!;
        });
      }

      if (input.endDate) {
        filtered = filtered.filter((t: any) => {
          const txDate = getLocalDateKey(t.createdAt);
          return txDate && txDate <= input.endDate!;
        });
      }

      // Ordenar por fecha
      filtered.sort((a: any, b: any) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      // Calcular saldo acumulado
      let runningBalance = 0;
      const rows = filtered.map((t: any) => {
        const date = new Date(t.createdAt);
        const user = allUsers.find((u: any) => u.id === t.userId);
        if (t.type === "income") {
          runningBalance += t.amount;
        } else {
          runningBalance -= t.amount;
        }

        return {
          fecha: date.toLocaleDateString("es-BO"),
          hora: date.toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }),
          usuario: user?.name || user?.username || `Usuario #${t.userId}` || "—",
          tipo: t.type === "income" ? "Ingreso" : "Egreso",
          categoria: t.category,
          referencia: t.referenceId ? `#${t.referenceId}` : "—",
          metodo: input.paymentMethod === "cash" ? "Efectivo" : input.paymentMethod === "qr" ? "QR" : "Transferencia",
          monto: t.amount / 100,
          ingreso: t.type === "income" ? t.amount / 100 : "",
          egreso: t.type === "expense" ? t.amount / 100 : "",
          saldo: runningBalance / 100,
          notas: t.notes || "",
        };
      });

      return { rows, methodName: input.paymentMethod === "cash" ? "Caja_Efectivo" : input.paymentMethod === "qr" ? "Caja_QR" : "Cuenta_Bancaria" };
    }),
});
