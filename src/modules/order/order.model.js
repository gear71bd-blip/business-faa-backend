const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default:null,
    },
    variantId:{
      type: mongoose.Schema.Types.ObjectId,
      default:null,
    },

    qty: { type: Number, required: true, min: 1 },
    color: { type: String, default: null, trim: true },
    size: { type: String, default: null, trim: true },
  },
  { _id: false },
);

const orderSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, unique: true, index: true }, // ex: INV-20260217-XXXX
    status: {
      type: String,
      default: "pending",
    },

    customer: {
      fullName: { type: String, required: true, trim: true },
      phone: {
        type: String,
        required: true,
        trim: true,
        index: true,
        validate: [
          (v) => /^(?:\+88|01)\d{11}$/.test(v) || /^01\d{9}$/.test(v),
          "Phone must be in format +8801XXXXXXXXX or 01XXXXXXXXX (Bangladesh).",
        ],
      },
      address: { type: String, required: true, trim: true },
    },

    note: { type: String, default: null, trim: true },

    paymentMethod: {
      type: String,
      default: "cod",
    },

    items: {
      type: [orderItemSchema],
      validate: [(v) => Array.isArray(v) && v.length > 0, "Items are required"],
      required: true,
    },

    totalQty: { type: Number, default: 0, min: 0 },
    subtotal: { type: Number, default: 0, min: 0 },
    deliveryCharge: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

//  auto invoiceId + totals
orderSchema.pre("save", function () {
  // invoiceId generate once
  if (!this.invoiceId) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    this.invoiceId = `INV-${y}${m}${day}-${rand}`;
  }

  // normalize note
  if (typeof this.note === "string") {
    const t = this.note.trim();
    this.note = t ? t : null;
  }
});

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);
