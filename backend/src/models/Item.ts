// backend/src/models/Item.ts
import mongoose, { Document, Schema } from "mongoose";
import { IItem } from "../types/item";

// ============ MONGOOSE DOCUMENT INTERFACE ============
export interface IItemDocument extends IItem, Document {
  getAvailableStock(): number;
  reserveStock(quantity: number): Promise<boolean>;
  releaseReservedStock(quantity: number): Promise<void>;
  fulfillReservedStock(quantity: number): Promise<void>;
  isLowStock(threshold?: number): boolean;
  isOutOfStock(): boolean;
  isExpiringSoon(days?: number): boolean;
  getStockStatus(threshold?: number): "Normal" | "Low" | "Critical" | "Out";
}

// ============ MONGOOSE SCHEMA ============
const ItemMongooseSchema = new Schema<IItemDocument>(
  {
    item_id: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      index: true,
      default: undefined,
    },

    item_image_url: {
      type: String,
      default: null,
    },

    item_name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
    },

    item_description: {
      type: String,
      default: "",
    },

    category: {
      type: String,
      enum: [
        "Medical Supplies",
        "Mobility Aids",
        "Food Assistance",
        "Hygiene Kits",
        "Assistive Devices",
        "Medicines",
        "Vitamins",
        "Wheelchairs",
        "Crutches",
        "Canes",
        "Hearing Aids",
        "Glasses",
        "Diapers",
        "Milk",
        "Other",
      ],
      default: "Medical Supplies",
      index: true,
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },

    pending_requests: {
      type: Number,
      default: 0,
      min: 0,
    },

    reserved_stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      enum: [
        "piece",
        "box",
        "pack",
        "bottle",
        "pair",
        "set",
        "kg",
        "liter",
        "can",
        "sachet",
      ],
      default: "piece",
    },

    status: {
      type: String,
      enum: [
        "Available",
        "Low Stock",
        "Out of Stock",
        "Reserved",
        "For Repair",
        "Damaged",
      ],
      default: "Available",
      index: true,
    },

    location: {
      type: String,
      default: "Main Storage",
    },

    expiry_date: {
      type: String,
      default: null,
    },

    is_medical: {
      type: Boolean,
      default: false,
    },

    requires_prescription: {
      type: Boolean,
      default: false,
    },

    // Certificate requirement fields
    requires_med_cert: {
      type: Boolean,
      default: false,
    },

    requires_brgy_cert: {
      type: Boolean,
      default: false,
    },

    is_consumable: {
      type: Boolean,
      default: true,
    },

    needs_fitting: {
      type: Boolean,
      default: false,
    },

    size: {
      type: String,
      default: null,
    },

    brand: {
      type: String,
      default: null,
    },

    total_distributed: {
      type: Number,
      default: 0,
    },

    last_distribution_date: {
      type: String,
      default: null,
    },

    created_by: {
      type: String,
      default: null,
    },

    updated_by: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  },
);

// ============ INDEXES ============
ItemMongooseSchema.index({ item_id: 1 }, { unique: true });
ItemMongooseSchema.index({ status: 1 });
ItemMongooseSchema.index({ category: 1 });
ItemMongooseSchema.index({ location: 1 });
ItemMongooseSchema.index({ expiry_date: 1 }, { sparse: true });
ItemMongooseSchema.index({ is_medical: 1, requires_prescription: 1 });
ItemMongooseSchema.index({ needs_fitting: 1 });
ItemMongooseSchema.index({ requires_med_cert: 1 });
ItemMongooseSchema.index({ requires_brgy_cert: 1 });

// Text search indexes
ItemMongooseSchema.index(
  {
    item_name: "text",
    item_description: "text",
    category: "text",
    brand: "text",
    item_id: "text",
  },
  {
    weights: {
      item_name: 10,
      item_id: 5,
      category: 3,
      brand: 2,
      item_description: 1,
    },
    name: "ItemTextIndex",
  },
);

// ============ MIDDLEWARE ============

// Generate sequential item_id before saving
ItemMongooseSchema.pre("save", async function (next) {
  const doc = this as IItemDocument;

  if (doc.isNew || !doc.item_id || doc.item_id === "ITEM-00000") {
    try {
      const lastItem = await mongoose
        .model("Item")
        .findOne({}, { item_id: 1 })
        .sort({ item_id: -1 });

      let nextNumber = 1;
      if (lastItem && lastItem.item_id) {
        const lastNumber = parseInt(lastItem.item_id.split("-")[1]);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      const paddedNumber = String(nextNumber).padStart(5, "0");
      doc.item_id = `ITEM-${paddedNumber}`;
      next();
    } catch (error) {
      console.error("Error generating item_id:", error);
      const timestamp = Date.now().toString().slice(-5);
      doc.item_id = `ITEM-${timestamp}`;
      next();
    }
  } else {
    next();
  }
});

// Update status based on stock before saving
ItemMongooseSchema.pre("save", function (next) {
  const doc = this as IItemDocument;

  if (doc.stock <= 0) {
    doc.status = "Out of Stock";
  } else if (doc.stock <= 5) {
    doc.status = "Low Stock";
  } else if (
    doc.stock > 5 &&
    doc.status !== "Reserved" &&
    doc.status !== "For Repair" &&
    doc.status !== "Damaged"
  ) {
    doc.status = "Available";
  }
  next();
});

// ============ METHODS ============

/**
 * Get available stock (total - reserved)
 */
ItemMongooseSchema.methods.getAvailableStock = function (): number {
  const doc = this as IItemDocument;
  return doc.stock - (doc.reserved_stock || 0);
};

/**
 * Reserve stock for a request
 */
ItemMongooseSchema.methods.reserveStock = async function (
  quantity: number,
): Promise<boolean> {
  const doc = this as IItemDocument;

  if (doc.getAvailableStock() < quantity) {
    return false;
  }

  doc.reserved_stock = (doc.reserved_stock || 0) + quantity;
  doc.pending_requests = (doc.pending_requests || 0) + 1;
  await doc.save();
  return true;
};

/**
 * Release reserved stock (when request is rejected/cancelled)
 */
ItemMongooseSchema.methods.releaseReservedStock = async function (
  quantity: number,
): Promise<void> {
  const doc = this as IItemDocument;

  doc.reserved_stock = Math.max(0, (doc.reserved_stock || 0) - quantity);
  doc.pending_requests = Math.max(0, (doc.pending_requests || 0) - 1);
  await doc.save();
};

/**
 * Fulfill reserved stock (when request is approved)
 */
ItemMongooseSchema.methods.fulfillReservedStock = async function (
  quantity: number,
): Promise<void> {
  const doc = this as IItemDocument;

  doc.stock -= quantity;
  doc.reserved_stock = Math.max(0, (doc.reserved_stock || 0) - quantity);
  doc.pending_requests = Math.max(0, (doc.pending_requests || 0) - 1);
  doc.total_distributed = (doc.total_distributed || 0) + quantity;
  doc.last_distribution_date = new Date().toISOString().split("T")[0];
  await doc.save();
};

/**
 * Check if item is low on stock
 */
ItemMongooseSchema.methods.isLowStock = function (
  threshold: number = 5,
): boolean {
  const doc = this as IItemDocument;
  return doc.stock <= threshold && doc.stock > 0;
};

/**
 * Check if item is out of stock
 */
ItemMongooseSchema.methods.isOutOfStock = function (): boolean {
  const doc = this as IItemDocument;
  return doc.stock <= 0;
};

/**
 * Check if item is expiring soon
 */
ItemMongooseSchema.methods.isExpiringSoon = function (
  days: number = 30,
): boolean {
  const doc = this as IItemDocument;
  if (!doc.expiry_date) return false;

  const expiryDate = new Date(doc.expiry_date);
  const today = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  return daysUntilExpiry <= days && daysUntilExpiry > 0;
};

/**
 * Get stock status
 */
ItemMongooseSchema.methods.getStockStatus = function (
  threshold: number = 5,
): "Normal" | "Low" | "Critical" | "Out" {
  const doc = this as IItemDocument;

  if (doc.stock <= 0) return "Out";
  if (doc.stock <= Math.ceil(threshold / 2)) return "Critical";
  if (doc.stock <= threshold) return "Low";
  return "Normal";
};

// ============ VIRTUAL PROPERTIES ============

ItemMongooseSchema.virtual("available_stock").get(function () {
  return this.getAvailableStock();
});

ItemMongooseSchema.virtual("stock_status").get(function () {
  return this.getStockStatus();
});

ItemMongooseSchema.virtual("days_until_expiry").get(function () {
  if (!this.expiry_date) return null;

  const expiryDate = new Date(this.expiry_date);
  const today = new Date();
  return Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
});

ItemMongooseSchema.virtual("is_expired").get(function () {
  if (!this.expiry_date) return false;

  const expiryDate = new Date(this.expiry_date);
  const today = new Date();
  return expiryDate < today;
});

ItemMongooseSchema.virtual("needs_reorder").get(function () {
  return (
    this.stock <= 5 && this.status !== "Damaged" && this.status !== "For Repair"
  );
});

// ============ TRANSFORM JSON ============
ItemMongooseSchema.set("toJSON", {
  virtuals: true,
  transform: function (doc, ret) {
    delete (ret as Record<string, any>).__v;
    return ret;
  },
});

ItemMongooseSchema.set("toObject", {
  virtuals: true,
  transform: function (doc, ret) {
    delete (ret as Record<string, any>).__v;
    return ret;
  },
});

// ============ MODEL ============
export const ItemModel =
  mongoose.models.Item ||
  mongoose.model<IItemDocument>("Item", ItemMongooseSchema);
