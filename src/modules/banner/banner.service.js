const bannerModel = require("@/modules/banner/banner.model");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { imageQueue } = require("@/shared/queues/image.queue");
const { ApiError } = require("@/shared/utils/apiError.utils");

class BannerService {
  // ── Create ──────────────────────────────────────────────────────────────────
  createBanner = async (data) => {
    const files = data?.image || [];
    const firstImage = Array.isArray(files) ? files[0] : null;

    const payload = {
      title: data.title,
      isActive: data.isActive ?? true,
      createdBy: data.createdBy || null,
      updatedBy: data.updatedBy || null,
      image: {
        status: "pending",
        localPath: firstImage?.path || "",
        url: "",
        publicId: "",
        tries: 0,
        lastError: "",
      },
    };

    const banner = await bannerModel.create(payload);

    if (!banner) {
      throw new ApiError("Banner not created", HTTP_STATUS.BAD_REQUEST);
    }

    if (firstImage?.path) {
      const job = await imageQueue.add(
        "upload-banner-image",
        {
          bannerId: banner._id.toString(),
          localPath: firstImage.path,
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      return {
        bannerTitle: banner.title,
        jobId: job.id,
        status: "queued",
      };
    }

    return banner;
  };

  // ── Read ─────────────────────────────────────────────────────────────────────
  getBanners = async (query) => {
    const banners = await bannerModel.find(query);

    if (!banners || banners.length === 0) {
      throw new ApiError("Banners not found", HTTP_STATUS.NOT_FOUND);
    }

    return banners;
  };

  /** get single banner by id */
  getBannerById = async (id) => {
    const banner = await bannerModel.findById(id);

    if (!banner) {
      throw new ApiError("Banner not found", HTTP_STATUS.NOT_FOUND);
    }

    return banner;
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  updateBanner = async (id, data) => {
    const files = data?.image || [];
    const firstImage = Array.isArray(files) ? files[0] : null;
    const { image, ...rest } = data;

    const banner = await bannerModel.findById(id);

    if (!banner) {
      throw new ApiError("Banner not found", HTTP_STATUS.NOT_FOUND);
    }

    const oldPublicId = banner.image?.publicId || "";

    const updatePayload = {
      ...rest,
      updatedAt: Date.now(),
    };

    if (firstImage?.path) {
      updatePayload.image = {
        status: "pending",
        localPath: firstImage.path,
        url: "",
        publicId: oldPublicId,
        tries: 0,
        lastError: "",
      };
    }

    const updated = await bannerModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true },
    );

    if (firstImage?.path) {
      const job = await imageQueue.add(
        "update-banner-image",
        {
          bannerId: id,
          localPath: firstImage.path,
          oldPublicId,
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      return {
        bannerTitle: `${banner.title} updated successfully`,
        jobId: job.id,
        status: "queued",
      };
    }

    return updated;
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  deleteBanner = async (id) => {
    const banner = await bannerModel.findByIdAndDelete(id);

    if (!banner) {
      throw new ApiError("Banner not found", HTTP_STATUS.NOT_FOUND);
    }

    const job = await imageQueue.add(
      "delete-banner-image",
      {
        bannerId: id,
        oldPublicId: banner.image?.publicId || "",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return {
      bannerTitle: `${banner.title} deleted successfully`,
      jobId: job.id,
      status: "queued",
    };
  };
}

module.exports = new BannerService();
