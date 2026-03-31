const { HTTP_STATUS } = require("@/shared/config/constant.config");
const { ApiError } = require("@/shared/utils/apiError.utils");
const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
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

// check if same title already exist or not
bannerSchema.pre("save", async function () {
  const existingBanner = await this.constructor.findOne({
    title: this.title,
  });
  console.log(existingBanner);
  if (existingBanner) {
       throw new ApiError("Banner name already exists", HTTP_STATUS.BAD_REQUEST);
  }
});

module.exports =
  mongoose.models.Banner || mongoose.model("Banner", bannerSchema);
