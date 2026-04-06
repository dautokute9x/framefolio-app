import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();

function loadEnv() {
  const candidates = [".env.local", ".env"];
  for (const file of candidates) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;

    const content = fs.readFileSync(full, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const DEMO_EMAIL = "demo@framefolio.local";
const DEMO_PASSWORD = "Demo123!";
const GALLERY_PASSWORD = "client123";

async function ensureDemoAuthUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: "Demo Photographer",
    },
  });

  if (data?.user) return data.user;

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) throw listError;
  const existing = usersData.users.find((user) => user.email === DEMO_EMAIL);
  if (!existing) {
    throw error || new Error("Unable to create or find demo auth user");
  }
  return existing;
}

async function ensureProfile() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", DEMO_EMAIL)
    .single();

  if (error) throw error;
  return data;
}

async function upsertClient(ownerId, client) {
  const { data: existing } = await supabase
    .from("clients")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("name", client.name)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      owner_id: ownerId,
      ...client,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function upsertAlbum(ownerId, clientId, album) {
  const { data: existing } = await supabase
    .from("albums")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("slug", album.slug)
    .maybeSingle();

  const payload = {
    owner_id: ownerId,
    client_id: clientId,
    title: album.title,
    slug: album.slug,
    description: album.description,
    status: album.status,
    visibility: album.visibility,
    event_date: album.event_date,
    password_hash: album.password ? await bcrypt.hash(album.password, 10) : null,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("albums")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("albums")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function uploadPhoto(ownerId, album, filename, sortOrder) {
  const source = fs.readFileSync(path.join(root, "public", "demo", filename));
  const storagePath = `${ownerId}/${album.id}/${filename}`;

  const { error: uploadError } = await supabase.storage
    .from("albums")
    .upload(storagePath, source, {
      contentType: "image/svg+xml",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: existing } = await supabase
    .from("photos")
    .select("*")
    .eq("album_id", album.id)
    .eq("file_path", storagePath)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("photos")
    .insert({
      album_id: album.id,
      owner_id: ownerId,
      file_path: storagePath,
      file_name: filename,
      storage_bucket: "albums",
      sort_order: sortOrder,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function setCover(albumId, photoId) {
  const { error } = await supabase
    .from("albums")
    .update({ cover_photo_id: photoId })
    .eq("id", albumId);

  if (error) throw error;
}

async function seedSelections(albumId, photoIds) {
  for (const photoId of photoIds) {
    await supabase.from("selections").upsert(
      {
        album_id: albumId,
        photo_id: photoId,
        selection_key: "demo-client-selection",
        selector_name: "Alicia",
        selector_email: "alicia@example.com",
      },
      { onConflict: "album_id,photo_id,selection_key" }
    );
  }
}

async function seedViews(albumId, shareToken) {
  await supabase.from("album_views").insert([
    {
      album_id: albumId,
      viewer_ip: "127.0.0.1",
      viewer_agent: "Seed Script",
      share_token: shareToken,
    },
    {
      album_id: albumId,
      viewer_ip: "127.0.0.2",
      viewer_agent: "Seed Script",
      share_token: shareToken,
    },
  ]);
}

async function main() {
  console.log("Ensuring demo auth user...");
  const authUser = await ensureDemoAuthUser();
  console.log("Auth user:", authUser.id);

  console.log("Ensuring public profile...");
  const profile = await ensureProfile();
  const ownerId = profile.id;

  const client1 = await upsertClient(ownerId, {
    name: "Alicia Morgan",
    email: "alicia@example.com",
    phone: "+1 555 102 200",
    notes: "Wedding client",
  });

  const client2 = await upsertClient(ownerId, {
    name: "North Studio",
    email: "hello@northstudio.co",
    phone: "+1 555 888 200",
    notes: "Brand refresh campaign",
  });

  const publicAlbum = await upsertAlbum(ownerId, client1.id, {
    title: "Alicia & Marcus",
    slug: "alicia-marcus",
    description: "Warm documentary wedding coverage with a soft editorial finish.",
    status: "Delivered",
    visibility: "public",
    event_date: "2026-01-18",
    password: null,
  });

  const privateAlbum = await upsertAlbum(ownerId, client2.id, {
    title: "North Studio Brand Refresh",
    slug: "north-studio-brand-refresh",
    description: "Private selection gallery for the first edit round.",
    status: "Client Selecting",
    visibility: "private",
    event_date: "2026-03-04",
    password: GALLERY_PASSWORD,
  });

  const publicPhotos = [];
  publicPhotos.push(await uploadPhoto(ownerId, publicAlbum, "wedding-01.svg", 1));
  publicPhotos.push(await uploadPhoto(ownerId, publicAlbum, "wedding-02.svg", 2));
  publicPhotos.push(await uploadPhoto(ownerId, publicAlbum, "wedding-03.svg", 3));

  const privatePhotos = [];
  privatePhotos.push(await uploadPhoto(ownerId, privateAlbum, "brand-01.svg", 1));
  privatePhotos.push(await uploadPhoto(ownerId, privateAlbum, "brand-02.svg", 2));
  privatePhotos.push(await uploadPhoto(ownerId, privateAlbum, "brand-03.svg", 3));
  privatePhotos.push(await uploadPhoto(ownerId, privateAlbum, "brand-04.svg", 4));

  await setCover(publicAlbum.id, publicPhotos[0].id);
  await setCover(privateAlbum.id, privatePhotos[0].id);

  await seedSelections(privateAlbum.id, [privatePhotos[0].id, privatePhotos[2].id]);
  await seedViews(privateAlbum.id, privateAlbum.share_token);

  console.log("");
  console.log("Demo seed complete.");
  console.log(`Admin login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`Private gallery password: ${GALLERY_PASSWORD}`);
  console.log(
    `Private gallery link: ${SITE_URL}/gallery/${privateAlbum.slug}?share=${privateAlbum.share_token}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
