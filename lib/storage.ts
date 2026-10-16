import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PHOTO_BUCKET } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Photo storage with two backends:
 *  - "supabase": Supabase Storage bucket `albums` (Free plan: 1 GB)
 *  - "r2":       Cloudflare R2 (Free tier: 10 GB, no egress fees)
 *
 * Every photo row records where its files live in `photos.storage_bucket`
 * ("albums" = Supabase, "r2" = R2), so switching STORAGE_DRIVER later never
 * breaks photos uploaded earlier.
 */
export type StorageDriver = "supabase" | "r2";
export const R2_BUCKET_MARKER = "r2";

export function activeDriver(): StorageDriver {
  return process.env.STORAGE_DRIVER === "r2" ? "r2" : "supabase";
}

export function driverForBucket(storageBucket: string | null | undefined): StorageDriver {
  return storageBucket === R2_BUCKET_MARKER ? "r2" : "supabase";
}

export function bucketValueForDriver(driver: StorageDriver) {
  return driver === "r2" ? R2_BUCKET_MARKER : PHOTO_BUCKET;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

let r2Client: S3Client | null = null;
function r2() {
  if (!r2Client) {
    r2Client = new S3Client({
      region: "auto",
      // R2_ENDPOINT lets tests point at a local S3-compatible server.
      endpoint:
        process.env.R2_ENDPOINT ??
        `https://${required("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      forcePathStyle: !!process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: required("R2_ACCESS_KEY_ID"),
        secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return r2Client;
}
const r2Bucket = () => required("R2_BUCKET");

/** URL the browser can PUT one file to, valid for 15 minutes (R2 only). */
export async function createR2UploadUrl(path: string, contentType: string, size: number) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: path,
      ContentType: contentType,
      // Signed into the URL, so the browser cannot upload a bigger file.
      ContentLength: size,
      CacheControl: "private, max-age=31536000, immutable",
    }),
    { expiresIn: 60 * 15, signableHeaders: new Set(["content-type", "content-length"]) }
  );
}

/** Signed read URLs, keyed by path. Paths are grouped per backend. */
export async function signReadUrls(
  items: { path: string; storageBucket: string | null | undefined }[],
  expiresIn: number
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const supabasePaths: string[] = [];
  const r2Paths: string[] = [];

  for (const item of items) {
    if (result.has(item.path)) continue;
    result.set(item.path, null);
    (driverForBucket(item.storageBucket) === "r2" ? r2Paths : supabasePaths).push(item.path);
  }

  if (supabasePaths.length) {
    const { data, error } = await createAdminClient()
      .storage.from(PHOTO_BUCKET)
      .createSignedUrls(supabasePaths, expiresIn);
    if (error) console.error("[storage] supabase sign failed", error.message);
    (data ?? []).forEach((row) => {
      if (row?.path) result.set(row.path, row.signedUrl ?? null);
    });
  }

  if (r2Paths.length) {
    // Signing is a local HMAC computation: no network call per photo.
    const client = r2();
    const bucket = r2Bucket();
    await Promise.all(
      r2Paths.map(async (path) => {
        const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: path }), {
          expiresIn,
        });
        result.set(path, url);
      })
    );
  }

  return result;
}

/** Short-lived URL that downloads the original under its own file name. */
export async function signDownloadUrl(
  path: string,
  storageBucket: string | null | undefined,
  fileName: string,
  expiresIn = 300
) {
  if (driverForBucket(storageBucket) === "r2") {
    return getSignedUrl(
      r2(),
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: path,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      }),
      { expiresIn }
    );
  }
  const { data, error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .createSignedUrl(path, expiresIn, { download: fileName });
  if (error) console.error("[storage] download sign failed", error.message);
  return data?.signedUrl ?? null;
}

export async function removeObjects(paths: string[], storageBucket: string | null | undefined) {
  if (!paths.length) return;
  if (driverForBucket(storageBucket) === "r2") {
    await r2().send(
      new DeleteObjectsCommand({
        Bucket: r2Bucket(),
        Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
      })
    );
    return;
  }
  await createAdminClient().storage.from(PHOTO_BUCKET).remove(paths);
}
