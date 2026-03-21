const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { imageQueue } = require("@/shared/queues/image.queue");
const { ApiError } = require("@/shared/utils/apiError.utils");
const productModel = require("@/modules/product/product.model");

class ProductService {
  // ── Create product ──────────────────────────────────────────────────────────
  createProduct = async (data) => {
    const hasVariants = Array.isArray(data.variants) && data.variants.length > 0;

    const product = await productModel.create({
      ...data,
      image: [],
      hasVariants,
    });

    if (!product) {
      throw new ApiError("Product not created", HTTP_STATUS.BAD_REQUEST);
    }

    if (Array.isArray(data.image) && data.image.length > 0) {
      imageQueue.add(
        "upload-product-image",
        {
          productId: product._id,
          images: data.image.map((img) => ({ path: img.path })),
        },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 3000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }

    return product;
  };

  // ── Get products ─────────────────────────────────────────────────────────────
  getProducts = async (filter, sortFilter) => {
    const products = await productModel
      .find(filter)
      .populate({ path: "category", select: "-__v -updatedAt -updatedBy -createdBy -filters -description" })
      .populate({ path: "subcategory", select: "name slug" })
      .populate({ path: "brandRef", select: "name slug image" })
      .select("-__v")
      .sort(sortFilter);

    if (!products.length) {
      throw new ApiError("Product not found", HTTP_STATUS.NOT_FOUND);
    }
   

    return products;
  };

  // ── Update product info ──────────────────────────────────────────────────────
  updateProductInfo = async (slug, data) => {
    const product = await productModel.findOneAndUpdate(
      { slug },
      { $set: data },
      { returnDocument: "after", runValidators: true },
    );

    if (!product) {
      throw new ApiError("Product not found", HTTP_STATUS.NOT_FOUND);
    }

    return product;
  };

  // ── Add variants to existing product ─────────────────────────────────────────
  addVariants = async (slug, variants) => {
    const product = await productModel.findOneAndUpdate(
      { slug },
      {
        $push: { variants: { $each: variants } },
        $set: { hasVariants: true },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!product) {
      throw new ApiError("Product not found", HTTP_STATUS.NOT_FOUND);
    }

    return product;
  };

  // ── Update a single variant by variantId ─────────────────────────────────────
  updateVariant = async (slug, variantId, data) => {
    // Build dot-notation $set for variant fields
    const setFields = {};
    Object.keys(data).forEach((key) => {
      setFields[`variants.$.${key}`] = data[key];
    });

    const product = await productModel.findOneAndUpdate(
      { slug, "variants._id": variantId },
      { $set: setFields },
      { returnDocument: "after", runValidators: true },
    );

    if (!product) {
      throw new ApiError("Product or variant not found", HTTP_STATUS.NOT_FOUND);
    }

    return product;
  };

  // ── Delete a single variant by variantId ─────────────────────────────────────
  deleteVariant = async (slug, variantId) => {
    const product = await productModel.findOneAndUpdate(
      { slug },
      { $pull: { variants: { _id: variantId } } },
      { returnDocument: "after" },
    );

    if (!product) {
      throw new ApiError("Product not found", HTTP_STATUS.NOT_FOUND);
    }

    // if no variants left, reset hasVariants
    const remaining = product.variants?.length ?? 0;
    if (remaining === 0) {
      await productModel.findOneAndUpdate({ slug }, { $set: { hasVariants: false } });
    }

    return product;
  };

  // ── Delete product image ─────────────────────────────────────────────────────
  deletedProductImage = async (slug, imageid = []) => {
    const product = await productModel.findOne({ slug });

    if (!product) {
      throw new ApiError("Product not found", HTTP_STATUS.NOT_FOUND);
    }

    imageQueue.add(
      "delete-product-image",
      { productId: product._id, images: imageid },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return product;
  };

  // ── Upload product image ─────────────────────────────────────────────────────
  uploadProductImage = async (slug, images) => {
    const product = await productModel.findOne({ slug });

    if (!product) {
      throw new ApiError("Product not found", HTTP_STATUS.NOT_FOUND);
    }

    imageQueue.add(
      "upload-product-image",
      { productId: product._id, images },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return product;
  };

  // ── Delete product (all images + doc) ────────────────────────────────────────
  deleteProductService = async (slug) => {
    const product = await productModel.findOne({ slug });

    if (!product) {
      throw new ApiError("Product not found", HTTP_STATUS.NOT_FOUND);
    }

    imageQueue.add(
      "delete-product",
      { productId: product._id, images: product.image },
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return product;
  };
}

module.exports = new ProductService();
