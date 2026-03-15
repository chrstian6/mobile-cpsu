// backend/src/routes/item.ts
import { Response, Router } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { ItemModel } from "../models/Item";
import User from "../models/User";

const router = Router();

// Helper to resolve user ID
const resolveUserId = async (mongoId: string): Promise<string> => {
  const user = (await User.findById(mongoId).select("user_id").lean()) as any;
  return user?.user_id || mongoId;
};

// GET /api/items - Get all available items
router.get(
  "/",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const {
        category,
        status,
        search,
        limit = 50,
        page = 1,
        available = "true",
      } = req.query;

      const query: any = {};

      // Filter by category
      if (category) {
        query.category = category;
      }

      // Filter by status
      if (status) {
        query.status = status;
      } else {
        // Default: exclude damaged/for repair items
        query.status = { $nin: ["For Repair", "Damaged"] };
      }

      // Filter by availability
      if (available === "true") {
        query.stock = { $gt: 0 };
      }

      // Search by text
      if (search) {
        query.$text = { $search: search as string };
      }

      const skip = (Number(page) - 1) * Number(limit);

      const items = await ItemModel.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean();

      const total = await ItemModel.countDocuments(query);

      // Add available stock to each item with type assertion
      const itemsWithAvailability = (items || []).map((item: any) => ({
        ...item,
        available_stock: (item.stock || 0) - (item.reserved_stock || 0),
      }));

      res.json({
        success: true,
        items: itemsWithAvailability,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (err: any) {
      console.error("[GET /api/items] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to fetch items" });
    }
  },
);

// GET /api/items/categories - Get all unique categories
router.get(
  "/categories",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const categories = await ItemModel.distinct("category", {
        status: { $nin: ["For Repair", "Damaged"] },
        stock: { $gt: 0 },
      });

      res.json({
        success: true,
        categories: (categories || []).sort(),
      });
    } catch (err: any) {
      console.error("[GET /api/items/categories] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to fetch categories" });
    }
  },
);

// GET /api/items/:id - Get single item by ID
router.get(
  "/:id",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const item = await ItemModel.findOne({
        $or: [{ _id: id }, { item_id: id }],
      }).lean();

      if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      // Add available stock with type assertion
      const itemWithAvailability = {
        ...(item as any),
        available_stock:
          ((item as any).stock || 0) - ((item as any).reserved_stock || 0),
      };

      res.json({
        success: true,
        item: itemWithAvailability,
      });
    } catch (err: any) {
      console.error("[GET /api/items/:id] Error:", err);
      res.status(500).json({ error: err?.message ?? "Failed to fetch item" });
    }
  },
);

// GET /api/items/:id/availability - Check item availability
router.get(
  "/:id/availability",
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { quantity } = req.query;

      const item = await ItemModel.findOne({
        $or: [{ _id: id }, { item_id: id }],
      });

      if (!item) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      const availableStock = item.getAvailableStock();
      const requestedQty = quantity ? parseInt(quantity as string) : 1;

      res.json({
        success: true,
        item_id: item.item_id,
        item_name: item.item_name,
        available: availableStock >= requestedQty,
        available_stock: availableStock,
        requested_quantity: requestedQty,
        unit: item.unit,
        requires_prescription: item.requires_prescription,
        requires_med_cert: item.requires_med_cert,
        requires_brgy_cert: item.requires_brgy_cert,
        needs_fitting: item.needs_fitting,
      });
    } catch (err: any) {
      console.error("[GET /api/items/:id/availability] Error:", err);
      res
        .status(500)
        .json({ error: err?.message ?? "Failed to check availability" });
    }
  },
);

export default router;
