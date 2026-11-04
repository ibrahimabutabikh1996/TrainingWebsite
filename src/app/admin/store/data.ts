import "server-only";
import { prisma } from "@/lib/db";
import { isMissingTable } from "@/lib/store/catalog";
import type { OrderItem, StoreOrder } from "@/lib/store/types";

/* Reads for the store panel. Each returns null when the tables are not there
   yet, so a screen can say "run the SQL file" instead of failing. */

type OrderRow = Awaited<ReturnType<typeof prisma.store_orders.findMany>>[number];

export function toOrder(r: OrderRow): StoreOrder {
  return {
    id: r.id,
    reference: r.reference,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    city: r.city,
    address: r.address,
    notes: r.notes,
    items: (Array.isArray(r.items) ? r.items : []) as unknown as OrderItem[],
    subtotal: r.subtotal,
    delivery_fee: r.delivery_fee,
    total: r.total,
    status: r.status,
    created_at: r.created_at.toISOString(),
    customer_id: r.customer_id,
    location_lat: r.location_lat,
    location_lng: r.location_lng,
    points_earned: r.points_earned,
    points_awarded: r.points_awarded,
  };
}

/** The orders, newest first. */
export async function getOrders(limit = 500, where: { customer_id?: string } = {}): Promise<StoreOrder[] | null> {
  try {
    const rows = await prisma.store_orders.findMany({ where, orderBy: { created_at: "desc" }, take: limit });
    return rows.map(toOrder);
  } catch (error) {
    if (!isMissingTable(error)) console.error("[store] Failed to read orders:", error);
    return null;
  }
}

export interface CustomerSummary {
  id: string;
  phone: string;
  name: string;
  city: string;
  address: string;
  points: number;
  notes: string | null;
  created_at: string;
  orders_count: number;
  /** Confirmed and delivered orders only — what was actually sold. */
  total_spent: number;
  last_order_at: string | null;
}

export interface PointsEntry {
  id: string;
  change: number;
  balance_after: number;
  reason: string;
  order_reference: string | null;
  note: string | null;
  created_at: string;
}

/** Every customer with their order count and spend, worked out from the orders. */
export async function getCustomers(): Promise<CustomerSummary[] | null> {
  try {
    const [customers, counts, spent] = await Promise.all([
      prisma.store_customers.findMany({ orderBy: { updated_at: "desc" } }),
      prisma.store_orders.groupBy({
        by: ["customer_id"],
        _count: { _all: true },
        _max: { created_at: true },
        where: { customer_id: { not: null } },
      }),
      prisma.store_orders.groupBy({
        by: ["customer_id"],
        _sum: { total: true },
        where: { customer_id: { not: null }, status: { in: ["confirmed", "delivered"] } },
      }),
    ]);
    const countBy = new Map(counts.map((c) => [c.customer_id, c]));
    const spentBy = new Map(spent.map((c) => [c.customer_id, c._sum.total ?? 0]));
    return customers.map((c) => ({
      id: c.id,
      phone: c.phone,
      name: c.name,
      city: c.city,
      address: c.address,
      points: c.points,
      notes: c.notes,
      created_at: c.created_at.toISOString(),
      orders_count: countBy.get(c.id)?._count._all ?? 0,
      total_spent: spentBy.get(c.id) ?? 0,
      last_order_at: countBy.get(c.id)?._max.created_at?.toISOString() ?? null,
    }));
  } catch (error) {
    if (!isMissingTable(error)) console.error("[store] Failed to read customers:", error);
    return null;
  }
}

/** One customer's orders and points history. */
export async function getCustomerDetail(
  id: string
): Promise<{ orders: StoreOrder[]; points: PointsEntry[] } | null> {
  try {
    const [orders, points] = await Promise.all([
      prisma.store_orders.findMany({ where: { customer_id: id }, orderBy: { created_at: "desc" }, take: 200 }),
      prisma.store_points_log.findMany({ where: { customer_id: id }, orderBy: { created_at: "desc" }, take: 200 }),
    ]);
    return {
      orders: orders.map(toOrder),
      points: points.map((p) => ({
        id: p.id,
        change: p.change,
        balance_after: p.balance_after,
        reason: p.reason,
        order_reference: p.order_reference,
        note: p.note,
        created_at: p.created_at.toISOString(),
      })),
    };
  } catch (error) {
    if (!isMissingTable(error)) console.error("[store] Failed to read customer:", error);
    return null;
  }
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  change: number;
  stock_after: number | null;
  reason: string;
  order_reference: string | null;
  note: string | null;
  created_at: string;
}

/** The newest stock movements across every product. */
export async function getStockMovements(limit = 300): Promise<StockMovement[] | null> {
  try {
    const rows = await prisma.store_stock_movements.findMany({
      orderBy: { created_at: "desc" },
      take: limit,
      include: { product: { select: { name: true } } },
    });
    return rows.map((m) => ({
      id: m.id,
      product_id: m.product_id,
      product_name: m.product.name,
      change: m.change,
      stock_after: m.stock_after,
      reason: m.reason,
      order_reference: m.order_reference,
      note: m.note,
      created_at: m.created_at.toISOString(),
    }));
  } catch (error) {
    if (!isMissingTable(error)) console.error("[store] Failed to read stock movements:", error);
    return null;
  }
}
