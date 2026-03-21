const express = require("express");
const _ = express.Router();
const brandController = require("@/modules/brand/brand.controller");
const { upload } = require("@/shared/middlewares/upload.middleware");
const {
  validateBrand,
  validateUpdateBrand,
} = require("./brand.validation");

_.route("/create-brand").post(
  upload.fields([{ name: "image", maxCount: 1 }]),
  validateBrand,
  brandController.createBrand,
);

_.route("/get-brand").get(brandController.getBrand);

_.route("/update-brand/:slug").put(
  upload.fields([{ name: "image", maxCount: 1 }]),
  validateUpdateBrand,
  brandController.updateBrand,
);

_.route("/delete-brand/:slug").delete(brandController.deleteBrand);

module.exports = _;
