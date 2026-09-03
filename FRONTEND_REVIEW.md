# FRONTEND REVIEW — `client/` (React 19 + Vite 8)

> Ngày: 2026-09-03 · Phạm vi: chỉ thư mục `client/` · Nhánh `dev` (có nhiều thay đổi chưa commit — migration modal→offcanvas đang dở).
> Không sửa code, chỉ đánh giá.

---

## 0. Tóm tắt

**Chất lượng tổng thể: KHÁ.** Nền tảng tốt (React Query kỷ luật, code-splitting theo route, hệ offcanvas a11y rất chỉn chu, permission model khai báo rõ ràng, `tsc`+ESLint sạch, không `any`/`@ts-ignore`/`TODO`). Nhưng có một số lỗ hổng nền móng: **không có Error Boundary**, **TypeScript chưa bật `strict`**, **xử lý phiên hết hạn (401) đang bị chết**, và một **cuộc migration modal→offcanvas mới hoàn thành 2/25 trang** khiến phần lớn màn hình vẫn dùng modal không có focus-trap/scroll-lock/Escape.

| # | Mức độ | Nhóm | Vấn đề |
|---|--------|------|--------|
| 1 | **High** | Robustness | Không có React **Error Boundary** ở bất kỳ đâu — 1 lỗi render = trắng màn hình |
| 2 | **High** | Type safety | `tsconfig.app.json` **không có `strict`** (mất `strictNullChecks`, `noImplicitAny`) |
| 3 | **High** | Auth UX | 401 giữa phiên không được xử lý — redirect trong `http.ts` bị **comment out**, không có "hết hạn → về login" |
| 4 | **High** | Security deps | `react-router` 7.15 + `vite` 8.0.12 có CVE High (XSS, open-redirect) — cần nâng (đã nêu ở AUDIT_REPORT) |
| 5 | **High** | A11y / Maintainability | Migration **modal → offcanvas** mới xong 2/25 trang; ~23 trang còn dùng `CrudModal`/`ConfirmDialog` **không focus-trap, không scroll-lock, không Escape, không restore focus** |
| 6 | Medium | Auth UX | `LoginPage` dùng `alert()` báo lỗi, `console.error` lỗi, `type="number"` cho ID, thiếu `autoComplete`, không redirect khi đã đăng nhập |
| 7 | Medium | Perf / CSP | **3 hệ icon** song song; Hugeicons nạp **CSS từ `cdn.hugeicons.com` bằng JS lúc runtime** |
| 8 | Medium | Perf / CSP | Logo & avatar **hotlink từ `upload.wikimedia.org`**; font Google + Hugeicons **inject `<link>` runtime** trong `WorkspaceLayout` |
| 9 | Medium | Bundle | `motion` (Framer Motion) bị gộp vào chunk `CrudPrimitives` **131 kB / gzip 42 kB**, nạp ở gần như mọi trang, chỉ dùng cho 1 toast |
| 10 | Medium | Architecture | Bảng route: **5 role × ~40 route trùng nhau**, chỉ khác tiền tố URL; gating 100% theo permission, tiền tố role không cách ly gì |
| 11 | Medium | Placeholder | `HomePage` (route `/` và fallback `*`) là **Lorem ipsum** + link "Click login" |
| 12 | Medium | Perf | Dropdown tham chiếu (`categories`/`units`/`providers`) **fetch ngay khi vào trang** dù chưa mở form (`useCrudResource` không có `enabled`) |
| 13 | Medium | Perf / UX | `usePaginatedResource.loading = isPending \|\| isFetching` → overlay "Đang cập nhật…" nhấp nháy mỗi lần phân trang/sắp xếp/mutation dù đã `keepPreviousData` |
| 14 | Medium | Perf | Context value không memo: `AuthContext`, `Outlet context`, `buildWorkspaceNavigation` dựng lại mỗi render → re-render lan rộng |
| 15 | Medium | A11y / UX | `NotificationBell`: lỗi `markRead` bị **nuốt im lặng**; dropdown không phải dialog thật (không dời focus, không Esc) |
| 16 | Low | A11y | `DataTable` thiếu `aria-sort`/`scope="col"`; `String(item[accessor])` → `[object Object]` nếu quên `render` |
| 17 | Low | DRY | ~10 trang master-data lặp gần như nguyên khối (list + debounce search + modal + form + confirm), 200–350 dòng/trang; JSX 1 dòng 10+ props |
| 18 | Low | i18n | Trộn Việt–Anh trong UI; `index.html` `lang="en"`, `<title>client</title>`; không có lớp i18n |
| 19 | Low | DX | `Button` chỉ là hàm ghép class, không phải component `<Button>` → dễ quên `type="button"` trong form |
| 20 | Low | Misc | `retry: 1` toàn cục retry cả 401/403/404; `useDebounce` mặc định 700ms vs 400ms; `MultiSelect` khi `error` thì khoá toàn bộ control |

---

## 1. Kiến trúc & tổ chức

**Stack:** React 19, Vite 8, React Router 7 (data router qua `useRoutes`), @tanstack/react-query 5, react-hook-form 7, Tailwind 4 (`@tailwindcss/vite`), axios, `motion`, `@radix-ui/react-tooltip`, FontAwesome.

**Cây thư mục** (`src/`): `api/` (axios service theo domain + `http.ts` interceptor) · `components/` (`common/`, `crud/`, `offcanvas/`, `orders/`, `workspace/`, `notifications/`) · `context/AuthContext` · `hooks/` · `layouts/workspace/` · `pages/` (32 file) · `routes/` · `constants/` · `types/` · `lib/` (`queryClient`, `queryKeys`) · `utils/` (`bodyScrollLock`, `focusManagement`).

**Điểm tốt:**
- Tách lớp rõ ràng `api ↔ hooks ↔ pages`; `queryKeys.ts` tập trung, có factory `resourceKeys()`.
- Code-splitting: mọi page + `WorkspaceLayout` đều `lazy()`. Build 943ms, đa số chunk < 8 kB gzip.
- `AbortSignal` từ React Query được truyền xuyên xuống axios (`queryFn: ({ signal }) => loader(query, signal)`) → huỷ request khi unmount/đổi query.
- Permission model khai báo: `<PermissionGuard anyOf={[...]}>`, `useAuth().hasPermission/hasAnyPermission/hasAllPermissions`, mã permission mirror backend.

**Vấn đề kiến trúc:**

### 1.1 [Medium] Bảng route phình do nhân bản theo role
`routes/workspace.routes.tsx`: `ROLE_CODES.map(createWorkspaceRoute)` tạo **5 subtree** (`/admin`, `/teamlead`, `/datavt`, `/datadg`, `/material-control`), mỗi cái gọi `createFeatureRoutes()` (~40 route) — cộng thêm 1 subtree `/workspace`. Tổng ~240 route object gần như giống hệt nhau, **chỉ khác tiền tố URL**. Việc gating hoàn toàn dựa trên `PermissionGuard` (permission), **không dựa trên role**: một user `DATA_PACKING` gõ `/admin/dashboard` vẫn vào được nếu có permission. Tiền tố role vì thế **không cung cấp cách ly nào**, chỉ làm đẹp URL, và buộc `getWorkspacePath(role, relativePath)` phải len lỏi khắp Sidebar/Header/mọi trang.
→ **Đề xuất:** dùng 1 cây `/workspace/*` duy nhất; role chỉ để chọn label/dashboard + redirect mặc định. Bỏ được ~200 route object và toàn bộ việc truyền `role` để dựng path.

### 1.2 [Low] Trùng lặp nặng giữa các trang CRUD master-data
`UnitsPage`, `SuppliesPage`, `ProvidersPage`, `SupplyCategoriesPage`, `StorageLocationsPage`, `AreasPage`, `RacksPage`, `ShopsPage`, `VehiclesPage`, `TripCatalogPage`… đều lặp cùng một khung: `usePaginatedResource` + state `search` local + `useDebounce` + `useEffect` đồng bộ vào `updateQuery` + `DataTable` + modal form + `ConfirmDialog` deactivate. Mỗi trang 200–350 dòng. Các trang legacy còn viết JSX nhồi 1 dòng 10+ props (`SuppliesPage.tsx:79, 92, 96, 234–241`) → rất khó đọc/diff/review.
→ **Đề xuất:** trích `useSearchableList()` (gộp debounce-search vào `usePaginatedResource`), `<CrudResourcePage config={…}>`, và primitives `<TextField>/<SelectField>/<FormRow>` thay cho việc lặp `<label className={labelClassName}><span>…</span><input {...register}/><FieldError/></label>`.

### 1.3 [Low] Hai hệ modal song song (migration dở)
`components/offcanvas/*` (mới) rất tốt; nhưng `grep` cho thấy **chỉ `UnitsPage` và `ShiftOrderSheetDetailPage`** dùng `useCrudOffcanvas`, còn **23 file** vẫn `import { CrudModal, ConfirmDialog } from '../crud/CrudPrimitives'`. `git status` cho thấy migration đang làm dở (`CrudEntityView.tsx`, `offcanvas/`, `useCrudOffcanvas.ts` là file mới chưa commit). Hệ quả: gánh nặng bảo trì 2 hệ + phần lớn app còn modal thiếu a11y (mục 3.1).

---

## 2. Type safety

### 2.1 [High] Không bật `strict`
`client/tsconfig.app.json` chỉ có `noUnusedLocals/Parameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly` — **thiếu `strict` / `strictNullChecks` / `noImplicitAny`**. (Server dùng `fastify-tsconfig` nên có strict; client thì không.) Hậu quả:
- `null`/`undefined` không bị bắt: `SuppliesPage.tsx:70` `item?.providers.map(...)` sẽ crash nếu `providers` là `undefined`; `ProtectedRoute`/`Sidebar` giả định `user.publicData` luôn có.
- Nhiều `!` che lỗi: `CreateOrderForm` `sourceArea!.id`, `requestedTotal!`, `sheetContext!.id`.
- Kiểu lỏng: `IUser` gần như mọi field optional (`id?`, `permissions?`, `isSystemAdmin?`); `UserProfile.role: RoleSummary | string | null` buộc `typeof` check rải rác (`Sidebar.tsx:52`).
→ Bật `strict: true`, xử lý fallout theo từng module; siết `Column<T>.accessor: keyof T | string` (bỏ `| string`).

### 2.2 [Low] `PermissionInput = PermissionCode | string`
`| string` vô hiệu hoá lợi ích union literal — gõ sai mã permission không bị bắt. Nên bỏ `| string`, ép mọi call-site dùng `PERMISSION_CODE.*`.

---

## 3. Accessibility

### 3.1 [High] Modal legacy thiếu quản lý focus
`CrudPrimitives.tsx` `CrudModal` / `ConfirmDialog`: có `role="dialog"`/`aria-modal`/`aria-labelledby` nhưng **không** focus-trap, **không** dời focus vào modal khi mở, **không** khôi phục focus khi đóng, **không** khoá scroll body (`utils/bodyScrollLock`/`focusManagement` đã có sẵn nhưng chỉ `offcanvas/` dùng), **không** đóng bằng `Escape`, backdrop chỉ đóng bằng `onMouseDown`. Áp dụng cho ~23 trang. Trái ngược, `components/offcanvas/*` làm **đúng chuẩn** (trap, `inert` cho lớp dưới, Esc, restore, scroll-lock ref-counted) — cần đẩy nhanh migration.

### 3.2 [Medium] `NotificationBell` dropdown không phải dialog thật
`aria-haspopup="dialog"` nhưng panel là `<section>` thường; không dời focus vào, không Esc (chỉ đóng bằng outside-click xử lý ở `WorkspaceLayout`). Nên: `role="dialog"` + focus-trap nhẹ + Esc, hoặc đổi sang menu pattern.

### 3.3 [Low] `DataTable`
- `<th>` sortable không có `aria-sort` (chỉ đổi ký tự `↑/↓`), thiếu `scope="col"`.
- Ô "Search:" `<label>` không gắn `htmlFor`/`id` với `<input>`.
- `String(item[column.accessor] ?? '')` → hiện `[object Object]` nếu cột trỏ vào object mà quên `render`.

### 3.4 Điểm tốt a11y
`MultiSelect` cài đúng ARIA combobox (`role="combobox"`, `aria-activedescendant`, `aria-controls`, điều hướng phím, `role="listbox"/"option"`); `prefers-reduced-motion` được tôn trọng trong `index.css`; `LiveNotificationToast`/`CrudFeedbackToast` có `role="status" aria-live="polite"`; Sidebar có `aria-current="page"`, `aria-expanded`, `aria-label` khi thu gọn.

---

## 4. Auth & session

### 4.1 [High] 401 giữa phiên không được xử lý
`api/http.ts` response interceptor: khi 401 → `localStorage.removeItem('access_token')` nhưng dòng điều hướng **bị comment** (`// window.location.href = '/auth/login';`). `AuthContext` chỉ bắt lỗi lúc **khởi động** (một lần `getMyProfile` trong `useEffect`). ⇒ token hết hạn giữa chừng: các query React Query lỗi rải rác, không có chuyển hướng, không thông báo "phiên đã hết hạn", state UI vỡ cho tới khi user tự F5. Nên có 1 handler tập trung: 401 → clear token + `queryClient.clear()` + điều hướng `/auth/login?returnTo=…` (dùng router, không `window.location`).

### 4.2 [Medium] `LoginPage`
- Báo lỗi bằng **`alert()`** (blocking, xấu) + `console.error("Lỗi đăng nhập:", error)` (lộ chi tiết ra console prod). Nên: error state inline.
- `type="number"` cho VinFast ID → chặn số 0 đầu, có spinner; nên `inputMode="numeric"` + `pattern`.
- Thiếu `autoComplete="username"` / `autoComplete="current-password"` → password manager không nhận diện tốt; thiếu nút hiện/ẩn mật khẩu.
- Không redirect khi user đã đăng nhập vẫn mở `/auth/login`.
- Không có `<h1>` (chỉ `<h2>Login`), khối code chết bị comment ở cuối.
- `minLength: 9` client — hợp lý (đồng bộ độ dài tối thiểu với backend), nhưng để mismatch nếu backend đổi rule; nên lấy từ 1 nguồn.

### 4.3 [Low] Token trong `localStorage`
Đã nêu ở AUDIT_REPORT (rủi ro XSS-exfil). Ghi lại ở đây để đầy đủ ngữ cảnh FE: mọi truy cập token đều rải rác `localStorage.getItem('access_token')` ở 4 file — nên bọc 1 module `tokenStore` để dễ đổi sang cookie `httpOnly` sau này.

---

## 5. Performance

### 5.1 [Medium] `motion` (Framer Motion) trong chunk `CrudPrimitives` — 131 kB / gzip 42 kB
`CrudPrimitives.tsx` `import { AnimatePresence, motion } from 'motion/react'` chỉ để trượt **một** `CrudFeedbackToast`. Vì `CrudPrimitives` được gần như mọi trang import, chunk 42 kB gzip này nạp ở hầu hết route. `index.css` đã có sẵn hạ tầng transition + `prefers-reduced-motion` → thay bằng CSS class, bỏ hẳn `motion` (hoặc chỉ `import` động ở nơi thực sự cần).

### 5.2 [Medium] Dropdown tham chiếu fetch sớm
`SuppliesPage` gọi 3 × `useCrudResource(loadCategories/loadUnits/loadProviders)` ở thân component → **3 request list ngay khi vào trang**, kể cả khi user không bao giờ mở form. `useCrudResource` không nhận `enabled`. Thêm `enabled` và chỉ bật khi `formOpen` (hoặc prefetch on-hover nút "Thêm").

### 5.3 [Medium] `loading` quá "nhạy" trong `usePaginatedResource`
`loading = resourceQuery.isPending || resourceQuery.isFetching`. Với `keepPreviousData`, mọi refetch nền (đổi trang, đổi sort, sau mutation invalidation) đều bật `loading=true` → `DataTable` hiện overlay "Đang cập nhật…" / hoặc skeleton nhấp nháy liên tục. Nên: `firstLoad = isPending` (skeleton) tách khỏi `isFetching` (chỉ badge mờ, hoặc bỏ).

### 5.4 [Medium] Context/prop không memo → re-render lan
- `AuthContext.tsx:110` `value={{ user, role, permissions, … }}` object literal mới mỗi render (dù các hàm đã `useCallback`) → mọi `useAuth()` consumer re-render khi `AuthProvider` render.
- `WorkspaceLayout.tsx:126` `<Outlet context={{ searchQuery, setSearchQuery }}/>` literal → mọi `useOutletContext` re-render khi gõ search/toggle sidebar.
- `Sidebar.tsx:35` `buildWorkspaceNavigation(role, hasPermission, …)` dựng lại toàn bộ mảng nav mỗi render.
→ Bọc `useMemo`.

### 5.5 [Low] Bundle & vendor
- Không cấu hình `build.rollupOptions.manualChunks` — `index.js` vendor 295 kB / gzip 95 kB (React+Router+Query). Chấp nhận được nhưng nên tách `react`/`react-dom` cố định để cache tốt.
- `@fortawesome/free-brands-svg-icons` là dependency nhưng không thấy trong output build → có thể gỡ.
- `WorkspaceLayout` vẽ 2 "blob" `blur-3xl` 96×96 trang trí — chi phí paint trên máy yếu; cân nhắc bỏ hoặc `content-visibility`.

### 5.6 [Low] SSE realtime
`useSupplyRealtime` (đã review ở AUDIT_REPORT): `fetch`+ReadableStream, có backoff, `AbortController` cleanup — tốt. Chỉ lưu ý mỗi lần nhận signal gọi hàng loạt `queryClient.invalidateQueries` (notifications + orders.lists + shiftOrderSheets + orders.detail) → có thể refetch dồn khi nhiều event; cân nhắc debounce invalidation.

---

## 6. Robustness & error handling

### 6.1 [High] Không có Error Boundary
`App.tsx` chỉ có `<Suspense>` (không bắt lỗi render, chỉ bắt promise của `lazy`). Bất kỳ lỗi render nào (ví dụ truy cập `undefined.foo` do `strictNullChecks` tắt) = **trắng màn hình, không log, không recovery**. Cần tối thiểu 1 `<ErrorBoundary>` bao `AppRoutes` (fallback + nút reload + report), lý tưởng thêm boundary cấp route để 1 trang lỗi không kéo sập cả app.

### 6.2 Điểm tốt
- `getApiErrorMessage` (`api/errors.ts`): map mã lỗi nghiệp vụ backend → câu tiếng Việt thân thiện, và **ẩn lỗi kỹ thuật** (regex `SQLSTATE|PGRST|duplicate key|violates constraint…`) khỏi người dùng — làm rất đúng.
- `CreateOrderForm` + `createOrderOrchestration.ts`: tách state machine (`editing → creating-draft → submitting → success/submit-failed`), lớp lỗi `DraftSubmitError` giữ lại `draft` đã tạo, khoá `<fieldset disabled>` để tránh sửa mất dữ liệu sau khi DRAFT đã lưu — xử lý edge case tốt.
- `runMutation` trong `usePaginatedResource`/`useCrudResource` trả `boolean`, set feedback thống nhất, tự lùi trang khi xoá bản ghi cuối trang (`removeCurrentItem`).

### 6.3 [Medium] `NotificationBell.openNotification`
```
if (!notification.is_read) { try { await markReadMutation.mutateAsync(id); } catch { return; } }
```
Lỗi mark-read → `return` im lặng: click không mở gì, không điều hướng, không báo. Nên vẫn điều hướng (mark-read là phụ) hoặc hiện toast lỗi.

### 6.4 [Low] `console.*` còn sót
`http.ts:35`, `AuthContext.tsx:46,67`, `LoginPage.tsx:48` (`OffcanvasProvider` đã gate `import.meta.env.DEV`). Gỡ hoặc thay bằng logger có thể tắt ở prod.

---

## 7. Assets, fonts, icons, CSP

### 7.1 [Medium] Ba hệ icon
1. `@fortawesome/react-fontawesome` + solid + brands (dependency) — Sidebar, Pagination, `workspaceNavigation`.
2. **Hugeicons** `class="hgi-stroke hgi-*"` với CSS nạp từ `https://cdn.hugeicons.com/font/hgi-stroke-rounded.css` — `NotificationBell`, `LiveNotificationToast`.
3. Glyph unicode thô: `×`, `✓`, `↑`, `↓` — `CrudModal`, `MultiSelect`, `DataTable`.
→ Chọn **một** hệ (khuyến nghị FontAwesome tree-shaken đã có sẵn), bỏ Hugeicons.

### 7.2 [Medium] Tài nguyên ngoài nạp lúc runtime
`WorkspaceLayout.tsx:30-47` `useEffect` `appendChild` `<link>` cho **Google Fonts (Figtree)** và **Hugeicons CDN**. Vấn đề:
- FOUT / icon "nhảy" vào sau khi JS chạy; không có `<link rel="preconnect/preload">`.
- **CSP**: theo khuyến nghị siết CSP ở AUDIT_REPORT, phải allow-list `cdn.hugeicons.com`, `fonts.googleapis.com`, `fonts.gstatic.com` — ngược lại icon/font gãy âm thầm.
- Figtree không được nạp trên trang Login (ngoài `WorkspaceLayout`) → typography Login ≠ phần còn lại.
→ Đưa `@font-face`/`<link>` vào `index.html` (build-time) hoặc self-host font; bỏ CDN icon.

### 7.3 [Medium] Hotlink ảnh Wikimedia
`Sidebar.tsx:88` logo VinFast và `:173` avatar placeholder trỏ thẳng `https://upload.wikimedia.org/...`. Wikimedia có thể chặn hotlink/429, thêm phụ thuộc mạng, lộ referrer, và cần allow-list `img-src`. → Bỏ vào `client/public/` hoặc `src/assets/`.

### 7.4 [Low] `index.html`
`<html lang="en">` (app tiếng Việt → `lang="vi"`), `<title>client</title>` (đặt tên thật), `favicon.svg` mặc định Vite.

---

## 8. UX & i18n

- **[Medium] `HomePage`** (`pages/HomePage.tsx`) = đoạn Lorem ipsum + `<Link to="/auth/login">Click login</Link>`. Đây là route `/` **và** đích của catch-all `path: "*"`. Người dùng gõ sai URL sẽ rơi vào trang Lorem. → Redirect `/` và `*` về `/auth/login` (hoặc role-home nếu đã đăng nhập).
- **[Low] i18n**: trộn ngôn ngữ trong UI — "Search:", "Previous"/"Next", "Master data", "Active"/"Inactive", "Deactivate", "Units"/"Supplies" (tiêu đề trang) lẫn với "Xem/Sửa/Bỏ qua/Đang lưu…/Thêm dòng". Không có lớp i18n (chuỗi hardcode khắp nơi). Nếu chỉ phục vụ nội bộ VN thì tối thiểu thống nhất về tiếng Việt; nếu cần song ngữ thì thêm `i18next`.
- **[Low] `useDebounce`** mặc định 700ms (cảm giác trễ khi lọc bảng) trong khi `useServerLookup` dùng 400ms — nên thống nhất ~300–400ms.
- **[Low] `MultiSelect`**: `effectiveDisabled = disabled || loading || Boolean(error)` — khi load options lỗi thì **khoá cả control**, user không thao tác/không retry được; nên chỉ hiển thị lỗi + vẫn cho chọn các option đã có.
- **[Low] `Pagination`**: nút "Previous/Next" tiếng Anh, không có nút nhảy trang / nhập số trang khi nhiều trang.

---

## 9. Những chỗ làm tốt (giữ nguyên)

1. **`components/offcanvas/*`** — hệ drawer chuẩn mực: focus-trap (`trapTabKey`), `inert` cho lớp không topmost, `Escape`, khôi phục focus về trigger, khoá scroll body đếm-tham-chiếu (`bodyScrollLock` với `Set<ownerId>` + snapshot/restore), animation theo phase `opening/open/closing` + dọn `setTimeout`/`requestAnimationFrame` khi unmount, cảnh báo giới hạn stack ở DEV, ARIA `labelledby`/`describedby`, chặn đóng khi `isBusy`, hỏi xác nhận khi `isDirty`.
2. **React Query** dùng kỷ luật: `queryKeys` tập trung có factory; `keepPreviousData`; `staleTime`/`gcTime` hợp lý; `signal` xuyên suốt xuống axios; `invalidateQueries` theo key bộ phận sau mutation.
3. **Code-splitting** theo route bằng `lazy()` toàn bộ; `Suspense` fallback skeleton; build nhanh, chunk nhỏ.
4. **`getApiErrorMessage`** map mã nghiệp vụ → tiếng Việt + giấu lỗi kỹ thuật/SQL.
5. **Permission model** khai báo, gọn: `<PermissionGuard anyOf/allOf/permission>`, helper `hasPermissionInSet` thuần hàm dễ test, mã mirror backend.
6. **`MultiSelect`** cài đúng ARIA combobox + điều hướng bàn phím đầy đủ.
7. **`CreateOrderForm`** — luồng draft→submit tách orchestration, có lớp lỗi giữ `draft`, khoá `<fieldset>` chống mất dữ liệu.
8. `prefers-reduced-motion` được tôn trọng; skeleton loaders nhất quán; toast có `aria-live`.
9. ESLint sạch, cả 2 `tsconfig` bật `noUnusedLocals/Parameters`; không `any`, không `@ts-ignore`, không `TODO`.

---

## 10. Thứ tự đề xuất xử lý

**Nhanh, tác động cao:**
1. Thêm `<ErrorBoundary>` bao `AppRoutes` (+ boundary cấp route). *(#1)*
2. Nối lại xử lý 401 tập trung trong `http.ts` → clear + `queryClient.clear()` + điều hướng router tới `/auth/login?returnTo=`. *(#3)*
3. `HomePage` + catch-all `*` → redirect thay vì Lorem ipsum. *(#11)*
4. `LoginPage`: bỏ `alert()` → error state inline; thêm `autoComplete`; bỏ `console.error`. *(#6)*
5. Bỏ `motion` khỏi `CrudPrimitives`, dùng CSS transition. *(#9)*

**Trung hạn:**
6. Bật `tsconfig.app.json` `strict: true`, xử lý fallout. *(#2)*
7. `cd client && npm audit fix` + nâng `react-router-dom`, `vite`. *(#4)*
8. Đưa font/icon vào build-time; self-host; bỏ Hugeicons CDN + hotlink Wikimedia; thống nhất 1 hệ icon. *(#7, #8)*
9. Đẩy nốt migration modal → `offcanvas` cho ~23 trang còn lại; xoá `CrudModal`/`ConfirmDialog`. *(#5, #3.1)*
10. Memo hoá context value (`AuthContext`, `Outlet context`, `buildWorkspaceNavigation`). *(#14)*
11. Thêm `enabled` cho `useCrudResource`; chỉ fetch dropdown khi mở form. *(#12)*
12. Tách `loading` first-load vs background trong `usePaginatedResource`. *(#13)*

**Dài hạn / nợ kỹ thuật:**
13. Gộp 5 subtree route theo role thành 1 cây `/workspace/*`. *(#10)*
14. Trích `<CrudResourcePage>` + primitives form (`<TextField>`, `<SelectField>`) để xoá lặp ~10 trang master-data. *(#17)*
15. Thêm lớp i18n hoặc thống nhất tiếng Việt; sửa `index.html` `lang`/`title`. *(#18)*
16. Bọc `<Button>` component thật (ép `type`, `disabled`, aria). *(#19)*
17. Thêm Vitest + Testing Library cho `AuthContext`, `PermissionGuard`, `ProtectedRoute`, `usePaginatedResource`, `CreateOrderForm` (đã nêu ở AUDIT_REPORT).

---

*Hết. Không có thay đổi code nào được thực hiện.*
