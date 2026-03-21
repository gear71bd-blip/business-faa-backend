const orderModel = require("@/modules/order/order.model");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");
const productModel = require("@/modules/product/product.model");
const mongoose = require("mongoose");

class createOrderService {
  async createOrder(data) {
    const session = await mongoose.startSession();

    try {
      let createdOrder = null;

      await session.withTransaction(async () => {
        const productIds = data.items.map((it) => it.productId);

        const products = await productModel
          .find({ _id: { $in: productIds }, isActive: true })
          .select("_id name price finalPrice stock inStock")
          .session(session);

        const pMap = new Map(products.map((p) => [String(p._id), p]));

        let totalQty = 0;
        let subtotal = 0;

        const orderItems = data.items.map((it) => {
          const p = pMap.get(String(it.productId));

          if (!p) {
            throw new ApiError(
              "Invalid product in items",
              HTTP_STATUS.BAD_REQUEST,
            );
          }

          const qty = Number(it.qty || 0);

          if (qty <= 0) {
            throw new ApiError("Invalid quantity", HTTP_STATUS.BAD_REQUEST);
          }

          const unitPrice = Number(p.finalPrice ?? p.price ?? 0);

          if (Number(p.stock || 0) < qty) {
            throw new ApiError(
              `Insufficient stock for ${p.name}. Available: ${p.stock}, Requested: ${qty}`,
              HTTP_STATUS.BAD_REQUEST,
            );
          }

          totalQty += qty;
          subtotal += unitPrice * qty;

          return {
            productId: p._id,
            variantId: it.variantId || null,
            qty,
            color: it.color || null,
            size: it.size || null,
          };
        });

        const docs = await orderModel.create(
          [
            {
              customer: {
                fullName: String(data.customer.fullName).trim(),
                phone: String(data.customer.phone).trim(),
                address: String(data.customer.address).trim(),
              },
              note: data.note ? String(data.note).trim() : null,
              paymentMethod: data.paymentMethod || "cod",
              items: orderItems,
              totalQty,
              subtotal,
              deliveryCharge: data.deliveryCharge || 0,
            },
          ],
          { session },
        );

        createdOrder = docs?.[0];

        if (!createdOrder) {
          throw new ApiError("Order not created", HTTP_STATUS.BAD_REQUEST);
        }

        for (const it of orderItems) {
          const r = await productModel.updateOne(
            { _id: it.productId, stock: { $gte: it.qty } },
            { $inc: { stock: -it.qty } },
            { session },
          );

          if (r.modifiedCount !== 1) {
            throw new ApiError(
              "Stock update failed (race condition)",
              HTTP_STATUS.CONFLICT,
            );
          }
        }
      });

      return createdOrder;
    } catch (err) {
      throw err;
    } finally {
      session.endSession();
    }
  }

  getOrders = async (query) => {
    const orders = await orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate({
        path: "items.productId",
      });

    if (!orders || orders.length === 0) {
      throw new ApiError("Orders not found", HTTP_STATUS.BAD_REQUEST);
    }

    return orders;
  };

  deleteOrder = async (id) => {
    const order = await orderModel.findOneAndDelete({ invoiceId: id });

    if (!order) {
      throw new ApiError("Order not found", HTTP_STATUS.BAD_REQUEST);
    }

    return order;
  };
  updateOrderStatus = async (id, status) => {
    const order = await orderModel.findOneAndUpdate(
      { invoiceId: id },
      { $set: { status } },
      { new: true }
    );

    if (!order) {
      throw new ApiError("Order not found", HTTP_STATUS.BAD_REQUEST);
    }

    return order;
  };
}

module.exports = new createOrderService();
