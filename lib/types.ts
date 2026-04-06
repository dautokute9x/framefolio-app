import type { JOB_STATUSES, ALBUM_VISIBILITY } from "@/lib/constants";

export type JobStatus = (typeof JOB_STATUSES)[number];
export type AlbumVisibility = (typeof ALBUM_VISIBILITY)[number];

export type Profile = {
  id: string;
  auth_user_id: string | null;
  email: string;
  full_name: string | null;
  role: "admin";
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Album = {
  id: string;
  owner_id: string;
  client_id: string | null;
  title: string;
  slug: string;
  description: string | null;
  status: JobStatus;
  visibility: AlbumVisibility;
  password_hash: string | null;
  share_token: string;
  event_date: string | null;
  delivered_at: string | null;
  cover_photo_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Photo = {
  id: string;
  album_id: string;
  owner_id: string;
  file_path: string;
  file_name: string;
  storage_bucket: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
};

export type Selection = {
  id: string;
  album_id: string;
  photo_id: string;
  selection_key: string;
  selector_name: string | null;
  selector_email: string | null;
  created_at: string;
};

export type AlbumCardData = Album & {
  clients: Pick<Client, "name" | "email"> | null;
  photo_count: number;
  cover_photo_url: string | null;
};

export type PhotoWithUrl = Photo & {
  signedUrl: string | null;
};

export type GalleryAlbumPayload = {
  album: Album & { clients: Pick<Client, "name" | "email"> | null };
  photos: PhotoWithUrl[];
  requiresPassword: boolean;
  canAccessWithoutPassword: boolean;
  shareTokenValidated: boolean;
  shareToken?: string | null;
};
