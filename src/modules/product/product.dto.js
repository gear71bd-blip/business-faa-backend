class ProductDTO {
  constructor(product) {
    this.id = product._id;
    this.name = product.name;
    this.slug = product.slug;
    this.shortDescription = product.shortDescription;
    this.description = product.description;
    this.sku = product.sku;

    // Relations
    this.category = product.category;
    this.subcategory = product.subcategory ?? null;
    this.brand = product.brandRef ?? product.brand ?? null;

    // Base price & stock
    this.price = product.price;
    this.discountType = product.discountType;
    this.discountValue = product.discountValue;
    this.finalPrice = product.finalPrice;
    this.stock = product.stock;
    this.inStock = product.inStock;

    // Attributes
    this.color = product.color || [];
    this.size = product.size || [];

    // Variants
    this.hasVariants = product.hasVariants;
    this.variants = (product.variants || []).map((v) => ({
      id: v._id,
      sku: v.sku,
      color: v.color,
      size: v.size,
      material: v.material,
      weight: v.weight,
      price: v.price,
      discountType: v.discountType,
      discountValue: v.discountValue,
      finalPrice: v.finalPrice,
      stock: v.stock,
      inStock: v.inStock,
      isActive: v.isActive,
    }));

    // Images
    this.image = (product.image || [])
      .filter((img) => img.status === "uploaded")
      .map((img) => ({
        url: img.url,
        publicId: img.publicId,
        optimized_url: img.optimized_url || img.url,
      }));

    // Badges
    this.isNew = product.isNew;
    this.isSale = product.isSale;
    this.isLimited = product.isLimited;
    this.isHot = product.isHot;
    this.isFeatured = product.isFeatured;
    this.isBestSelling = product.isBestSelling;
    this.isActive = product.isActive;

    // Rating
    this.rating = product.rating;
    this.totalReviews = product.totalReviews;

    this.createdAt = product.createdAt;
    this.updatedAt = product.updatedAt;
  }
}

module.exports = ProductDTO;
