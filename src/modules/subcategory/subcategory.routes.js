const express = require("express");
const _ = express.Router();
const subCategoryController = require("@/modules/subcategory/subcategory.controller");
const {
  validateSubCategory,
  validateUpdateSubCategory,
} = require("./subcategory.validation");

_.route("/create-subcategory").post(
  validateSubCategory,
  subCategoryController.createSubCategory,
);

_.route("/get-subcategory").get(subCategoryController.getSubCategory);

_.route("/update-subcategory/:slug").put(
  validateUpdateSubCategory,
  subCategoryController.updateSubCategory,
);

_.route("/delete-subcategory/:slug").delete(
  subCategoryController.deleteSubCategory,
);

module.exports = _;
