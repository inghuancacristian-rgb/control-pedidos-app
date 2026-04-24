import { and, desc, eq, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import {
  InsertUser,
  users,
  customers,
  products,
  inventory,
  inventoryMovements,
  orders,
  orderItems,
  payments,
  suppliers,
  purchases,
  purchaseItems,
  accountsPayable,
  deliveryExpenses,
  operationalExpenses,
  InsertOperationalExpense,
  financialTransactions,
  gpsTracking,
  sessions,
  cashClosures,
  cashOpenings,
  InsertCustomer,
  InsertProduct,
  InsertInventory,
  InsertInventoryMovement,
  InsertOrder,
  InsertOrderItem,
  InsertPayment,
  InsertGPSTracking,
  InsertCashClosure,
  InsertCashOpening,
  sales,
  saleItems,
  InsertSale,
  InsertSaleItem,
  auditLog,
  InsertAuditLog,
  quotations,
  quotationItems,
  InsertQuotation,
  InsertQuotationItem,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { getSession } from "./auth";

let _db: any = null;
let _pool: any = null;

const MOCK_DATA_FILE = path.join(process.cwd(), "server", "demo_data.json");

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toValidDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value as any);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getLocalDateKey(value: unknown): string | null {
  const date = toValidDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function syncMocksToDisk() {
  if (process.env.DATABASE_URL) return;
  const data = {
    MOCK_CUSTOMERS,
    MOCK_USERS,
    MOCK_PRODUCTS,
    MOCK_INVENTORY,
    MOCK_ORDERS,
    MOCK_ORDER_ITEMS,
    MOCK_PAYMENTS,
    MOCK_MOVEMENTS,
    MOCK_SUPPLIERS,
    MOCK_PURCHASES,
    MOCK_PURCHASE_ITEMS,
    MOCK_ACCOUNTS_PAYABLE,
    MOCK_DELIVERY_EXPENSES,
    MOCK_OPERATIONAL_EXPENSES,
    MOCK_FINANCIAL_TRANSACTIONS,
    MOCK_CASH_CLOSURES,
    MOCK_CASH_OPENINGS,
    MOCK_SALES,
    MOCK_SALE_ITEMS,
    MOCK_QUOTATIONS,
    MOCK_QUOTATION_ITEMS,
  };
  try {
    fs.writeFileSync(MOCK_DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to sync mocks to disk:", err);
  }
}

const MOCK_CUSTOMERS: any[] = [];
const MOCK_USERS: any[] = [
  { id: 999, username: "admin", passwordHash: "", name: "Administrador (Modo Demo)", role: "admin", openId: "demo_admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(), email: "admin@demo.com", loginMethod: "traditional" }
];
const MOCK_PRODUCTS: any[] = [];
const MOCK_INVENTORY: any[] = [];
const MOCK_ORDERS: any[] = [];
const MOCK_ORDER_ITEMS: any[] = [];
const MOCK_PAYMENTS: any[] = [];
const MOCK_MOVEMENTS: any[] = [];
const MOCK_SUPPLIERS: any[] = [];
const MOCK_PURCHASES: any[] = [];
const MOCK_PURCHASE_ITEMS: any[] = [];
const MOCK_ACCOUNTS_PAYABLE: any[] = [];
const MOCK_DELIVERY_EXPENSES: any[] = [];
const MOCK_OPERATIONAL_EXPENSES: any[] = [];
const MOCK_FINANCIAL_TRANSACTIONS: any[] = [];
const MOCK_CASH_CLOSURES: any[] = [];
const MOCK_CASH_OPENINGS: any[] = [];
const MOCK_QUOTATIONS: any[] = [];
const MOCK_QUOTATION_ITEMS: any[] = [];

function loadMocks() {
  if (process.env.DATABASE_URL || !fs.existsSync(MOCK_DATA_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(MOCK_DATA_FILE, "utf-8"));
    const arrays: Record<string, any[]> = {
      MOCK_CUSTOMERS, MOCK_USERS, MOCK_PRODUCTS, MOCK_INVENTORY,
      MOCK_ORDERS, MOCK_ORDER_ITEMS, MOCK_PAYMENTS, MOCK_MOVEMENTS,
      MOCK_SUPPLIERS, MOCK_PURCHASES, MOCK_PURCHASE_ITEMS,
      MOCK_ACCOUNTS_PAYABLE, MOCK_DELIVERY_EXPENSES,
      MOCK_OPERATIONAL_EXPENSES,
      MOCK_FINANCIAL_TRANSACTIONS, MOCK_CASH_CLOSURES,
      MOCK_CASH_OPENINGS, MOCK_SALES, MOCK_SALE_ITEMS,
      MOCK_QUOTATIONS, MOCK_QUOTATION_ITEMS,
    };
    for (const [key, arr] of Object.entries(arrays)) {
      if (data[key] && Array.isArray(data[key])) {
        arr.length = 0;
        arr.push(...data[key]);
      }
    }

    // Normalizar fechas de cierres antiguos (cuando venían guardados con fecha UTC por error)
    for (const closure of MOCK_CASH_CLOSURES as any[]) {
      const localDate = getLocalDateKey(closure.createdAt);
      if (localDate && closure.date && closure.date !== localDate) {
        closure.date = localDate;
      }
    }

    // Normalizar canal de origen en clientes/pedidos (cuando el campo aún no existía)
    for (const customer of MOCK_CUSTOMERS as any[]) {
      if (!customer.sourceChannel) customer.sourceChannel = "other";
    }
    for (const order of MOCK_ORDERS as any[]) {
      if (!order.sourceChannel) order.sourceChannel = "other";
    }
    console.log("[DB] Demo Mode: Data loaded from disk");
  } catch (err) {
    console.error("Failed to load mocks from disk:", err);
  }
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      if (!_pool) {
        _pool = mysql.createPool(process.env.DATABASE_URL);
      }
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  // openId es requerido solo para usuarios OAuth
  if (!user.openId && !user.username) {
    throw new Error("Either openId or username is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    // Si es un usuario tradicional (tiene username), actualizar por username
    if (user.username) {
      const result = await db.select().from(users).where(eq(users.username, user.username)).limit(1);
      
      if (result.length > 0) {
        // Usuario existe, actualizar
        const updateData: any = {};
        if (user.lastSignedIn !== undefined) updateData.lastSignedIn = user.lastSignedIn;
        if (user.name !== undefined) updateData.name = user.name;
        if (user.email !== undefined) updateData.email = user.email;
        if (user.role !== undefined) updateData.role = user.role;
        
        if (Object.keys(updateData).length > 0) {
          await db.update(users).set(updateData).where(eq(users.username, user.username));
        }
        return;
      }
    }

    // Para usuarios OAuth o nuevos usuarios tradicionales
    if (!user.openId) {
      user.openId = "";
    }

    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "username", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) {
    return MOCK_USERS.find(u => u.username === username);
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createUser(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = Math.floor(Math.random() * 1000) + 100;
    const newUser = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date() };
    MOCK_USERS.push(newUser);
    console.log("[DB] Demo Mode: User registered in memory", data.username);
    return { insertId: newId };
  }
  return await db.insert(users).values(data);
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) {
    return MOCK_USERS;
  }
  return await db.select().from(users);
}

export async function updateUser(id: number, data: any) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_USERS.findIndex(u => u.id === id);
    if (index !== -1) {
      MOCK_USERS[index] = { ...MOCK_USERS[index], ...data, updatedAt: new Date() };
      console.log("[DB] Demo Mode: User updated in memory", id);
      return { success: true };
    }
    return { success: false };
  }
  return await db.update(users).set(data).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_USERS.findIndex(u => u.id === id);
    if (index !== -1) {
      MOCK_USERS.splice(index, 1);
      console.log("[DB] Demo Mode: User deleted from memory", id);
      return { success: true };
    }
    return { success: false };
  }
  return await db.delete(users).where(eq(users.id, id));
}

export async function getUserById(id: number) {
  // Fallback para administrador predeterminado
  if (id === 999) {
    return {
      id: 999,
      username: "admin",
      name: "Administrador (Modo Demo)",
      role: "admin" as const,
      openId: "demo_admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
      email: "admin@demo.com",
      loginMethod: "traditional"
    };
  }

  const db = await getDb();
  if (!db) {
    const user = MOCK_USERS.find(u => u.id === id);
    if (user) return user;
    console.warn("[Database] User not found in memory (Demo Mode):", id);
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateLastSignedInById(userId: number) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_USERS.findIndex(u => u.id === userId);
    if (index !== -1) {
      MOCK_USERS[index].lastSignedIn = new Date();
    }
    return;
  }

  try {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
  } catch (error) {
    console.warn("[Database] Failed to update lastSignedIn:", error);
  }
}

// Clientes
// Clientes

export async function getCustomerByNumber(clientNumber: string) {
  const db = await getDb();
  if (!db) {
    return MOCK_CUSTOMERS.find(c => c.clientNumber === clientNumber) || null;
  }
  const result = await db.select().from(customers).where(eq(customers.clientNumber, clientNumber)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getCustomerById(customerId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_CUSTOMERS.find((customer) => customer.id === customerId) || null;
  }
  const result = await db.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllCustomers() {
  const db = await getDb();
  if (!db) return MOCK_CUSTOMERS;
  return await db.select().from(customers);
}

export async function searchCustomers(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const allCustomers = await getAllCustomers();
  return allCustomers
    .filter((customer: any) =>
      customer.clientNumber?.toLowerCase().includes(normalizedQuery) ||
      customer.name?.toLowerCase().includes(normalizedQuery) ||
      customer.phone?.toLowerCase().includes(normalizedQuery) ||
      customer.whatsapp?.toLowerCase().includes(normalizedQuery) ||
      customer.zone?.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, 8);
}



export async function createCustomer(data: InsertCustomer) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_CUSTOMERS.length + 1;
    const newCustomer = { ...data, id: newId, createdAt: new Date() };
    MOCK_CUSTOMERS.push(newCustomer);
    return { insertId: newId };
  }
  return await db.insert(customers).values(data);
}

export async function updateCustomer(customerId: number, data: Partial<InsertCustomer>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_CUSTOMERS.findIndex((customer) => customer.id === customerId);
    if (index !== -1) {
      MOCK_CUSTOMERS[index] = { ...MOCK_CUSTOMERS[index], ...data, updatedAt: new Date() };
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }

  return await db.update(customers).set(data).where(eq(customers.id, customerId));
}

// Productos
export async function updateProductPrice(productId: number, price: number) {
  const db = await getDb();
  if (!db) return; // Ignorar en modo demo
  return await db.update(products).set({ price }).where(eq(products.id, productId));
}

export async function updateProduct(productId: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_PRODUCTS.findIndex(p => p.id === productId);
    if (index !== -1) {
      MOCK_PRODUCTS[index] = { ...MOCK_PRODUCTS[index], ...data, updatedAt: new Date() };
      syncMocksToDisk();
    }
    return;
  }
  return await db.update(products).set(data).where(eq(products.id, productId));
}

export async function getProductById(productId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_PRODUCTS.find((product) => product.id === productId);
  }
  const result = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Almacenamiento en memoria para modo demo (persistente mientras el servidor corra)
// Almacenamiento en memoria para modo demo (persistente mientras el servidor corra)
// Productos

export async function getAllProducts() {
  const db = await getDb();
  if (!db) return MOCK_PRODUCTS;
  return await db.select().from(products);
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_PRODUCTS.length + 1;
    const newProduct = { ...data, id: newId, salePrice: data.salePrice || 0, createdAt: new Date(), updatedAt: new Date() };
    MOCK_PRODUCTS.push(newProduct);
    
    // Crear registro de inventario mock
    MOCK_INVENTORY.push({
      id: MOCK_INVENTORY.length + 1,
      productId: newId,
      quantity: 0,
      minStock: 10,
      lastUpdated: new Date()
    });
    
    syncMocksToDisk();
    console.log("[DB] Demo Mode: Product created in memory", newProduct);
    return { insertId: newId };
  }
  
  try {
    console.log("[DB] Creating product with data:", JSON.stringify(data, null, 2));
    
    // Crear el producto
    const result = await db.insert(products).values(data);
    
    // Obtener el ID del producto creado
    let productId: number | null = null;
    if (result && typeof result === 'object') {
      productId = (result as any).insertId || null;
    }
    
    // Crear automáticamente un registro de inventario con stock inicial de 0
    if (productId) {
      await db.insert(inventory).values({
        productId,
        quantity: 0,
        minStock: 5,
      });
    }
    
    return result;
  } catch (error: any) {
    console.error("[DB] Error creating product:", error);
    throw error;
  }
}

// Inventario
export async function getInventoryByProductId(productId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_INVENTORY.find(inv => inv.productId === productId);
  }
  const result = await db.select().from(inventory).where(eq(inventory.productId, productId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllInventory() {
  const db = await getDb();
  if (!db) return MOCK_INVENTORY;
  return await db.select().from(inventory);
}

export async function updateInventory(productId: number, quantity: number, expiryDate?: string | null) {
  const db = await getDb();
  if (!db) {
    const inv = MOCK_INVENTORY.find(inv => inv.productId === productId);
    if (inv) {
      inv.quantity = quantity;
      if (expiryDate !== undefined) {
        inv.expiryDate = expiryDate ? new Date(expiryDate) : null;
      }
      inv.lastUpdated = new Date();
      syncMocksToDisk();
    }
    return;
  }
  const updateData: any = { quantity };
  if (expiryDate !== undefined) {
    updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
  }
  return await db.update(inventory).set(updateData).where(eq(inventory.productId, productId));
}

// Pedidos
// Pedidos

export async function getOrderByNumber(orderNumber: string) {
  const db = await getDb();
  if (!db) return MOCK_ORDERS.find(o => o.orderNumber === orderNumber);
  const result = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllOrders() {
  const db = await getDb();
  if (!db) {
    // Resolver nombres de repartidores en modo demo
    return MOCK_ORDERS.map(order => {
      const deliveryPerson = MOCK_USERS.find(u => u.id === order.deliveryPersonId);
      const customer = MOCK_CUSTOMERS.find(c => c.id === order.customerId);
      // Incluir el administrador demo si es el repartidor 999
      const adminName = order.deliveryPersonId === 999 ? "Administrador (Demo)" : null;
      return {
        ...order,
        deliveryPersonName: deliveryPerson?.name || adminName || null,
        customerPhone: customer?.phone || null,
        customerWhatsapp: customer?.whatsapp || null,
      };
    });
  }
  const result = await db.select({
    ...orders,
    deliveryPersonName: users.name,
    customerPhone: customers.phone,
    customerWhatsapp: customers.whatsapp,
  }).from(orders)
    .leftJoin(users, eq(orders.deliveryPersonId, users.id))
    .leftJoin(customers, eq(orders.customerId, customers.id));
  return result;
}

// Deduce inventory when an order is created
export async function deductInventoryForOrder(orderId: number, orderNumber: string, items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) {
    for (const item of items) {
      const inv = MOCK_INVENTORY.find(i => i.productId === item.productId);
      if (inv && inv.quantity > 0) {
        const deductQty = Math.min(item.quantity, inv.quantity);
        inv.quantity -= deductQty;
        inv.lastUpdated = new Date();
      } else if (inv) {
        inv.quantity -= item.quantity;
        inv.lastUpdated = new Date();
      }
      MOCK_MOVEMENTS.push({
        id: MOCK_MOVEMENTS.length + 1,
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: `Pedido reservado ${orderNumber}`,
        orderId: orderId,
        createdAt: new Date()
      });
    }
    syncMocksToDisk();
    return;
  }

  await db.transaction(async (tx: any) => {
    for (const item of items) {
      const invRows = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
      const inv = invRows[0];
      if (inv) {
        const newQty = inv.quantity - item.quantity;
        await tx.update(inventory).set({ quantity: newQty, lastUpdated: new Date() })
          .where(eq(inventory.productId, item.productId));
      }
      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: `Pedido reservado ${orderNumber}`,
        orderId: orderId,
        createdAt: new Date()
      });
    }
  });
}

// Restore inventory when an order is cancelled
export async function restoreInventoryForOrder(orderId: number, orderNumber: string, items: InsertOrderItem[]) {
  const db = await getDb();
  if (!db) {
    for (const item of items) {
      const inv = MOCK_INVENTORY.find(i => i.productId === item.productId);
      if (inv) {
        inv.quantity += item.quantity;
        inv.lastUpdated = new Date();
      }
      MOCK_MOVEMENTS.push({
        id: MOCK_MOVEMENTS.length + 1,
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Pedido cancelado ${orderNumber}`,
        orderId: orderId,
        createdAt: new Date()
      });
    }
    syncMocksToDisk();
    return;
  }

  await db.transaction(async (tx: any) => {
    for (const item of items) {
      const invRows = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
      const inv = invRows[0];
      if (inv) {
        await tx.update(inventory).set({ quantity: inv.quantity + item.quantity, lastUpdated: new Date() })
          .where(eq(inventory.productId, item.productId));
      }
      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Pedido cancelado ${orderNumber}`,
        orderId: orderId,
        createdAt: new Date()
      });
    }
  });
}

export async function createOrder(data: InsertOrder) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_ORDERS.length + 1;
    const newOrder = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date(), deliveryPersonName: null };
    MOCK_ORDERS.push(newOrder);
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(orders).values(data);
}

export async function updateOrder(orderId: number, data: Partial<InsertOrder>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_ORDERS.findIndex(o => o.id === orderId);
    if (index !== -1) {
      const oldStatus = MOCK_ORDERS[index].status;
      MOCK_ORDERS[index] = { ...MOCK_ORDERS[index], ...data, updatedAt: new Date() };
      
      // Si el estado cambia a delivered, registrar ingreso automático
      if (data.status === "delivered" && oldStatus !== "delivered") {
        MOCK_FINANCIAL_TRANSACTIONS.push({
          id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
          type: "income",
          category: "sale",
          amount: MOCK_ORDERS[index].totalPrice,
          referenceId: orderId,
          notes: "Venta Pedido " + MOCK_ORDERS[index].orderNumber,
          paymentMethod: MOCK_ORDERS[index].paymentMethod || "cash",
          createdAt: new Date()
        });
      }
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  return await db.update(orders).set(data).where(eq(orders.id, orderId));
}

// Repartidores
export async function getAllDeliveryPersons() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).where(eq(users.role, "user"));
}

export async function createDeliveryPerson(data: InsertUser) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(users).values(data);
}

export async function updateDeliveryPerson(userId: number, data: Partial<InsertUser>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.update(users).set(data).where(eq(users.id, userId));
}

export async function deleteDeliveryPerson(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.delete(users).where(eq(users.id, userId));
}

export async function getOrderById(orderId: number) {
  const db = await getDb();
  if (!db) return MOCK_ORDERS.find(o => o.id === orderId);
  const result = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}


export async function completeOrderDelivery(orderId: number, method: "cash" | "qr" | "transfer") {
  const db = await getDb();
  if (!db) {
    // Modo demo: actualizar estado y movimiento de entrega en mock
    const order = MOCK_ORDERS.find(o => o.id === orderId);
    if (order && order.status !== "delivered") {
      order.status = "delivered";
      order.paymentStatus = "completed";
      order.paymentMethod = method;
      order.deliveredAt = new Date();
      order.updatedAt = new Date();

      // Registrar movimiento de entrega (stock ya descontado al crear pedido)
      const items = MOCK_ORDER_ITEMS.filter(item => item.orderId === orderId);
      for (const item of items) {
        MOCK_MOVEMENTS.push({
          id: MOCK_MOVEMENTS.length + 1,
          productId: item.productId,
          type: "exit",
          quantity: item.quantity,
          reason: `Entrega Pedido ${order.orderNumber}`,
          orderId: orderId,
          createdAt: new Date()
        });
      }

      // NO creamos transacción financiera aún — se crea al aprobar el cierre de caja
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }

  // Real DB Transaction
  return await db.transaction(async (tx: any) => {
    const orderRows = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    const order = orderRows[0];
    if (!order || order.status === "delivered") return { success: false };

    await tx.update(orders).set({
      status: "delivered",
      paymentStatus: "completed",
      paymentMethod: method,
      deliveredAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(orders.id, orderId));

    // Registrar movimiento de entrega (stock ya descontado al crear pedido)
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: `Entrega Pedido ${order.orderNumber}`,
        orderId: orderId,
        userId: order.deliveryPersonId,
        createdAt: new Date()
      });
    }

    // NO creamos transacción financiera — se crea al aprobar el cierre de caja
    return { success: true };
  });
}


// Items de Pedidos

export async function createOrderItem(data: InsertOrderItem) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_ORDER_ITEMS.length + 1;
    MOCK_ORDER_ITEMS.push({ ...data, id: newId });
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(orderItems).values(data);
}

export async function deleteOrderItems(orderId: number) {
  const db = await getDb();
  if (!db) {
    const originalLength = MOCK_ORDER_ITEMS.length;
    // Filtrar items que NO pertenezcan a este pedido
    const filtered = MOCK_ORDER_ITEMS.filter(item => item.orderId !== orderId);
    MOCK_ORDER_ITEMS.length = 0;
    MOCK_ORDER_ITEMS.push(...filtered);
    syncMocksToDisk();
    return { success: true };
  }
  return await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
}

// Pagos

export async function createPayment(data: InsertPayment) {
  const db = await getDb();
  if (!db) {
    const newPayment = { ...data, id: MOCK_PAYMENTS.length + 1, createdAt: new Date() };
    MOCK_PAYMENTS.push(newPayment);
    // Actualizar el estado de pago del pedido en mock
    const order = MOCK_ORDERS.find((o: any) => o.id === data.orderId);
    if (order) {
      order.paymentStatus = "completed";
      order.paymentMethod = data.method;
    }
    syncMocksToDisk();
    return newPayment;
  }
  return await db.insert(payments).values(data);
}

export async function updatePayment(paymentId: number, data: Partial<InsertPayment>) {
  const db = await getDb();
  if (!db) {
    const idx = MOCK_PAYMENTS.findIndex((p: any) => p.id === paymentId);
    if (idx >= 0) {
      MOCK_PAYMENTS[idx] = { ...MOCK_PAYMENTS[idx], ...data };
      // Actualizar el estado de pago del pedido en mock
      const order = MOCK_ORDERS.find((o: any) => o.id === MOCK_PAYMENTS[idx].orderId);
      if (order) {
        order.paymentStatus = "completed";
        if (data.method) order.paymentMethod = data.method;
      }
    }
    syncMocksToDisk();
    return;
  }
  return await db.update(payments).set(data).where(eq(payments.id, paymentId));
}

// Rastreo GPS
export async function createGPSTracking(data: InsertGPSTracking) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(gpsTracking).values(data);
}

export async function getLatestGPSTracking(orderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gpsTracking).where(eq(gpsTracking.orderId, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getGPSTrackingHistory(orderId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(gpsTracking).where(eq(gpsTracking.orderId, orderId));
}

// Movimientos de Inventario

export async function createInventoryMovement(data: InsertInventoryMovement) {
  const db = await getDb();
  if (!db) {
    MOCK_MOVEMENTS.push({ ...data, id: MOCK_MOVEMENTS.length + 1, createdAt: new Date() });
    syncMocksToDisk();
    return;
  }
  return await db.insert(inventoryMovements).values(data);
}

export async function getInventoryMovements(productId: number) {
  const db = await getDb();
  if (!db) {
    const movements = MOCK_MOVEMENTS.filter(m => m.productId === productId);
    return movements.map(m => {
      const u = MOCK_USERS.find(user => user.id === m.userId);
      const o = MOCK_ORDERS.find(order => order.id === m.orderId);
      const s = MOCK_SALES.find(sale => sale.id === m.saleId);
      const dp = o ? MOCK_USERS.find(user => user.id === o.deliveryPersonId) : null;
      return {
        ...m,
        userName: u?.name || u?.username || null,
        userRole: u?.role || null,
        orderNumber: o?.orderNumber || null,
        saleNumber: s?.saleNumber || null,
        deliveryPersonName: dp?.name || null,
        orderStatus: o?.status || null,
      };
    });
  }

  return await db.select({
    id: inventoryMovements.id,
    productId: inventoryMovements.productId,
    type: inventoryMovements.type,
    quantity: inventoryMovements.quantity,
    reason: inventoryMovements.reason,
    notes: inventoryMovements.notes,
    userId: inventoryMovements.userId,
    orderId: inventoryMovements.orderId,
    saleId: inventoryMovements.saleId,
    createdAt: inventoryMovements.createdAt,
    userName: users.name,
    userRole: users.role,
    orderNumber: orders.orderNumber,
    saleNumber: sales.saleNumber,
    deliveryPersonName: sql<string>`(select name from ${users} where ${users.id} = (select ${orders.deliveryPersonId} from ${orders} where ${orders.id} = ${inventoryMovements.orderId}))`,
    orderStatus: sql<string>`(select ${orders.status} from ${orders} where ${orders.id} = ${inventoryMovements.orderId})`,
  })
  .from(inventoryMovements)
  .leftJoin(users, eq(inventoryMovements.userId, users.id))
  .leftJoin(orders, eq(inventoryMovements.orderId, orders.id))
  .leftJoin(sales, eq(inventoryMovements.saleId, sales.id))
  .where(eq(inventoryMovements.productId, productId));
}


export async function getOrderItems(orderId: number) {
  const db = await getDb();
  
  if (!db) {
    const items = MOCK_ORDER_ITEMS.filter(item => item.orderId === orderId);
    return items.map(item => {
      const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product ? product.name : "Producto #" + item.productId
      };
    });
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  
  // Obtener nombres de productos
  const itemsWithProductNames = await Promise.all(
    items.map(async (item: any) => {
      const productResult = await db
        .select({ name: products.name })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);
      return {
        ...item,
        productName: productResult.length > 0 ? productResult[0].name : "Producto #" + item.productId,
      };
    })
  );
  
  return itemsWithProductNames;
}



export async function getPaymentByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) {
    const found = (MOCK_PAYMENTS as any[]).find((p: any) => p.orderId === orderId);
    return found || undefined;
  }
  const result = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// --- MÓDULO FINANCIERO Y COMPRAS (DEMO MODE) ---

// Proveedores
export async function getAllSuppliers() {
  const db = await getDb();
  if (!db) return MOCK_SUPPLIERS;
  return await db.select().from(suppliers);
}

export async function createSupplier(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_SUPPLIERS.length + 1;
    const newSupplier = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date() };
    MOCK_SUPPLIERS.push(newSupplier);
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(suppliers).values(data);
}

export async function getPurchaseById(id: number) {
  const db = await getDb();
  if (!db) {
    const purchase = MOCK_PURCHASES.find(p => p.id === id);
    if (purchase) {
      const supplier = MOCK_SUPPLIERS.find(s => s.id === purchase.supplierId);
      return { ...purchase, supplierName: supplier?.name || "Proveedor Desconocido" };
    }
    return null;
  }
  const result = await db.select({
    ...purchases,
    supplierName: suppliers.name,
  }).from(purchases).leftJoin(suppliers, eq(purchases.supplierId, suppliers.id)).where(eq(purchases.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Compras
export async function getAllPurchases() {
  const db = await getDb();
  if (!db) {
    return MOCK_PURCHASES.map(p => {
      const supplier = MOCK_SUPPLIERS.find(s => s.id === p.supplierId);
      return { ...p, supplierName: supplier?.name || "Proveedor Desconocido" };
    });
  }
  return await db.select({
    ...purchases,
    supplierName: suppliers.name,
  }).from(purchases).leftJoin(suppliers, eq(purchases.supplierId, suppliers.id));
}

export async function getPurchaseItems(purchaseId: number) {
  const db = await getDb();
  if (!db) {
    const items = MOCK_PURCHASE_ITEMS.filter(i => i.purchaseId === purchaseId);
    return items.map(item => {
      const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || "Producto #" + item.productId,
        productCode: product?.code || ""
      };
    });
  }
  
  const result = await db.select({
    id: purchaseItems.id,
    purchaseId: purchaseItems.purchaseId,
    productId: purchaseItems.productId,
    quantity: purchaseItems.quantity,
    price: purchaseItems.price,
    expiryDate: purchaseItems.expiryDate,
    createdAt: purchaseItems.createdAt,
    productName: products.name,
    productCode: products.code,
  })
  .from(purchaseItems)
  .leftJoin(products, eq(purchaseItems.productId, products.id))
  .where(eq(purchaseItems.purchaseId, purchaseId));
  
  return result;
}

export async function getPurchasesByProductId(productId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_PURCHASE_ITEMS
      .filter((item: any) => item.productId === productId)
      .map((item: any) => {
        const purchase = MOCK_PURCHASES.find((entry: any) => entry.id === item.purchaseId);
        const supplier = MOCK_SUPPLIERS.find((entry: any) => entry.id === purchase?.supplierId);

        return {
          ...item,
          purchaseNumber: purchase?.purchaseNumber || `COMPRA-${item.purchaseId}`,
          purchaseStatus: purchase?.status || "pending",
          supplierName: supplier?.name || "Proveedor desconocido",
          orderDate: purchase?.orderDate || purchase?.createdAt || item.createdAt,
          purchaseCreatedAt: purchase?.createdAt || item.createdAt,
        };
      });
  }

  return await db
    .select({
      id: purchaseItems.id,
      purchaseId: purchaseItems.purchaseId,
      productId: purchaseItems.productId,
      quantity: purchaseItems.quantity,
      price: purchaseItems.price,
      expiryDate: purchaseItems.expiryDate,
      createdAt: purchaseItems.createdAt,
      purchaseNumber: purchases.purchaseNumber,
      purchaseStatus: purchases.status,
      orderDate: purchases.orderDate,
      purchaseCreatedAt: purchases.createdAt,
      supplierName: suppliers.name,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(eq(purchaseItems.productId, productId));
}

export async function createPurchase(purchaseData: any, items: any[]) {
  const db = await getDb();
  if (!db) {
    const purchaseId = MOCK_PURCHASES.length + 1;
    const newPurchase = { 
      ...purchaseData, 
      id: purchaseId, 
      createdAt: new Date(), 
      updatedAt: new Date(),
      status: purchaseData.status || "pending"
    };
    MOCK_PURCHASES.push(newPurchase);

    // Agregar items
    for (const item of items) {
      MOCK_PURCHASE_ITEMS.push({
        ...item,
        id: MOCK_PURCHASE_ITEMS.length + 1,
        purchaseId,
        createdAt: new Date()
      });
    }

    // Si se recibe inmediatamente, procesar stock
    if (newPurchase.status === "received") {
      await processPurchaseImpact(purchaseId, items, newPurchase);
    }
    syncMocksToDisk();
    return { insertId: purchaseId };
  }
  
  // Real DB logic
  return await db.transaction(async (tx: any) => {
    const [result] = await tx.insert(purchases).values(purchaseData);
    const id = (result as any).insertId;
    
    for (const item of items) {
      await tx.insert(purchaseItems).values({ ...item, purchaseId: id });
      
      // Actualizar stock en DB real si es 'received'
      if (purchaseData.status === "received") {
        const existing = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
        if (existing.length > 0) {
          await tx.update(inventory).set({ 
            quantity: existing[0].quantity + Number(item.quantity),
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : existing[0].expiryDate,
            lastUpdated: new Date()
          }).where(eq(inventory.productId, item.productId));
        } else {
          await tx.insert(inventory).values({
            productId: item.productId,
            quantity: Number(item.quantity),
            minStock: 10,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            lastUpdated: new Date()
          });
        }
      }
    }
    return result;
  });
}

// Función interna para procesar impacto de compra (Inventario + Finanzas)
async function processPurchaseImpact(purchaseId: number, items: any[], purchase: any) {
  // 1. Actualizar Stock
  for (const item of items) {
    const productId = Number(item.productId);
    const qtyToAdd = Number(item.quantity);
    const currentInv = MOCK_INVENTORY.find(i => Number(i.productId) === productId);
    if (currentInv) {
      currentInv.quantity += qtyToAdd;
      if (item.expiryDate) currentInv.expiryDate = item.expiryDate;
      currentInv.lastUpdated = new Date();
    } else {
      MOCK_INVENTORY.push({
        id: MOCK_INVENTORY.length + 1,
        productId: item.productId,
        quantity: qtyToAdd,
        minStock: 10,
        expiryDate: item.expiryDate || null,
        lastUpdated: new Date()
      });
    }
  }

  // 2. Transacción Financiera
  MOCK_FINANCIAL_TRANSACTIONS.push({
    id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
    type: "expense",
    category: "purchase",
    amount: purchase.totalAmount,
    referenceId: purchaseId,
    notes: "Compra " + (purchase.purchaseNumber || ""),
    paymentMethod: purchase.paymentMethod || "cash",
    createdAt: new Date()
  });

  // 3. Cuentas por Pagar (si es crédito)
  if (purchase.isCredit) {
    MOCK_ACCOUNTS_PAYABLE.push({
      id: MOCK_ACCOUNTS_PAYABLE.length + 1,
      purchaseId,
      amount: purchase.totalAmount,
      status: "unpaid",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días default
      createdAt: new Date()
    });
  }
  syncMocksToDisk();
}

// Función para registrar una entrada de inventario como una compra financiera
export async function recordInventoryEntryAsPurchase(
  productId: number,
  quantity: number,
  price: number,
  expiryDate?: string | null,
  reason?: string,
  paymentMethod?: "cash" | "qr" | "transfer",
  userId?: number
) {
  const db = await getDb();
  const method = paymentMethod || "cash";
  if (!db) {
    // Proveedor genÃ©rico para compras rÃ¡pidas (mejor lectura en UI)
    const supplierName = "Compra rÃ¡pida (sistema)";
    let supplier = (MOCK_SUPPLIERS as any[]).find((s: any) => s?.name === supplierName);
    if (!supplier) {
      supplier = {
        id: (MOCK_SUPPLIERS as any[]).length + 1,
        name: supplierName,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      (MOCK_SUPPLIERS as any[]).push(supplier);
    }

    const purchaseId = MOCK_PURCHASES.length + 1;
    const purchaseNumber = `COMPRA-INV-${purchaseId}`;
    const newPurchase = {
      id: purchaseId,
      purchaseNumber,
      supplierId: supplier.id,
      orderDate: new Date(),
      totalAmount: quantity * price,
      status: "received",
      paymentStatus: "paid",
      paymentMethod: method,
      isCredit: 0,
      notes: (reason || "Entrada manual de inventario") + " (Auto-registrado)",
      createdAt: new Date(),
      updatedAt: new Date()
    };
    MOCK_PURCHASES.push(newPurchase);
    MOCK_PURCHASE_ITEMS.push({
      id: MOCK_PURCHASE_ITEMS.length + 1,
      purchaseId,
      productId,
      quantity,
      price,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      createdAt: new Date()
    });

    MOCK_FINANCIAL_TRANSACTIONS.push({
      id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
      type: "expense",
      category: "purchase",
      amount: quantity * price,
      referenceId: purchaseId,
      notes: `Compra Inventario ${purchaseNumber}`,
      paymentMethod: method,
      userId,
      createdAt: new Date()
    });

    syncMocksToDisk();
    return { insertId: purchaseId };
  }
  
  // Real DB: crear registro de compra + item + transacciÃ³n financiera (sin reimpactar stock)
  return await db.transaction(async (tx: any) => {
    const supplierName = "Compra rÃ¡pida (sistema)";
    const supplierRows = await tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(eq(suppliers.name, supplierName))
      .limit(1);
    let supplierId = supplierRows[0]?.id as number | undefined;

    if (!supplierId) {
      const created = await tx.insert(suppliers).values({ name: supplierName });
      supplierId = (created as any).insertId as number;
    }

    const purchaseNumber = `COMPRA-INV-${Date.now()}`;
    const totalAmount = quantity * price;

    const purchaseInsert = await tx.insert(purchases).values({
      supplierId,
      purchaseNumber,
      orderDate: new Date(),
      totalAmount,
      status: "received",
      paymentStatus: "paid",
      paymentMethod: method,
      isCredit: 0,
    });

    const purchaseId = (purchaseInsert as any).insertId as number;

    await tx.insert(purchaseItems).values({
      purchaseId,
      productId,
      quantity,
      price,
      expiryDate: expiryDate || null,
    });

    await tx.insert(financialTransactions).values({
      type: "expense",
      category: "purchase",
      amount: totalAmount,
      paymentMethod: method,
      userId: userId ?? null,
      referenceId: purchaseId,
      notes: `Compra Inventario ${purchaseNumber}`,
      createdAt: new Date(),
    });

    return { insertId: purchaseId };
  });
}

// Finanzas y Gastos
export async function createFinancialTransaction(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_FINANCIAL_TRANSACTIONS.length + 1;
    MOCK_FINANCIAL_TRANSACTIONS.push({ ...data, id: newId, createdAt: new Date() });
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(financialTransactions).values(data);
}

export async function getFinancialTransactions(userId?: number) {
  const db = await getDb();
  if (!db) {
    if (userId) {
      return MOCK_FINANCIAL_TRANSACTIONS.filter((t: any) => {
        if (t.userId === userId) return true;

        // Backfill para transacciones antiguas sin userId (ventas)
        if (!t.userId && (t.category === "sale" || t.category === "sale_cancellation") && t.referenceId) {
          const sale = MOCK_SALES.find((s: any) => s.id === t.referenceId);
          return sale?.soldBy === userId;
        }

        return false;
      });
    }
    return MOCK_FINANCIAL_TRANSACTIONS;
  }
  const query = db.select().from(financialTransactions);
  if (userId) {
    return await query.where(eq(financialTransactions.userId, userId));
  }
  return await query;
}

export async function createDeliveryExpense(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_DELIVERY_EXPENSES.length + 1;
    const expense = { ...data, id: newId, createdAt: new Date() };
    MOCK_DELIVERY_EXPENSES.push(expense);
    
    // Impacto financiero automático
    await createFinancialTransaction({
      type: "expense",
      category: data.type === "fuel" ? "fuel" : "subsistence",
      amount: data.amount,
      notes: data.notes || "Gasto de repartidor",
      paymentMethod: "cash",
      userId: data.deliveryPersonId,
      referenceId: data.orderId || null
    });
    
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(deliveryExpenses).values(data);
}

// Gastos Operativos
export async function getOperationalExpenses() {
  const db = await getDb();
  if (!db) {
    return MOCK_OPERATIONAL_EXPENSES.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  return await db.select().from(operationalExpenses).orderBy(desc(operationalExpenses.createdAt));
}

export async function getOperationalExpenseById(id: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_OPERATIONAL_EXPENSES.find((e: any) => e.id === id);
  }
  const result = await db.select().from(operationalExpenses).where(eq(operationalExpenses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOperationalExpense(data: any) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_OPERATIONAL_EXPENSES.length + 1;
    const expense = { ...data, id: newId, createdAt: new Date(), updatedAt: new Date() };
    MOCK_OPERATIONAL_EXPENSES.push(expense);

    // Si está marcado como pagado, crear transacción financiera automáticamente
    if (data.status === "paid") {
      await createFinancialTransaction({
        type: "expense",
        category: data.category,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        notes: data.description,
        referenceId: newId
      });
    }

    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(operationalExpenses).values(data);
}

export async function updateOperationalExpense(id: number, data: any) {
  const db = await getDb();
  const oldExpense = await getOperationalExpenseById(id);

  if (!db) {
    const index = MOCK_OPERATIONAL_EXPENSES.findIndex((e: any) => e.id === id);
    if (index !== -1) {
      MOCK_OPERATIONAL_EXPENSES[index] = {
        ...MOCK_OPERATIONAL_EXPENSES[index],
        ...data,
        updatedAt: new Date()
      };

      // Si cambia de pendiente a pagado, crear transacción financiera
      if (oldExpense?.status === "pending" && data.status === "paid") {
        await createFinancialTransaction({
          type: "expense",
          category: data.category || oldExpense.category,
          amount: data.amount || oldExpense.amount,
          paymentMethod: data.paymentMethod || oldExpense.paymentMethod,
          notes: data.description || oldExpense.description,
          referenceId: id
        });
      }

      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }

  const result = await db.update(operationalExpenses).set({ ...data, updatedAt: new Date() })
    .where(eq(operationalExpenses.id, id));

  // Si cambia de pendiente a pagado
  if (oldExpense?.status === "pending" && data.status === "paid") {
    await createFinancialTransaction({
      type: "expense",
      category: data.category || oldExpense.category,
      amount: data.amount || oldExpense.amount,
      paymentMethod: data.paymentMethod || oldExpense.paymentMethod,
      notes: data.description || oldExpense.description,
      referenceId: id
    });
  }

  return result;
}

export async function deleteOperationalExpense(id: number) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_OPERATIONAL_EXPENSES.findIndex((e: any) => e.id === id);
    if (index !== -1) {
      MOCK_OPERATIONAL_EXPENSES.splice(index, 1);
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  return await db.delete(operationalExpenses).where(eq(operationalExpenses.id, id));
}

// Aperturas de Caja
export async function getCashOpeningByUserIdAndDateMethod(userId: number, openingDate: string, paymentMethod: string) {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_OPENINGS.find((opening) => opening.responsibleUserId === userId && opening.openingDate === openingDate && opening.paymentMethod === paymentMethod);
  }

  const result = await db
    .select()
    .from(cashOpenings)
    .where(sql`${cashOpenings.responsibleUserId} = ${userId} AND ${cashOpenings.openingDate} = ${openingDate} AND ${cashOpenings.paymentMethod} = ${paymentMethod}`)
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createCashOpening(data: InsertCashOpening) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_CASH_OPENINGS.length + 1;
    const opening = { ...data, id: newId, createdAt: new Date() };
    MOCK_CASH_OPENINGS.push(opening);
    syncMocksToDisk();
    return { insertId: newId };
  }

  return await db.insert(cashOpenings).values(data);
}

export async function getAllCashOpenings() {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_OPENINGS
      .map((opening) => {
        const responsibleUser = MOCK_USERS.find((user) => user.id === opening.responsibleUserId);
        const openedByUser = MOCK_USERS.find((user) => user.id === opening.openedByUserId);

        return {
          ...opening,
          responsibleUserName: responsibleUser?.name || `Usuario #${opening.responsibleUserId}`,
          openedByUserName: openedByUser?.name || `Usuario #${opening.openedByUserId}`,
        };
      })
      .sort((a, b) => `${b.openingDate} ${String(b.id).padStart(5, "0")}`.localeCompare(`${a.openingDate} ${String(a.id).padStart(5, "0")}`));
  }

  return await db
    .select({
      id: cashOpenings.id,
      openingDate: cashOpenings.openingDate,
      openingAmount: cashOpenings.openingAmount,
      paymentMethod: cashOpenings.paymentMethod,
      responsibleUserId: cashOpenings.responsibleUserId,
      openedByUserId: cashOpenings.openedByUserId,
      status: cashOpenings.status,
      notes: cashOpenings.notes,
      createdAt: cashOpenings.createdAt,
      responsibleUserName: sql<string>`(select name from users where users.id = ${cashOpenings.responsibleUserId})`,
      openedByUserName: sql<string>`(select name from users where users.id = ${cashOpenings.openedByUserId})`,
    })
    .from(cashOpenings)
    .orderBy(sql`${cashOpenings.openingDate} desc, ${cashOpenings.id} desc`);
}

// Cierres de Caja
export async function getCashClosureByUserIdAndDate(userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    const matches = MOCK_CASH_CLOSURES.filter((c: any) => c.userId === userId && c.date === date);
    if (matches.length === 0) return undefined;
    return matches
      .slice()
      .sort((a: any, b: any) => {
        const aMs = toValidDate(a.createdAt)?.getTime() ?? 0;
        const bMs = toValidDate(b.createdAt)?.getTime() ?? 0;
        return bMs - aMs;
      })[0];
  }
  const result = await db.select().from(cashClosures).where(
    sql`${cashClosures.userId} = ${userId} AND (${cashClosures.date} = ${date} OR DATE(${cashClosures.createdAt}) = ${date})`
  ).orderBy(desc(cashClosures.createdAt)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCashClosure(data: InsertCashClosure) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_CASH_CLOSURES.length + 1;
    const closure = { ...data, id: newId, createdAt: new Date() };
    MOCK_CASH_CLOSURES.push(closure);
    syncMocksToDisk();
    return { insertId: newId };
  }
  return await db.insert(cashClosures).values(data);
}

export async function getAllCashClosures() {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_CLOSURES.map(c => {
      const user = MOCK_USERS.find(u => u.id === c.userId);
      return { ...c, userName: user?.name || "Usuario #" + c.userId };
    });
  }
  return await db.select({
    ...cashClosures,
    userName: users.name,
  }).from(cashClosures).leftJoin(users, eq(cashClosures.userId, users.id));
}

export async function getCashClosuresByUserId(userId: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_CLOSURES
      .filter(c => c.userId === userId)
      .slice()
      .sort((a, b) => `${b.date} ${String(b.id).padStart(5, "0")}`.localeCompare(`${a.date} ${String(a.id).padStart(5, "0")}`));
  }

  return await db.select().from(cashClosures).where(eq(cashClosures.userId, userId)).orderBy(desc(cashClosures.createdAt));
}

export async function getCashClosureById(id: number) {
  const db = await getDb();
  if (!db) {
    return MOCK_CASH_CLOSURES.find(c => c.id === id);
  }
  const result = await db.select().from(cashClosures).where(eq(cashClosures.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateCashClosure(id: number, data: any) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_CASH_CLOSURES.findIndex(c => c.id === id);
    if (index !== -1) {
      MOCK_CASH_CLOSURES[index] = { ...MOCK_CASH_CLOSURES[index], ...data };
      syncMocksToDisk();
      return { success: true };
    }
    return { success: false };
  }
  return await db.update(cashClosures).set(data).where(eq(cashClosures.id, id));
}

// Total de órdenes pendientes (no entregadas, no canceladas) por repartidor
export async function getPendingOrdersTotal(userId: number) {
  const db = await getDb();
  if (!db) {
    const pendingOrders = MOCK_ORDERS.filter(o =>
      o.deliveryPersonId === userId &&
      !["delivered", "cancelled"].includes(o.status)
    );
    const total = pendingOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    return { total, count: pendingOrders.length };
  }

  const rows = await db.select({
    total: sql<number>`cast(coalesce(sum(${orders.totalPrice}), 0) as signed)`,
    count: sql<number>`cast(count(${orders.id}) as signed)`,
  })
  .from(orders)
  .where(and(
    eq(orders.deliveryPersonId, userId),
    ne(orders.status, "delivered"),
    ne(orders.status, "cancelled")
  ));

  return { total: Number(rows[0]?.total ?? 0), count: Number(rows[0]?.count ?? 0) };
}

export async function createFinancialTransactionsForDeliveries(closureId: number, userId: number, date: string) {
  const db = await getDb();
  if (!db) {
    // Modo demo: crear transacciones financieras para órdenes entregadas por este repartidor
    const deliveredOrders = MOCK_ORDERS.filter(o =>
      o.deliveryPersonId === userId &&
      o.status === "delivered" &&
      getLocalDateKey(o.deliveredAt) === date &&
      !MOCK_FINANCIAL_TRANSACTIONS.some(t => t.referenceId === o.id && t.category === "order_delivery")
    );

    for (const order of deliveredOrders) {
      MOCK_FINANCIAL_TRANSACTIONS.push({
        id: MOCK_FINANCIAL_TRANSACTIONS.length + 1,
        type: "income",
        category: "order_delivery",
        amount: order.totalPrice,
        referenceId: order.id,
        userId: order.deliveryPersonId,
        notes: `Cobro Pedido ${order.orderNumber} (Cierre #${closureId})`,
        paymentMethod: order.paymentMethod || "cash",
        createdAt: new Date()
      });
    }
    syncMocksToDisk();
    return { success: true };
  }

  // Real DB: insertar transacciones para órdenes entregadas ese día sin transacción financiera
  const existingRefs = await db.select({ referenceId: financialTransactions.referenceId })
    .from(financialTransactions)
    .where(and(
      eq(financialTransactions.category, "order_delivery"),
      eq(financialTransactions.userId, userId),
      sql`DATE(${financialTransactions.createdAt}) = ${date}`
    ));
  const existingIds = new Set(existingRefs.map(r => r.referenceId).filter(Boolean));

  const deliveredOrders = await db.select()
    .from(orders)
    .where(and(
      eq(orders.deliveryPersonId, userId),
      eq(orders.status, "delivered"),
      sql`DATE(${orders.deliveredAt}) = ${date}`
    ));

  for (const order of deliveredOrders) {
    if (order.id && !existingIds.has(order.id)) {
      await db.insert(financialTransactions).values({
        type: "income",
        category: "order_delivery",
        amount: order.totalPrice,
        referenceId: order.id,
        userId: order.deliveryPersonId,
        notes: `Cobro Pedido ${order.orderNumber} (Cierre #${closureId})`,
        paymentMethod: order.paymentMethod || "cash",
        createdAt: new Date()
      });
    }
  }

  return { success: true };
}

export async function getExpectedDailyTotals(userId: number, date: string) {
  const db = await getDb();
  const totals = { cash: 0, qr: 0, transfer: 0 };

  if (!db) {
    // Ordenes ENTREGADAS en la fecha
    const userOrders = MOCK_ORDERS.filter(o =>
      o.deliveryPersonId === userId &&
      o.status === "delivered" &&
      getLocalDateKey(o.deliveredAt) === date
    );

    let cash = 0, qr = 0, transfer = 0;
    userOrders.forEach(o => {
      if (o.paymentMethod === "cash") cash += o.totalPrice;
      else if (o.paymentMethod === "qr") qr += o.totalPrice;
      else if (o.paymentMethod === "transfer") transfer += o.totalPrice;
    });

    // Ventas del repartidor
    const userSales = MOCK_SALES.filter((sale: any) =>
      sale.soldBy === userId &&
      sale.status !== "cancelled" &&
      sale.paymentStatus === "completed" &&
      getLocalDateKey(sale.createdAt) === date
    );

    userSales.forEach((sale: any) => {
      if (sale.paymentMethod === "cash") cash += sale.total;
      else if (sale.paymentMethod === "qr") qr += sale.total;
      else if (sale.paymentMethod === "transfer") transfer += sale.total;
    });

    totals.cash = cash;
    totals.qr = qr;
    totals.transfer = transfer;

    // Si ya hubo cierres aprobados en la misma fecha, mostrar solo el saldo pendiente
    const approvedClosures = MOCK_CASH_CLOSURES.filter((c: any) => c.userId === userId && c.date === date && c.status === "approved");
    if (approvedClosures.length > 0) {
      const alreadyExpectedCash = approvedClosures.reduce((sum: number, c: any) => sum + (c.expectedCash || 0), 0);
      const alreadyExpectedQr = approvedClosures.reduce((sum: number, c: any) => sum + (c.expectedQr || 0), 0);
      const alreadyExpectedTransfer = approvedClosures.reduce((sum: number, c: any) => sum + (c.expectedTransfer || 0), 0);

      totals.cash = Math.max(0, totals.cash - alreadyExpectedCash);
      totals.qr = Math.max(0, totals.qr - alreadyExpectedQr);
      totals.transfer = Math.max(0, totals.transfer - alreadyExpectedTransfer);
    }

    return totals;
  }

  // Ordenes entregadas
  const orderResults = await db.select({
    total: sql<number>`cast(ifnull(sum(${orders.totalPrice}), 0) as signed)`,
    method: orders.paymentMethod,
  })
  .from(orders)
  .where(and(
    eq(orders.deliveryPersonId, userId),
    eq(orders.status, "delivered"),
    sql`DATE(${orders.deliveredAt}) = ${date}`
  ))
  .groupBy(orders.paymentMethod);

  orderResults.forEach((r: any) => {
    if (r.method === "cash") totals.cash += r.total || 0;
    else if (r.method === "qr") totals.qr += r.total || 0;
    else if (r.method === "transfer") totals.transfer += r.total || 0;
  });

  // Ventas
  const saleResults = await db.select({
    total: sql<number>`cast(ifnull(sum(${sales.total}), 0) as signed)`,
    method: sales.paymentMethod,
  })
  .from(sales)
  .where(and(
    eq(sales.soldBy, userId),
    ne(sales.status, "cancelled"),
    eq(sales.paymentStatus, "completed"),
    sql`DATE(${sales.createdAt}) = ${date}`
  ))
  .groupBy(sales.paymentMethod);

  saleResults.forEach((r: any) => {
    if (r.method === "cash") totals.cash += r.total || 0;
    else if (r.method === "qr") totals.qr += r.total || 0;
    else if (r.method === "transfer") totals.transfer += r.total || 0;
  });

  // Restar montos ya cerrados/aprobados en la fecha (para permitir "cierres parciales")
  const approvedClosures = await db
    .select({
      expectedCash: cashClosures.expectedCash,
      expectedQr: cashClosures.expectedQr,
      expectedTransfer: cashClosures.expectedTransfer,
    })
    .from(cashClosures)
    .where(and(
      eq(cashClosures.userId, userId),
      eq(cashClosures.status, "approved" as any),
      // Fallback por si la columna `date` quedÃ³ guardada con desfase UTC en registros antiguos
      sql`(${cashClosures.date} = ${date} OR DATE(${cashClosures.createdAt}) = ${date})`,
    ));

  if (approvedClosures.length > 0) {
    const alreadyExpectedCash = approvedClosures.reduce((sum, c) => sum + (c.expectedCash || 0), 0);
    const alreadyExpectedQr = approvedClosures.reduce((sum, c) => sum + (c.expectedQr || 0), 0);
    const alreadyExpectedTransfer = approvedClosures.reduce((sum, c) => sum + (c.expectedTransfer || 0), 0);

    totals.cash = Math.max(0, totals.cash - alreadyExpectedCash);
    totals.qr = Math.max(0, totals.qr - alreadyExpectedQr);
    totals.transfer = Math.max(0, totals.transfer - alreadyExpectedTransfer);
  }

  return totals;
}


// =============================================
// Ventas (Sales)
// =============================================
export const MOCK_SALES: any[] = [];
export const MOCK_SALE_ITEMS: any[] = [];

type SaleDiscountType = "none" | "percentage" | "fixed";
type SalePaymentStatus = "pending" | "completed";
type SaleStatus = "completed" | "cancelled";

type SaleItemCreateInput = {
  productId: number;
  pricingType: "unit" | "wholesale";
  quantity: number;
  basePrice: number;
  discountType: SaleDiscountType;
  discountValue: number;
  discountAmount: number;
  finalUnitPrice: number;
  subtotal: number;
};

type SaleCreatePayload = {
  saleNumber: string;
  customerId?: number;
  customerName?: string;
  saleChannel: "local" | "delivery";
  orderId?: number;
  soldBy: number;
  subtotal: number;
  discountType: SaleDiscountType;
  discountValue: number;
  discountAmount: number;
  total: number;
  paymentMethod: "cash" | "qr" | "transfer";
  paymentStatus: SalePaymentStatus;
  notes?: string;
  items: SaleItemCreateInput[];
};

function getSaleFinanceNote(saleNumber: string) {
  return `Venta ${saleNumber}`;
}

function mapSaleWithRelations(sale: any, usersList: any[], customersList: any[]) {
  const seller = usersList.find((user: any) => user.id === sale.soldBy);
  const customer = customersList.find((item: any) => item.id === sale.customerId);

  return {
    ...sale,
    sellerName: seller?.name || "Desconocido",
    customerDisplayName: customer?.name || sale.customerName || "Anónimo",
    customerCode: customer?.clientNumber || null,
  };
}

export async function getNextSaleNumber() {
  const db = await getDb();
  const allData = db ? await db.select({ saleNumber: sales.saleNumber }).from(sales) : MOCK_SALES;
  const max = allData.length > 0
    ? Math.max(...allData.map((s: any) => parseInt(s.saleNumber.replace('VTA-', '')) || 0))
    : 0;
  return `VTA-${String(max + 1).padStart(3, '0')}`;
}

export async function createSale(data: InsertSale) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_SALES.length + 1;
    MOCK_SALES.push({
      status: "completed",
      discountType: "none",
      discountValue: 0,
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      ...data,
      id: newId,
      createdAt: new Date(),
    });
    return { insertId: newId };
  }
  return await db.insert(sales).values(data);
}

export async function createSaleItem(data: InsertSaleItem) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_SALE_ITEMS.length + 1;
    MOCK_SALE_ITEMS.push({
      discountType: "none",
      discountValue: 0,
      discountAmount: 0,
      finalUnitPrice: data.basePrice,
      ...data,
      id: newId,
      createdAt: new Date(),
    });
    return { insertId: newId };
  }
  return await db.insert(saleItems).values(data);
}

export async function getProductsWithStock() {
  const [allProducts, allInventory] = await Promise.all([getAllProducts(), getAllInventory()]);

  return allProducts.map((product: any) => {
    const stockItem = allInventory.find((item: any) => item.productId === product.id);
    const stock = stockItem?.quantity || 0;
    const minStock = stockItem?.minStock || 0;

    return {
      ...product,
      stock,
      minStock,
      isLowStock: stock <= minStock,
    };
  });
}

export async function createSaleWithItems(payload: SaleCreatePayload) {
  const db = await getDb();

  if (!db) {
    for (const item of payload.items) {
      const product = MOCK_PRODUCTS.find((entry: any) => entry.id === item.productId);
      if (!product || product.status !== "active") {
        throw new Error(`Producto ${item.productId} no disponible para la venta`);
      }

      const inventoryItem = MOCK_INVENTORY.find((entry: any) => entry.productId === item.productId);
      const currentStock = inventoryItem?.quantity || 0;
      if (currentStock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}`);
      }
    }

    const newSaleId = MOCK_SALES.length + 1;
    MOCK_SALES.push({
      id: newSaleId,
      saleNumber: payload.saleNumber,
      customerId: payload.customerId || null,
      customerName: payload.customerId ? null : payload.customerName || "Anónimo",
      saleChannel: payload.saleChannel,
      status: "completed" as SaleStatus,
      orderId: payload.orderId || null,
      soldBy: payload.soldBy,
      subtotal: payload.subtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      notes: payload.notes || null,
      cancelReason: null,
      cancelledAt: null,
      cancelledBy: null,
      createdAt: new Date(),
    });

    for (const item of payload.items) {
      MOCK_SALE_ITEMS.push({
        id: MOCK_SALE_ITEMS.length + 1,
        saleId: newSaleId,
        productId: item.productId,
        pricingType: item.pricingType,
        quantity: item.quantity,
        basePrice: item.basePrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount,
        finalUnitPrice: item.finalUnitPrice,
        subtotal: item.subtotal,
        createdAt: new Date(),
      });

      const inventoryItem = MOCK_INVENTORY.find((entry: any) => entry.productId === item.productId);
      if (inventoryItem) {
        inventoryItem.quantity -= item.quantity;
        inventoryItem.lastUpdated = new Date();
      }

      await createInventoryMovement({
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: `Venta ${payload.saleNumber}`,
        notes: `Salida por venta ${payload.saleNumber}`,
        saleId: newSaleId,
        orderId: payload.orderId || undefined,
        userId: payload.soldBy,
      });
    }

    if (payload.paymentStatus === "completed") {
      await createFinancialTransaction({
        type: "income",
        category: "sale",
        amount: payload.total,
        referenceId: newSaleId,
        notes: getSaleFinanceNote(payload.saleNumber),
        paymentMethod: payload.paymentMethod,
        userId: payload.soldBy,
      });
    }
    syncMocksToDisk();
    return { insertId: newSaleId };
  }

  return await db.transaction(async (tx: any) => {
    const saleResult = await tx.insert(sales).values({
      saleNumber: payload.saleNumber,
      customerId: payload.customerId,
      customerName: payload.customerId ? null : payload.customerName || "Anónimo",
      saleChannel: payload.saleChannel,
      status: "completed",
      orderId: payload.orderId,
      soldBy: payload.soldBy,
      subtotal: payload.subtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      total: payload.total,
      paymentMethod: payload.paymentMethod,
      paymentStatus: payload.paymentStatus,
      notes: payload.notes,
    });

    const saleId = saleResult.insertId;

    for (const item of payload.items) {
      const productRows = await tx.select().from(products).where(eq(products.id, item.productId)).limit(1);
      const product = productRows[0];
      if (!product || product.status !== "active") {
        throw new Error(`Producto ${item.productId} no disponible para la venta`);
      }

      const inventoryRows = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
      const inventoryItem = inventoryRows[0];
      const currentStock = inventoryItem?.quantity || 0;
      if (currentStock < item.quantity) {
        throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${currentStock}`);
      }

      await tx.insert(saleItems).values({
        saleId,
        productId: item.productId,
        pricingType: item.pricingType,
        quantity: item.quantity,
        basePrice: item.basePrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount,
        finalUnitPrice: item.finalUnitPrice,
        subtotal: item.subtotal,
      });

      await tx.update(inventory).set({
        quantity: currentStock - item.quantity,
        lastUpdated: new Date(),
      }).where(eq(inventory.productId, item.productId));

      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "exit",
        quantity: item.quantity,
        reason: `Venta ${payload.saleNumber}`,
        notes: `Salida por venta ${payload.saleNumber}`,
        saleId,
        orderId: payload.orderId,
        userId: payload.soldBy,
      });
    }

    if (payload.paymentStatus === "completed") {
      await tx.insert(financialTransactions).values({
        type: "income",
        category: "sale",
        amount: payload.total,
        referenceId: saleId,
        notes: getSaleFinanceNote(payload.saleNumber),
        paymentMethod: payload.paymentMethod,
        userId: payload.soldBy,
      });
    }

    return { insertId: saleId };
  });
}

export async function updateSale(saleId: number, data: Partial<InsertSale>) {
  const db = await getDb();
  if (!db) {
    const index = MOCK_SALES.findIndex((sale: any) => sale.id === saleId);
    if (index === -1) return { success: false };
    MOCK_SALES[index] = { ...MOCK_SALES[index], ...data };
    return { success: true };
  }
  return await db.update(sales).set(data).where(eq(sales.id, saleId));
}

export async function markSalePaymentCompleted(saleId: number) {
  const sale = await getSaleById(saleId);
  if (!sale) {
    throw new Error("Venta no encontrada");
  }
  if (sale.status === "cancelled") {
    throw new Error("No se puede cobrar una venta anulada");
  }
  if (sale.paymentStatus === "completed") {
    return { success: true };
  }

  await updateSale(saleId, { paymentStatus: "completed" });
  await createFinancialTransaction({
    type: "income",
    category: "sale",
    amount: sale.total,
    referenceId: saleId,
    notes: getSaleFinanceNote(sale.saleNumber),
    paymentMethod: sale.paymentMethod,
    userId: sale.soldBy,
  });

  return { success: true };
}

export async function cancelSaleRecord(saleId: number, cancelledByUserId: number, reason: string) {
  const sale = await getSaleById(saleId);
  if (!sale) {
    throw new Error("Venta no encontrada");
  }
  if (sale.status === "cancelled") {
    throw new Error("La venta ya fue anulada");
  }

  const items = await getSaleItemsBySaleId(saleId);
  const db = await getDb();

  if (!db) {
    const saleIndex = MOCK_SALES.findIndex((entry: any) => entry.id === saleId);
    if (saleIndex === -1) {
      throw new Error("Venta no encontrada");
    }

    MOCK_SALES[saleIndex] = {
      ...MOCK_SALES[saleIndex],
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date(),
      cancelledBy: cancelledByUserId,
    };

    for (const item of items as any[]) {
      const inventoryItem = MOCK_INVENTORY.find((entry: any) => entry.productId === item.productId);
      if (inventoryItem) {
        inventoryItem.quantity += item.quantity;
        inventoryItem.lastUpdated = new Date();
      }

      await createInventoryMovement({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Anulación ${sale.saleNumber}`,
        notes: `Reposición por anulación de venta ${sale.saleNumber}`,
      });
    }

    if (sale.paymentStatus === "completed") {
      await createFinancialTransaction({
        type: "expense",
        category: "sale_cancellation",
        amount: sale.total,
        referenceId: saleId,
        notes: `Anulación ${sale.saleNumber}`,
        paymentMethod: sale.paymentMethod,
        userId: sale.soldBy,
      });
    }

    return { success: true };
  }

  await db.transaction(async (tx: any) => {
    await tx.update(sales).set({
      status: "cancelled",
      cancelReason: reason,
      cancelledAt: new Date(),
      cancelledBy: cancelledByUserId,
    }).where(eq(sales.id, saleId));

    for (const item of items as any[]) {
      const inventoryRows = await tx.select().from(inventory).where(eq(inventory.productId, item.productId)).limit(1);
      const inventoryItem = inventoryRows[0];
      const currentStock = inventoryItem?.quantity || 0;

      await tx.update(inventory).set({
        quantity: currentStock + item.quantity,
        lastUpdated: new Date(),
      }).where(eq(inventory.productId, item.productId));

      await tx.insert(inventoryMovements).values({
        productId: item.productId,
        type: "entry",
        quantity: item.quantity,
        reason: `Anulación ${sale.saleNumber}`,
        notes: `Reposición por anulación de venta ${sale.saleNumber}`,
      });
    }

    if (sale.paymentStatus === "completed") {
      await tx.insert(financialTransactions).values({
        type: "expense",
        category: "sale_cancellation",
        amount: sale.total,
        referenceId: saleId,
        notes: `Anulación ${sale.saleNumber}`,
        paymentMethod: sale.paymentMethod,
        userId: sale.soldBy,
      });
    }
  });

  return { success: true };
}

export async function getAllSales() {
  const db = await getDb();
  if (!db) {
    return MOCK_SALES.map((sale: any) => {
      return mapSaleWithRelations(sale, MOCK_USERS, MOCK_CUSTOMERS);
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const [rawSales, usersList, customersList] = await Promise.all([
    db.select().from(sales),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select({ id: customers.id, name: customers.name, clientNumber: customers.clientNumber }).from(customers),
  ]);

  return rawSales
    .map((sale: any) => mapSaleWithRelations(sale, usersList, customersList))
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getSaleById(saleId: number) {
  const db = await getDb();
  if (!db) {
    const sale = MOCK_SALES.find((entry: any) => entry.id === saleId);
    return sale ? mapSaleWithRelations(sale, MOCK_USERS, MOCK_CUSTOMERS) : null;
  }

  const [result, usersList, customersList] = await Promise.all([
    db.select().from(sales).where(eq(sales.id, saleId)).limit(1),
    db.select({ id: users.id, name: users.name }).from(users),
    db.select({ id: customers.id, name: customers.name, clientNumber: customers.clientNumber }).from(customers),
  ]);

  return result[0] ? mapSaleWithRelations(result[0], usersList, customersList) : null;
}

export async function getSaleItemsBySaleId(saleId: number) {
  const db = await getDb();
  if (!db) {
    const items = MOCK_SALE_ITEMS.filter((i: any) => i.saleId === saleId);
    return items.map((item: any) => {
      const product = MOCK_PRODUCTS.find((p: any) => p.id === item.productId);
      return { ...item, productName: product?.name || 'Producto #' + item.productId, productCode: product?.code || '' };
    });
  }
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
  return await Promise.all(items.map(async (item: any) => {
    const prod = await db.select({ name: products.name, code: products.code }).from(products).where(eq(products.id, item.productId)).limit(1);
    return { ...item, productName: prod[0]?.name || '', productCode: prod[0]?.code || '' };
  }));
}

export async function getOnOrderQuantities() {
  const db = await getDb();
  if (!db) {
    // Modo demo
    const result: Record<number, number> = {};
    MOCK_ORDER_ITEMS.forEach(item => {
      const order = MOCK_ORDERS.find(o => o.id === item.orderId);
      if (order && !['delivered', 'cancelled'].includes(order.status)) {
        result[item.productId] = (result[item.productId] || 0) + item.quantity;
      }
    });
    return result;
  }

  const rows = await db
    .select({
      productId: orderItems.productId,
      totalQuantity: sql<number>`cast(sum(${orderItems.quantity}) as signed)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(
      ne(orders.status, 'delivered'),
      ne(orders.status, 'cancelled')
    ))
    .groupBy(orderItems.productId);

  const result: Record<number, number> = {};
  rows.forEach((row: any) => {
    result[row.productId] = Number(row.totalQuantity);
  });
  return result;
}

// Cargar datos persistentes al iniciar el servidor en modo demo
loadMocks();

// Limpiar todos los datos (excepto administrador) al iniciar
export function clearAllData() {
  console.log("[DB] Clearing all data, keeping only admin user...");

  // Limpiar arrays de datos
  MOCK_CUSTOMERS.length = 0;
  MOCK_PRODUCTS.length = 0;
  MOCK_INVENTORY.length = 0;
  MOCK_ORDERS.length = 0;
  MOCK_ORDER_ITEMS.length = 0;
  MOCK_PAYMENTS.length = 0;
  MOCK_MOVEMENTS.length = 0;
  MOCK_SUPPLIERS.length = 0;
  MOCK_PURCHASES.length = 0;
  MOCK_PURCHASE_ITEMS.length = 0;
  MOCK_ACCOUNTS_PAYABLE.length = 0;
  MOCK_DELIVERY_EXPENSES.length = 0;
  MOCK_OPERATIONAL_EXPENSES.length = 0;
  MOCK_FINANCIAL_TRANSACTIONS.length = 0;
  MOCK_CASH_CLOSURES.length = 0;
  MOCK_CASH_OPENINGS.length = 0;
  MOCK_SALES.length = 0;
  MOCK_SALE_ITEMS.length = 0;
  MOCK_QUOTATIONS.length = 0;
  MOCK_QUOTATION_ITEMS.length = 0;

  console.log("[DB] All data cleared successfully. Only admin user remains.");
}

// ============================================================
// COTIZACIONES
// ============================================================

function pad3(value: number) {
  return String(value).padStart(3, "0");
}

export async function getNextQuoteNumber(): Promise<string> {
  const db = await getDb();
  const now = new Date();
  const dateStr = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}`;
  const prefix = `COT-${dateStr}-`;

  if (!db) {
    const today = MOCK_QUOTATIONS.filter((q: any) => q.quoteNumber?.startsWith(prefix));
    return `${prefix}${pad3(today.length + 1)}`;
  }

  const rows = await db
    .select({ quoteNumber: quotations.quoteNumber })
    .from(quotations)
    .where(sql`${quotations.quoteNumber} LIKE ${prefix + "%"}`);
  return `${prefix}${pad3(rows.length + 1)}`;
}

export async function createQuotation(payload: {
  quoteNumber: string;
  customerId: number;
  adminId: number;
  subtotal: number;
  discountType: "percentage" | "fixed" | null;
  discountValue: number;
  discountAmount: number;
  totalAmount: number;
  validUntil?: string | null;
  notes?: string | null;
  termsAndConditions?: string | null;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    discountType: "percentage" | "fixed" | null;
    discountValue: number;
    discountAmount: number;
    finalUnitPrice: number;
    subtotal: number;
  }[];
}) {
  const db = await getDb();
  if (!db) {
    const newId = MOCK_QUOTATIONS.length + 1;
    MOCK_QUOTATIONS.push({
      id: newId,
      quoteNumber: payload.quoteNumber,
      customerId: payload.customerId,
      adminId: payload.adminId,
      status: "pending",
      subtotal: payload.subtotal,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      discountAmount: payload.discountAmount,
      totalAmount: payload.totalAmount,
      validUntil: payload.validUntil || null,
      notes: payload.notes || null,
      termsAndConditions: payload.termsAndConditions || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    for (const item of payload.items) {
      MOCK_QUOTATION_ITEMS.push({
        id: MOCK_QUOTATION_ITEMS.length + 1,
        quoteId: newId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
        discountAmount: item.discountAmount,
        finalUnitPrice: item.finalUnitPrice,
        subtotal: item.subtotal,
        createdAt: new Date(),
      });
    }
    syncMocksToDisk();
    return { insertId: newId };
  }

  return await db.transaction(async (tx: any) => {
    const result = await tx.insert(quotations).values({
      quoteNumber: payload.quoteNumber,
      customerId: payload.customerId,
      adminId: payload.adminId,
      status: "pending",
      totalAmount: payload.totalAmount,
      discountType: payload.discountType,
      discountValue: payload.discountValue,
      validUntil: payload.validUntil,
      notes: payload.notes,
      termsAndConditions: payload.termsAndConditions,
    });
    const quoteId = result.insertId;
    for (const item of payload.items) {
      await tx.insert(quotationItems).values({
        quoteId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountType: item.discountType,
        discountValue: item.discountValue,
      });
    }
    return { insertId: quoteId };
  });
}

export async function getAllQuotations() {
  const db = await getDb();
  if (!db) {
    return MOCK_QUOTATIONS.map((q: any) => {
      const customer = MOCK_CUSTOMERS.find((c: any) => c.id === q.customerId);
      const admin = MOCK_USERS.find((u: any) => u.id === q.adminId);
      return {
        ...q,
        customerName: customer?.name || "Cliente desconocido",
        customerPhone: customer?.phone || null,
        customerWhatsapp: customer?.whatsapp || null,
        adminName: admin?.name || "Admin",
      };
    }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const rows = await db.select().from(quotations);
  return await Promise.all(rows.map(async (q: any) => {
    const [customerRows, adminRows] = await Promise.all([
      db.select({ name: customers.name, phone: customers.phone, whatsapp: customers.whatsapp }).from(customers).where(eq(customers.id, q.customerId)).limit(1),
      db.select({ name: users.name }).from(users).where(eq(users.id, q.adminId)).limit(1),
    ]);
    return {
      ...q,
      customerName: customerRows[0]?.name || "Cliente desconocido",
      customerPhone: customerRows[0]?.phone || null,
      customerWhatsapp: customerRows[0]?.whatsapp || null,
      adminName: adminRows[0]?.name || "Admin",
    };
  }));
}

export async function getQuotationById(quoteId: number) {
  const db = await getDb();
  if (!db) {
    const q = MOCK_QUOTATIONS.find((entry: any) => entry.id === quoteId);
    if (!q) return null;
    const customer = MOCK_CUSTOMERS.find((c: any) => c.id === q.customerId);
    const admin = MOCK_USERS.find((u: any) => u.id === q.adminId);
    return {
      ...q,
      customerName: customer?.name || "Cliente desconocido",
      customerPhone: customer?.phone || null,
      customerWhatsapp: customer?.whatsapp || null,
      adminName: admin?.name || "Admin",
    };
  }

  const rows = await db.select().from(quotations).where(eq(quotations.id, quoteId)).limit(1);
  if (!rows[0]) return null;
  const q = rows[0];
  const [customerRows, adminRows] = await Promise.all([
    db.select({ name: customers.name, phone: customers.phone, whatsapp: customers.whatsapp }).from(customers).where(eq(customers.id, q.customerId)).limit(1),
    db.select({ name: users.name }).from(users).where(eq(users.id, q.adminId)).limit(1),
  ]);
  return {
    ...q,
    customerName: customerRows[0]?.name || "Cliente desconocido",
    customerPhone: customerRows[0]?.phone || null,
    customerWhatsapp: customerRows[0]?.whatsapp || null,
    adminName: adminRows[0]?.name || "Admin",
  };
}

export async function getQuotationItemsByQuoteId(quoteId: number) {
  const db = await getDb();
  if (!db) {
    const items = MOCK_QUOTATION_ITEMS.filter((i: any) => i.quoteId === quoteId);
    return items.map((item: any) => {
      const product = MOCK_PRODUCTS.find((p: any) => p.id === item.productId);
      return {
        ...item,
        productName: product?.name || "Producto #" + item.productId,
        productCode: product?.code || "",
      };
    });
  }
  const items = await db.select().from(quotationItems).where(eq(quotationItems.quoteId, quoteId));
  return await Promise.all(items.map(async (item: any) => {
    const prod = await db.select({ name: products.name, code: products.code }).from(products).where(eq(products.id, item.productId)).limit(1);
    return { ...item, productName: prod[0]?.name || "", productCode: prod[0]?.code || "" };
  }));
}

export async function updateQuotationStatus(quoteId: number, status: "pending" | "accepted" | "rejected") {
  const db = await getDb();
  if (!db) {
    const index = MOCK_QUOTATIONS.findIndex((q: any) => q.id === quoteId);
    if (index === -1) return { success: false };
    MOCK_QUOTATIONS[index] = { ...MOCK_QUOTATIONS[index], status, updatedAt: new Date() };
    syncMocksToDisk();
    return { success: true };
  }
  await db.update(quotations).set({ status, updatedAt: new Date() }).where(eq(quotations.id, quoteId));
  return { success: true };
}

export async function convertQuotationToSale(payload: {
  quoteId: number;
  soldBy: number;
  paymentMethod: "cash" | "qr" | "transfer";
  paymentStatus: "completed" | "pending";
  saleChannel: "local" | "delivery";
}) {
  const quote = await getQuotationById(payload.quoteId);
  if (!quote) throw new Error("Cotización no encontrada");
  if (quote.status === "accepted") throw new Error("Esta cotización ya fue convertida en venta");
  if (quote.status === "rejected") throw new Error("No se puede convertir una cotización rechazada");

  const items = await getQuotationItemsByQuoteId(payload.quoteId);
  const saleNumber = await getNextSaleNumber();

  const normalizedItems = items.map((item: any) => ({
    productId: item.productId,
    pricingType: "unit" as const,
    quantity: item.quantity,
    basePrice: item.unitPrice,
    discountType: item.discountType || "none",
    discountValue: item.discountValue || 0,
    discountAmount: item.discountAmount || 0,
    finalUnitPrice: item.finalUnitPrice || item.unitPrice,
    subtotal: item.subtotal,
  }));

  const subtotal = normalizedItems.reduce((sum: number, item: any) => sum + item.subtotal, 0);

  let discountAmount = 0;
  if (quote.discountType === "percentage") {
    discountAmount = Math.min(subtotal, Math.round(subtotal * (Math.min(100, quote.discountValue) / 100)));
  } else if (quote.discountType === "fixed") {
    discountAmount = Math.min(subtotal, Math.max(0, quote.discountValue));
  }
  const total = Math.max(0, subtotal - discountAmount);

  const saleResult = await createSaleWithItems({
    saleNumber,
    customerId: quote.customerId,
    customerName: undefined,
    saleChannel: payload.saleChannel,
    orderId: undefined,
    soldBy: payload.soldBy,
    subtotal,
    discountType: quote.discountType || "none",
    discountValue: quote.discountValue || 0,
    discountAmount,
    total,
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentStatus,
    notes: `Convertido desde cotización ${quote.quoteNumber}`,
    items: normalizedItems,
  });

  await updateQuotationStatus(payload.quoteId, "accepted");

  return { success: true, saleNumber, saleId: (saleResult as any).insertId };
}
