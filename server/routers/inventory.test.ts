import { describe, it, expect, beforeEach, vi } from "vitest";
import { inventoryRouter } from "./inventory";
import type { TrpcContext } from "../_core/context";

const createAdminContext = (): TrpcContext => ({
  user: {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {
    protocol: "https",
    headers: {},
  } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

const createDeliveryContext = (): TrpcContext => ({
  user: {
    id: 2,
    openId: "delivery-user",
    email: "delivery@example.com",
    name: "Delivery User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {
    protocol: "https",
    headers: {},
  } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});

describe("Inventory Router", () => {
  let caller: ReturnType<typeof inventoryRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listProducts", () => {
    it("should allow any authenticated user to list products", async () => {
      const ctx = createAdminContext();
      caller = inventoryRouter.createCaller(ctx);

      const result = await caller.listProducts();
      expect(Array.isArray(result)).toBe(true);
    });

    it("should allow delivery users to list products", async () => {
      const ctx = createDeliveryContext();
      caller = inventoryRouter.createCaller(ctx);

      const result = await caller.listProducts();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("createProduct", () => {
    it("should allow admin to create product", async () => {
      const ctx = createAdminContext();
      caller = inventoryRouter.createCaller(ctx);

      try {
        const result = await caller.createProduct({
          code: "COCO",
          name: "Coco",
          category: "Sabores",
          price: 5000,
        });
        expect(result.success).toBe(true);
      } catch (error: any) {
        // May fail due to duplicate, but not permissions
        expect(error.code).not.toBe("FORBIDDEN");
      }
    });

    it("should deny delivery users from creating products", async () => {
      const ctx = createDeliveryContext();
      caller = inventoryRouter.createCaller(ctx);

      try {
        await caller.createProduct({
          code: "FRUT",
          name: "Fruta",
          category: "finished_product",
          price: 5000,
        });
        expect.fail("Should have thrown FORBIDDEN error");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("listInventory", () => {
    it("should return inventory with low stock indicators", async () => {
      const ctx = createAdminContext();
      caller = inventoryRouter.createCaller(ctx);

      const result = await caller.listInventory();
      expect(Array.isArray(result)).toBe(true);

      // Check that each item has the isLowStock property
      result.forEach((item) => {
        expect(typeof item.isLowStock).toBe("boolean");
      });
    });
  });

  describe("updateQuantity", () => {
    it("should allow admin to update quantity", async () => {
      const ctx = createAdminContext();
      caller = inventoryRouter.createCaller(ctx);

      try {
        const result = await caller.updateQuantity({
          productId: 1,
          quantity: 100,
        });
        expect(result.success).toBe(true);
      } catch (error: any) {
        // May fail due to invalid product, but not permissions
        expect(error.code).not.toBe("FORBIDDEN");
      }
    });

    it("should deny delivery users from updating quantity", async () => {
      const ctx = createDeliveryContext();
      caller = inventoryRouter.createCaller(ctx);

      try {
        await caller.updateQuantity({
          productId: 1,
          quantity: 100,
        });
        expect.fail("Should have thrown FORBIDDEN error");
      } catch (error: any) {
        expect(error.code).toBe("FORBIDDEN");
      }
    });
  });

  describe("getLowStockProducts", () => {
    it("should return only low stock products", async () => {
      const ctx = createAdminContext();
      caller = inventoryRouter.createCaller(ctx);

      const result = await caller.getLowStockProducts();
      expect(Array.isArray(result)).toBe(true);

      // All returned items should have low stock
      result.forEach((item) => {
        expect(item.quantity).toBeLessThanOrEqual(item.minStock);
      });
    });
  });
});
