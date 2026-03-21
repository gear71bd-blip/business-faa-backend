const { upload } = require("@/shared/middlewares/upload.middleware");
const productController = require("@/modules/product/product.controller");
const express = require("express");
const {
  validateProduct,
  validateUpdateProduct,
  validateProductImage,
  validateAddVariant,
  validateUpdateVariant,
} = require("./product.validation");

const _ = express.Router();

// ── Product CRUD ──────────────────────────────────────────────────────────────
_.route("/create-product").post(
  upload.fields([{ name: "image", maxCount: 10 }]),
  validateProduct,
  productController.createProduct,
);

_.route("/get-products").get(productController.getProducts);

_.route("/update-productinfo/:slug").put(
  validateUpdateProduct,
  productController.updateProductInfo,
);

_.route("/delete-productimage/:slug").delete(
  productController.deleteProductImage,
);

_.route("/upload-product-image/:slug").post(
  upload.fields([{ name: "image", maxCount: 10 }]),
  validateProductImage,
  productController.uploadProductImage,
);

_.route("/delete-product/:slug").delete(productController.deleteProuct);

// ── Variant routes ────────────────────────────────────────────────────────────
_.route("/add-variants/:slug").post(
  validateAddVariant,
  productController.addVariants,
);

_.route("/update-variant/:slug/:variantId").put(
  validateUpdateVariant,
  productController.updateVariant,
);

_.route("/delete-variant/:slug/:variantId").delete(
  productController.deleteVariant,
);

module.exports = _;
