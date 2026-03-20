const { ApiError } = require("@/shared/utils/apiError.utils");
const ApiResponse = require("@/shared/utils/apiResponse.utils");
const asyncHandler = require("@/shared/utils/asyncHandeler.utils");
const subCategoryService = require("@/modules/subcategory/subcategory.service");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const SubCategoryDTO = require("./subcategory.dto");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/shared/utils/cache.util");

class SubCategoryController {
  // ── Create ──────────────────────────────────────────────────────────────────
  createSubCategory = asyncHandler(async (req, res, next) => {
    const subCategory = await subCategoryService.createSubCategory(
      req.validatedData,
    );

    // invalidate subcategory cache
    await bumpNsVersion("subcategory");

    ApiResponse.success(res, 200, "Sub-category created", subCategory);
  });

  // ── Read ─────────────────────────────────────────────────────────────────────
  getSubCategory = asyncHandler(async (req, res, next) => {
    let query = {};

    if (req.query.slug) {
      query.slug = req.query.slug;
    }

    // optional: filter by parent category
    if (req.query.category) {
      query.category = req.query.category;
    }

    const suffix = JSON.stringify({ query });
    const cacheKey = await buildCacheKey("subcategory", suffix);

    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return ApiResponse.success(
        res,
        200,
        "Sub-category fetched from cache",
        cachedData,
      );
    }

    const subCategories = await subCategoryService.getSubCategories(query);

    const subCategoryData = Array.isArray(subCategories)
      ? subCategories.map((sc) => new SubCategoryDTO(sc))
      : new SubCategoryDTO(subCategories);

    await setCache(cacheKey, subCategoryData, 300);

    ApiResponse.success(res, 200, "Sub-category fetched", subCategoryData);
  });

  // ── Update ──────────────────────────────────────────────────────────────────
  updateSubCategory = asyncHandler(async (req, res, next) => {
    if (!req.params.slug) {
      throw new ApiError(
        "Sub-category slug is required",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const subCategory = await subCategoryService.updateSubCategory(
      req.params.slug,
      req.validatedData,
    );

    // invalidate subcategory cache
    await bumpNsVersion("subcategory");

    ApiResponse.success(res, 200, "Sub-category updated", subCategory);
  });

  // ── Delete ──────────────────────────────────────────────────────────────────
  deleteSubCategory = asyncHandler(async (req, res, next) => {
    if (!req.params.slug) {
      throw new ApiError(
        "Sub-category slug is required",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const subCategory = await subCategoryService.deleteSubCategory(
      req.params.slug,
    );

    // invalidate subcategory cache
    await bumpNsVersion("subcategory");

    ApiResponse.success(res, 200, "Sub-category deleted", subCategory);
  });
}

module.exports = new SubCategoryController();
