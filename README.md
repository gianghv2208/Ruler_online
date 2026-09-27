# Thuocdo Clone

Trang web FE tĩnh clone giao diện/thao tác của https://thuocdo.mamachoice.vn/

## Production

Ứng dụng chỉ gồm static files, không cần Python/Node/backend/runtime server-side.

Deploy folder này lên bất kỳ static web server nào:

```text
C:\SourceCode\thuocdo-clone
├── index.html
├── styles.css
└── app.js
```

Ví dụ Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/thuocdo-clone;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(css|js|png|jpg|jpeg|gif|svg|ico|webp)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }
}
```

## Preview local

Có thể mở trực tiếp:

```text
C:\SourceCode\thuocdo-clone\index.html
```

Nếu muốn preview qua HTTP local thì dùng bất kỳ static server nào. Python chỉ là lựa chọn tạm để preview, không phải dependency production.

## Tính năng

- Header giống trang gốc
- Tab Thước thẳng với vạch mm/cm
- Tab Thước đo với 2 thanh kẹp kéo lên/xuống
- Tự tính đường kính mm (đo khoảng hở giữa 2 mép trong của vạch) và gợi ý size phễu +2mm đến +4mm
- Tự nhận diện dòng máy và bù zoom pinch, không cần người dùng tự hiệu chỉnh
- Tab Hướng dẫn
- Responsive mobile-first, hỗ trợ màn hình nhỏ/ngắn và desktop

## Kiến trúc nhận diện thiết bị (`app.js`)

```
Browser (UA / UA-CH / screen.width,height / devicePixelRatio)
        │
        ▼
Device Detection (detectDevice)
        │
        ▼
Device Database (IPHONE_PPI_DB, SAMSUNG_PPI_DB, PIXEL_PPI_DB, XIAOMI_PPI_DB, IPAD_*)
        │
        ▼
Physical PPI (PPI vật lý công bố của model)
        │  chia cho devicePixelRatio
        ▼
CSS px / physical mm (pixelsPerMm)
        │
        ▼
Online Ruler (Thước thẳng + Thước đo)
```

Độ chính xác theo 3 tầng, hiển thị ngay trên header:
1. **Model chính xác** - iPhone/iPad (qua screen+dpr), Samsung (mã `SM-xxxx` qua UA-CH), Pixel (tên UA-CH). Sai số &lt;1%.
2. **Chỉ biết hãng** - dùng PPI trung bình của hãng (Xiaomi, OPPO, vivo, realme...). Sai số ước tính 3-5%.
3. **Không nhận diện được** - ước lượng chung theo loại thiết bị (điện thoại/máy tính). Sai số có thể &gt;5%.

Muốn thêm model cụ thể (đặc biệt Xiaomi/Redmi/POCO/OPPO/vivo hay trả mã nội bộ khó đoán như `23049PCD8G`), bổ sung một dòng vào bảng DB tương ứng trong `app.js` kèm PPI vật lý lấy từ thông số nhà sản xuất.
