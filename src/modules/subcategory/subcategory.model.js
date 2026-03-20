const slugify = require("slugify");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");
const mongoose = require("mongoose");

const subCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },

    // required ref to parent — subcategory can't exist without a category
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },



    description: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },

    seo: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: [{ type: String }],
      ogImage: { type: String, default: "" },
    },

    filters: [{ type: String }],

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// ── slug generation ──────────────────────────────────────────────────────────
subCategorySchema.pre("save", function () {
  if (!this.isModified("name")) return;
  this.slug = slugify(this.name, { lower: true, strict: true });
});

// ── duplicate slug check (scoped globally, slugs must be universally unique) ─
subCategorySchema.pre("save", async function () {
  if (!this.isModified("name")) return;

  const duplicate = await this.constructor.findOne({
    slug: this.slug,
    _id: { $ne: this._id },
  });

  if (duplicate) {
    throw new ApiError(
      "Sub-category name already exists",
      HTTP_STATUS.BAD_REQUEST,
    );
  }
});

// ── auto SEO metadata ────────────────────────────────────────────────────────
subCategorySchema.pre("save", function () {
  if (
    !this.isModified("name") &&
    !this.isModified("description") &&
    !this.isModified("image.url")
  )
    return;

  this.seo.metaTitle = this.name;
  this.seo.metaDescription = this.description;
});

// ── findOneAndUpdate hooks ───────────────────────────────────────────────────
subCategorySchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();
  if (!update) return;

  const $set = update.$set || {};

  // name changed → slug + seo.metaTitle
  if (update.name !== undefined || $set.name !== undefined) {
    const name = (update.name ?? $set.name) || "";
    const slug = name ? slugify(name, { lower: true, strict: true }) : "";

    if (update.name !== undefined) update.slug = slug;
    else $set.slug = slug;

    $set["seo.metaTitle"] = name;
  }

  // description changed → seo.metaDescription
  if (update.description !== undefined || $set.description !== undefined) {
    const desc = (update.description ?? $set.description) || "";
    $set["seo.metaDescription"] = desc;
  }



  update.$set = $set;
  this.setUpdate(update);
});

module.exports =
  mongoose.models.SubCategory ||
  mongoose.model("SubCategory", subCategorySchema);