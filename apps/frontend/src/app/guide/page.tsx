'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  HelpCircle,
  Info,
  Laptop,
  MessageCircle,
  Server,
  Settings,
  Smartphone,
  UserCheck,
  Users,
} from 'lucide-react';

const adminSteps = [
  {
    icon: Users,
    title: '1. Quản lý nhân sự',
    items: [
      'Vào trang Nhân Sự để thêm user bằng username và họ tên.',
      'Có thể sửa thông tin, đổi vai trò STAFF/ADMIN và cập nhật Telegram ID nếu cần.',
      'Nút Link TG tạo QR/link Telegram cho từng nhân viên; link có thời hạn 10 phút.',
      'Sau khi nhân viên bấm Start trên Telegram, cột Telegram sẽ cập nhật trạng thái đã liên kết.',
    ],
  },
  {
    icon: Server,
    title: '2. Tạo server và khung giờ ca',
    items: [
      'Vào trang Phân Ca, tab Quản lý Server để tạo server mới (ô hiện tại chỉ nhập số server).',
      'Sang tab Quản lý Ca làm để tạo khung giờ cho một hoặc nhiều server cùng lúc. Mỗi ca làm sẽ gắn liền với một tuần cụ thể.',
      'Mỗi khung giờ gồm server, tên mô tả tùy chọn, tuần của ca làm và giờ bắt đầu ca.',
      'Xóa server hoặc ca làm sẽ ảnh hưởng đến lịch phân ca liên quan, cần kiểm tra trước khi xóa.',
    ],
  },
  {
    icon: Calendar,
    title: '3. Phân ca và Quản lý ca theo tuần',
    items: [
      'Bộ chọn ngày "Tuần phân ca" được đưa lên đầu trang, tự động áp dụng chung cho cả tab Phân Ca và Ca Làm.',
      'Khi chuyển sang tuần mới chưa có ca, một hộp thoại hiện lên giúp bạn chọn "Kế thừa ca trực" (copy khung giờ/server từ tuần trước và để trống nhân viên) hoặc "Bắt đầu tuần mới trống". Trạng thái bỏ qua modal sẽ tự động reset khi tải lại trang (F5).',
      'Bảng matrix hiện server/ca theo hàng và các ngày Thứ 2 đến Chủ nhật theo cột. Click vào ô giao nhau để phân nhân viên.',
      'Bạn có thể nhanh chóng sửa/xóa ca bằng cách DI CHUỘT (Hover) vào cột SERVER / CA LÀM và bấm nút sửa/xóa, hoặc CLICK CHUỘT PHẢI để mở menu ngữ cảnh tùy chọn.',
      'Modal chỉnh sửa ca làm việc cho phép thay đổi cả tên ca, giờ bắt đầu và chọn lại các Server game gộp/đơn lẻ.',
    ],
  },
  {
    icon: DollarSign,
    title: '4. Kiểm tra và cấu hình bảng lương',
    items: [
      'Trang Bảng Lương cho chọn khoảng ngày, xem tổng chi trả, số ca hoàn thành và lương trung bình.',
      'Nút Chi Tiết mở bảng lương từng ca của một nhân viên trong khoảng ngày đã chọn.',
      'Nút Xuất Báo Cáo tải file CSV tổng hợp bảng lương.',
      'Tab Cấu Hình Thù Lao dùng để đặt lương ca mặc định, các loại phụ cấp đêm và phụ cấp cuối tuần.',
      'Lương ca có thể cấu hình riêng cho từng server hoạt động chính thức (các ca gộp server tự động đã được lọc bỏ để tránh nhầm lẫn).',
    ],
  },
];

const staffSteps = [
  {
    title: '1. Đăng nhập màn hình nhân viên',
    items: [
      'Tài khoản STAFF sau khi đăng nhập sẽ vào trang Staff Dashboard.',
      'Menu của nhân viên hiện chỉ còn Lịch & Bảng Lương, không có menu Hướng Dẫn.',
      'Nhân viên không vào được các màn hình quản trị như Dashboard, Nhân Sự, Phân Ca, Bảng Lương tổng hợp.',
    ],
  },
  {
    title: '2. Xem lịch làm việc',
    items: [
      'Tab Lịch Làm Việc hiện lịch theo tháng và các dấu chấm màu trên ngày có ca.',
      'Chọn một ngày để xem server, giờ ca và trạng thái ca ở cột chi tiết bên phải.',
      'Trạng thái có thể là Lên lịch, Chờ xác nhận, Đã xác nhận, Hoàn thành, Chưa xác nhận hoặc Vắng mặt.',
      'Nếu ca sắp tới giờ nhắc, trạng thái sẽ chuyển sang Chờ xác nhận theo cấu hình thời gian trên Dashboard.',
    ],
  },
  {
    title: '3. Xác nhận ca qua Telegram',
    items: [
      'Nhân viên cần liên kết Telegram trước thì mới nhận được tin nhắc ca.',
      'Trước giờ vào ca, bot gửi tin nhắn kèm nút Tôi đã sẵn sàng.',
      'Nhân viên phải bấm nút này trước khi ca bắt đầu; nếu ca đã bắt đầu thì bot sẽ từ chối xác nhận.',
      'Khi bấm thành công, trạng thái ca trên web sẽ cập nhật thành Đã xác nhận/Sẵn sàng.',
    ],
  },
  {
    title: '4. Xem bảng lương cá nhân',
    items: [
      'Tab Bảng Lương cho chọn từ ngày đến ngày và xem tổng thực nhận cá nhân.',
      'Bảng lương hiện lương ca, phụ cấp đêm và phụ cấp cuối tuần.',
      'Chi tiết lương từng ca chỉ hiện các ca đã đủ điều kiện tính lương.',
      'Ca làm hôm nay sẽ được tính từ ngày hôm sau, nên nếu vừa làm xong trong ngày thì có thể chưa xuất hiện ở chi tiết lương.',
    ],
  },
];

const faqItems = [
  {
    label: 'Telegram',
    question: 'Nhân viên không nhận được tin nhắc ca?',
    answer:
      'Kiểm tra cột Telegram trong trang Nhân Sự. Nếu chưa liên kết, tạo lại QR/link Telegram và yêu cầu nhân viên bấm Start. Nếu đã liên kết mà vẫn không có tin, kiểm tra backend, Redis queue và cấu hình TELEGRAM_BOT_TOKEN.',
  },
  {
    label: 'Phân ca',
    question: 'Bảng matrix không thấy nhân viên trong ô ca?',
    answer:
      'Kiểm tra đã chọn đúng tuần hay chưa, bộ lọc server/nhân viên có đang bật không, và ô ca đó đã bấm Cập nhật ca trực sau khi chọn nhân viên hay chưa.',
  },
  {
    label: 'Bảng lương',
    question: 'Nhân viên làm hôm nay nhưng chưa thấy tính lương?',
    answer:
      'Hệ thống chỉ tính lương cho ca có ngày làm nhỏ hơn ngày hiện tại. Ca làm trong ngày hôm nay sẽ được đưa vào bảng lương từ ngày hôm sau.',
  },
  {
    label: 'Tài khoản',
    question: 'STAFF không vào được màn hình quản lý?',
    answer:
      'Đây là đúng thiết kế hiện tại. STAFF chỉ xem được Staff Dashboard gồm Lịch Làm Việc và Bảng Lương cá nhân. ADMIN/MANAGER mới vào được Dashboard, Nhân Sự, Phân Ca và Bảng Lương tổng hợp.',
  },
];

function StepList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex gap-2 text-sm text-slate-300">
          <ChevronRight className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<'admin' | 'staff' | 'faq'>('admin');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 sm:p-6 font-sans selection:bg-cyan-500/30">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-cyan-400" />
              Hướng dẫn sử dụng hệ thống
            </h1>
            <p className="text-slate-400 mt-1 text-sm">
              Cập nhật theo các màn hình hiện tại: Dashboard, Nhân Sự, Phân Ca, Bảng Lương và Staff Dashboard.
            </p>
          </div>
          <Badge className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 w-fit">
            ROK_SCHEDULE
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
          <Button
            onClick={() => setActiveTab('admin')}
            variant={activeTab === 'admin' ? 'default' : 'ghost'}
            className={`h-11 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 ${
              activeTab === 'admin'
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Laptop className="w-4 h-4" />
            Quản lý
          </Button>
          <Button
            onClick={() => setActiveTab('staff')}
            variant={activeTab === 'staff' ? 'default' : 'ghost'}
            className={`h-11 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 ${
              activeTab === 'staff'
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Nhân viên
          </Button>
          <Button
            onClick={() => setActiveTab('faq')}
            variant={activeTab === 'faq' ? 'default' : 'ghost'}
            className={`h-11 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 ${
              activeTab === 'faq'
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Lỗi thường gặp
          </Button>
        </div>

        {activeTab === 'admin' && (
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Tổng quan cho ADMIN / MANAGER
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-400">
                  <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Quản lý theo thứ tự khuyến nghị: tạo nhân sự, liên kết Telegram, tạo server, tạo khung giờ ca,
                    phân ca trên bảng tuần, sau đó kiểm tra bảng lương.
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Bell className="w-4 h-4 text-cyan-400" />
                      Dashboard vận hành
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Xem ca hiện tại, trạng thái sẵn sàng, cảnh báo realtime và cấu hình thời gian nhắc ca.
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      Cấu hình thời gian
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Thời điểm nhắc nhân viên và thời điểm cảnh báo admin được tính theo reminder + preparation.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {adminSteps.map((step) => {
                const Icon = step.icon;
                return (
                  <Card key={step.title} className="bg-slate-900 border-slate-800 text-slate-50">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-slate-200 flex items-center gap-2">
                        <Icon className="w-5 h-5 text-cyan-400" />
                        {step.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <StepList items={step.items} />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'staff' && (
          <div className="space-y-6">
            <Card className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader className="pb-3 border-b border-slate-800">
                <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Hướng dẫn cho nhân viên
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 p-3 text-sm text-cyan-400">
                  <MessageCircle className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Nhân viên xem lịch và bảng lương trên web, còn thao tác xác nhận sẵn sàng trước ca được thực
                    hiện qua Telegram Bot.
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {staffSteps.map((step, index) => (
                <Card key={step.title} className="bg-slate-900 border-slate-800 text-slate-50">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-slate-200 flex items-center gap-2">
                      {index === 0 && <UserCheck className="w-5 h-5 text-cyan-400" />}
                      {index === 1 && <Calendar className="w-5 h-5 text-cyan-400" />}
                      {index === 2 && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
                      {index === 3 && <DollarSign className="w-5 h-5 text-cyan-400" />}
                      {step.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <StepList items={step.items} />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="space-y-4">
            {faqItems.map((item) => (
              <Card key={item.question} className="bg-slate-900 border-slate-800 text-slate-50">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                    <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 w-fit">
                      {item.label}
                    </Badge>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        {item.question}
                      </div>
                      <p className="text-sm text-slate-400 leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-slate-900 border-slate-800 text-slate-50">
              <CardContent className="p-4 text-sm text-slate-400 flex items-start gap-2">
                <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>
                  Lưu ý quan trọng về bảng lương: hệ thống tính lương cho ca đã qua ngày làm. Vì vậy ca hôm nay
                  sẽ hiện trong bảng lương từ ngày hôm sau.
                </span>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
