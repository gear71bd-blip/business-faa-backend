const subCategoryModel = require("@/modules/subcategory/subcategory.model");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");

class SubCategoryService {
  // ── Create ──────────────────────────────────────────────────────────────────
  createSubCategory = async (data) => {
    const payload = {
      name: data.name,
      category: data.category,
      description: data.description || "",
      isActive: data.isActive ?? true,
      featured: data.featured ?? false,
      sortOrder: data.sortOrder ?? 0,
      filters: data.filters || [],
    };

    const subCategory = await subCategoryModel.create(payload);

    if (!subCategory) {
      throw new ApiError(
        "Sub-category not created",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    return subCategory;
  };

  // ── Read (list / single by slug) ─────────────────────────────────────────────
  getSubCategories = async (query) => {
    const subCategories = await subCategoryModel
      .find(query)
      .populate("category", "name slug image createdAt");
      console.log(subCategories); 
    if (!subCategories || subCategories.length === 0) {
      throw new ApiError("Sub-categories not found", HTTP_STATUS.NOT_FOUND);
    }

    return subCategories;
  };

  // ── Update ──────────────────────────────────────────────────────────────────
  updateSubCategory = async (slug, data) => {
    const subCategory = await subCategoryModel.findOne({ slug });

    if (!subCategory) {
      throw new ApiError("Sub-category not found", HTTP_STATUS.NOT_FOUND);
    }

    const updatePayload = {
      ...data,
      updatedAt: Date.now(),
    };

    const updated = await subCategoryModel.findOneAndUpdate(
      { slug: subCategory.slug },
      { $set: updatePayload },
      { new: true },
    );

    return updated;
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  deleteSubCategory = async (slug) => {
    const subCategory = await subCategoryModel.findOneAndDelete({ slug });

    if (!subCategory) {
      throw new ApiError("Sub-category not found", HTTP_STATUS.NOT_FOUND);
    }

    return {
      message: `${subCategory.name} deleted successfully`,
    };
  };
}

module.exports = new SubCategoryService();
