# Voicecord

<details open>
<summary><b>English</b></summary>

## Node.js Edition

Voicecord is a lightweight, resource-optimized Node.js script designed to maintain a persistent connection to a Discord voice channel.

Unlike standard bot implementations, this daemon is engineered for high-population environments (servers with 100,000+ members). It employs a minimalist architecture with aggressive memory management, ensuring the process remains stable on low-spec hardware.

---

### Technical Specifications

- **Minimalist Client:** Initializes Discord client with `patchVoice: true` and `checkUpdate: false` for a lean footprint.
- **Keep-Alive Mechanism:** Streams continuous silent Opus frames (`0xf8, 0xff, 0xfe`) to prevent the "Assume Active" timeout.
- **Fault Tolerance:**
  - Implements race-condition recovery (Signalling vs Connecting) with 5s timeout.
  - Includes Watchdog routine (60s interval) to enforce channel presence.
  - Exponential backoff retry (1s → 60s max).
- **Zero-Dependency Setup:** Includes an interactive CLI wizard for generating the `.env` configuration file.

---

### Requirements

- **Node.js:** v16.9.0 or newer.
- **Network:** Stable internet connection (UDP output allowed).

---

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/Mikofoxie/Voicecord.git
   cd Voicecord
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

---

### Configuration

The application requires environment variables to function.

#### Option 1: Interactive Setup

Run the script directly. It will detect missing configurations and prompt you for input via the CLI.

```bash
npm start
```

#### Option 2: Manual Configuration

Create a `.env` file in the root directory:

```env
TOKEN=your_user_token
GUILD_ID=target_server_id
CHANNEL_ID=target_voice_channel_id
```

---

### Usage

#### Development

To run the daemon in the current session:

```bash
npm start
```

or

```bash
node index.js
```

#### Production (Background Service)

For 24/7 operation, using a process manager like PM2 is recommended to handle auto-restarts and logging.

```bash
npm install pm2 -g
pm2 start index.js --name "voicecord"
pm2 save
pm2 startup
```

---

### Architecture Notes

The daemon operates on a single-threaded event loop.

1. **Initialization:** Loads environment variables and initializes the Discord client with `patchVoice: true`.
2. **Connection:** Establishes a voice connection with `selfMute: true` and `selfDeaf: false`.
3. **Stream:** Creates a readable stream pushing silence frames via `AudioPlayer`.
4. **Recovery:** If the `VoiceConnectionStatus` transitions to `Disconnected`, the system attempts a race-condition recovery (Signalling vs Connecting, 5s timeout) before initiating exponential backoff retry.

---

### Disclaimer

This software automates a user account ("selfbotting"), which is against the Discord Terms of Service. This tool is provided for educational and research purposes only. The author assumes no responsibility for any account suspensions or bans resulting from its use.

</details>

<details>
<summary><b>Tiếng Việt</b></summary>

## Phiên bản Node.js

Voicecord là một script Node.js nhẹ, được tối ưu tài nguyên, thiết kế để duy trì kết nối liên tục tới kênh thoại Discord.

Khác với các triển khai bot thông thường, daemon này được thiết kế cho môi trường đông đúc (máy chủ có hơn 100,000 thành viên). Nó sử dụng kiến trúc tối giản với quản lý bộ nhớ quyết liệt, đảm bảo tiến trình hoạt động ổn định trên phần cứng cấu hình thấp.

---

### Thông số Kỹ thuật

- **Client Tối giản:** Khởi tạo Discord client với `patchVoice: true` và `checkUpdate: false` để giữ footprint nhẹ nhàng.
- **Cơ chế Keep-Alive:** Stream liên tục các khung im lặng Opus (`0xf8, 0xff, 0xfe`) để ngăn timeout "Assume Active".
- **Khả năng Chịu lỗi:**
  - Triển khai khôi phục race-condition (Signalling vs Connecting) với timeout 5 giây.
  - Bao gồm Watchdog routine (khoảng cách 60 giây) để đảm bảo sự hiện diện trong kênh.
  - Exponential backoff retry (1 giây → tối đa 60 giây).
- **Thiết lập Không Phụ thuộc:** Bao gồm trình hướng dẫn CLI tương tác để tạo file cấu hình `.env`.

---

### Yêu cầu

- **Node.js:** v16.9.0 hoặc mới hơn.
- **Mạng:** Kết nối internet ổn định (cho phép đầu ra UDP).

---

### Cài đặt

1. Clone repository:

   ```bash
   git clone https://github.com/Mikofoxie/Voicecord.git
   cd Voicecord
   ```

2. Cài đặt các dependency:

   ```bash
   npm install
   ```

---

### Cấu hình

Ứng dụng yêu cầu các biến môi trường để hoạt động.

#### Lựa chọn 1: Thiết lập Tương tác

Chạy script trực tiếp. Nó sẽ phát hiện các cấu hình thiếu và yêu cầu bạn nhập thông tin qua CLI.

```bash
npm start
```

#### Lựa chọn 2: Cấu hình Thủ công

Tạo file `.env` trong thư mục gốc:

```env
TOKEN=your_user_token
GUILD_ID=target_server_id
CHANNEL_ID=target_voice_channel_id
```

---

### Sử dụng

#### Phát triển

Để chạy daemon trong phiên hiện tại:

```bash
npm start
```

hoặc

```bash
node index.js
```

#### Production (Dịch vụ Nền)

Để vận hành 24/7, khuyến nghị sử dụng trình quản lý tiến trình như PM2 để xử lý tự động khởi động lại và ghi log.

```bash
npm install pm2 -g
pm2 start index.js --name "voicecord"
pm2 save
pm2 startup
```

---

### Ghi chú Kiến trúc

Daemon hoạt động trên vòng lặp sự kiện đơn luồng.

1. **Khởi tạo:** Tải các biến môi trường và khởi tạo Discord client với `patchVoice: true`.
2. **Kết nối:** Thiết lập kết nối thoại với `selfMute: true` và `selfDeaf: false`.
3. **Luồng:** Tạo readable stream đẩy các khung im lặng qua `AudioPlayer`.
4. **Khôi phục:** Nếu `VoiceConnectionStatus` chuyển sang `Disconnected`, hệ thống cố gắng khôi phục race-condition (Signalling vs Connecting, timeout 5 giây) trước khi bắt đầu exponential backoff retry.

---

### Tuyên bố Miễn trừ Trách nhiệm

Phần mềm này tự động hóa tài khoản người dùng ("selfbotting"), điều này vi phạm Điều khoản Dịch vụ của Discord. Công cụ này được cung cấp chỉ cho mục đích giáo dục và nghiên cứu. Tác giả không chịu trách nhiệm cho bất kỳ việc đình chỉ hoặc cấm tài khoản nào do sử dụng nó.

</details>
