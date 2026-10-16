# Chạy Framefolio miễn phí cho cá nhân và gia đình

Web chạy 0đ/tháng trên 3 dịch vụ miễn phí: **Vercel Hobby** (web), **Supabase Free** (database, đăng nhập), **Cloudflare R2** (lưu ảnh, 10GB). Toàn bộ cài đặt mất khoảng 45 phút và không cần biết lập trình.

| Dịch vụ | Miễn phí | Giới hạn cần biết |
| --- | --- | --- |
| Vercel Hobby | Web + tên miền `ten-ban.vercel.app` | Chỉ dùng cá nhân, **không thương mại** |
| Supabase Free | 500MB database, 50.000 người dùng | Tạm dừng sau 7 ngày không ai vào (repo đã có tác vụ tự giữ hoạt động, xem bước 6) |
| Cloudflare R2 | 10GB lưu trữ, xem/tải ảnh không mất phí | Cloudflare có thể yêu cầu thêm thẻ hoặc PayPal để bật R2; dưới 10GB không bị trừ tiền |

**Sức chứa 10GB:** mỗi ảnh lưu 2 bản (ảnh gốc + bản xem trước 2048px). Ảnh điện thoại khoảng 3–4MB, tức khoảng **2.500 ảnh**. Muốn chứa nhiều hơn, xuất ảnh JPEG cạnh dài 3000px trước khi upload: được khoảng **8.000–10.000 ảnh**.

> Gói miễn phí không có sao lưu tự động. Luôn giữ ảnh gốc ở nơi khác (Google Photos, ổ cứng, NAS). Web chỉ là nơi xem và chia sẻ.

---

## Bước 1 — Tạo Supabase (database + đăng nhập)

1. Vào <https://supabase.com> → **Start your project** → đăng nhập bằng GitHub.
2. **New project**: đặt tên (VD `framefolio`), đặt mật khẩu database (lưu lại), Region chọn **Southeast Asia (Singapore)**, gói **Free** → **Create**.
3. Đợi khoảng 2 phút. Vào **SQL Editor → New query**, lần lượt dán và bấm **Run** cho từng file trong repo:
   1. `supabase/migrations/0001_initial.sql`
   2. `supabase/migrations/0002_selection_workflow.sql`

   Không chạy các file trong `scripts/dev/` (chỉ dùng để tạo dữ liệu demo khi chạy trên máy).
4. Tạo tài khoản của bạn: **Authentication → Users → Add user → Create new user**, nhập email + mật khẩu, tick **Auto Confirm User**. Tài khoản đầu tiên tự động thành chủ web.
5. Lấy khoá: **Project Settings → API Keys** (hoặc **Data API**), ghi lại:
   - **Project URL** → dùng cho `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (hoặc `anon` key) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret key** (hoặc `service_role` key) → `SUPABASE_SERVICE_ROLE_KEY` — **không chia sẻ cho ai**

## Bước 2 — Tạo kho ảnh Cloudflare R2

1. Vào <https://dash.cloudflare.com> → đăng ký/đăng nhập → menu trái **R2 Object Storage** → bật R2 (chọn gói Free).
2. **Create bucket**: tên `family-photos` (chữ thường, không dấu), Location **Automatic** → **Create bucket**. Để bucket ở chế độ riêng tư (không bật Public access).
3. Mở bucket → **Settings → CORS Policy → Add CORS policy**, dán (đổi địa chỉ web của bạn ở bước 3; có thể quay lại sửa sau):

   ```json
   [
     {
       "AllowedOrigins": ["https://ten-ban.vercel.app"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

4. Quay lại trang **R2 Object Storage** → **Manage R2 API Tokens** (hoặc **API → Manage API tokens**) → **Create API token**:
   - Permissions: **Object Read & Write**
   - Specify bucket: chỉ chọn `family-photos`
   - **Create** → ghi lại **Access Key ID** và **Secret Access Key** (chỉ hiện 1 lần).
5. Ghi lại **Account ID** (hiện ở trang R2 Overview, cột bên phải).

## Bước 3 — Đưa web lên Vercel

1. Vào <https://vercel.com> → đăng nhập bằng GitHub → **Add New → Project** → chọn repo `framefolio-app` → **Import**.
2. Mở **Environment Variables**, thêm:

   | Tên | Giá trị |
   | --- | --- |
   | `NEXT_PUBLIC_SITE_URL` | `https://ten-ban.vercel.app` (sửa lại sau khi biết địa chỉ thật) |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL ở bước 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key ở bước 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key ở bước 1 |
   | `ALBUM_COOKIE_SECRET` | Một chuỗi ngẫu nhiên dài ≥ 32 ký tự (gõ bừa chữ + số) |
   | `STORAGE_DRIVER` | `r2` |
   | `R2_ACCOUNT_ID` | Account ID ở bước 2 |
   | `R2_ACCESS_KEY_ID` | Access Key ID ở bước 2 |
   | `R2_SECRET_ACCESS_KEY` | Secret Access Key ở bước 2 |
   | `R2_BUCKET` | `family-photos` |
   | `ALLOW_SIGNUP` | `false` |

3. Bấm **Deploy**. Xong sẽ có địa chỉ dạng `https://framefolio-app-xxxx.vercel.app`.
4. Nếu địa chỉ khác với dự kiến: sửa `NEXT_PUBLIC_SITE_URL` (Settings → Environment Variables) rồi **Deployments → ⋯ → Redeploy**, và sửa `AllowedOrigins` trong CORS của R2 cho khớp.

## Bước 4 — Báo cho Supabase địa chỉ web

Supabase → **Authentication → URL Configuration** → **Site URL** = địa chỉ Vercel của bạn → **Save**.

## Bước 5 — Dùng thử

1. Mở địa chỉ web → **Login** bằng tài khoản tạo ở bước 1.
2. **New album** → đặt tên (VD "Tết 2027"), chọn Private, đặt mật khẩu nếu muốn → tạo.
3. Kéo thả vài ảnh vào trang upload. Thấy "Hoàn tất · n/n thành công" là ảnh đã vào R2.
4. Ở Dashboard bấm **Copy link**, gửi cho người nhà qua Zalo kèm mật khẩu.

Nếu upload báo "Không kết nối được kho ảnh": kiểm tra lại CORS ở bước 2.3 (địa chỉ phải trùng chính xác, có `https://`, không có `/` cuối).

## Bước 6 — Giữ Supabase không bị tạm dừng

Repo có sẵn tác vụ `.github/workflows/keep-alive.yml`, cứ 3 ngày gọi web một lần.

1. GitHub → repo `framefolio-app` → **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `SITE_URL`, Secret: địa chỉ web của bạn (VD `https://framefolio-app-xxxx.vercel.app`) → **Add secret**.
3. Thử ngay: tab **Actions → Keep Supabase awake → Run workflow**. Có dấu tích xanh là được.

Lưu ý: tác vụ chỉ chạy khi file nằm trên nhánh `main`, nên phải merge Pull Request trước. Nếu repo để công khai, GitHub tự tắt tác vụ định kỳ sau 60 ngày repo không có thay đổi; khi đó vào tab Actions bật lại.

## Khi nào sẽ phải trả tiền

- Dùng web để gửi ảnh cho khách trả tiền → Vercel yêu cầu gói Pro.
- Ảnh vượt 10GB → R2 tính $0,015/GB/tháng cho phần vượt (100GB ≈ $1,35/tháng).
- Muốn sao lưu database tự động → Supabase Pro.
