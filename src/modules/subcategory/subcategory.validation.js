const joi = require("joi");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");

// ── Create validation schema ─────────────────────────────────────────────────
// Only required fields have validation — name & category are required by model
const createSchema = joi.object({
  name: joi.string().trim().required().messages({
    "string.empty": "Sub-category name is required.",
    "any.required": "Sub-category name is required.",
  }),
  category: joi.string().trim().required().messages({
    "string.empty": "Parent category id is required.",
    "any.required": "Parent category id is required.",
  }),
});

exports.validateSubCategory = async (req, res, next) => {
  try {
    const value = await createSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    req.validatedData = { ...value };
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

// ── Update validation schema ─────────────────────────────────────────────────
const updateSchema = joi
  .object({
    name: joi.string().trim().optional(),
    description: joi.string().trim().allow("").optional(),
    category: joi.string().trim().optional(),
    isActive: joi.boolean().optional(),
    featured: joi.boolean().optional(),
    sortOrder: joi.number().optional(),
    filters: joi.array().items(joi.string()).optional(),
  })
  .min(1);

exports.validateUpdateSubCategory = async (req, res, next) => {
  try {
    const value = await updateSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    req.validatedData = { ...value };
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
