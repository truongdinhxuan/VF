# AUDIT REPORT — Dự án VF (Supply / Milkrun Management)

> Ngày thực hiện: 2026-09-03
> Phạm vi: toàn bộ `client/` (React + Vite) và `server/` (Fastify + Supabase), nhánh `dev`.
> Nguyên tắc: **chỉ báo cáo, không sửa code**.

---

## 1. Executive Summary

**Mức độ nghiêm trọng tổng thể: TRUNG BÌNH (Medium), có một vài điểm cần xác minh gấp trên môi trường production.**

Codebase có chất lượng kỹ thuật **tốt hơn mức trung bình đáng kể**:

- TypeScript strict, `tsc` build sạch ở cả 2 project, ESLint client pass 0 lỗi.
- Không có `as any`, không có `TODO/FIXME/HACK`, không có `catch {}` nuốt lỗi, gần như không có `console.log` rác.
- Tầng phân quyền RBAC động khá bài bản: mọi route (trừ `/auth/login`, `/`) đều gắn `verifyToken` + `requirePermission`.
- Input được validate bằng JSON Schema (Fastify/ajv) với `format: uuid`, `additionalProperties: false`.
- Mật khẩu hash bằng `scrypt` (N=32768) + `timtimgSafeEqual`, có "dummy hash" chống user-enumeration theo thời gian.
- Nghiệp vụ phức tạp (order lifecycle, stock allocation) đẩy xuống RPC/stored-procedure trong Postgres → tránh được phần lớn SQL injection.

**Các vấn đề cần xử lý (không có lỗ hổng "khai thác tức thì" trong code đã commit), theo thứ tự ưu tiên:**

| # | Mức độ | Nhóm | Vấn đề |
|---|--------|------|--------|
| 1 | **Critical (điều kiện)** | Security | `APP_JWT_SECRET` và `BOOTSTRAP_ADMIN_PASSWORD` trong `server/.env` đang là giá trị placeholder/yếu — **phải xác minh giá trị thật trên production** |
| 2 | **High** | Security | Không có rate-limit / brute-force protection cho `/auth/login` |
| 3 | **High** | Security | `npm audit`: 8 lỗ hổng server (5 High), 10 lỗ hổng client (8 High) — gồm `@fastify/static` auth-bypass, `fastify` host-spoofing, `react-router` XSS/open-redirect |
| 4 | **High** | Security | RLS chưa bật đầy đủ trên các bảng Postgres (chỉ ~27 lệnh `enable row level security`, **0 policy**); nếu `anon key` lộ → các bảng chưa bật RLS bị đọc/ghi tự do |
| 5 | Medium | Security | CORS "mở" (reflect mọi Origin) khi biến `ORIGIN_URL` không được set, kèm `credentials: true` |
| 6 | Medium | Security | Thiếu security headers (không dùng `@fastify/helmet`; `netlify.toml` không có CSP/X-Frame-Options) |
| 7 | Medium | Security | Swagger UI `/docs` mở public ở mọi môi trường |
| 8 | Medium | Security | Error handler trả stack trace + message khi `NODE_ENV !== 'production'`; script `start`/deploy không set `NODE_ENV=production` |
| 9 | Medium | Security | JWT không có cơ chế thu hồi (logout chỉ xoá phía client), không có `iss`/`aud`, sống 8h; token lưu ở `localStorage` |
| 10 | Medium | Performance | SSE `/notifications/stream` poll DB mỗi 1.5s / kết nối; `getActiveAuthorizationContexts` quét toàn bộ user+role+permission mỗi lần đổi trạng thái order |
| 11 | Low | Security | Nội suy chuỗi vào PostgREST `.or()` filter (~15 chỗ) — đã giảm thiểu bằng `normalizeSearch` nhưng mong manh; chưa escape `%` `_` |
| 12 | Low | Security | Excel export chưa chặn formula-injection (`=`,`+`,`-`,`@`) ở cột `note`/`supplyName` |
| 13 | Low | Maintainability | `orders.service.ts` (1428 dòng) & `OrderDetailPage.tsx` (1067 dòng) quá lớn |
| 14 | Low | Maintainability | File rác được commit (`outputs/`, `.vscode/settings.json` rỗng); README gần như trống; không có LICENSE / CI |
| 15 | Low | Testing | Test suite server phụ thuộc Supabase thật, không có CI, client test dùng harness `.mjs` tự chế |

---

## 2. Khảo sát tổng quan

### 2.1 Stack công nghệ

| Thành phần | Chi tiết |
|---|---|
| **Backend** | Node.js + **Fastify 5** (bootstrap bằng `fastify-cli`), TypeScript ~5.9, `@fastify/autoload` (plugins + routes), `@fastify/jwt`, `@fastify/cors`, `@fastify/swagger(-ui)`, `@fastify/sensible` |
| **Database** | **Supabase (PostgreSQL)** truy cập qua `@supabase/supabase-js` bằng **service-role key** (bypass RLS). Toàn bộ nghiệp vụ nặng nằm trong migrations SQL / RPC (`server/supabase/migrations/*.sql`, 41 bảng, ~40 file migration) |
| **Frontend** | **React 19 + Vite 8**, React Router 7, **@tanstack/react-query 5**, `react-hook-form`, **Tailwind CSS 4**, `axios`, `motion`, FontAwesome |
| **Package manager** | npm (có `package-lock.json` ở cả 2) |
| **Build** | Server: `tsc` → `dist/` rồi `fastify start`. Client: `tsc -b && vite build` → `dist/` (deploy Netlify) |
| **Test** | Server: `node --test` + `c8` (coverage), nhiều test tích hợp chạy trên Supabase thật. Client: `node --test` trên các file `test/*.test.mjs` tự viết |
| **Deploy** | Frontend: Netlify (`superb-seahorse-d2b061.netlify.app`). Backend: gợi ý Railway (comment trong `notifications` controller) |

### 2.2 Cấu trúc thư mục (rút gọn)

```
VF/
├─ client/
│  └─ src/
│     ├─ api/          # axios services (1 file / domain) + http.ts (interceptor)
│     ├─ components/   # crud/, offcanvas/, orders/, workspace/, common/, notifications/…
│     ├─ context/      # AuthContext (user + permissions + token)
│     ├─ hooks/        # usePaginatedResource, useCrudResource, useSupplyRealtime (SSE)…
│     ├─ pages/        # auth/, catalog/, management/, milkrun/, orders/, stock/, dashboards/
│     ├─ routes/       # auth.routes / workspace.routes / index
│     ├─ constants/    # permissions, roles, workspaceNavigation
│     └─ types/        # 1 file / domain
├─ server/
│  └─ src/
│     ├─ app.ts                # entrypoint: autoload plugins + routes
│     ├─ plugins/              # jwt, cors, dbContext (supabaseAdmin), swagger, logError, sensible
│     ├─ middleware/auth.ts    # verifyToken, requirePermission, requireSystemAdmin
│     ├─ routes/               # định nghĩa route + preHandler (guard)
│     ├─ controllers/          # HTTP glue, map error → status code
│     ├─ services/             # business logic + gọi Supabase/RPC
│     ├─ domain/               # enums, permission-codes, orderRules, order-access, stockRules
│     ├─ schemas/              # JSON Schema cho request
│     └─ supabase/migrations/  # toàn bộ DDL + RPC + seed
└─ outputs/                    # (không nên commit) file spec .xlsx/.png
```

### 2.3 Entry point & luồng chạy

**Backend** — `server/src/app.ts`:
1. `AutoLoad(plugins/)` nạp: `dbContext` (tạo `fastify.supabaseAdmin` từ `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), `jwt` (kiểm tra `APP_JWT_SECRET` ≥ 32 ký tự), `cors`, `swagger` (`/docs`), `logError` (error handler global), `sensible`, `support`.
2. `AutoLoad(routes/)` nạp toàn bộ route theo thư mục.
3. Mỗi request có phân quyền: `verifyToken` (kiểm tra Bearer JWT → `getEffectivePermissions()` nạp lại role/permission từ DB, gắn `request.user`) → `requirePermission(code | {allOf|anyOf})`.

**Luồng auth**: `POST /auth/login` (`vinfast_id` + `password`) → `UsersService.authenticate()` (tra `users` + `user_credentials`, `verifyPassword` scrypt, kiểm tra active/verified/role/area) → `reply.jwtSign({ sub: userId })` → client lưu `access_token` vào `localStorage`, mọi request sau đính kèm qua axios interceptor (`client/src/api/http.ts:13`).

**Luồng nghiệp vụ chính (Supply Order)**: `DRAFT → PENDING (submit) → APPROVED/REJECTED (review) → ALLOCATED (allocate stack) → confirm allocation → ISSUED (issue, trừ tồn) → RECEIVED → COMPLETED`, mỗi bước là 1 RPC Postgres + phát notification (fan-out) + đẩy tín hiệu realtime qua SSE.

**Frontend** — `client/src/main.tsx` → `App.tsx` → `AuthProvider` + `QueryClientProvider` + `RouterProvider`. `ProtectedRoute` chặn theo `localStorage.access_token`; `PermissionGuard` chặn theo permission; `useSupplyRealtime` mở SSE tới `/notifications/stream`.

---

## 3. BẢNG LIỆT KÊ VẤN ĐỀ (Critical → Low)

> Cột `File:dòng` trỏ tới vị trí đại diện; vấn đề mang tính hệ thống ghi rõ "nhiều nơi".

### CRITICAL

| Mức độ | File:dòng | Mô tả | Đề xuất fix |
|---|---|---|---|
| **Critical (cần xác minh)** | `server/.env` (không commit) + `server/src/plugins/jwt.ts:22-33` | `APP_JWT_SECRET=replace-with-a-long-random-secret` — đúng 34 ký tự nên **qua được** check `length < 32`, nhưng là placeholder công khai. Nếu production dùng đúng giá trị này → **bất kỳ ai cũng ký được JWT hợp lệ** với `sub` tuỳ ý ⇒ chiếm mọi tài khoản, kể cả system ADMIN. | Xác minh biến môi trường production. Sinh secret ngẫu nhiên ≥ 48 byte (`openssl rand -base64 48`). Nâng điều kiện kiểm tra: từ chối các giá trị placeholder đã biết. Cân nhắc rotate secret định kỳ + `iss`/`aud`. |
| **Critical (cần xác minh)** | `server/.env` (không commit), `server/src/scripts/bootstrap-admin-password.ts:40` | `BOOTSTRAP_ADMIN_PASSWORD=Aabbcc123!` — mật khẩu admin hệ thống yếu & xuất hiện trong repo dev. Nếu đã dùng bootstrap tài khoản ADMIN thật với giá trị này → tài khoản quản trị bị đoán mật khẩu ngay. | Xác minh & đổi mật khẩu ADMIN production ngay. Không lưu mật khẩu thật trong `.env`; truyền một lần qua biến môi trường CI/shell rồi xoá. |
| **Critical (cần xác minh)** | `server/.env` | `SUPABASE_SERVICE_ROLE_KEY` và `SUPABASE_ANON_KEY` là JWT **thật, hạn tới 2093** (`exp: 2093951605`), nằm plaintext trên đĩa máy dev. Service-role key = toàn quyền DB, bỏ qua RLS. | Xác nhận `.env` chưa từng bị đẩy lên git (đã kiểm tra: **chưa**), chưa lộ qua backup/log. Rotate cả 2 key trên Supabase nếu có nghi ngờ. Dùng secret manager của nền tảng deploy thay vì file `.env`. |

### HIGH

| Mức độ | File:dòng | Mô tả | Đề xuất fix |
|---|---|---|---|
| **High** | `server/src/routes/auth/index.ts:7`, `server/src/controllers/auth/login.ts` | `/auth/login` **không có rate-limit / lockout / captcha**. `scrypt` (~50-100ms) chỉ làm chậm nhẹ; vẫn brute-force / credential-stuffing được (đặc biệt `vinfast_id` là số nguyên dễ đoán). `server/package.json` không có `@fastify/rate-limit`. | Thêm `@fastify/rate-limit` (global + siết riêng cho `/auth/login`, ví dụ 5 lần/phút/IP + 10 lần/giờ/`vinfast_id`). Cân nhắc khoá tạm tài khoản sau N lần sai, log cảnh báo. |
| **High** | `server/package.json` (`npm audit`) | 8 lỗ hổng (5 High, 3 Moderate): `@fastify/static <=10.1.1` **Authorization Bypass / route-guard bypass qua path traversal** (qua `@fastify/swagger-ui`), `fastify <=5.12.0` **spoof `request.protocol`/`host` qua `X-Forwarded-*`** + body-schema bypass, `find-my-way` DoS HTTP/2, `fast-uri` SSRF/host-confusion, `brace-expansion` DoS, `uuid`/`exceljs` bounds-check. | `cd server && npm audit fix` (phần lớn không breaking). Với `@fastify/swagger-ui`/`exceljs` cần nâng major → test lại. Bật `trustProxy` đúng cách nếu sau reverse-proxy. |
| **High** | `client/package.json` (`npm audit`) | 10 lỗ hổng (8 High): `react-router 6.0–7.18.1` **XSS (RSCErrorHandler), open-redirect qua backslash, CSRF, DoS route-matching**; `vite 8.0.0–8.0.15` `server.fs.deny` bypass + NTLM hash disclosure; `postcss` path traversal; `nanoid` loop. | `cd client && npm audit fix`. Nâng `react-router-dom` ≥ 7.19, `vite` ≥ 8.0.16. Rà lại chỗ dùng `<Link>`/`useNavigate` với URL từ dữ liệu ngoài. |
| **High** | `server/supabase/migrations/*.sql` (toàn bộ) | Grep thấy **~27** lệnh `enable row level security` nhưng **0** lệnh `create policy`, trong khi có **41** `create table`. Mô hình hiện tại "RLS bật + không policy = chỉ service-role vào được" là *fail-closed* và an toàn — **nhưng** các bảng **quên bật RLS** (public/lookup/milkrun) sẽ đọc/ghi được bằng `anon key` (PostgREST mặc định expose schema `public`). | Rà soát từng bảng trong schema được expose: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` cho *tất cả*. Trên Supabase dashboard bật cảnh báo "RLS disabled". Cân nhắc `REVOKE` quyền của `anon`/`authenticated` trên các bảng chỉ backend dùng. |

### MEDIUM

| Mức độ | File:dòng | Mô tả | Đề xuất fix |
|---|---|---|---|
| Medium | `server/src/plugins/cors.ts:9-15` | `origin: process.env.ORIGIN_URL`. Nếu biến **không set** (hoặc rỗng) → `@fastify/cors` coi như `origin: true` = **reflect mọi Origin**, cộng `credentials: true` ⇒ trang web bất kỳ đọc được response có credential của người dùng đã đăng nhập. | Fail-fast khi thiếu `ORIGIN_URL` (throw như `jwt.ts` đang làm). Hỗ trợ whitelist nhiều origin qua mảng. Không bao giờ để `credentials:true` đi kèm origin động không kiểm soát. |
| Medium | `server/src/app.ts`, `server/package.json` | Không dùng `@fastify/helmet`. Thiếu `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Strict-Transport-Security`, CSP cho response API. | Thêm `@fastify/helmet`. Với JSON API tối thiểu set `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` cho endpoint nhạy cảm. |
| Medium | `client/netlify.toml` | Site frontend phục vụ **không có header bảo mật** (CSP, X-Frame-Options, HSTS…). Kết hợp token trong `localStorage` → 1 lỗ XSS = mất token. | Thêm block `[[headers]]` trong `netlify.toml`: CSP nghiêm ngặt (chỉ `self` + domain API), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`. |
| Medium | `server/src/plugins/swagger.ts:31-39` | Swagger UI `/docs` đăng ký **vô điều kiện** ở mọi môi trường → lộ toàn bộ bề mặt API, schema, tên field cho người ngoài. | Chỉ `register` khi `process.env.NODE_ENV !== 'production'` hoặc đặt sau `verifyToken` + permission ADMIN. |
| Medium | `server/src/plugins/logError.ts:14,21-23` | `isDev = process.env.NODE_ENV !== 'production'`. Không script nào (`start`, deploy) set `NODE_ENV=production` ⇒ mặc định lộ `error.message` + **stack trace** cho client trên mọi lỗi. | Đảm bảo `NODE_ENV=production` trong lệnh chạy production. Đảo logic sang "mặc định giấu, chỉ hiện khi bật `DEBUG_ERRORS` tường minh". Luôn log đầy đủ ở server-side (đang có). |
| Medium | `server/src/plugins/jwt.ts:28-33`, `client/src/context/AuthContext.tsx:88-92`, `client/src/api/http.ts:13` | JWT stateless, **không thể thu hồi**: `logoutContext()` chỉ xoá `localStorage`; token bị đánh cắp vẫn dùng được tới 8h. Không có `iss`/`aud`. Token ở `localStorage` (JS đọc được). | Rút ngắn TTL access token (15–30 phút) + refresh token `httpOnly` cookie có xoay vòng & danh sách thu hồi (bảng `revoked_tokens` hoặc `token_version` trên user). Thêm `iss`/`aud` và verify chúng. |
| Medium | `server/src/controllers/notifications/index.ts:100-143`, `server/src/services/authorization.service.ts:194-260` | SSE: mỗi kết nối chạy `setInterval` **1.5s** gọi `listLiveSignals` (+ `getLatestStockChange`) ⇒ tải DB tuyến tính theo số client online. Mỗi lần order đổi trạng thái, `resolveOrderRecipients` gọi `getActiveAuthorizationContexts` **quét toàn bộ** `users` + `user_roles` + `role_permissions` rồi lọc in-memory. | SSE: tăng chu kỳ poll (5–10s) hoặc chuyển sang Supabase Realtime / `LISTEN/NOTIFY` / message queue. Fan-out: cache danh sách recipient theo `(area, permission)` với TTL ngắn, hoặc truy vấn thẳng "user có quyền đọc order ở area X" bằng 1 query có index. |
| Medium | `server/src/controllers/users/update.ts`, `server/src/controllers/users/update-password.ts:50-52` | `PATCH /users/:id` (quyền `ADMIN_USER_UPDATE`) cho phép set `is_verified`/`is_active`/`is_deleted` cho **bất kỳ user nào kể cả chính mình**; `PATCH /users/:id/password` nhánh admin (`setPassword`) đặt lại mật khẩu **không cần mật khẩu cũ**. Đúng thiết kế admin, nhưng thiếu chặn tự-nâng-quyền / tự-mở-khoá và không ghi audit rõ ràng. | Chặn actor sửa `is_active/is_verified/is_deleted` của **chính mình**. Ghi `order_revisions`-style audit cho thao tác admin reset password / (de)activate. Cân nhắc buộc user đổi lại mật khẩu sau khi admin set. |
| Medium | `server/src/services/orders.service.ts:1113-1117`, `1119-1121`; `users.service.ts:227-236` | Query param (`areaId`, `from_area_id`, `createdBy`…) và `search` được **nội suy chuỗi** vào PostgREST `.or()`. Hiện *an toàn* nhờ: (a) các id có `format: uuid` được ajv ép kiểu; (b) `normalizeSearch` chặn `( ) ,` và escape `*`. Rủi ro là **ngầm định** — thêm 1 field mới không phải uuid/không qua `normalizeSearch` là mở injection filter (lọc sai, lộ dữ liệu ngoài scope). | Bọc helper builder (`.ilike(col, pattern)` / `.in(col, arr)`) thay vì ghép chuỗi `.or()`. Nếu buộc dùng `.or()`, tập trung 1 hàm `buildOrFilter()` có escape thống nhất + unit test. |

### LOW

| Mức độ | File:dòng | Mô tả | Đề xuất fix |
|---|---|---|---|
| Low | `server/src/utils/pagination.ts:59-71` | `normalizeSearch` không escape `%` và `_` (wildcard của SQL LIKE) ⇒ người dùng gõ `%` làm sai kết quả tìm kiếm (không phải lỗ hổng, chỉ sai UX/độ chính xác). | Escape `%` `_` `\` trước khi ghép vào pattern `ilike`. |
| Low | `server/src/services/shift-order-sheet-exporter.ts:206-229` | Excel export ghi thẳng `note`, `supplyName`, `provider` vào cell. `exceljs` **không** tự biến chuỗi `=...` thành công thức nên rủi ro CSV/formula-injection thấp, nhưng vẫn nên phòng khi người dùng mở bằng công cụ khác / export CSV sau này. | Prefix `'` cho cell text bắt đầu bằng `= + - @ \t \r`, hoặc set `cell.value = { richText: [...] }`. |
| Low | `server/src/controllers/auth/login.ts:37-42` | Sau khi mật khẩu đúng, hệ thống trả message khác nhau + `code: ACCOUNT_NOT_VERIFIED` cho tài khoản chưa duyệt / bị khoá ⇒ lộ trạng thái tài khoản (chỉ với người đã biết mật khẩu → rủi ro thấp). | Chấp nhận được cho UX nội bộ; nếu siết: gộp về 1 message chung cho mọi trường hợp "không đăng nhập được". |
| Low | `server/src/services/orders.service.ts` (1428 dòng), `client/src/pages/orders/OrderDetailPage.tsx` (1067 dòng), `client/src/components/orders/CreateOrderForm.tsx` (470) | Module quá lớn, nhiều trách nhiệm (1 class `OrderService` lo create/patch/submit/list/approve/reject/allocate/confirm/issue/receive/complete/cancel + chuẩn hoá + tính tồn + map lỗi RPC). Khó test đơn vị, khó review, dễ xung đột merge. | Tách theo use-case: `OrderReadService`, `OrderReviewService`, `OrderIssueService`, `OrderStockAvailability`, và 1 module `orderRpcErrors.ts` (đã có rải rác các hàm `*RpcError`). Trang `OrderDetailPage` tách thành sub-component theo panel (approve/reject/issue/allocate). |
| Low | `server/src/services/authorization.service.ts:129-188` vs `194-260` | Logic resolve permission bị **lặp** giữa `getEffectivePermissions` (1 user) và `getActiveAuthorizationContexts` (tất cả user): cùng cấu trúc select `user_roles`/`role_permissions`, cùng bước lọc `is_active/is_deleted`. | Trích chung phần "build select string" + "map row → context" thành helper dùng lại cho cả 2. |
| Low | `server/src/middleware/auth.ts:37` | `verifyToken` gọi `getEffectivePermissions` (3 query DB) **cho mọi request đã xác thực** ⇒ mỗi API call = tối thiểu 3 round-trip DB chỉ để dựng `request.user`. | Cache permission theo `userId` trong bộ nhớ (TTL 30–60s) hoặc nhét `roleIds` vào JWT và chỉ nạp permission khi cần; invalidate khi đổi role. |
| Low | Repo | Commit file rác: `outputs/*.xlsx/.png/.ndjson` (spec build), `.vscode/settings.json` rỗng. `README.MD` chỉ 4 dòng, không có LICENSE / CONTRIBUTING / kiến trúc. Không có thư mục `.github/` (CI/CD). Message commit sai chính tả nhiều ("reponsive", "depoloy", "sever commits"). | `git rm -r --cached outputs .vscode` + bổ sung `.gitignore`. Viết README (setup, biến môi trường, kiến trúc, luồng order). Thêm GitHub Actions: `tsc` + `eslint` + `npm audit` + test. |
| Low | `server/test/**`, `client/test/**` | 38 file test server nhưng nhiều cái là **integration chạy trên Supabase thật** (cần `.env` + DB có seed) ⇒ không chạy được trong CI sạch, không đo được coverage ổn định. Client test là script `node --test` `.mjs` tự dựng, không phải Vitest/RTL ⇒ không test render component thật. | Tách "unit" (thuần logic: `orderRules`, `stockRules`, `authorization.resolveEffectivePermissions`, `pagination`, `shift-order-sheet-exporter`) chạy không cần DB, đưa vào CI + ngưỡng coverage. Integration để job riêng có DB ephemeral. Client: cân nhắc Vitest + Testing Library cho `AuthContext`, `PermissionGuard`, form tạo order. |

---

## 4. Chi tiết theo hạng mục

### 4.1 Bảo mật (Security)

**Điểm tốt (đã làm đúng):**

- **AuthN/AuthZ**: mọi route nghiệp vụ đều có `[verifyToken, requirePermission(...)]`; đã rà toàn bộ `server/src/routes/**` — không thấy route nghiệp vụ nào thiếu guard (chỉ `/` và `/auth/login` là public, hợp lý). `verifyToken` nạp lại quyền từ DB mỗi request nên **thu hồi quyền có hiệu lực gần như tức thì** (đánh đổi bằng hiệu năng — xem 3/Low).
- **IDOR order**: `assertPackingOwner` (`orders.service.ts:711-720`) chặn sửa order không phải của mình; `canReadOrder` + `isOrderAreaScoped` (`domain/order-access.ts`) giới hạn user chỉ-tạo-order xem order trong area của họ; `confirmAllocation` kiểm tra allocation thuộc đúng order (`orders.service.ts:1254`).
- **IDOR notification**: `NotificationsService.applyScope` luôn `.eq('user_id', userId)`; `markRead` truyền `request.user.id`.
- **Password**: `scrypt` N=32768, salt 16B ngẫu nhiên/record, so sánh `timingSafeEqual`, format `scrypt$N$r$p$salt$key` có kiểm tra tham số; `authenticate` chạy `hashPassword` "giả" khi không tìm thấy user/credential để chống timing enumeration (`users.service.ts:290,306`).
- **SQL injection**: nghiệp vụ ghi dữ liệu đi qua RPC Postgres tham số hoá (`create_order_with_items`, `review_order`, `issue_order`, `replace_user_roles`…); PostgREST `.eq/.in` tham số hoá. Chỉ còn `.or()` filter ghép chuỗi là bề mặt cần canh (đã đánh giá Low/Medium ở trên).
- **XSS client**: không có `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `document.write` trong `client/src`. React auto-escape. SSE parse thủ công nhưng chỉ `JSON.parse` + kiểm tra shape, không render HTML thô.
- **Secrets trong code**: **không** có API key/secret hardcode trong `client/src` hay `server/src` (chỉ đọc từ `process.env`/`import.meta.env`). `server/.env` **chưa từng** được commit (đã kiểm tra `git log --all -- server/.env`).
- **SSE auth**: dùng `fetch` + header `Authorization: Bearer` (không nhét token vào URL/query) — đúng chuẩn, tránh lộ token qua log proxy.

**Cần khắc phục:** xem bảng mục 3 (rate-limit, npm audit, RLS, CORS, headers, swagger, error verbosity, JWT revocation).

### 4.2 Chất lượng code

- **Rất tốt**: 0 `as any` / `: any`, 0 `TODO/FIXME`, 0 `catch {}` rỗng, 5 `console.*` trong toàn bộ `client/src`, `tsc` sạch, ESLint client 0 lỗi. Đặt tên nhất quán (`*.service.ts`, `assert*`, `*RpcError`, `PERMISSION_CODE`). Error handling có phân tầng lớp lỗi riêng (`OrderServiceError`, `UsersServiceError`, `AuthorizationError`, `PaginationValidationError`) map sang HTTP status ở controller.
- **Trùng lặp**: (a) khối resolve permission trong `authorization.service.ts` (2 hàm); (b) mẫu `list()` gần như copy giữa các service (`parsePagination` → build `.or(search)` → `range` → `resolvePaginatedQueryResult`) lặp ở ~10 service — có thể trừu tượng hoá thành `paginatedList(table, { searchFields, filters })`; (c) mẫu controller `respond(request, reply, handler)` được nhân bản ở `orders`, `notifications` (giống nhau ~90%).
- **Module lớn**: `orders.service.ts` 1428 dòng / `OrderDetailPage.tsx` 1067 dòng (xem Low).
- **Comment**: chỗ logic tinh tế có comment giải thích tốt (`pagination.ts:139-143`, `notifications/index.ts:66-72`, `middleware/auth.ts:87-92`). Không thấy vùng "magic" thiếu chú thích nghiêm trọng.
- **Bất nhất nhỏ**: `plugins/cors.ts` và `plugins/logError.ts` viết tiếng Việt + `console`-style log cứng `"Cors is actived on http://localhost:5173"` (sai thực tế khi deploy). `plugins/support.ts` là bootstrap thừa của fastify-cli (`someSupport() => 'hugs'`) — nên xoá.

### 4.3 Hiệu năng

- **N+1 / fan-out**: `verifyToken` = 3 query/req (Low); `finishStatusTransition` → `resolveOrderRecipients` → `getActiveAuthorizationContexts` quét 3 bảng toàn bộ mỗi lần đổi trạng thái order (Medium).
- **SSE polling**: `setInterval(1500ms)` mỗi client (Medium). `heartbeat` 15s ổn.
- **Query có thể thiếu index**: các filter `stock_balances` theo `(area_id, is_active, is_deleted, storage_location.is_active)` (`orders.service.ts:643-662`, `816-902`) chạy khá thường xuyên khi mở order — cần đảm bảo có composite index `(area_id, supply_id)` / `(area_id, provider_id)` trên `stock_balances`. `orders` list filter/sort theo `created_at`, `status_id`, `to_area_id` — cần index tương ứng. *(Không kiểm chứng được index từ code; cần xem schema DB.)*
- **Bundle frontend**: chưa cấu hình `build.rollupOptions`/manualChunks trong `vite.config.ts`; `motion`, FontAwesome (3 gói icon) kéo bundle. Chưa có route-level code-splitting rõ ràng (cần xem `routes/index.tsx`). Đề xuất: `React.lazy` cho các page milkrun/stock/admin, chỉ import icon lẻ thay vì cả set, phân tích bằng `rollup-plugin-visualizer`.
- **React Query**: dùng tốt (invalidate theo `queryKeys`), có skeleton loader.

### 4.4 Kiểm thử

- Server: 38 file `.test.ts` + nhiều `.mjs`/`.sql` integration trong `test/integration/`. `npm test` build TS rồi chạy `c8 node --test`. Phụ thuộc Supabase thật → không chạy trong CI sạch, coverage không tin cậy.
- Client: 14 file `test/*.test.mjs` chạy bằng `node --test` với harness tự viết (`test/manual/mock-units-api.mjs`, `offcanvas-harness.tsx`). Không có Vitest/RTL → **không có test render component / hook thực sự**.
- **Vùng quan trọng nhưng mỏng test đơn vị (đề xuất bổ sung, không cần DB):**
  - `domain/orderRules.ts` (`assertOrderActionAllowed`, `calculateStockAvailability`, `assertApprovedQuantity`) — trái tim state machine.
  - `domain/order-access.ts` (`canReadOrder`, `isOrderAreaScoped`) — quyết định IDOR.
  - `services/authorization.service.ts` → `resolveEffectivePermissions` (thuần hàm, đã tách sẵn — lý tưởng để test bảng chân trị).
  - `utils/password.ts` (`isStrongPassword`, round-trip `hashPassword`/`verifyPassword`, chống tamper format).
  - `utils/pagination.ts` (`normalizeSearch` — đặc biệt các ca injection `(),*%`).
  - `services/shift-order-sheet-exporter.ts` (`buildShiftOrderSheetExportRows`, `resolveStackQuantity`, `sanitizeFilenameSegment`).
  - Client: `AuthContext` (login/logout/permission helpers), `PermissionGuard`/`ProtectedRoute`, `useSupplyRealtime` (parse SSE block).

### 4.5 Kiến trúc & khả năng bảo trì

- **Tổ chức tốt**: phân lớp rõ `routes → controllers → services → (domain / supabase RPC)`; `domain/` tách business rule thuần khỏi I/O; `schemas/` tách validation; `interfaces/` + `types/` rõ ràng; client chia `api / hooks / components / pages / constants / types` hợp lý; `queryKeys.ts` tập trung.
- **Coupling**: service phụ thuộc trực tiếp `fastify.supabaseAdmin` (khó mock → đó là lý do test phải cần DB thật). Cân nhắc 1 lớp repository/gateway để service test được bằng fake.
- **Technical debt / "khó động vào"**:
  - `orders.service.ts` — thay đổi luồng order phải đọc cả file 1400+ dòng; nhiều hàm `*RpcError` ánh xạ mã lỗi string từ RPC (ghép chặt với nội dung `RAISE` trong file SQL — đổi message SQL là vỡ mapping mà không có test bắt).
  - Ghép chặt **tên mã lỗi** giữa TS và Postgres RPC (vd `ORDER_NOT_DRAFT`, `INSUFFICIENT_STACK_STOCK`) không có "hợp đồng" chung → nên đưa danh sách mã vào 1 file dùng chung / sinh code, hoặc test contract.
  - `getEffectivePermissions` chạy mỗi request — muốn tối ưu sẽ đụng vào lõi auth.
  - Migration SQL rất dài (file `202607290001_lookup_master_data_foundation.sql` > 1000 dòng) chứa cả DDL + RPC + seed lẫn lộn — khó theo dõi tiến hoá schema.
- **Thiếu**: tài liệu kiến trúc, sơ đồ luồng trạng thái order, mô tả mô hình phân quyền (permission catalog), hướng dẫn biến môi trường.

---

## 5. Điểm mạnh nổi bật (giữ nguyên, không cần sửa)

1. Kỷ luật kiểu & lint cao; build sạch cả 2 project.
2. RBAC động, guard nhất quán ở mọi route; kiểm tra quyền lại từ DB → thu hồi quyền tức thời.
3. Business rule tách thành `domain/` thuần hàm (dễ test, dễ đọc).
4. Nghiệp vụ giao dịch (trừ tồn, phân bổ chồng) nằm trong RPC Postgres → atomic + tránh SQL injection.
5. Hash mật khẩu đúng chuẩn (`scrypt` + timing-safe + dummy hash chống enumeration).
6. Validation request bằng JSON Schema với `additionalProperties:false` + `format:uuid`.
7. SSE truyền token qua header (không qua URL); có heartbeat, backoff reconnect, chống double-poll.
8. Xử lý phân trang thống nhất, có xử lý ca `PGRST103` (offset vượt) không cần query đếm lần 2.

---

## 6. Thứ tự ưu tiên xử lý

**Ngay lập tức (trong 24–48h):**
1. Xác minh trên production: `APP_JWT_SECRET` **không** phải placeholder; mật khẩu ADMIN **không** phải `Aabbcc123!`; đổi ngay nếu trùng. *(mục 3/Critical)*
2. Xác minh `.env` / service-role key chưa lộ ra ngoài; chuyển sang secret manager của nền tảng.
3. Rà soát & bật RLS cho **mọi** bảng trong schema được PostgREST expose. *(3/High #4)*

**Tuần này:**
4. Thêm `@fastify/rate-limit` cho `/auth/login`. *(3/High #2)*
5. `npm audit fix` cho cả `server` và `client`; nâng `react-router-dom`, `vite`, xử lý `@fastify/swagger-ui`. *(3/High #3)*
6. Fail-fast khi thiếu `ORIGIN_URL`; set `NODE_ENV=production` trong lệnh chạy; giới hạn `/docs`. *(3/Medium #5,7,8)*

**Sprint tới:**
7. `@fastify/helmet` + security headers ở `netlify.toml`. *(3/Medium #6)*
8. Rút ngắn TTL access token + refresh token `httpOnly` + cơ chế thu hồi. *(3/Medium #9)*
9. Giảm tải SSE (poll 5–10s hoặc Supabase Realtime) + cache fan-out recipient. *(3/Medium #10)*
10. Bọc helper cho PostgREST `.or()` filter + escape `% _`. *(3/Medium, Low)*

**Liên tục / kỹ thuật nợ:**
11. Tách `orders.service.ts` và `OrderDetailPage.tsx`; gộp code trùng (`list()`, resolve permission, `respond()`).
12. Tách test unit không phụ thuộc DB + thêm GitHub Actions (`tsc`, `eslint`, `npm audit`, unit test, ngưỡng coverage).
13. Dọn repo (`outputs/`, `.vscode/`, `support.ts`), viết README + tài liệu kiến trúc/luồng order/permission catalog.
14. Cache permission trong `verifyToken` (TTL ngắn) để giảm 3 query/request.

---

*Hết báo cáo. Không có thay đổi code nào được thực hiện. Khi cần fix từng mục, vui lòng yêu cầu riêng theo số thứ tự ở Mục 3.*
