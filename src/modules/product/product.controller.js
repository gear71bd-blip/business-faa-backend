const ApiResponse = require("@/shared/utils/apiResponse.utils");
const asyncHandler = require("@/shared/utils/asyncHandeler.utils");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");
const ProductService = require("@/modules/product/product.service");
const {
  getCache,
  setCache,
  bumpNsVersion,
  buildCacheKey,
} = require("@/shared/utils/cache.util");

class ProductController {
  // ── Create product ────────────────────────────────────────────────────────
  createProduct = asyncHandler(async (req, res) => {
    const product = await ProductService.createProduct(req.validatedData);
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.CREATED, "Product created", product.name);
  });

  // ── Get products (with filters, sort, cache) ──────────────────────────────
  getProducts = asyncHandler(async (req, res) => {
    const {
      category, subcategory, brandRef,
      minPrice, maxPrice,
      color, inStock, outOfStock,
      rating, highToLow, lowToHigh,
      newest, oldest, isLimited,
      name, slug, isBestSelling, hasVariants,
    } = req.query;

    let filter = {};
    let sort = {};

    // ── Sorting ──
    if (highToLow) sort.price = -1;
    else if (lowToHigh) sort.price = 1;
    if (newest) sort.createdAt = -1;
    else if (oldest) sort.createdAt = 1;

    // ── Filtering ──
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;
    if (brandRef) filter.brandRef = brandRef;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (color) {
      const colors = Array.isArray(color) ? color : [color];
      filter.color = { $in: colors };
    }

    if (inStock) filter.stock = { $gt: 0 };
    if (outOfStock) filter.stock = { $eq: 0 };
    if (isLimited !== undefined) filter.isLimited = isLimited === "true";
    if (isBestSelling !== undefined) filter.isBestSelling = isBestSelling === "true";
    if (hasVariants !== undefined) filter.hasVariants = hasVariants === "true";
    if (rating) filter.rating = { $eq: Number(rating) };
    if (name) filter.name = { $regex: name, $options: "i" };
    if (slug) filter.slug = slug;

    // ── Cache ──
    const cacheKey = await buildCacheKey("product", JSON.stringify({ filter, sort }));
    const cached = await getCache(cacheKey);
    if (cached) {
      return ApiResponse.success(res, HTTP_STATUS.OK, "Products fetched from cache", cached);
    }

    const products = await ProductService.getProducts(filter, sort);
    await setCache(cacheKey, products, 300);
    ApiResponse.success(res, HTTP_STATUS.OK, "Products fetched", products);
  });

  // ── Update product info ───────────────────────────────────────────────────
  updateProductInfo = asyncHandler(async (req, res) => {
    if (!req.params.slug)
      throw new ApiError("Product slug is required", HTTP_STATUS.BAD_REQUEST);

    const product = await ProductService.updateProductInfo(req.params.slug, req.body);
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.OK, "Product information updated", product);
  });

  // ── Add variants ──────────────────────────────────────────────────────────
  addVariants = asyncHandler(async (req, res) => {
    if (!req.params.slug)
      throw new ApiError("Product slug is required", HTTP_STATUS.BAD_REQUEST);

    const product = await ProductService.addVariants(
      req.params.slug,
      req.validatedData.variants,
    );
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.OK, "Variants added", product);
  });

  // ── Update a single variant ───────────────────────────────────────────────
  updateVariant = asyncHandler(async (req, res) => {
    const { slug, variantId } = req.params;
    if (!slug || !variantId)
      throw new ApiError("Product slug and variant ID are required", HTTP_STATUS.BAD_REQUEST);

    const product = await ProductService.updateVariant(slug, variantId, req.validatedData);
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.OK, "Variant updated", product);
  });

  // ── Delete a single variant ───────────────────────────────────────────────
  deleteVariant = asyncHandler(async (req, res) => {
    const { slug, variantId } = req.params;
    if (!slug || !variantId)
      throw new ApiError("Product slug and variant ID are required", HTTP_STATUS.BAD_REQUEST);

    const product = await ProductService.deleteVariant(slug, variantId);
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.OK, "Variant deleted", product);
  });

  // ── Delete product image ──────────────────────────────────────────────────
  deleteProductImage = asyncHandler(async (req, res) => {
    if (!req.params.slug)
      throw new ApiError("Product slug is required", HTTP_STATUS.BAD_REQUEST);

    const product = await ProductService.deletedProductImage(req.params.slug, req.body.publicId);
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.OK, "Product image deleted", product.name);
  });

  // ── Upload product image ──────────────────────────────────────────────────
  uploadProductImage = asyncHandler(async (req, res) => {
    if (!req.params.slug)
      throw new ApiError("Product slug is required", HTTP_STATUS.BAD_REQUEST);

    const product = await ProductService.uploadProductImage(req.params.slug, req.validatedData.image);
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.OK, "Product image uploaded", product.name);
  });

  // ── Delete product ────────────────────────────────────────────────────────
  deleteProuct = asyncHandler(async (req, res) => {
    if (!req.params.slug)
      throw new ApiError("Product slug is required", HTTP_STATUS.BAD_REQUEST);

    const product = await ProductService.deleteProductService(req.params.slug);
    await bumpNsVersion("product");
    ApiResponse.success(res, HTTP_STATUS.OK, "Product deleted", product.name);
  });
}

module.exports = new ProductController();
