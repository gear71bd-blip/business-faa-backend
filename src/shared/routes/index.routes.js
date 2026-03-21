const express = require("express");
const _ = express.Router();
_.use("/categories", require("@/modules/categories/categories.routes"));
_.use("/subcategory", require("@/modules/subcategory/subcategory.routes"));
_.use("/brand", require("@/modules/brand/brand.routes"));
_.use("/product", require("@/modules/product/product.routes"));
_.use("/order", require("@/modules/order/order.route"));
_.use("/contact", require("@/modules/contactMessage/contact.routes"));

module.exports = _;
