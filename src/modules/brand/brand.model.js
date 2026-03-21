const slugify = require("slugify");
const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");
const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, index: true },

    description: { type: String, default: "" },

    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      status: {
        type: String,
        enum: ["pending", "processing", "uploaded", "failed"],
        default: "pending",
      },
      localPath: { type: String, default: "" },
      tries: { type: Number, default: 0 },
      lastError: { type: String, default: "" },
    },

    isActive: { type: Boolean, default: true },

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

// ── slug from name ────────────────────────────────────────────────────────────
brandSchema.pre("save", function () {
  if (!this.isModified("name")) return;
  this.slug = slugify(this.name, { lower: true, strict: true });
});

// ── duplicate slug check ──────────────────────────────────────────────────────
brandSchema.pre("save", async function () {
  if (!this.isModified("name")) return;

  const duplicate = await this.constructor.findOne({
    slug: this.slug,
    _id: { $ne: this._id },
  });

  if (duplicate) {
    throw new ApiError("Brand name already exists", HTTP_STATUS.BAD_REQUEST);
  }
});

// ── findOneAndUpdate: sync slug when name changes ────────────────────────────
brandSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate();
  if (!update) return;

  const $set = update.$set || {};

  if (update.name !== undefined || $set.name !== undefined) {
    const name = (update.name ?? $set.name) || "";
    const slug = name ? slugify(name, { lower: true, strict: true }) : "";

    if (update.name !== undefined) update.slug = slug;
    else $set.slug = slug;
  }

  update.$set = $set;
  this.setUpdate(update);
});

module.exports =
  mongoose.models.Brand || mongoose.model("Brand", brandSchema);
