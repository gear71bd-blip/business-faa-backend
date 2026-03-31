const bannerService = require("@/modules/banner/banner.service");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const ApiResponse = require("@/shared/utils/apiResponse.utils");
const asyncHandler = require("@/shared/utils/asyncHandeler.utils");

class BannerController {
  // ── Create ──────────────────────────────────────────────────────────────────
  createBanner = asyncHandler(async (req, res, next) => {
    const data = {
      ...req.validatedData,
      createdBy: req?.user?._id || null,
      updatedBy: req?.user?._id || null,
    };

    const result = await bannerService.createBanner(data);

    ApiResponse.success(
      res,
      HTTP_STATUS.CREATED,
      "Banner created successfully",
      result,
    );
  });

  // ── Read ─────────────────────────────────────────────────────────────────────
  getBanners = asyncHandler(async (req, res, next) => {
    const query = req.query || {};
    const result = await bannerService.getBanners(query);

    ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      "Banners fetched successfully",
      result,
    );
  });

  /** get single banner */
  getBannerById = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const result = await bannerService.getBannerById(id);

    ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      "Banner fetched successfully",
      result,
    );
  });

  // ── Update ──────────────────────────────────────────────────────────────────
  updateBanner = asyncHandler(async (req, res, next) => {
    const { id } = req.params;
    const data = {
      ...req.validatedData,
      updatedBy: req?.user?._id || null,
    };

    const result = await bannerService.updateBanner(id, data);

    ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      "Banner updated successfully",
      result,
    );
  });

  // ── Delete ──────────────────────────────────────────────────────────────────
  deleteBanner = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const result = await bannerService.deleteBanner(id);

    ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      "Banner deleted successfully",
      result,
    );
  });
}

module.exports = new BannerController();
