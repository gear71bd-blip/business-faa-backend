const express = require("express");
const _ = express.Router();
const bannerController = require("@/modules/banner/banner.controller");
const { upload } = require("@/shared/middlewares/upload.middleware");
const {
  validateBanner,
  validateUpdateBanner,
} = require("./banner.validation");

_.route("/create-banner").post(
  upload.fields([{ name: "image", maxCount: 1 }]),
  validateBanner,
  bannerController.createBanner,
);

_.route("/get-banner").get(bannerController.getBanners);

_.route("/get-banner/:id").get(bannerController.getBannerById);

_.route("/update-banner/:id").put(
  upload.fields([{ name: "image", maxCount: 1 }]),
  validateUpdateBanner,
  bannerController.updateBanner,
);

_.route("/delete-banner/:id").delete(bannerController.deleteBanner);

module.exports = _;
