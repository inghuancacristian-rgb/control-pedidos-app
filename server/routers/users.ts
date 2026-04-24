import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { hashPassword } from "../auth";
import { 
  getAllUsers, 
  getUserByUsername, 
  createUser, 
  updateUser, 
  deleteUser, 
  getUserById 
} from "../db";

export const usersRouter = router({
  // Listar todos los repartidores
  listDeliveryPersons: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const allUsers = await getAllUsers();
    // Devolvemos todos excepto el admin base para que puedan ser gestionados
    return (allUsers as any[]).filter((u: any) => u.username !== "admin");
  }),

  // Obtener un repartidor por ID
  getDeliveryPerson: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const deliveryPerson = await getUserById(input.id);
      if (!deliveryPerson) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Repartidor no encontrado",
        });
      }

      return deliveryPerson;
    }),

  // Crear un nuevo repartidor
  createDeliveryPerson: protectedProcedure
    .input(
      z.object({
        username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
        password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
        name: z.string().min(1, "El nombre es requerido"),
        email: z.string().email("Email inválido").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Verificar que el username no exista
      const existingUser = await getUserByUsername(input.username);
      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "El usuario ya existe",
        });
      }

      const passwordHash = await hashPassword(input.password);

      await createUser({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email,
        role: "user",
        loginMethod: "traditional",
      });

      return {
        success: true,
        message: "Repartidor creado exitosamente",
      };
    }),

  // Editar un repartidor
  updateDeliveryPerson: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1, "El nombre es requerido").optional(),
        email: z.string().email("Email inválido").optional(),
        password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
        role: z.enum(["admin", "user"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.email) updateData.email = input.email;
      if (input.password) updateData.passwordHash = await hashPassword(input.password);
      if (input.role) updateData.role = input.role;

      await updateUser(input.id, updateData);

      return {
        success: true,
      };
    }),

  // Eliminar un repartidor
  deleteDeliveryPerson: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // No permitir eliminar al usuario actual
      if (input.id === ctx.user?.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No puedes eliminar tu propio usuario",
        });
      }

      await deleteUser(input.id);

      return {
        success: true,
      };
    }),

  // Registro público de usuarios
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(3, "El usuario debe tener al menos 3 caracteres"),
        password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
        name: z.string().min(1, "El nombre es requerido"),
        email: z.string().email("Email inválido").optional(),
        role: z.enum(["admin", "user"]).default("user"),
      })
    )
    .mutation(async ({ input }) => {
      // Verificar si el usuario ya existe
      const existingUser = await getUserByUsername(input.username);

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "El nombre de usuario ya está en uso",
        });
      }

      const passwordHash = await hashPassword(input.password);

      const result = await createUser({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email,
        role: input.role,
        loginMethod: "traditional",
      });

      return {
        success: true,
        userId: (result as any).insertId,
      };
    }),
});
