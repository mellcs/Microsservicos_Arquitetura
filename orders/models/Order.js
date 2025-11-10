import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    productId: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "CANCELLED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
