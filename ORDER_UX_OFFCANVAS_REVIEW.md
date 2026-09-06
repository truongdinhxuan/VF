# ORDER UX & OFFCANVAS PERFORMANCE REVIEW

> Repo `truongdinhxuan/VF` @ `dev` · Ngày 2026-09-03 · **Review only, không sửa code.**
> Trọng tâm: **tốc độ tạo + submit MỘT Order** so với KPI vận hành **30s – 1 phút**.
> Nguồn số liệu được gắn nhãn: `MEASURED` (đo thực), `SOURCE-INFERRED` (suy từ code), `ESTIMATED` (ước lượng). **Không có telemetry timing trong dự án** → phần lớn là `SOURCE-INFERRED` / `ESTIMATED`.

---

## A. EXECUTIVE VERDICT

**Câu hỏi chính:** *"Một nhân viên kho được đào tạo có tạo + submit được 1 Order trong 30–60 giây với ứng dụng hiện tại không?"*

| Kịch bản | Rating | Thời gian khả dĩ (ESTIMATED) |
|---|---|---|
| **Order thường, 1 item, cache ấm, không lỗi** | **LIKELY YES** | ~15–30s |
| **Order thường, 1 item, lần đầu sau khi vào trang (cache lạnh)** | **BORDERLINE** | ~25–45s |
| **KIEN_SAT_TC (kiện sắt tiêu chuẩn), 1 item** | **BORDERLINE → LIKELY NO** | ~35–70s |
| **Order nhiều item (3–5)** | **LIKELY NO** | ~60–150s |
| **Có lỗi zero-stock phát hiện ở bước Submit** | **NO** (phải làm lại) | +20–40s |

**Theo thiết bị:**

| | Rating |
|---|---|
| **Desktop** (bàn phím + chuột) | LIKELY YES cho case thường; BORDERLINE tổng thể |
| **Tablet** (768–1024) | BORDERLINE |
| **Mobile** (<768) | LIKELY NO cho case thường; NO cho stack/multi-item |

**Lý do chính khiến kết luận không phải "YES" chắc chắn:**

1. **Chọn Supply là nút thắt lớn nhất** — hiện là *ô search riêng* nuôi một *`<select>` native riêng* (thao tác 2 widget), không phải combobox typeahead. Không có "gần đây / hay dùng / yêu thích".
2. **Provider vẫn phải chọn tay kể cả khi Supply chỉ có 1 Provider.**
3. **Zero-stock chỉ lộ ra ở bước Submit** — người dùng có thể mất 20s điền xong mới thất bại.
4. **Đường Submit backend nặng và biến thiên** — `submit` gọi `findOrder` (select lồng rất lớn) **3 lần** + fan-out thông báo quét toàn bộ `users`/`user_roles`/`role_permissions`. 0.6–2.5s và xấu dần theo số user.
5. **Two-step create→submit** (2 HTTP request tuần tự, không transaction) — thêm 1 round-trip chặn và cả một nhánh lỗi "DRAFT đã tạo nhưng chưa submit".
6. **Đóng drawer bị chặn bởi refetch Sheet.**

**Offcanvas KHÔNG phải là vấn đề** — nó giúp nhanh hơn kiến trúc route cũ (xem mục E, F). Chi phí animation (~0.44s/lần mở+đóng) là không đáng kể.

---

## B. CURRENT ORDER FLOW (bám theo source)

Flow "pilot" mới: `ShiftOrderSheetDetailPage` → **"+ Tạo thêm Order"** → Offcanvas (`OffcanvasProvider` → `CrudOffcanvas` → `Offcanvas`) → `CreateOrderForm` `mode="shift-sheet-submit"` → `createAndSubmitOrder` (POST /orders → POST /orders/:id/submit) → `handleCreateSuccess` (invalidate + await refetch Sheet) → `closePrimary`.

| # | User action | UI surface | Frontend work | Network | Backend work | Chờ (blocking?) | Failure | Recovery |
|---|---|---|---|---|---|---|---|---|
| 1 | Ở trang Sheet detail | `ShiftOrderSheetDetailPage` | Sheet đã load (`getShiftOrderSheet`) | — | — | — | — | — |
| 2 | Click **"+ Tạo thêm Order"** | Button | `openCreateOrder` → `setCreateDrawer`, `setCreateState(INITIAL)`, `openCrud({...size:'lg'})` | — | — | — | — | — |
| 3 | (mở drawer) | `Offcanvas` portal → `document.body` | `OffcanvasProvider.setState` primary phase `opening`→`open` (1×`requestAnimationFrame`); CSS `transform 240ms`, backdrop `220ms`; `useBodyScrollLock`; sau `phase='open'` → `focusFirstElement` | — | — | ~**0.24s** anim (ESTIMATED, CSS `index.css:74`) | — | — |
| 4 | (form mount) | `CreateOrderForm` (chunk `CreateOrderForm-*.js` 5.17 kB gzip, `MEASURED` build) | `useForm` default 1 empty row; `useServerLookup(supplies)` fire; `useCrudResource(areas)` fire | **GET /supplies** `?page=1&pageSize=20&isActive=true&isDeleted=false&sortBy=code` · **GET /areas** `?pageSize=100&isActive=true` (song song) | supplies list: PostgREST select + relations (`category, unit, provider_links`); areas list | **CÓ** — Supply select & Area hiển thị chờ 2 request này (COLD). WARM: cache hit (`staleTime` supplies 5′, areas 15′) → 0 request | request lỗi → skeleton/err; `referenceUnavailable=true` khoá Submit | Bấm reload / thử lại |
| 5 | Chọn **Supply** (dòng 1) — thường phải gõ ô "Tìm vật tư trên server" trước | `<input type=search>` + `<select>` native | `setSupplySearch` → `useDebounce 400ms` → query mới; chọn option → `changeSupply` (set supply_id, clear provider_id, set unit_id derived, set qty=1 hoặc undefined nếu stack, `resetStackFields`) | **GET /supplies?search=…** (mỗi lần dừng gõ 400ms) | supplies list `code.ilike.*term*` → **leading wildcard, seq scan** (`supplies.service.ts:187`) | **CÓ** khi gõ search (chờ ~0.4s debounce + RT) | — | Gõ lại |
| 6 | Chọn **Provider** (dòng 1) | `SupplyProviderSelect` `<select>` | `useQuery(supplyProviders.list(supplyId))` `enabled` khi có supplyId; `changeProvider` → set provider_id, `resetStackFields` | **GET /supplies/:id/providers** `?isActive=true&isDeleted=false` | `listProviders`: select supply exists + `supply_providers` join `providers` | **CÓ** lần đầu cho supply đó (skeleton). `staleTime 30′` | lỗi → select disabled + msg | — |
| 6b | *(chỉ KIEN_SAT_TC)* chọn **SET/chồng** + nhập **Số chồng** | `OrderStackFields` | `useQuery(supplyStackOptions.list(supply,provider,area))` `enabled` khi đủ 3 id; `changeSetPerQty`/`changeRequestedStackQuantity` → tính `requested_total_set_quantity` + `quantity_requested` | **GET /supplies/:id/stack-options** `?provider_id&area_id` | RPC `get_supply_stack_options` (index `stock_balances_stack_lookup_idx` OK) | **CÓ** (skeleton dropdown); `staleTime 15s` | options rỗng → "Không có quy cách chồng đang tồn kho" | Đổi supply/provider |
| 7 | *(normal)* xác nhận / sửa **Số lượng** (đã mặc định 1) | `<input type=number>` | `register(...valueAsNumber)` | — | — | — | — | — |
| 8 | *(tùy chọn)* **"Thêm dòng"** → lặp 5–7 | Button trong form | `useFieldArray.append(emptyItem())` | — | — | — | — | — |
| 9 | Click **"Gửi Order"** (footer, `type=submit form=formId`) | `DrawerFormFooter` | `handleSubmit(onSubmit)` → `validateReferences()` (sync) → `createAndSubmitOrder` | — | — | — | validate refs fail → `setSubmitError`, không gọi API | Sửa rồi bấm lại |
| 9a | (tạo DRAFT) | footer "Đang tạo Order..." | `createOrder(buildPayload)` | **POST /orders** | `getOrderSourceAreaId` (1 sel) ‖ `assertActiveReceivingArea` (1 sel); `assertShiftSheetContext` (3 song song: sheet sel + user sel + RPC `resolve_user_work_shift_instance`); `prepareOrderItems` (supplies sel + supply_providers sel [+ stock_balances sel nếu stack]); `getStatusId('DRAFT')` (1 sel); **RPC `create_order_with_items`** (mỗi item: `normalize_order_item_request` = supplies+categories join, units check, supply_providers check [+ stock_balances check nếu stack] → insert order + insert items); rồi **`findOrder`** = **ORDER_DETAIL_SELECT** (order + status + 2 area + 4 user join + shift_order_sheet lồng + order_items{supply,provider,unit,allocations{…,discrepancies{reporter,resolver}}} + order_revisions{…}) + `attachStockAvailability` (1 sel stock_balances) | **CÓ** ~0.4–1.2s (ESTIMATED) | 400/409 (zero-stock chỉ ở submit, không ở create); mất kết nối | `stage='editing'`, `setSubmitError`, form còn nguyên dữ liệu (`isDirty` giữ) → bấm lại |
| 9b | (submit PENDING) | footer "Đang gửi Order..." | `submitDraft(draft)` → `submitOrder(draft.id,{shift_order_sheet_id})` | **POST /orders/:id/submit** | `findOrder` (**lại** ORDER_DETAIL_SELECT + attachStockAvailability); `assertPackingOwner`; `assertOrderActionAllowed`; **RPC `submit_order_to_pending`** (`has_permission`, lock order, status=DRAFT, requester context, resolve leader, RPC `resolve_user_work_shift_instance`, **per-item zero-stock**: sum `stock_balances` theo area nguồn, sheet context check + lock, status lookup PENDING, update order + insert order_revision); `finishStatusTransition` → `findOrder` (**lần 3**) + `NotificationsService.persistOrderTransition` → `getActiveAuthorizationContexts` (**3 seq full scan**: users, user_roles, role_permissions) + filter `canReadOrder` + **RPC `persist_notification_with_recipients`** | **CÓ** ~0.6–2.5s (ESTIMATED; xấu dần theo số user vì fan-out) | zero-stock → `ORDER_ITEM_ZERO_STOCK`; context invalid; shift assignment not found; permission | **`DraftSubmitError`** → `stage='submit-failed'`, form khoá, hiện "Order nháp {code} đã tạo nhưng chưa gửi", nút **"Thử gửi lại"** + "Mở Order nháp". DRAFT không mất. |
| 10 | (thành công) | — | `onStateChange('success')`; `handleCreateSuccess` → `Promise.allSettled([invalidate orders.lists, invalidate shiftOrderSheets.detail(id), invalidate shiftOrderSheets.lists])` → **await** (bao gồm **refetch GET /supply/shift-order-sheets/:id** vì đang mounted) → `setFeedback(success)` → `closePrimary()` | **GET /supply/shift-order-sheets/:id** (refetch) | Sheet detail select | **CÓ** ~0.3–1s trước khi drawer đóng | refetch lỗi → `allSettled` nuốt, vẫn đóng | — |
| 11 | (đóng drawer) | `Offcanvas` | phase `closing` → CSS 200ms → timer `EXIT_DURATION_MS=220` → unmount + `restoreFocus(triggerElement)` | — | — | ~**0.2s** anim | — | — |
| 12 | (SSE side-effect ~1.5s sau) | `useSupplyRealtime` (ở `WorkspaceLayout`) | nhận event `notification` → `invalidateSupplyViews` = invalidate notifications.all + orders.lists + shiftOrderSheets.all (+ orders.detail nếu STATUS_CHANGED) | **GET /supply/shift-order-sheets/:id** (refetch **lần 2**) | — | không (background) | — | — |

---

## C. INTERACTION COUNT

Đếm cho luồng từ **Sheet detail**, cache **ấm**, người dùng **thuộc bài**. "Thao tác" = click/tap hoặc 1 lần chọn option; keystroke đếm riêng.

| Loại Order | Min path | Typical path | Worst practical |
|---|---|---|---|
| **A. Normal Supply, 1 item** | **6 clicks**, 0 keystroke <br>(mở 1 · Supply select 2 · Provider select 2 · qty=1 sẵn · Gửi 1) | **~6 clicks + ~5–10 keystrokes** (phải gõ ô search Supply) + 1 lần chờ debounce 400ms | ~10 clicks + ~15 keystrokes (search nhiều lần, sửa qty, review) |
| **B. KIEN_SAT_SPECIAL** *(không phải KIEN_SAT_TC → nhánh normal trong `normalize_order_item_request`)* | như A | như A | như A |
| **C. KIEN_SAT_TC** | **9 clicks** (như A + SET/chồng select 2 + Số chồng focus 1) + 1–3 keystroke số chồng | ~9 clicks + ~8–12 keystrokes + 2 lần chờ (providers, stack-options) + nhẩm `set × chồng` | ~14 clicks + ~20 keystrokes (đổi set_per_qty, sửa số chồng, cảnh báo "vượt tồn") |
| **D. Multi-item (3 item, normal)** | 6 + 2×(Thêm dòng 1 · Supply 2 · Provider 2 · qty 0) = **~16 clicks** | ~16 clicks + ~20–30 keystrokes + 3–6 lần chờ | ~24 clicks + 40 keystrokes |
| **E. Multi stack size (2 dòng cùng Supply, set khác nhau)** | 6 + Thêm dòng 1 + Supply 2 + Provider 2 + SET 2 + Số chồng 1 + (dòng gốc) SET 2 + Số chồng 1 ≈ **~17 clicks** | + nhẩm 2 phép nhân + 2 fetch stack-options | ~22 clicks + 25 keystrokes |

Cuộn (scroll): trong drawer `lg` desktop thường 0–1 lần cho 1 item; **2–4 lần** cho 3+ item hoặc trên tablet/mobile (footer sticky nên nút Gửi luôn thấy).
Confirmation: **0** cho happy path (tốt — xem mục cuối). Chỉ có confirm khi đóng drawer lúc `isDirty` hoặc khi `submit-failed`.

---

## D. TIME BUDGET (normal, 1 item)

| Bước | Nguồn | Cold (s) | Warm (s) | Ghi chú |
|---|---|---|---|---|
| Click "Tạo thêm Order" + anim mở | MEASURED (CSS 240ms) | 0.3 | 0.3 | |
| Nhận diện context bị khoá (Area/Ca/ngày) | ESTIMATED | 1.5 | 1.0 | context hiển thị nhưng chiếm ~1/3 chiều cao drawer |
| Chờ lookup Supplies + Areas | SOURCE-INFERRED | 0.5–1.2 | 0 | song song; warm = cache |
| Tìm + chọn Supply | ESTIMATED | 6–12 | 5–10 | ô search riêng → `<select>` riêng; seq scan server |
| Chọn Provider | SOURCE-INFERRED + ESTIMATED | 2–4 | 2–3 | + GET providers lần đầu (skeleton) |
| Nhập/khẳng định số lượng | ESTIMATED | 1–3 | 1–2 | mặc định 1 |
| Review | ESTIMATED | 3–5 | 2–4 | |
| Click "Gửi Order" | — | 0.3 | 0.3 | |
| API create (POST /orders) | ESTIMATED | 0.6–1.4 | 0.4–1.0 | ~10 read lồng + RPC |
| API submit (POST /submit) | ESTIMATED | 0.9–2.8 | 0.6–2.2 | 3× findOrder + fan-out full-scan |
| Refetch Sheet trước khi đóng | ESTIMATED | 0.4–1.0 | 0.3–0.8 | `await Promise.allSettled` |
| Anim đóng | MEASURED (CSS 200ms) | 0.2 | 0.2 | |
| **TỔNG** | | **~18–37s** | **~14–28s** | |

**So với KPI 30–60s:** Warm/normal **đạt** (nằm trong 14–28s, dư địa cho 1 lần sửa). Cold **sát mép trên**. **KIEN_SAT_TC** (+ ~8–20s cho stack-options fetch + 2 dropdown + nhẩm) → **~30–70s, thường vượt**. **3 item** → **60–150s, vượt rõ**.

---

## E. OFFCANVAS VERDICT

### Rating: **POSITIVE** (không phải STRONGLY vì đường backend + form UX vẫn là nút thắt)

**Lợi ích (so với route cũ):**
- **Bỏ 3 lần chuyển route** (Sheet → CreateOrderPage → OrderDetailPage → back). Mỗi lần = khả năng tải chunk lazy + remount toàn bộ query của trang + reset scroll + refetch Sheet/Order detail.
- **Bỏ 1 hành động submit thủ công**: route cũ tạo DRAFT xong phải sang OrderDetailPage bấm "Submit"; nay `createAndSubmitOrder` làm 2 bước liền, người dùng chỉ bấm **1** nút "Gửi Order".
- **Giữ ngữ cảnh**: Sheet vẫn thấy phía sau, scroll giữ nguyên, không mất phương hướng.
- **Giữ cache**: trang Sheet không unmount → React Query không remount, tránh refetch nguyên trang.
- `focusFirstElement` + `initialFocusRef` đưa con trỏ vào form ngay khi mở.

**Chi phí:**
- Animation mở 240ms + đóng 200ms + timer unmount 220ms ≈ **0.44–0.66s/chu kỳ** — **không đáng kể** so với 5–12s chọn Supply. **Không khuyến nghị bỏ animation.**
- Mỗi `updatePrimary` (`ShiftOrderSheetDetailPage.tsx:151` effect) đẩy `content`/`footer` ReactNode mới vào state của `OffcanvasProvider` → re-render provider + consumer (trang Sheet, gồm bảng Orders). **Không phải mỗi keystroke** (đã kiểm: `onStateChange` chỉ chạy khi `stage/draftOrder/isBusy/isDirty` đổi giá trị — vài lần/phiên). Tác động thực tế: nhỏ.
- Drawer `lg` (640px) trên desktop che ~1/3 màn; context Sheet trong drawer lặp lại thông tin trang → tốn chiều dọc.
- Pattern "render props qua state" (`renderCreateContent`/`renderCreateFooter` + `updatePrimary` trong `useEffect` nhiều deps) khó bảo trì — nhưng **không** ảnh hưởng tốc độ người dùng.

---

## F. OLD (route) vs NEW (offcanvas)

| | Route-based (cũ) | Offcanvas (mới) |
|---|---|---|
| Route transitions | 3 (tới Create, tới Detail, quay lại) | **0** |
| Explicit user clicks cho "tạo+submit" | tạo (≥6) + **sang trang** + **Submit** + confirm? | tạo (≥6) + **Gửi Order (1)** |
| Query remount | toàn bộ CreateOrderPage rồi OrderDetailPage | 0 (Sheet giữ nguyên) |
| Scroll | reset 3 lần | giữ |
| Chuyển ngữ cảnh (cognitive) | cao (3 màn khác nhau) | thấp (1 màn) |
| Latency ẩn được | không (mỗi navigation lộ spinner) | có (drawer đóng sau khi PENDING xác nhận) |
| **Clicks tiết kiệm** | — | **~2–4** |
| **Navigation tiết kiệm** | — | **3** |
| **Thời gian tiết kiệm (ESTIMATED)** | — | **~5–15s + lợi ích nhận thức lớn** |

**Kết luận:** Offcanvas là bước đi đúng. Giữ.

---

## G. FRONTEND PERFORMANCE

| Điểm | Nhận định |
|---|---|
| **Render `CreateOrderForm`** | `useWatch({name:'order_list'})` → re-render toàn form mỗi keystroke ở bất kỳ dòng nào. Với 1–3 dòng: không cảm nhận được. Với 8–10 dòng + mỗi dòng có `<select>` options: bắt đầu có độ trễ gõ nhẹ (ESTIMATED, chưa đo). |
| **`useFieldArray`** | `key={field.id}` ổn định (RHF cấp) → không remount sai. Tốt. |
| **`onStateChange` → parent** | Chỉ chạy khi `stage/draftOrder/isDirty/isBusy` đổi → **không** loop, **không** per-keystroke. Đã xác minh. Tốt. |
| **`buildPayload` / `supplies.find(...)`** | `supplies.find` chạy trong render cho mỗi dòng (`fields.map`) để lấy `selectedSupply`. `supplies` ≤ 20 phần tử (pageSize 20) → O(20×rows), rẻ. |
| **`OffcanvasProvider`** | `value` `useMemo` với `state` deps → context re-render mỗi lần drawer state đổi; consumer ít (2 trang). Chấp nhận được. |
| **`ShiftOrderSheetDetailPage` bảng Orders** | render lại khi `updatePrimary` (vài lần/phiên). Bảng thường < 20 dòng → rẻ. |
| **`DataTable`/`MultiSelect`** | không nằm trên đường tạo Order (form dùng `<select>` native + `SupplyProviderSelect`), không phải hotspot ở đây. |
| **Query hooks** | dùng `signal` (hủy request khi unmount), `keepPreviousData` ở lookup — tốt. |
| **Không có hotspot render nghiêm trọng trên đường tạo 1 Order thường.** Rủi ro chỉ xuất hiện ở 8+ item. |

---

## H. NETWORK

**Cho 1 Order thường thành công:**

| Request | Blocking? | Cold | Warm |
|---|---|---|---|
| GET /supplies (lookup mở drawer) | chặn Supply select | ✔ | cache |
| GET /areas (lookup mở drawer) | chặn Area + Submit | ✔ | cache |
| GET /supplies?search=… | chặn (debounce 400ms + RT) mỗi lần gõ | ✔ (1–3×) | ✔ (1–3×) |
| GET /supplies/:id/providers | chặn provider dropdown (1×/supply) | ✔ | cache 30′ |
| GET /supplies/:id/stack-options *(KIEN_SAT_TC)* | chặn SET dropdown | ✔ | cache 15s |
| **POST /orders** (create DRAFT) | **chặn** | ✔ | ✔ |
| **POST /orders/:id/submit** | **chặn** | ✔ | ✔ |
| GET /supply/shift-order-sheets/:id (refetch, `await`) | **chặn đóng drawer** | ✔ | ✔ |
| GET /supply/shift-order-sheets/:id (SSE ~1.5s sau) | background | ✔ (dup) | ✔ (dup) |
| invalidate orders.lists / shiftOrderSheets.lists | không refetch (chưa mounted) | — | — |

**Blocking round trips:** Warm ≈ **4** (providers + create + submit + sheet refetch) + 1–3 search. Cold ≈ **6** (+ supplies + areas). KIEN_SAT_TC warm ≈ **5**.
**Tổng latency chặn (ESTIMATED):** Warm ~2.0–5.5s; Cold ~3.5–9s.
**Refetch trùng:** Sheet detail bị refetch **2 lần** (một do `handleCreateSuccess`, một do SSE ~1.5s sau). Chưa dedupe.

---

## I. BACKEND (chỉ nút thắt trên đường tạo Order)

| Vị trí | Vấn đề | Mức |
|---|---|---|
| `orders.service.ts` `findOrder` | `ORDER_DETAIL_SELECT` cực rộng (order + 2 area + 4 user join + shift_order_sheet lồng + order_items{allocations{discrepancies{reporter,resolver}}} + order_revisions). Gọi **1× trong create**, **3× trong submit** (`submit` handler + `finishStatusTransition` gọi lại + so sánh). Order vừa tạo **không có** allocation/discrepancy/revision → phần lớn join trả rỗng nhưng vẫn phải plan/execute. | Cao (biến thiên 0.3–1s mỗi lần) |
| `orders.service.ts` `finishStatusTransition` | `await` `NotificationsService.persistOrderTransition` **trên đường trả response**. Bên trong: `getActiveAuthorizationContexts` = **3 truy vấn full-table tuần tự** (`users`, `user_roles`, `role_permissions`) + xử lý in-memory + RPC `persist_notification_with_recipients`. Chi phí O(số user) mỗi lần submit. | **Cao** — xấu tuyến tính theo quy mô tổ chức |
| `submit_order_to_pending` RPC | Đã khá gọn, dùng lock hàng + index. Zero-stock check quét `stock_balances` sum theo (supply,provider,area[,set_per_qty]) — có index. OK. Chỉ là nó nằm **sau** create nên là round-trip thứ 2. | Trung bình |
| `create_order_with_items` + `normalize_order_item_request` | Mỗi item: join supplies+categories, check units, check supply_providers, (stack) check stock_balances — hợp lý, có index. `prepareOrderItems` ở tầng service **cũng** làm gần hệt các check này trước khi gọi RPC → **kiểm tra 2 lớp** (service + RPC). Đúng về an toàn, nhưng thêm 2 select (supplies, supply_providers) mỗi lần create. | Trung bình |
| `getStatusId('DRAFT')` / `getStatusId('PENDING')` | select `order_statuses` theo code mỗi request. Bảng nhỏ, có thể cache in-memory. | Thấp |
| `assertShiftSheetContext` | 3 truy vấn song song (tốt) nhưng lặp lại logic mà `submit_order_to_pending` cũng kiểm lại. | Thấp |
| Permission (`verifyToken`) | Mỗi request lại `getEffectivePermissions` = 3 query DB dựng `request.user`. Không cache. Cộng dồn vào **mọi** request ở mục H. | Trung bình (đã nêu ở AUDIT_REPORT) |

---

## J. STOCK / STACK PERFORMANCE

| Case | Khi nào query chạy | Latency | Chặn input? | Ghi chú |
|---|---|---|---|---|
| **Normal** | **Không có** query tồn khả dụng ở form tạo. `attachStockAvailability` chỉ chạy **trong response create/get Order** (sau khi đã tạo). | — | Không | ⇒ người dùng **không biết** tồn đủ hay không cho tới khi Submit |
| **KIEN_SAT_SPECIAL** (nhánh normal) | như Normal | — | Không | như trên |
| **KIEN_SAT_TC** | `get_supply_stack_options` khi đủ (supply, provider, area); `staleTime 15s`; `refetchOnWindowFocus: true` | ESTIMATED 0.1–0.4s (index `stock_balances_stack_lookup_idx`, `MEASURED` index tồn tại) | Có (skeleton dropdown SET) | mỗi lần đổi supply/provider → fetch lại; `refetchOnWindowFocus` có thể fetch thừa khi alt-tab |
| **Zero stock** | Chỉ phát hiện trong `submit_order_to_pending` (`ORDER_ITEM_ZERO_STOCK` kèm detail) | trong latency submit | — | **phát hiện muộn nhất có thể** |
| **Stack Options** | RPC group by `set_per_qty`, order desc | nhanh | — | trả `available_stack_quantity`; form cảnh báo "vượt tồn" nhưng vẫn cho submit |

**Có thể chạy song song?** `providers` và `stack-options` hiện **tuần tự** (phải chọn provider mới lộ stack fields). Đúng logic. Không có request per-keystroke cho tồn (tốt). Không có nguy cơ response cũ đè state mới rõ rệt vì React Query key theo (supply,provider,area).

---

## K. COGNITIVE LOAD

**Trường nằm trên form nhưng hệ thống đã biết / suy được:**

| Trường | Trạng thái hiện tại | Nhận xét |
|---|---|---|
| Area gửi (VTDG) | read-only, hiển thị | OK (đã khóa) — nhưng chiếm 1 ô nguyên |
| Area nhận | read-only (từ `user.publicData.area`) | OK (đã khóa) |
| Ca / ngày làm việc | hiển thị trong block "Phiếu Order Ca" | OK (đã khóa) |
| **Provider** | `<select>` phải chọn tay **kể cả khi chỉ 1 option** | **Friction** — nên auto-select |
| **Unit** | read-only, suy từ Supply (`selectedSupply.unit`), có `<input hidden>` submit kèm | OK (đã suy) — chỉ tốn 1 ô hiển thị |
| `requested_total_set_quantity` / `quantity_requested` (stack) | tự tính từ `set_per_qty × số chồng`, hiển thị "Tổng SET" read-only | OK (đã tự tính) |
| Ghi chú / Ghi chú dòng | optional, không đánh dấu rõ optional | nhẹ |

**Nhãn kỹ thuật lộ ra:** "DRAFT", "PENDING", mô tả drawer *"Hệ thống tạo DRAFT trước, sau đó submit sang PENDING bằng hai bước backend hiện có"* — **lộ chi tiết triển khai** cho người dùng kho, tăng tải nhận thức mà không có giá trị vận hành. Nên: *"Gửi Order cho ca này"*.

**Số ô nhìn thấy / dòng item (normal):** Vật tư, Provider, Unit(ro), Số lượng, Ghi chú dòng, nút Xóa = ~5 control. Chấp nhận được. Stack: +SET/chồng, +Số chồng, +Tổng SET(ro) = ~8 → hơi nặng trên 1 dòng grid.

---

## L. KEYBOARD / TOUCH UX

| | Nhận định |
|---|---|
| **Desktop keyboard** | Tab đi qua: search Supply → Supply select → Provider select → (stack: SET → số chồng) → số lượng → ghi chú → Xóa → Thêm dòng → footer. **Không có**: Enter để nhảy field hợp lý, Ctrl+Enter để submit, phím tắt "Thêm dòng", auto-focus vào Supply của dòng mới sau "Thêm dòng". `<select>` native có gõ-để-lọc của trình duyệt (chỉ theo ký tự đầu) — không mạnh bằng combobox. |
| **Tablet** | `<select>` native mở picker OS (ổn). Drawer `lg` ≈ đủ. Bàn phím ảo che field khi gõ số chồng/ghi chú → phải cuộn. Touch target nút "Xóa"/"Thêm dòng" cỡ `TextErrorButton`/`SecondaryButton` — hơi nhỏ cho ngón tay. |
| **Mobile** | Drawer full-width (`Offcanvas` `w-screen`). `<select>` native = tốt trên mobile. Nhưng: nhiều field dọc + bàn phím ảo + grid `sm:grid-cols-2` gập lại 1 cột → cuộn nhiều; footer sticky (tốt). Search Supply + select là 2 lần chạm + 1 lần chờ. **KPI 30–60s khó đạt trên mobile cho case thường.** |

---

## M. COLD vs WARM

| | Cold (Order đầu tiên sau khi vào trang Sheet) | Warm (Order thứ 2+ cùng phiên) |
|---|---|---|
| Chunk `CreateOrderForm-*.js` | có thể tải (5.17 kB gzip) — `SOURCE-INFERRED`: Vite thường `modulepreload` cùng chunk trang nên gần như 0 | đã có |
| GET /supplies (pageSize 20) | ~0.2–0.6s | cache (`staleTime` 5′) |
| GET /areas (pageSize 100) | ~0.2–0.6s | cache (15′) |
| GET providers cho supply | ~0.2–0.5s | cache 30′ nếu cùng supply; supply khác → fetch |
| GET stack-options | ~0.1–0.4s | `staleTime` chỉ 15s → **thường fetch lại** |
| create / submit RPC | plan lạnh, chậm hơn chút | ấm |
| **Chênh lệch tổng** | **+3–8s** so với warm | baseline |

⇒ Khuyến nghị **prefetch supplies + areas** khi vào trang Sheet (mục P/Q) để triệt tiêu phần lớn phần "cold".

---

## N. MÔ HÌNH KPI 30–60s

| Loại | Thời gian khả dĩ (warm, trained, no error) | Trong KPI? |
|---|---|---|
| **Normal Order, 1 item** | **~14–28s** | ✅ Có (còn dư địa 1 lần sửa) |
| **Normal Order, 1 item, cold** | ~22–40s | ⚠️ Sát |
| **KIEN_SAT_TC, 1 item** | **~32–70s** | ❌ Thường vượt |
| **Order 3 item (normal)** | **~55–110s** | ❌ Vượt |
| **Bất kỳ loại nào + zero-stock ở submit** | + 20–40s làm lại | ❌ |

---

## O. XẾP HẠNG NÚT THẮT (giây mất đi, cho Order thường)

| # | Nút thắt | Giây mất (ESTIMATED) | Bằng chứng | Mức |
|---|---|---|---|---|
| 1 | **Định danh + chọn Supply**: ô search rời + `<select>` native rời, không combobox, không "gần đây/hay dùng"; server `code.ilike.*term*` seq scan | **5–12s** | `CreateOrderForm.tsx` (input search + `<select>` tách rời); `supplies.service.ts:187` leading wildcard | **Cao** |
| 2 | **Đường Submit backend**: 3× `findOrder` (select lồng lớn) + fan-out thông báo 3 full-scan **trên response path** | **0.9–2.8s**, tăng theo #user | `orders.service.ts` `submit`/`finishStatusTransition`; `authorization.service.ts` `getActiveAuthorizationContexts` | **Cao** |
| 3 | **Provider chọn tay khi chỉ 1 option** | **2–4s** | `SupplyProviderSelect.tsx` (không auto-select) | Trung bình |
| 4 | **Zero-stock lộ ở Submit** (không có chỉ báo tồn ở form normal) | 0s happy / **+20–40s** khi fail | `submit_order_to_pending` `ORDER_ITEM_ZERO_STOCK`; form normal không gọi query tồn | **Cao (đuôi)** |
| 5 | **create API** (POST /orders): ~10 read lồng + RPC + `findOrder` | **0.4–1.4s** | `orders.service.ts` `create` | Trung bình |
| 6 | **Nhận diện context + review** (drawer lặp thông tin Sheet, nhãn kỹ thuật DRAFT/PENDING) | **3–6s** | `CreateOrderForm` block "Phiếu Order Ca"; description drawer | Trung bình |
| 7 | **Refetch Sheet chặn đóng drawer** (`await Promise.allSettled`) | **0.3–1s** | `ShiftOrderSheetDetailPage.tsx:81-90` | Thấp–TB |
| 8 | **Cold lookups** (supplies + areas khi mở drawer lần đầu) | 0 warm / **2–4s cold** | `useServerLookup`/`useCrudResource` không prefetch | Thấp–TB |
| 9 | **Refetch Sheet trùng** (handleSuccess + SSE ~1.5s) | ~0.3s CPU/mạng thừa | `useSupplyRealtime` `invalidateSupplyViews` | Thấp |
| 10 | **Animation Offcanvas** mở+đóng | **~0.44s** | `index.css:74,82` 240/200ms | **Rất thấp — KHÔNG tối ưu** |

---

## P. KHUYẾN NGHỊ P0 (bắt buộc để đạt KPI ổn định, gồm cả stack/multi-item lác đác)

### P0-1 — Supply combobox typeahead (gộp ô search + select làm một)
- **Vấn đề:** 2 widget rời (input search → `<select>`), người dùng phải gõ ở chỗ này rồi chọn ở chỗ khác; không thấy quá 20 kết quả; không keyboard-first.
- **Khuyến nghị:** 1 combobox: gõ → gọi `listSupplies({search})` (đã có), hiện `code — short_text (category)`, ↑/↓ + Enter chọn; giữ debounce ~250–300ms. Có thể tái dùng pattern ARIA của `MultiSelect` hiện có.
- **Tiết kiệm:** ~3–8s/Order. **Độ khó:** Trung bình. **Rủi ro:** thấp (chỉ FE). **Business:** không đổi (vẫn submit `supply_id`).

### P0-2 — Auto-select Provider khi Supply chỉ có 1 Provider active
- **Vấn đề:** `SupplyProviderSelect` luôn bắt chọn tay.
- **Khuyến nghị:** khi `getSupplyProviders(supplyId)` trả đúng 1 phần tử → `onChange(provider.id)` tự động, vẫn để field hiển thị + cho đổi. Backend vẫn validate (`normalize_order_item_request`).
- **Tiết kiệm:** ~2–4s/Order (đa số Supply 1 Provider). **Độ khó:** Thấp. **Rủi ro:** thấp. **Business:** không đổi.

### P0-3 — Chỉ báo tồn kho **trước** khi Submit (mọi loại item)
- **Vấn đề:** với Supply thường, form không có bất kỳ tín hiệu tồn nào; zero-stock chỉ nổ ở Submit.
- **Khuyến nghị:** thêm một probe tồn khả dụng theo `(supply_id, provider_id, from_area_id[, set_per_qty])`, debounce + hủy được, chạy khi dòng đủ thông tin; hiển thị "Tồn: X / Thiếu Y" (tái dùng `StockAvailabilityWarning` vốn đã tồn tại cho OrderDetailPage). Backend đã có `attachStockAvailability` (chỉ chạy sau khi tạo) và `get_supply_stack_options` (stack) — cần thêm 1 endpoint tồn "normal" tương đương hoặc mở rộng stack-options.
- **Tiết kiệm:** loại bỏ ~20–40s làm lại khi zero-stock; tần suất cao ở kho. **Độ khó:** Trung bình (cần 1 endpoint đọc). **Rủi ro:** thấp — **không thay** validate quyền lực ở `submit_order_to_pending` (vẫn là nguồn chân lý), đây chỉ là gợi ý sớm.

### P0-4 — Không chặn đóng drawer bằng refetch Sheet
- **Vấn đề:** `handleCreateSuccess` `await Promise.allSettled([... invalidate + refetch Sheet ...])` rồi mới `closePrimary()`.
- **Khuyến nghị:** gọi `closePrimary()` ngay khi có 200 từ submit; để `invalidateQueries` chạy nền (SSE cũng sẽ refresh Sheet ~1.5s sau). Hiện toast "Order đã gửi" ngay.
- **Tiết kiệm:** ~0.3–1s + cảm giác "xong ngay". **Độ khó:** Thấp. **Rủi ro:** rất thấp.

---

## Q. KHUYẾN NGHỊ P1

### P1-1 — Prefetch `supplies` (trang 1) + `areas` khi vào trang Sheet detail
`queryClient.prefetchQuery` trong `ShiftOrderSheetDetailPage` (hoặc `onMouseEnter`/`onFocus` nút "Tạo thêm Order"). **SAFE PREFETCH** (bán tĩnh). **KHÔNG prefetch** tồn/stack-options (biến động). Tiết kiệm ~2–4s ở Order cold.

### P1-2 — Giảm tải đường Submit
- Bỏ `findOrder` lần 2 & 3: `submit` handler có thể dùng lại `order` từ bước trước; `finishStatusTransition` không cần `findOrder` lại để so `status_id` — có thể lấy từ kết quả RPC.
- **Đưa `persistOrderTransition` ra khỏi response path** (fire-and-forget). Nó đã bắt lỗi post-commit; hiện đang `await` trong `finishStatusTransition`. Kèm thay `getActiveAuthorizationContexts` (3 full-scan) bằng truy vấn "user có quyền đọc order ở area X" có điều kiện + cache ngắn.
- **Tiết kiệm:** ~0.5–2s/Submit và **ổn định theo quy mô**. **Độ khó:** Trung bình. **Rủi ro:** cần rà tính nhất quán thông báo (đã là post-commit nên an toàn).

### P1-3 — Keyboard-first trong form
- `Enter` trong field cuối 1 dòng → focus Supply dòng mới (hoặc "Thêm dòng" nếu là dòng cuối).
- `Ctrl+Enter` → submit form.
- Sau "Thêm dòng" → auto-focus Supply dòng mới (hiện không).
- **Tiết kiệm:** ~2–5s cho multi-item. **Độ khó:** Thấp–TB. **Rủi ro:** thấp (đừng bắt phím khi đang mở `<select>`).

### P1-4 — (Có điều kiện) Gộp create+submit thành 1 endpoint cho luồng shift-sheet
- Chỉ khi **đo được** round-trip thứ 2 tốn > ~300–500ms thực tế **và** giữ nguyên toàn bộ validate (`normalize_order_item_request` + zero-stock + sheet context) trong 1 RPC/transaction.
- Lợi: bỏ 1 round-trip chặn **và** xoá hẳn nhánh lỗi `DraftSubmitError` ("DRAFT tạo rồi nhưng chưa submit") — nhánh này tồn tại **chỉ vì** 2 HTTP không transaction.
- **Rủi ro:** trung bình (đụng backend + nghĩa vụ nhất quán). Không làm nếu chỉ vì "đẹp".

### P1-5 — Dedupe refetch Sheet sau submit
Sau `handleCreateSuccess` đã invalidate Sheet, SSE ~1.5s sau lại invalidate. Cho `invalidateSupplyViews` bỏ qua nếu vừa invalidate < ~2s (timestamp), hoặc dựa vào `dataUpdatedAt`.

---

## R. KHUYẾN NGHỊ P2

- **Recent / Frequently-used Supplies theo user** — tác động lớn hơn mọi tối ưu animation, nhưng **cần telemetry usage** (chưa có). Ghi nhận là hướng tương lai.
- **"Nhân bản Order trước" / template** cho các ca lặp lại cùng danh mục — có thể là đòn bẩy tốc độ lớn nhất cho multi-item.
- **Drawer width:** desktop giữ `lg` (640) — hợp. Tablet cân nhắc `full`. Mobile đã full.
- **Trigram/GIN index** `supplies(code, short_text)` khi catalog > ~5.000 (hiện `ilike` leading-wildcard seq scan).
- **Virtualize** danh sách option Supply nếu chuyển sang combobox trả > vài trăm dòng.
- **Cache `order_statuses`/permission in-memory** ở backend (đã nêu ở AUDIT_REPORT) — giảm nền cho mọi request.
- **Nhãn UI:** "Gửi Order" thay vì mô tả "tạo DRAFT rồi submit PENDING bằng hai bước backend".

---

## S. CẢI TIẾN QUANH OFFCANVAS (giữ Offcanvas)

| Khía cạnh | Khuyến nghị |
|---|---|
| **Width** | Desktop `lg` (640) — giữ. Tablet: `full`. Mobile: full (đang vậy). |
| **Animation** | Giữ 240/200ms. `prefers-reduced-motion` đã xử lý (`index.css:114`). Không đụng. |
| **Form layout** | Thu gọn block "Phiếu Order Ca" trong drawer thành 1 dòng chip (Area · Ca · Ngày) — tiết kiệm chiều dọc, giảm lặp với trang. |
| **Footer** | Đang tốt: sticky, `type=submit form=formId`, nhãn trạng thái ("Đang tạo Order..."/"Đang gửi Order..."). Thêm hint phím `Ctrl+Enter`. |
| **Focus** | `focusFirstElement` + `initialFocusRef` OK. Đảm bảo `initialFocusRef` trỏ vào combobox Supply (P0-1) chứ không phải ô search rời. |
| **Dropdown** | Chuyển Supply sang combobox trong luồng (P0-1). Provider auto-select (P0-2). |
| **Caching** | `staleTime`: Units/Categories/Areas dài (15–30′) — OK. Providers/supply 5–30′ — OK. Stack-options 15s — có thể nâng lên 30–60s (tồn kiện sắt đổi chậm hơn milkrun). Tồn "normal" (nếu thêm ở P0-3): 5–15s, luôn tươi khi mở lại. |
| **Prefetch** | P1-1: supplies + areas khi vào trang Sheet / hover nút. |
| **State pattern** | (Không ảnh hưởng tốc độ, nhưng nợ kỹ thuật) `renderCreateContent`/`renderCreateFooter` + `updatePrimary` trong `useEffect` nhiều deps là "render props qua state" — nếu tái cấu trúc offcanvas sau này, cho phép truyền thẳng element con thay vì đẩy vào context state. |

---

## T. KẾ HOẠCH TELEMETRY (đề xuất, **không** implement)

**KPI đo được:** `Order Creation Time` =
- **start:** người dùng click "+ Tạo thêm Order" (`drawer_opened_at`)
- **end:** backend xác nhận `PENDING` (HTTP 200 của `POST /orders/:id/submit`) (`order_pending_at`)

**Báo cáo:** `P50 / P90 / P95`, tách theo:
- `normal` · `KIEN_SAT_TC` · `multi-item` (≥2)

**Kèm:**
- `error_rate` (submit fail / tổng), `retry_rate` (số Order có ≥1 lần "Thử gửi lại"), `avg_item_count`, tỉ lệ `zero_stock_at_submit`.

**`performance.mark` gợi ý (nếu sau này duyệt):**
`drawer_open` → `form_ready` (lookups resolved) → `first_item_completed` → `submit_clicked` → `create_resolved` → `submit_resolved` → `drawer_closed`.
`performance.measure` giữa các mốc. Không cần vendor analytics — gửi kèm 1 endpoint log nội bộ hoặc `console` trong môi trường đo.

---

## U. FINAL ANSWERS

**1. Có đạt 30–60s không?**
- Order **thường, 1 item, cache ấm, không lỗi:** **LIKELY YES** (~14–28s).
- **Tổng thể (gồm cold, KIEN_SAT_TC, multi-item, lỗi zero-stock):** **BORDERLINE → LIKELY NO** nếu không làm P0.
- **Mobile:** LIKELY NO cho case thường.
- Với **P0-1..P0-4**: normal + cold + KIEN_SAT_TC 1-item vào vùng an toàn; multi-item 3 dòng vẫn ~45–75s (cần P2 template).

**2. Offcanvas có giúp không?** **CÓ — POSITIVE.** Bỏ 3 route transition + 1 click submit, giữ ngữ cảnh & cache, ẩn latency. Chi phí animation không đáng kể. **Giữ Offcanvas.**

**3. Nút thắt số 1?** **Chọn Supply** — ô search rời + `<select>` native rời (không combobox, không "gần đây"), cộng server search seq scan. ~5–12s/Order.

**4. Tối ưu trước tiên?**
1. P0-1 Supply combobox typeahead.
2. P0-2 auto-select Provider khi chỉ 1 option.
3. P0-3 chỉ báo tồn trước Submit (chặn làm-lại 20–40s).
4. P0-4 đừng chặn đóng drawer bằng refetch.
5. P1-2 bỏ 2× `findOrder` thừa + đẩy fan-out thông báo ra khỏi response path.

**5. KHÔNG nên tối ưu (tác động quá nhỏ):**
- Thời lượng animation Offcanvas (~0.44s) — giữ nguyên.
- Micro-memo hoá `CreateOrderForm`/bảng Orders cho case 1–3 item (không phải hotspot; chỉ xét khi ≥8 item).
- Kích thước bundle của form (5 kB gzip, và gần như đã preload cùng chunk trang).
- Gộp create+submit thành 1 RPC **chỉ để nhanh hơn** — chỉ làm nếu đo được round-trip 2 tốn đáng kể *và* giữ trọn validate (P1-4, có điều kiện).

---

*Hết. Không có thay đổi code nào được thực hiện trong quá trình review này.*
