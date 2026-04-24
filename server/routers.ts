import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { ordersRouter } from "./routers/orders";
import { inventoryRouter } from "./routers/inventory";
import { trackingRouter } from "./routers/tracking";
import { customersRouter } from "./routers/customers";
import { statsRouter } from "./routers/stats";
import { usersRouter } from "./routers/users";
import { suppliersRouter } from "./routers/suppliers";
import { purchasesRouter } from "./routers/purchases";
import { financeRouter } from "./routers/finance";
import { salesRouter } from "./routers/sales";
import { auditRouter } from "./routers/audit";
import { reportsRouter } from "./routers/reports";
import { expensesRouter } from "./routers/expenses";
import { quotationsRouter } from "./routers/quotations";
import { couponRouter } from "./routers/coupons";
import { authenticateUser, createSession } from "./auth";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    loginTraditional: publicProcedure
      .input(
        z.object({
          username: z.string().min(1, "Usuario requerido"),
          password: z.string().min(1, "Contraseña requerida"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await authenticateUser(input.username, input.password);

        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Usuario o contraseña incorrectos",
          });
        }

        const sessionId = await createSession(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);

        ctx.res.cookie(COOKIE_NAME, sessionId, {
          ...cookieOptions,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
        };
      }),
  }),

  orders: ordersRouter,
  inventory: inventoryRouter,
  tracking: trackingRouter,
  customers: customersRouter,
  stats: statsRouter,
  users: usersRouter,
  suppliers: suppliersRouter,
  purchases: purchasesRouter,
  finance: financeRouter,
  expenses: expensesRouter,
  sales: salesRouter,
  audit: auditRouter,
  reports: reportsRouter,
  quotations: quotationsRouter,
  coupons: couponRouter,
});

export type AppRouter = typeof appRouter;
