# Voicecord

<details open>
<summary><b>English</b></summary>

## Node.js Edition
A lightweight Node.js daemon designed to keep a Discord account connected to a Voice Channel 24/7 (Selfbot). No bloatware, strictly focused on maintaining connection states

---

### Core Mechanics

- **AFK Bypass:** Streams empty Opus packets (0xf8, 0xff, 0xfe) to trick the server into keeping the connection alive
- **State Recovery:** Handles Signalling vs Connecting race conditions with a hard 5-second timeout
- **Auto-Reconnect:** Implements exponential backoff (1s to 90s max) to prevent API rate limits during network drops
- **Setup Prompt:** Built-in CLI wizard to generate the .env config file automatically

---

### Requirements

- **Node.js:** v16.9.0+

---

### Deployment

1. Clone & Install:

   ```bash
    git clone https://github.com/Mikofoxie/Voicecord.git
    cd Voicecord
    npm install
   ```

2. Run (Interactive CLI will guide you if .env is missing):

   ```bash
    npm start
   ```
   
3. Production (Using PM2):

   ```bash
    npm install pm2 -g
    pm2 start index.js --name "voicecord"
    pm2 save
    pm2 startup
   ```
  
---

### Warning
This is a Selfbot script. Automating user accounts violates Discord's Terms of Service. If your account gets banned, that is on you. Use for research only.

</details>

<details>
<summary><b>Vietnamese</b></summary>

## Phiên bản Node.js

Script Node.js chạy ngầm (daemon) dùng để treo account Discord trong Voice Channel 24/7. Không nhét ba cái tính năng thừa thãi, chỉ tập trung vào việc giữ connection state.

---

### Cơ chế hoạt động

- **Bypass AFK:** Liên tục bắn các packet Opus rỗng (0xf8, 0xff, 0xfe) để đánh lừa server, ép nó giữ kết nối
- **Xử lý kẹt State** Bắt cứng timeout 5s cho các pha lỗi Race Condition khi kẹt giữa state Signalling và Connecting
- **Auto-Reconnect:** Dùng thuật toán Exponential backoff (delay tăng dần từ 1s đến max 90s) để gọi lại kết nối khi rớt mạng, tránh bị dính Rate Limit từ Discord API
- **Setup Prompt:** Có sẵn script CLI để tự động sinh file `.env` nếu chưa có

---

### Yêu cầu hệ thống

- **Node.js:** v16.9.0+

---

### Cài đặt

1. Clone repository:

   ```bash
    git clone https://github.com/Mikofoxie/Voicecord.git
    cd Voicecord
    npm install
   ```

2. Chạy script (CLI sẽ tự hỏi config nếu chưa có file .env):

   ```bash
    npm start
   ```
   
3. Chạy Production (Dùng PM2 để auto-restart):

   ```bash
    npm install pm2 -g
    pm2 start index.js --name "voicecord"
    pm2 save
    pm2 startup
   ```

---

### Cảnh báo bảo mật

Chạy Selfbot là vi phạm trực tiếp ToS của Discord. Tự chịu trách nhiệm nếu account bị ban. Script này chỉ phục vụ mục đích test/research

</details>
