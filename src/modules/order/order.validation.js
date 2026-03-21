const joi = require("joi");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");

// ------------------------
// CREATE ORDER (required only)
// ------------------------
const orderCreateSchema = joi.object(
  {
    customer: joi
      .object({
        fullName: joi.string().trim().required().messages({
          "string.empty": "Customer fullName is required.",
          "any.required": "Customer fullName is required.",
        }),

        phone: joi.string().trim().required().messages({
          "string.empty": "Customer phone is required.",
          "any.required": "Customer phone is required.",
          "string.pattern.base":
            "Phone must be in format +8801XXXXXXXXX or 01XXXXXXXXX (Bangladesh).",
        }),

        address: joi.string().trim().required().messages({
          "string.empty": "Customer address is required.",
          "any.required": "Customer address is required.",
        }),
      })
      .required()
      .messages({
        "any.required": "Customer is required.",
      }),

    paymentMethod: joi.string().trim().default("cod").messages({
      "string.empty": "Payment method is required.",
      "any.required": "Payment method is required.",
      "any.only": "Invalid payment method.",
    }),

    items: joi
      .array()
      .items(
        joi.object({
          productId: joi.string().trim().required().messages({
            "string.empty": "Item productId is required.",
            "any.required": "Item productId is required.",
          }),

          qty: joi.number().required().min(1).messages({
            "number.base": "Item qty must be a number.",
            "any.required": "Item qty is required.",
            "number.min": "Item qty must be at least 1.",
          }),

          variantId: joi.string().trim().allow(null, "").optional(),
          color: joi.string().trim().allow(null, "").optional(),
          size: joi.string().trim().allow(null, "").optional(),
        }),
      )
      .min(1)
      .required()
      .messages({
        "array.base": "Items must be an array.",
        "array.min": "At least 1 item is required.",
        "any.required": "Items are required.",
      }),

    note: joi.string().trim().allow(null, "").optional(),
    deliveryCharge: joi.number().optional(),
  },
  { abortEarly: false, allowUnknown: true },
);

exports.validateCreateOrder = async (req, res, next) => {
  console.log(req.body);
  try {
    const value = await orderCreateSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    // attach validated data
    req.validatedData = value;

    next();
  } catch (error) {
    if (error.details) {
      const message = error.details.map((err) => err.message).join(", ");
      return next(
        new ApiError("Validation error: " + message, HTTP_STATUS.BAD_REQUEST),
      );
    }

    return next(
      new ApiError(
        error.message || "Validation failed",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }
};

// ------------------------
// UPDATE ORDER STATUS
// ------------------------
const updateOrderStatusSchema = joi.object({
  status: joi
    .string()
    .valid("pending", "processing", "confirmed", "shipped", "delivered", "cancelled")
    .required()
    .messages({
      "any.required": "Status is required.",
      "any.only": "Invalid status.",
    }),
});

exports.validateUpdateOrderStatus = async (req, res, next) => {
  try {
    const value = await updateOrderStatusSchema.validateAsync(req.body);
    req.validatedData = value;
    next();
  } catch (error) {
    if (error.details) {
      const message = error.details.map((err) => err.message).join(", ");
      return next(new ApiError(message, HTTP_STATUS.BAD_REQUEST));
    }
    return next(new ApiError("Validation failed", HTTP_STATUS.BAD_REQUEST));
  }
};
