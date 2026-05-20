# MVP Realtime Shift Attendance Platform

Hệ thống quản lý ca làm và điểm danh realtime.

## 🚀 Setup & Installation

### 1. Khởi động Infrastructure (Database, Redis)
Yêu cầu: Đã cài đặt [Docker](https://www.docker.com/).
```bash
docker-compose up -d
```

### 2. Cài đặt và khởi chạy Backend (NestJS)
```bash
cd apps/backend
npm install
# Khởi tạo Database (Prisma)
npx prisma generate
npx prisma db push
# Hoặc npx prisma migrate dev --name init

# Chạy Backend (Port: 3000)
npm run start:dev
```

### 3. Cài đặt và khởi chạy Frontend (NextJS)
```bash
cd apps/frontend
npm install
# Chạy Frontend (Port: 3001)
npm run dev
```

## 📚 Môi trường (.env)
Bạn cần cập nhật `TELEGRAM_BOT_TOKEN` trong file `.env` root và `.env` của backend (nếu cần thiết) bằng token sinh từ @BotFather trên Telegram.

## 🏗️ Công nghệ
- **Backend**: NestJS, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO, Telegraf.
- **Frontend**: NextJS (App Router), TailwindCSS, shadcn/ui, Zustand, Socket.IO Client.
