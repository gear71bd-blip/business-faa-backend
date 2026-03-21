const brandModel = require("@/modules/brand/brand.model");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { imageQueue } = require("@/shared/queues/image.queue");
const { ApiError } = require("@/shared/utils/apiError.utils");

class BrandService {
  // ── Create ──────────────────────────────────────────────────────────────────
  createBrand = async (data) => {
    const files = data?.image || [];
    const firstImage = Array.isArray(files) ? files[0] : null;


    const payload = {
      name: data.name,
      description: data.description || "",
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

    const brand = await brandModel.create(payload);

    if (!brand) {
      throw new ApiError("Brand not created", HTTP_STATUS.BAD_REQUEST);
    }

    if (firstImage?.path) {
      const job = await imageQueue.add(
        "upload-brand-image",
        {
          brandId: brand._id.toString(),
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
        brandName: brand.name,
        jobId: job.id,
        status: "queued",
      };
    }

    return brand;
  };

  // ── Read ─────────────────────────────────────────────────────────────────────
  getBrands = async (query) => {
    const brands = await brandModel.find(query);

    if (!brands || brands.length === 0) {
      throw new ApiError("Brands not found", HTTP_STATUS.NOT_FOUND);
    }

    return brands;
  };

  // ── Update ──────────────────────────────────────────────────────────────────
  updateBrand = async (slug, data) => {
    const files = data?.image || [];
    const firstImage = Array.isArray(files) ? files[0] : null;
    const { image, ...rest } = data;

    const brand = await brandModel.findOne({ slug });

    if (!brand) {
      throw new ApiError("Brand not found", HTTP_STATUS.NOT_FOUND);
    }

    const oldPublicId = brand.image?.publicId || "";

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

    const updated = await brandModel.findOneAndUpdate(
      { slug: brand.slug },
      { $set: updatePayload },
      { new: true },
    );

    if (firstImage?.path) {
      const job = await imageQueue.add(
        "update-brand-image",
        {
          brandId: brand._id.toString(),
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
        brandName: `${brand.name} updated successfully`,
        jobId: job.id,
        status: "queued",
      };
    }

    return updated;
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  deleteBrand = async (slug) => {
    const brand = await brandModel.findOneAndDelete({ slug });

    if (!brand) {
      throw new ApiError("Brand not found", HTTP_STATUS.NOT_FOUND);
    }

    const job = await imageQueue.add(
      "delete-brand-image",
      {
        brandId: brand._id.toString(),
        oldPublicId: brand.image?.publicId || "",
      },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return {
      brandName: `${brand.name} deleted successfully`,
      jobId: job.id,
      status: "queued",
    };
  };
}

module.exports = new BrandService();
