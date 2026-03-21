// shared/workers/image.worker.js
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
const productModel = require("@/modules/product/product.model");
const brandModel = require("@/modules/brand/brand.model");
const { connectDatabase } = require("../config/db.config");
const { bumpNsVersion } = require("../utils/cache.util");

connectDatabase().then(() => {
  const worker = new Worker(
    IMAGE_QUEUE_NAME,
    async (job) => {
      if (job.name === "upload-category-image") {
        return handleCreateCategoryImage(job);
      }

      if (job.name === "update-category-image") {
        return handleUpdateCategoryImage(job);
      }
      if (job.name === "delete-category-image") {
        return handleDeleteCategoryImage(job);
      }
      // product job
      if (job.name == "upload-product-image") {
        return handleCreateProductImage(job);
      }
      if (job.name == "delete-product-image") {
        return handleDeleteProductImage(job);
      }
      if (job.name == "delete-product") {
        return handleDeleteProductImage(job);
      }

      // brand jobs
      if (job.name === "upload-brand-image") {
        return handleCreateBrandImage(job);
      }
      if (job.name === "update-brand-image") {
        return handleUpdateBrandImage(job);
      }
      if (job.name === "delete-brand-image") {
        return handleDeleteBrandImage(job);
      }

      // unknown job
      return null;
    },
    { connection, concurrency: 3 },
  );

  worker.on("ready", () => console.log("✅ Image Worker ready"));
  worker.on("active", (job) => console.log("▶️ Job active:", job.id, job.name));
  worker.on("completed", (job) =>
    console.log("✅ Job completed:", job.id, job.name),
  );
  worker.on("failed", (job, err) =>
    console.log("❌ Job failed:", job?.id, err),
  );
  worker.on("error", (err) => console.log("🔥 Worker error:", err));
});

/** ----- Create Category Image ----- */
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
    // invalidate category cache
    await bumpNsVersion("category");
    return { categoryId, imageUrl: uploaded.secure_url };
  } catch (err) {
    await categoryModel.findByIdAndUpdate(categoryId, {
      "image.status": "failed",
      "image.tries": job.attemptsMade + 1,
      "image.lastError": err?.message || "Upload failed",
      "image.localPath": localPath,
    });

    // invalidate category cache
    await bumpNsVersion("category");
    throw err;
  } finally {
    if (job.attemptsMade >= 2) {
      await fs.unlink(absPath).catch(() => null);
    }
  }
}

/** ----- Update Category Image (upload new + delete old) ----- */
async function handleUpdateCategoryImage(job) {
  const { categoryId, localPath, oldPublicId } = job.data;
  const absPath = path.resolve(localPath);

  // processing
  await categoryModel.findByIdAndUpdate(categoryId, {
    "image.status": "processing",
    "image.localPath": localPath,
    "image.tries": job.attemptsMade,
  });

  try {
    // upload new
    const uploaded = await cloudinaryFileUpload(absPath);

    //  prevent race: only update if still same localPath
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

    // if newer update came, skip delete
    if (!updated) {
      await fs.unlink(absPath).catch(() => null);
      return { categoryId, skipped: true };
    }

    // delete old after success
    if (oldPublicId && oldPublicId !== uploaded.public_id) {
      await deleteCloudinaryFile(oldPublicId);
    }
    // invalidate category cache
    await bumpNsVersion("category");
    await fs.unlink(absPath).catch(() => null);
    return { categoryId, imageUrl: uploaded.secure_url };
  } catch (err) {
    await categoryModel.findByIdAndUpdate(categoryId, {
      "image.status": "failed",
      "image.tries": job.attemptsMade + 1,
      "image.lastError": err?.message || "Upload failed",
      "image.localPath": localPath,
    });
    // invalidate category cache
    await bumpNsVersion("category");

    throw err;
  } finally {
    if (job.attemptsMade >= 2) {
      await fs.unlink(absPath).catch(() => null);
    }
  }
}

// delete category image
async function handleDeleteCategoryImage(job) {
  try {
    const { categoryId, publicId } = job.data;
    const deleted = await deleteCloudinaryFile(publicId);
    await categoryModel.deleteOne({ _id: categoryId });
    console.log("Deleted Category:", deleted);
    // invalidate category cache
    await bumpNsVersion("category");
    return deleted;
  } catch (error) {
    // invalidate category cache
    await bumpNsVersion("category");
    console.log("error from deleted category image", error);
    throw error;
  }
}

// create product image job
async function handleCreateProductImage(job) {
  const { productId, images = [] } = job.data;

  if (!productId) throw new Error("productId is required");
  if (!Array.isArray(images) || images.length === 0) {
    return { productId, uploadedCount: 0, images: [] };
  }

  const results = [];

  for (const img of images) {
    const absPath = path.resolve(img.path);

    try {
      const uploaded = await cloudinaryFileUpload(absPath);

      // push new image object into image array
      await productModel.findOneAndUpdate(
        { _id: productId },
        {
          $push: {
            image: {
              url: uploaded.secure_url,
              publicId: uploaded.public_id,
              optimized_url: uploaded.optimized_url,
              status: "uploaded",
              localPath: "",
              tries: job.attemptsMade + 1,
              lastError: "",
            },
          },
        },
        { returnDocument: "after" },
      );
      console.log("updated image on product db");
      results.push({ url: uploaded.secure_url, publicId: uploaded.public_id });
      await bumpNsVersion("product");

      // cleanup local file
      await fs.unlink(absPath).catch(() => null);
    } catch (error) {
      // push failed image info too (optional but useful)
      await productModel.findOneAndUpdate(
        { _id: productId },
        {
          $push: {
            image: {
              url: "",
              publicId: "",
              status: "failed",
              localPath: img.path,
              tries: job.attemptsMade + 1,
              lastError: error?.message || "Upload failed",
            },
          },
        },
      );
      await bumpNsVersion("product");

      await fs.unlink(absPath).catch(() => null);
      // continue next image (don’t stop whole batch)
      continue;
    }
  }

  return { productId, uploadedCount: results.length, images: results };
}

// handleDeleteProductImage
async function handleDeleteProductImage(job) {
  const { productId, images } = job.data;

  if (!productId) throw new Error("productId is required");

  // normalize ids
  const publicIds = Array.isArray(images)
    ? [...new Set(images.filter(Boolean).map(String))]
    : [];

  if (publicIds.length === 0) {
    return { productId, deletedCount: 0, images: [], failed: [] };
  }

  // (optional) quick existence check (cheap)
  const exists = await productModel.exists({ _id: productId });
  if (!exists) {
    return { productId, deletedCount: 0, images: [], failed: publicIds };
  }

  // --- delete in parallel with a small concurrency limit
  const concurrency = 5;
  const deleted = [];
  const failed = [];

  for (let i = 0; i < publicIds.length; i += concurrency) {
    const batch = publicIds.slice(i, i + concurrency);

    const results = await Promise.allSettled(
      batch.map((id) => deleteCloudinaryFile(id)),
    );

    results.forEach((r, idx) => {
      const id = batch[idx];
      if (r.status === "fulfilled" && r.value) deleted.push(id);
      else failed.push(id);
    });
  }

  // --- only remove from DB what actually deleted from Cloudinary
  if (deleted.length > 0) {
    await productModel.updateOne(
      { _id: productId },
      { $pull: { image: { publicId: { $in: deleted } } } },
    );
  }
  await bumpNsVersion("product");

  return {
    productId,
    requestedCount: publicIds.length,
    deletedCount: deleted.length,
    images: deleted, // deleted publicIds
    failed, // failed publicIds
  };
}

// handleDeleteProductImage
async function handleDeleteProductImage(job) {
  const { productId, images } = job.data;

  if (!productId) throw new Error("productId is required");
  const product = await productModel.findOneAndDelete({ _id: productId });
  if (!product) throw new Error("Product not found");
  for (let obj of images) {
    await deleteCloudinaryFile(obj.publicId);
  }
  await bumpNsVersion("product");

  return { productId, deletedCount: images.length, images };
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

    // 2) update brand doc with Cloudinary URL
    await brandModel.findByIdAndUpdate(brandId, {
      "image.url": uploaded.secure_url,
      "image.publicId": uploaded.public_id,
      "image.status": "uploaded",
      "image.lastError": "",
      "image.tries": job.attemptsMade + 1,
    });

    // 3) delete local temp file
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
    // after max retries — remove local file to free disk
    if (job.attemptsMade >= 2) {
      await fs.unlink(absPath).catch(() => null);
    }
  }
}

/** Update brand image — upload new, delete old from Cloudinary */
async function handleUpdateBrandImage(job) {
  const { brandId, localPath, oldPublicId } = job.data;
  const absPath = path.resolve(localPath);

  await brandModel.findByIdAndUpdate(brandId, {
    "image.status": "processing",
    "image.localPath": localPath,
    "image.tries": job.attemptsMade,
  });

  try {
    // 1) upload new image
    const uploaded = await cloudinaryFileUpload(absPath);

    // 2) race-safe: only apply if no newer update came in
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

    if (!updated) {
      await fs.unlink(absPath).catch(() => null);
      return { brandId, skipped: true };
    }

    // 3) delete old Cloudinary image
    if (oldPublicId && oldPublicId !== uploaded.public_id) {
      await deleteCloudinaryFile(oldPublicId);
    }

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

/** Delete brand image — remove from Cloudinary (doc already deleted in service) */
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
