const joi = require("joi");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");
const { validateImageFiles } = require("@/shared/helpers/imageValidation");

// ── Variant sub-schema for Joi ────────────────────────────────────────────────
const variantJoiSchema = joi.object({
  sku: joi.string().trim().allow("").optional(),

  // Only color and size are required
  color: joi.string().trim().allow("").optional(),
  size: joi.string().trim().allow("").optional(),
  material: joi.string().trim().allow("").optional(),
  weight: joi.number().min(0).optional(),
  price: joi.number().optional(),
  discountType: joi
    .string()
    .valid("percentage", "fixed")
    .allow(null)
    .default(null)
    .optional(),
  discountValue: joi.number().min(0).default(0).optional(),
  stock: joi.number().min(0).default(0).optional(),
  isActive: joi.boolean().default(true).optional(),
});

// ── Create product schema ─────────────────────────────────────────────────────
const productSchema = joi.object({
  name: joi.string().trim().required().messages({
    "string.empty": "Product name is required",
    "any.required": "Product name is required",
  }),
  description: joi.string().trim().required().messages({
    "string.empty": "Description is required",
    "any.required": "Description is required",
  }),
  shortDescription: joi.string().trim().allow("").optional(),
  sku: joi.string().trim().required().messages({
    "string.empty": "SKU is required",
    "any.required": "SKU is required",
  }),

  // Relations
  category: joi.string().trim().required().messages({
    "string.empty": "Category is required",
    "any.required": "Category is required",
  }),
  subcategory: joi.string().trim().allow("", null).optional(),
  brandRef: joi.string().trim().allow("", null).optional(),

  // Base pricing (required when no variants)
  price: joi.number().required().messages({
    "any.required": "Price is required",
  }),
  discountType: joi
    .string()
    .valid("percentage", "fixed")
    .allow(null)
    .default(null)
    .optional(),
  discountValue: joi.number().min(0).default(0).optional(),

  // Base stock
  stock: joi.number().min(0).optional().messages({
    "any.required": "Stock is required",
  }),
});

exports.validateProduct = async (req, res, next) => {
  try {
    // 1) Handle variants JSON string if needed
    if (req.body.variants && typeof req.body.variants === "string") {
      try {
        req.body.variants = JSON.parse(req.body.variants);
      } catch {
        return next(
          new ApiError(
            "variants must be a valid JSON array",
            HTTP_STATUS.BAD_REQUEST,
          ),
        );
      }
    }

    // 2) Validate body
    const value = await productSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    // 3) Validate images using helper
    const images = validateImageFiles({
      req,
      next,
      required: true,
      maxCount: 10,
      maxSizeMB: 10,
      fieldName: "image",
    });

    req.validatedData = {
      ...value,
      image: images,
    };
    next();
  } catch (error) {
    if (error.details) {
      const message = error.details.map((e) => e.message).join(", ");
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

// ── Update product info schema ────────────────────────────────────────────────
const updateSchema = joi
  .object({
    name: joi.string().trim().optional(),
    shortDescription: joi.string().trim().allow("").optional(),
    description: joi.string().allow("").optional(),
    price: joi.number().optional(),
    discountType: joi
      .string()
      .valid("percentage", "fixed")
      .allow(null)
      .optional(),
    discountValue: joi.number().min(0).optional(),
    stock: joi.number().min(0).optional(),
    color: joi.array().items(joi.string().trim()).optional(),
    size: joi.array().items(joi.string().trim()).optional(),
    subcategory: joi.string().allow("", null).optional(),
    brandRef: joi.string().allow("", null).optional(),
    isNew: joi.boolean().optional(),
    isSale: joi.boolean().optional(),
    isLimited: joi.boolean().optional(),
    isHot: joi.boolean().optional(),
    isFeatured: joi.boolean().optional(),
    isBestSelling: joi.boolean().optional(),
    isActive: joi.boolean().optional(),
  })
  .min(1);

exports.validateUpdateProduct = async (req, res, next) => {
  try {
    const value = await updateSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    // 3) Process files from upload.any()
    const allFiles = req.files || [];
    const productImages = allFiles.filter((f) => f.fieldname === "image");

    req.validatedData = { ...value, image: productImages };
    next();
  } catch (error) {
    if (error.details) {
      const message = error.details.map((e) => e.message).join(", ");
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

// ── Image-only validation ─────────────────────────────────────────────────────
exports.validateProductImage = async (req, res, next) => {
  try {
    const images = validateImageFiles({
      req,
      next,
      required: true,
      maxCount: 10,
      maxSizeMB: 10,
      fieldName: "image",
    });

    req.validatedData = { image: images };
    next();
  } catch (error) {
    return next(
      new ApiError(
        error.message || "Validation failed",
        HTTP_STATUS.BAD_REQUEST,
      ),
    );
  }
};

// ── Add variant validation ────────────────────────────────────────────────────
exports.validateAddVariant = async (req, res, next) => {
  try {
    const schema = joi.array().items(variantJoiSchema).min(1).required();

    let body = req.body.variants;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return next(
          new ApiError(
            "variants must be a valid JSON array",
            HTTP_STATUS.BAD_REQUEST,
          ),
        );
      }
    }

    const value = await schema.validateAsync(body, { abortEarly: false });
    req.validatedData = { variants: value };
    next();
  } catch (error) {
    if (error.details) {
      const message = error.details.map((e) => e.message).join(", ");
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

// ── Update single variant validation ─────────────────────────────────────────
exports.validateUpdateVariant = async (req, res, next) => {
  try {
    const schema = joi
      .object({
        color: joi.string().trim().allow("").optional(),
        size: joi.string().trim().allow("").optional(),
        material: joi.string().trim().allow("").optional(),
        weight: joi.number().min(0).optional(),
        price: joi.number().optional(),
        discountType: joi
          .string()
          .valid("percentage", "fixed")
          .allow(null)
          .optional(),
        discountValue: joi.number().min(0).optional(),
        stock: joi.number().min(0).optional(),
        isActive: joi.boolean().optional(),
      })
      .min(1);

    const value = await schema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: false,
    });

    req.validatedData = value;
    next();
  } catch (error) {
    if (error.details) {
      const message = error.details.map((e) => e.message).join(", ");
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
