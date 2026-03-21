require("module-alias/register");

const { Worker } = require("bullmq");
const fs = require("fs/promises");
const path = require("path");

const { IMAGE_QUEUE_NAME } = require("@/shared/queues/image.queue");
const { connection } = require("@/shared/config/redis.config");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("@/shared/config/cloudinary.config");

const categoryModel = require("@/modules/categories/categories.model");
const brandModel = require("@/modules/brand/brand.model");
const productModel = require("@/modules/product/product.model");
const { connectDatabase } = require("../config/db.config");
const { bumpNsVersion } = require("../utils/cache.util");

connectDatabase().then(() => {
  const worker = new Worker(
    IMAGE_QUEUE_NAME,
    async (job) => {
      // ── Category jobs ────────────────────────────────────────────────────────
      if (job.name === "upload-category-image")
        return handleCreateCategoryImage(job);
      if (job.name === "update-category-image")
        return handleUpdateCategoryImage(job);
      if (job.name === "delete-category-image")
        return handleDeleteCategoryImage(job);

      // ── Brand jobs ───────────────────────────────────────────────────────────
      if (job.name === "upload-brand-image")
        return handleCreateBrandImage(job);
      if (job.name === "update-brand-image")
        return handleUpdateBrandImage(job);
      if (job.name === "delete-brand-image")
        return handleDeleteBrandImage(job);

      // ── Product jobs ────────────────────────────────────────────────────────
      if (job.name === "upload-product-image")
        return handleCreateProductImage(job);
      if (job.name === "delete-product-image")
        return handleDeleteProductImage(job);
      if (job.name === "delete-product")
        return handleDeleteFullProduct(job);

      // unknown job — skip silently
      return null;
    },
    { connection, concurrency: 3 },
  );

  worker.on("ready", () => console.log("✅ Image Worker ready"));
  worker.on("active", (job) => console.log("▶️  Job active:", job.id, job.name));
  worker.on("completed", (job) =>
    console.log("✅ Job completed:", job.id, job.name),
  );
  worker.on("failed", (job, err) =>
    console.log("❌ Job failed:", job?.id, err),
  );
  worker.on("error", (err) => console.log("🔥 Worker error:", err));
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CATEGORY HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Create — upload image then update DB */
async function handleCreateCategoryImage(job) {
  const { categoryId, localPath } = job.data;
  const absPath = path.resolve(localPath);

  await categoryModel.findByIdAndUpdate(categoryId, {
    "image.status": "processing",
    "image.localPath": localPath,
    "image.tries": job.attemptsMade,
  });

  try {
    const uploaded = await cloudinaryFileUpload(absPath);

    await categoryModel.findByIdAndUpdate(categoryId, {
      "image.url": uploaded.secure_url,
      "image.publicId": uploaded.public_id,
      "image.status": "uploaded",
      "image.lastError": "",
      "image.tries": job.attemptsMade + 1,
      "seo.ogImage": uploaded.secure_url,
    });

    await fs.unlink(absPath).catch(() => null);
    await bumpNsVersion("category");
    return { categoryId, imageUrl: uploaded.secure_url };
  } catch (err) {
    await categoryModel.findByIdAndUpdate(categoryId, {
      "image.status": "failed",
      "image.tries": job.attemptsMade + 1,
      "image.lastError": err?.message || "Upload failed",
      "image.localPath": localPath,
    });

    await bumpNsVersion("category");
    throw err;
  } finally {
    if (job.attemptsMade >= 2) {
      await fs.unlink(absPath).catch(() => null);
    }
  }
}

/** Update — upload new, delete old from Cloudinary */
async function handleUpdateCategoryImage(job) {
  const { categoryId, localPath, oldPublicId } = job.data;
  const absPath = path.resolve(localPath);

  await categoryModel.findByIdAndUpdate(categoryId, {
    "image.status": "processing",
    "image.localPath": localPath,
    "image.tries": job.attemptsMade,
  });

  try {
    const uploaded = await cloudinaryFileUpload(absPath);

    // race-safe: only update if this job's localPath is still the current one
    const updated = await categoryModel.findOneAndUpdate(
      { _id: categoryId, "image.localPath": localPath },
      {
        $set: {
          "image.url": uploaded.secure_url,
          "image.publicId": uploaded.public_id,
          "image.status": "uploaded",
          "image.lastError": "",
          "image.tries": job.attemptsMade + 1,
          "seo.ogImage": uploaded.secure_url,
        },
      },
      { new: true },
    );

    if (!updated) {
      await fs.unlink(absPath).catch(() => null);
      return { categoryId, skipped: true };
    }

    if (oldPublicId && oldPublicId !== uploaded.public_id) {
      await deleteCloudinaryFile(oldPublicId);
    }

    await fs.unlink(absPath).catch(() => null);
    await bumpNsVersion("category");
    return { categoryId, imageUrl: uploaded.secure_url };
  } catch (err) {
    await categoryModel.findByIdAndUpdate(categoryId, {
      "image.status": "failed",
      "image.tries": job.attemptsMade + 1,
      "image.lastError": err?.message || "Upload failed",
      "image.localPath": localPath,
    });

    await bumpNsVersion("category");
    throw err;
  } finally {
    if (job.attemptsMade >= 2) {
      await fs.unlink(absPath).catch(() => null);
    }
  }
}

/** Delete — remove image from Cloudinary (document already deleted in service) */
async function handleDeleteCategoryImage(job) {
  try {
    const { oldPublicId } = job.data;
    if (oldPublicId) {
      await deleteCloudinaryFile(oldPublicId);
    }
    await bumpNsVersion("category");
    return { deleted: true, oldPublicId };
  } catch (err) {
    await bumpNsVersion("category");
    console.error("❌ Delete category image error:", err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BRAND HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Create brand — upload image to Cloudinary then update brand in DB */
async function handleCreateBrandImage(job) {
  const { brandId, localPath } = job.data;
  const absPath = path.resolve(localPath);

  // mark as processing
  await brandModel.findByIdAndUpdate(brandId, {
    "image.status": "processing",
    "image.localPath": localPath,
    "image.tries": job.attemptsMade,
  });

  try {
    // 1) upload to Cloudinary
    const uploaded = await cloudinaryFileUpload(absPath);

    // 2) update brand with cloudinary URL
    await brandModel.findByIdAndUpdate(brandId, {
      "image.url": uploaded.secure_url,
      "image.publicId": uploaded.public_id,
      "image.status": "uploaded",
      "image.lastError": "",
      "image.tries": job.attemptsMade + 1,
    });

    // 3) clean up local temp file
    await fs.unlink(absPath).catch(() => null);

    // 4) invalidate brand cache
    await bumpNsVersion("brand");

    return { brandId, imageUrl: uploaded.secure_url };
  } catch (err) {
    await brandModel.findByIdAndUpdate(brandId, {
      "image.status": "failed",
      "image.tries": job.attemptsMade + 1,
      "image.lastError": err?.message || "Upload failed",
      "image.localPath": localPath,
    });

    await bumpNsVersion("brand");
    throw err; // BullMQ will retry based on attempts/backoff config
  } finally {
    // after max retries — remove local file to save disk space
    if (job.attemptsMade >= 2) {
      await fs.unlink(absPath).catch(() => null);
    }
  }
}

/** Update brand image — upload new image, delete old from Cloudinary */
async function handleUpdateBrandImage(job) {
  const { brandId, localPath, oldPublicId } = job.data;
  const absPath = path.resolve(localPath);

  // mark as processing
  await brandModel.findByIdAndUpdate(brandId, {
    "image.status": "processing",
    "image.localPath": localPath,
    "image.tries": job.attemptsMade,
  });

  try {
    // 1) upload new image
    const uploaded = await cloudinaryFileUpload(absPath);

    // 2) race-safe update: only apply if this job's localPath is still current
    const updated = await brandModel.findOneAndUpdate(
      { _id: brandId, "image.localPath": localPath },
      {
        $set: {
          "image.url": uploaded.secure_url,
          "image.publicId": uploaded.public_id,
          "image.status": "uploaded",
          "image.lastError": "",
          "image.tries": job.attemptsMade + 1,
        },
      },
      { new: true },
    );

    // if a newer update came in while this job was running — skip old delete
    if (!updated) {
      await fs.unlink(absPath).catch(() => null);
      return { brandId, skipped: true };
    }

    // 3) delete old Cloudinary image (only if different publicId)
    if (oldPublicId && oldPublicId !== uploaded.public_id) {
      await deleteCloudinaryFile(oldPublicId);
    }

    // 4) clean up temp file & invalidate cache
    await fs.unlink(absPath).catch(() => null);
    await bumpNsVersion("brand");

    return { brandId, imageUrl: uploaded.secure_url };
  } catch (err) {
    await brandModel.findByIdAndUpdate(brandId, {
      "image.status": "failed",
      "image.tries": job.attemptsMade + 1,
      "image.lastError": err?.message || "Upload failed",
      "image.localPath": localPath,
    });

    await bumpNsVersion("brand");
    throw err;
  } finally {
    if (job.attemptsMade >= 2) {
      await fs.unlink(absPath).catch(() => null);
    }
  }
}

/** Delete brand image — remove from Cloudinary (document already deleted in service) */
async function handleDeleteBrandImage(job) {
  try {
    const { oldPublicId } = job.data;
    if (oldPublicId) {
      await deleteCloudinaryFile(oldPublicId);
    }
    await bumpNsVersion("brand");
    return { deleted: true, oldPublicId };
  } catch (err) {
    await bumpNsVersion("brand");
    console.error("❌ Delete brand image error:", err);
    throw err;
  }
}
// ═══════════════════════════════════════════════════════════════════════════════
//  PRODUCT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Create Product Image — batch upload to top-level */
async function handleCreateProductImage(job) {
  const { productId, images = [] } = job.data;
  if (!productId || !images.length) return { productId, uploadedCount: 0 };

  const results = [];
  for (const img of images) {
    const absPath = path.resolve(img.path);
    try {
      const uploaded = await cloudinaryFileUpload(absPath);
      const imgData = {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        optimized_url: uploaded.optimized_url || uploaded.secure_url,
        status: "uploaded",
        tries: job.attemptsMade + 1,
      };

      // Update top-level product image
      await productModel.findByIdAndUpdate(productId, {
        $push: { image: imgData }
      });

      results.push(uploaded.secure_url);
      await fs.unlink(absPath).catch(() => null);
    } catch (err) {
      console.error("❌ Product image upload failed:", err);
      await fs.unlink(absPath).catch(() => null);
    }
  }

  await bumpNsVersion("product");
  return { productId, uploadedCount: results.length };
}

/** Delete Product Image — remove specific publicIds */
async function handleDeleteProductImage(job) {
  const { productId, images = [] } = job.data; // images is array of publicIds
  if (!productId || !images.length) return { deleted: 0 };

  for (const publicId of images) {
    try {
      if (publicId) await deleteCloudinaryFile(publicId);
    } catch (err) {
      console.error("❌ Delete product image helper error:", err);
    }
  }

  // Remove from DB (top-level only)
  await productModel.findByIdAndUpdate(productId, {
    $pull: { image: { publicId: { $in: images } } }
  });

  await bumpNsVersion("product");
  return { deleted: images.length };
}

/** Delete Full Product — remove all images and the doc */
async function handleDeleteFullProduct(job) {
  const { productId, images = [] } = job.data;
  
  // 1) Delete doc
  await productModel.findByIdAndDelete(productId);

  // 2) Delete all images (top-level provided in job, but we should also check variants)
  // In a real scenario, we might want to fetch the doc first to get ALL publicIds
  for (const img of images) {
    if (img.publicId) await deleteCloudinaryFile(img.publicId).catch(() => null);
  }

  await bumpNsVersion("product");
  return { productId, deleted: true };
}
