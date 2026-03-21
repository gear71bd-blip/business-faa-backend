class BrandDTO {
  constructor(brand) {
    this.id = brand._id;
    this.name = brand.name;
    this.slug = brand.slug;
    this.description = brand.description;

    this.image = {
      url: brand.image?.url || "",
      publicId: brand.image?.publicId || "",
      status: brand.image?.status || "pending",
      lastError: brand.image?.lastError || "",
    };

    this.isActive = brand.isActive;
    this.createdAt = brand.createdAt;
    this.updatedAt = brand.updatedAt;
  }
}

module.exports = BrandDTO;
