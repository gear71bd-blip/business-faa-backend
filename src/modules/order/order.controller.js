const { ApiError } = require("@/shared/utils/apiError.utils");
const ApiResponse = require("@/shared/utils/apiResponse.utils");
const asyncHandler = require("@/shared/utils/asyncHandeler.utils");
const orderService = require("@/modules/order/order.service");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/shared/utils/cache.util");

class orderController {
  createOrder = asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.validatedData);

    // invalidate order cache
    await bumpNsVersion("order");

    ApiResponse.success(res, HTTP_STATUS.CREATED, "Order created", order);
  });

  getOrders = asyncHandler(async (req, res) => {
    let query = {};

    if (req.query.invoiceId) {
      query.invoiceId = req.query.invoiceId;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    const suffix = JSON.stringify({ query });
    const cacheKey = await buildCacheKey("order", suffix);

    const cachedOrders = await getCache(cacheKey);
    if (cachedOrders) {
      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        "Orders fetched from cache",
        cachedOrders,
      );
    }

    const orders = await orderService.getOrders(query);

    await setCache(cacheKey, orders, 300);

    ApiResponse.success(res, HTTP_STATUS.OK, "Orders fetched", orders);
  });

  deleteOrder = asyncHandler(async (req, res) => {
    if (!req.params.invoiceId) {
      throw new ApiError(
        "Order invoiceId is required",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const order = await orderService.deleteOrder(req.params.invoiceId);

    // invalidate order cache
    await bumpNsVersion("order");

    ApiResponse.success(res, HTTP_STATUS.OK, "Order deleted", order);
  });

  updateOrderStatus = asyncHandler(async (req, res) => {
    if (!req.params.invoiceId) {
      throw new ApiError(
        "Order invoiceId is required",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const { status } = req.validatedData;
    const order = await orderService.updateOrderStatus(req.params.invoiceId, status);

    // invalidate order cache
    await bumpNsVersion("order");

    ApiResponse.success(res, HTTP_STATUS.OK, "Order status updated", order);
  });
}

module.exports = new orderController();
