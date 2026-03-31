const joi = require("joi");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");
const { validateImageFiles } = require("@/shared/helpers/imageValidation");

// ── Create schema ───────────────────────────────────────────────────────────
const createSchema = joi.object({
  title: joi.string().trim().required().messages({
    "string.empty": "Banner title is required.",
    "any.required": "Banner title is required.",
  }),
});

exports.validateBanner = async (req, res, next) => {
  try {
    const value = await createSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    const images = validateImageFiles({
      req,
      next,
      required: true,
      maxCount: 1,
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

// ── Update schema ───────────────────────────────────────────────────────────
const updateSchema = joi
  .object({
    title: joi.string().trim().optional(),
    isActive: joi.boolean().optional(),
  })
  .min(1);

exports.validateUpdateBanner = async (req, res, next) => {
  try {
    const value = await updateSchema.validateAsync(req.body, {
      abortEarly: false,
      allowUnknown: true,
    });

    // image optional on update
    const images = validateImageFiles({
      req,
      next,
      required: req?.files?.image?.length > 0 ? true : false,
      maxCount: 1,
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
