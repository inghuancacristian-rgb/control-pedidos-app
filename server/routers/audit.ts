import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc.js";
import { getDb } from "../db.js";
import {
  auditLog,
  users,
} from "../../drizzle/schema.js";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";

export const auditRouter = router({
  // Listar logs de auditoría con filtros
  list: protectedProcedure
    .input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      action: z.enum(["CREATE", "UPDATE", "DELETE"]).optional(),
      userId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      let conditions: any[] = [];

      if (input?.entityType) {
        conditions.push(eq(auditLog.entityType, input.entityType));
      }
      if (input?.entityId) {
        conditions.push(eq(auditLog.entityId, input.entityId));
      }
      if (input?.action) {
        conditions.push(eq(auditLog.action, input.action));
      }
      if (input?.userId) {
        conditions.push(eq(auditLog.userId, input.userId));
      }
      if (input?.startDate) {
        conditions.push(gte(auditLog.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(auditLog.createdAt, new Date(input.endDate + " 23:59:59")));
      }

      const logs = await db.query.auditLog.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          user: true,
        },
        orderBy: [desc(auditLog.createdAt)],
        limit: input?.limit || 100,
        offset: input?.offset || 0,
      });

      return logs || [];
    }),

  // Obtener historial de una entidad específica
  getEntityHistory: protectedProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const logs = await db.query.auditLog.findMany({
        where: (auditLog, { and, eq }) => and(
          eq(auditLog.entityType, input.entityType),
          eq(auditLog.entityId, input.entityId)
        ),
        with: {
          user: true,
        },
        orderBy: [desc(auditLog.createdAt)],
      });

      return logs || [];
    }),

  // Estadísticas de auditoría
  stats: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { byAction: [], byEntity: [], byUser: [] };

      let conditions: any[] = [];
      if (input?.startDate) {
        conditions.push(gte(auditLog.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(auditLog.createdAt, new Date(input.endDate + " 23:59:59")));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Por tipo de acción
      const byActionRaw = await db
        .select({
          action: auditLog.action,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(auditLog)
        .where(whereClause)
        .groupBy(auditLog.action);

      // Por entidad
      const byEntityRaw = await db
        .select({
          entityType: auditLog.entityType,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(auditLog)
        .where(whereClause)
        .groupBy(auditLog.entityType);

      // Por usuario
      const byUserRaw = await db
        .select({
          userId: auditLog.userId,
          userName: users.name,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(auditLog)
        .leftJoin(users, eq(auditLog.userId, users.id))
        .where(whereClause)
        .groupBy(auditLog.userId, users.name);

      return {
        byAction: byActionRaw,
        byEntity: byEntityRaw,
        byUser: byUserRaw.filter(u => u.userId !== null),
      };
    }),

  // Crear log de auditoría (para uso interno)
  create: publicProcedure
    .input(z.object({
      entityType: z.string(),
      entityId: z.number(),
      action: z.enum(["CREATE", "UPDATE", "DELETE"]),
      userId: z.number().optional(),
      oldValues: z.any().optional(),
      newValues: z.any().optional(),
      description: z.string().optional(),
      ipAddress: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false };

      await db.insert(auditLog).values({
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        userId: input.userId,
        oldValues: input.oldValues ? JSON.stringify(input.oldValues) : null,
        newValues: input.newValues ? JSON.stringify(input.newValues) : null,
        description: input.description,
        ipAddress: input.ipAddress,
      });
      return { success: true };
    }),
});

// Helper para insertar con auditoría
export async function logAudit(
  dbClient: any,
  entityType: string,
  entityId: number,
  action: "CREATE" | "UPDATE" | "DELETE",
  userId: number | undefined,
  oldValues: any,
  newValues: any,
  description: string
) {
  await dbClient.insert(auditLog).values({
    entityType,
    entityId,
    action,
    userId,
    oldValues: oldValues ? JSON.stringify(oldValues) : null,
    newValues: newValues ? JSON.stringify(newValues) : null,
    description,
  });
}