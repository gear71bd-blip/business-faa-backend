class SubCategoryDTO {
  constructor(subCategory) {
    this.id = subCategory._id;
    this.name = subCategory.name;
    this.slug = subCategory.slug;
    this.description = subCategory.description;

    // populated or raw ref
    this.category = subCategory.category;

    this.seo = subCategory.seo;
    this.isActive = subCategory.isActive;
    this.featured = subCategory.featured;
    this.sortOrder = subCategory.sortOrder;
    this.filters = subCategory.filters || [];
    this.createdAt = subCategory.createdAt;
    this.updatedAt = subCategory.updatedAt;
  }
}

module.exports = SubCategoryDTO;
