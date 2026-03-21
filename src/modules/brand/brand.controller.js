const { ApiError } = require("@/shared/utils/apiError.utils");
const ApiResponse = require("@/shared/utils/apiResponse.utils");
const asyncHandler = require("@/shared/utils/asyncHandeler.utils");
const brandService = require("@/modules/brand/brand.service");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const BrandDTO = require("./brand.dto");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/shared/utils/cache.util");

class BrandController {
  // ── Create ──────────────────────────────────────────────────────────────────
  createBrand = asyncHandler(async (req, res, next) => {
    const brand = await brandService.createBrand(req.validatedData);

    // invalidate brand cache
    await bumpNsVersion("brand");

    ApiResponse.success(res, 200, "Brand created", brand);
  });

  // ── Read ─────────────────────────────────────────────────────────────────────
  getBrand = asyncHandler(async (req, res, next) => {
    let query = {};

    if (req.query.slug) {
      query.slug = req.query.slug;
    }

    const suffix = JSON.stringify({ query });
    const cacheKey = await buildCacheKey("brand", suffix);

    const cachedBrand = await getCache(cacheKey);
    if (cachedBrand) {
      return ApiResponse.success(
        res,
        200,
        "Brand fetched from cache",
        cachedBrand,
      );
    }

    const brands = await brandService.getBrands(query);

    const brandData = Array.isArray(brands)
      ? brands.map((b) => new BrandDTO(b))
      : new BrandDTO(brands);

    await setCache(cacheKey, brandData, 300);

    ApiResponse.success(res, 200, "Brand fetched", brandData);
  });

  // ── Update ──────────────────────────────────────────────────────────────────
  updateBrand = asyncHandler(async (req, res, next) => {
    if (!req.params.slug) {
      throw new ApiError("Brand slug is required", HTTP_STATUS.BAD_REQUEST);
    }

    const brand = await brandService.updateBrand(
      req.params.slug,
      req.validatedData,
    );

    // invalidate brand cache
    await bumpNsVersion("brand");

    ApiResponse.success(res, 200, "Brand updated", brand);
  });

  // ── Delete ──────────────────────────────────────────────────────────────────
  deleteBrand = asyncHandler(async (req, res, next) => {
    if (!req.params.slug) {
      throw new ApiError("Brand slug is required", HTTP_STATUS.BAD_REQUEST);
    }

    const brand = await brandService.deleteBrand(req.params.slug);

    // invalidate brand cache
    await bumpNsVersion("brand");

    ApiResponse.success(res, 200, "Brand deleted", brand);
  });
}

module.exports = new BrandController();
