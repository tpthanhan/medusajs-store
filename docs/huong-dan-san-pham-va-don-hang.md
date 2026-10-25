# Hướng dẫn tạo sản phẩm & quản lý đơn hàng thủ công (VND)

Tài liệu này mô tả toàn bộ quy trình trên **Medusa Admin** (`http://localhost:9000/app`) cho cửa hàng VND bán tại TP.HCM: tạo sản phẩm kèm giá nhập, lên đơn thủ công cho khách (không cần email), và hoàn tất đơn (thu tiền + giao hàng) đồng bộ với trạng thái gốc của Medusa.

> Tất cả tính năng dưới đây là **tùy biến riêng** của dự án, nằm cạnh màn hình Medusa gốc. Tiền tệ mặc định là **VND**, khu vực **Vietnam**, kho **Kho Q9** (TP.HCM).

---

## 1. Tạo sản phẩm (kèm giá nhập & giá bán)

**Đường vào:** Sidebar → **Products** → **Tạo SP với giá nhập** (`/app/import-pricing`).

### Các trường trên form

| Trường | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| Tên sản phẩm | ✅ | Tên hiển thị của sản phẩm |
| Biến thể (mỗi dòng) | ✅ ít nhất 1 | Mỗi dòng là 1 biến thể; nhập tên biến thể (vd: `S`, `M`, `Đỏ`) và SKU (tùy chọn) |
| Giá gốc | ⬜ | Giá nhập gốc mỗi đơn vị (VND). Thông tin nội bộ, không hiện cho khách |
| Giá ship về | ⬜ | Phí vận chuyển nhập hàng (VND). Nội bộ |
| Tổng giá đã nhập\* | ✅ (nếu dòng có nhập giá) | Tổng vốn đã nhập. Tự tính = Giá gốc + Giá ship về, **cho phép sửa tay** và giữ nguyên khi đổi input |
| Giá bán thị trường\* | ✅ (nếu dòng có nhập giá) | Giá bán VND hiển thị cho khách |

### Quy tắc quan trọng

| Tình huống | Hành vi |
| --- | --- |
| Biến thể **chưa cần định giá** | Để trống **tất cả** ô giá của dòng đó → bỏ qua, không lưu giá |
| Dòng có nhập **bất kỳ** ô giá nào | Bắt buộc có **Tổng giá đã nhập** và **Giá bán thị trường** |
| Nút tính lại tổng (↻) | Ghi đè Tổng giá đã nhập = Giá gốc + Giá ship về |
| Sửa tay Tổng giá đã nhập | Giữ nguyên dù đổi Giá gốc/Giá ship về (cho tới khi bấm tính lại) |
| Thêm biến thể | Bấm **+ Thêm biến thể** |

### Kết quả sau khi bấm "Tạo sản phẩm"

| Hạng mục | Giá trị |
| --- | --- |
| Trạng thái sản phẩm | **Published** (tự động, có thể lên đơn ngay) |
| Shipping profile | **Default Shipping Profile** (tự gán — bắt buộc để fulfillment chạy) |
| Giá bán | Lưu thành giá VND của biến thể |
| Giá nhập (gốc/ship/tổng) | Lưu riêng vào bảng `variant_import_price` (không public) |

### Nhập hàng loạt từ CSV

**Đường vào:** Sidebar → **Products** → **Nhập SP từ CSV** (`/app/import-pricing-csv`).

| Bước | Thao tác |
| --- | --- |
| 1 | Bấm **Tải mẫu CSV** để lấy file mẫu (hoặc dùng `docs/templates/import-pricing-template.csv`) |
| 2 | Điền dữ liệu: **mỗi dòng = 1 biến thể**; các dòng cùng `product_title` gộp thành 1 sản phẩm |
| 3 | Chọn file CSV → xem số sản phẩm/biến thể và lỗi (nếu có) |
| 4 | Bấm **Nhập N sản phẩm** → tạo sản phẩm (published + shipping profile mặc định) kèm giá nhập |

**Cột CSV:**

| Cột | Bắt buộc | Ý nghĩa |
| --- | --- | --- |
| `product_title` | ✅ | Tên sản phẩm (gộp nhiều dòng) |
| `variant_title` | ⬜\* | Tên biến thể. Bắt buộc **khi SP không có cột option**; nếu có option sẽ tự ghép từ giá trị option |
| `sku` | ⬜ | Mã SKU |
| `option:<Tên>` | ⬜ | Cột option động để tạo SP nhiều thuộc tính. Ví dụ `option:Size`, `option:Màu` |
| `original_price` | ⬜ | Giá gốc (VND) |
| `import_shipping_price` | ⬜ | Giá ship về (VND) |
| `imported_total_price` | ⬜ | Tổng giá đã nhập — bỏ trống sẽ tự tính = gốc + ship; điền tay = ghi đè |
| `market_price` | ✅ | Giá bán thị trường (VND) |

**Sản phẩm nhiều option (Size × Màu):** thêm các cột `option:Size`, `option:Màu`… Mỗi dòng là **một tổ hợp** (vd `S, Đỏ`). Hệ thống tự suy ra danh sách option và giá trị cho từng sản phẩm.

| product_title | option:Size | option:Màu | market_price |
| --- | --- | --- | --- |
| Áo thun | S | Đỏ | 150000 |
| Áo thun | S | Xanh | 150000 |
| Áo thun | M | Đỏ | 160000 |

| Quy tắc option | Chi tiết |
| --- | --- |
| Mỗi SP tự có bộ option riêng | SP khác nhau trong cùng file có thể dùng bộ option khác nhau (vd SP này Size+Màu, SP kia chỉ Size) |
| Nhất quán trong 1 SP | Mọi dòng của cùng một SP phải điền đúng cùng bộ cột option, nếu không sẽ báo lỗi |
| Không có cột option nào | Rơi về một option mặc định tên `Variant`, dùng `variant_title` |
| Biến thể trùng | Trùng tổ hợp giá trị option (hoặc trùng `variant_title`) trong cùng SP sẽ báo lỗi |

> Chỉ dòng có **ít nhất một cột giá nhập** mới lưu bản ghi giá nhập riêng. Mỗi sản phẩm được tạo độc lập: một sản phẩm lỗi không chặn các sản phẩm còn lại (kết quả hiện số tạo được / thất bại).

### Sửa giá sản phẩm đã có

- **Trang biến thể**: mở sản phẩm → chọn biến thể → có **khối nhập giá inline** (Giá gốc, Giá ship về, Tổng giá đã nhập, Giá bán). Sửa và lưu tại chỗ, đồng bộ cả giá VND cơ bản lẫn giá vùng Vietnam.
- **Màn hình editor riêng**: từ widget trên trang sản phẩm/biến thể có link mở lại editor giá nhập; editor này cho **lưu từng biến thể** (không bắt nhập giá cho mọi dòng).

> ⚠️ Nếu biến thể bật **quản lý tồn kho** (`manage_inventory`), phải có tồn tại **Kho Q9** trước khi lên đơn. Chạy `npx medusa exec ./src/scripts/setup-vietnam-fulfillment.ts` (idempotent) để backfill mức tồn kho cho các item mới, hoặc nhập tồn thủ công ở mục **Inventory**.

---

## 2. Tạo đơn hàng thủ công

**Đường vào:** Sidebar → **Orders** → **Tạo đơn hàng thủ công** (`/app/manual-orders`).

Dùng khi nhân viên nhập đơn thay khách. Khách **không cần email** — chỉ cần tên, địa chỉ, số điện thoại.

### Các trường trên form

| Trường | Bắt buộc | Ghi chú |
| --- | --- | --- |
| Tên khách hàng | ✅ | Lưu vào địa chỉ giao hàng |
| Địa chỉ | ✅ | Địa chỉ giao hàng |
| Số điện thoại | ✅ | SĐT khách |
| Khu vực sử dụng VND | ✅ | Chọn **Vietnam** |
| Sản phẩm | ✅ ít nhất 1 biến thể | Bấm **Chọn sản phẩm** mở popup |
| Phí vận chuyển thủ công (VND) | ⬜ (mặc định 0) | Phí ship nhập tay, cộng vào tổng đơn |
| Tiền đặt cọc đã nhận (VND) | ⬜ (mặc định 0) | Số tiền đã nhận trước, ghi vào lịch sử thanh toán |

### Popup chọn sản phẩm

| Thao tác | Kết quả |
| --- | --- |
| Gõ ô tìm kiếm | Lọc sản phẩm theo tên (debounce) |
| **Thêm vào đơn** ở biến thể | Đưa biến thể vào danh sách đã chọn (không cho trùng) |
| Phân trang Trước / Tiếp | Duyệt thêm sản phẩm, vẫn giữ các biến thể đã chọn |
| **Xong** | Đóng popup, giữ nguyên lựa chọn |
| Chỉnh **Số lượng** / **Xóa** | Sửa trực tiếp trên danh sách đã chọn |

### Sau khi bấm "Tạo đơn hàng"

- Hệ thống tạo đơn với line item **yêu cầu giao hàng** (`requires_shipping: true`), gắn phương thức vận chuyển Việt Nam và **tạo reservation tồn kho tại Kho Q9** cho biến thể quản lý kho.
- Đơn được đánh dấu metadata `manual_vnd_order` để widget nhận diện.
- Tự chuyển sang trang chi tiết đơn vừa tạo.

| Công thức | Giá trị |
| --- | --- |
| Tổng đơn | (Giá bán × số lượng) + Phí vận chuyển |
| Còn phải thu ngay sau khi tạo | Tổng đơn − Tiền đặt cọc |

> ❗ Lỗi thường gặp: *"Variants ... do not exist or belong to a product that is not published"* → sản phẩm đang **nháp**. Sản phẩm tạo qua trang tùy biến đã tự Published; nếu tạo bằng màn hình Medusa gốc, nhớ Publish trước.

---

## 3. Hoàn tất đơn hàng (thu tiền + giao hàng)

Mở trang chi tiết đơn → cuộn tới widget **"Thanh toán đơn hàng thủ công (VND)"**.

### Thông tin hiển thị

| Mục | Ý nghĩa |
| --- | --- |
| Phí vận chuyển | Phí ship đã nhập (đã gồm trong tổng đơn) |
| Tổng đơn hàng | Tổng phải thu (đã gồm ship) |
| Tiền đặt cọc | Khoản nhận đầu tiên |
| Tổng đã nhận | Tổng mọi khoản đã ghi nhận |
| Còn phải thu | max(0, Tổng đơn − Tổng đã nhận) |
| Tiền thưởng (tip) | max(0, Tổng đã nhận − Tổng đơn) — phần khách trả dư |
| Lịch sử thanh toán | Danh sách khoản thu, kèm thời gian; khoản đầu gắn nhãn **(đặt cọc)** |

### Thu tiền

| Hành động | Kết quả |
| --- | --- |
| Nhập số tiền + **Ghi nhận thanh toán** | Thêm 1 khoản thu mới vào lịch sử |
| **Sửa** (một khoản thu sau) | Nhập lại số tiền → thay khoản cũ bằng khoản mới |
| **Xóa** (một khoản thu sau) | Xác nhận rồi xóa khoản đó |
| Khoản **(đặt cọc)** | **Không** cho sửa/xóa |
| **Đã thanh toán** | Ghi nốt số còn thiếu (nếu có) **và** đánh dấu payment collection là đã thu → **badge gốc "Captured"** |

> Nút "Đã thanh toán" chuyển thành **"Đã thanh toán đủ"** (vô hiệu) khi đã thu đủ và badge gốc đã là đã thu.

### Trạng thái giao hàng

Bốn nút chuyển trạng thái **chỉ tiến, không lùi**. Mỗi bước điều khiển fulfillment thật của Medusa:

| Nút (trạng thái) | Hành vi hệ thống | Badge Medusa gốc |
| --- | --- | --- |
| **Đã lên đơn** (`placed`) | Chưa có fulfillment | Not fulfilled |
| **Đang chờ giao** (`awaiting`) | Tạo fulfillment tại Kho Q9 | Fulfilled |
| **Đang giao** (`delivering`) | Tạo shipment (đánh dấu đã gửi) | Shipped |
| **Đã giao** (`delivered`) | Đánh dấu đã giao | Delivered |

| Quy tắc | Chi tiết |
| --- | --- |
| Không lùi trạng thái | Báo lỗi *"Không thể lùi trạng thái giao hàng"* |
| Nhảy bước (vd placed → delivered) | Tự tạo các bước trung gian (fulfillment → shipment) cho đúng máy trạng thái |
| Badge gốc tự cập nhật | Sau mỗi thao tác, cache admin được làm mới; **không cần reload** (reload sẽ mất phiên đăng nhập) |

---

## 4. Hạ tầng & tham chiếu nhanh

| Hạng mục | Giá trị |
| --- | --- |
| Tiền tệ mặc định | `vnd` |
| Khu vực | Vietnam — `reg_01M5S3V706PZ48WC2G0Q5P5KR7` |
| Kho (TP.HCM) | Kho Q9 — `sloc_01M5S3XVSM5KNXJGATE5J9BCQS` |
| Nhà cung cấp thanh toán | `pp_system_default` (hệ thống, không gọi ngoài) |
| Nhà cung cấp giao hàng | `manual_manual` (flat-rate) |
| Script thiết lập giao hàng VN (idempotent) | `npx medusa exec ./src/scripts/setup-vietnam-fulfillment.ts` |

### API endpoints (Admin)

| Method & path | Mục đích |
| --- | --- |
| `POST /admin/manual-orders` | Tạo đơn thủ công |
| `GET /admin/manual-orders/:id` | Lấy tóm tắt thanh toán + trạng thái giao |
| `POST /admin/manual-orders/:id/payments` | Ghi nhận khoản thu mới |
| `POST /admin/manual-orders/:id/payments/:payment_id` | Sửa khoản thu (trừ đặt cọc) |
| `DELETE /admin/manual-orders/:id/payments/:payment_id` | Xóa khoản thu (trừ đặt cọc) |
| `POST /admin/manual-orders/:id/mark-paid` | Đánh dấu đã thanh toán đủ (đồng bộ badge) |
| `POST /admin/manual-orders/:id/delivery-status` | Đổi trạng thái giao (driving fulfillment thật) |
| `GET /admin/variant-import-prices/:variant_id` | Đọc giá nhập riêng của biến thể |
| `POST /admin/variant-import-prices/:variant_id` | Lưu giá nhập riêng của biến thể |
| `POST /admin/import-pricing/import` | Nhập hàng loạt sản phẩm + giá nhập (body `{ products: [...] }`) |

### Hình dạng response tóm tắt đơn

```jsonc
{
  "order_id": "order_...",
  "currency_code": "vnd",
  "delivery_status": "placed | awaiting | delivering | delivered",
  "payment_captured": true,          // badge thanh toán gốc đã "Captured"?
  "total": 320000,                   // tổng đơn (gồm ship)
  "shipping": 20000,
  "deposit": 50000,
  "paid": 320000,                    // tổng đã nhận
  "remaining": 0,
  "tip": 0,
  "payments": [
    { "id": "...", "amount": 50000, "created_at": "...", "is_deposit": true },
    { "id": "...", "amount": 270000, "created_at": "...", "is_deposit": false }
  ]
}
```
