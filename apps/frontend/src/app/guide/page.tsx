'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, Laptop, Smartphone, MapPin, Calendar, 
  Clock, AlertTriangle, CheckCircle2, ChevronRight, 
  HelpCircle, Info, ShieldAlert, Key, UserCheck 
} from 'lucide-react';

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<'admin' | 'staff' | 'faq'>('admin');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 sm:p-6 font-mono selection:bg-cyan-500/30">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tighter flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-cyan-400" />
              TÀI_LIỆU_HƯỚNG_DẪN
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Hướng dẫn vận hành và điểm danh GPS</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-full">
            <span className="text-cyan-400 text-xs font-semibold tracking-wider font-mono">CYBER_GUIDE v1.1</span>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-1 border border-slate-800 rounded-xl">
          <Button
            onClick={() => setActiveTab('admin')}
            variant={activeTab === 'admin' ? 'default' : 'ghost'}
            className={`h-11 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'admin' 
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span className="hidden xs:inline">Dành cho</span> Quản lý
          </Button>
          <Button
            onClick={() => setActiveTab('staff')}
            variant={activeTab === 'staff' ? 'default' : 'ghost'}
            className={`h-11 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'staff' 
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden xs:inline">Dành cho</span> Nhân sự
          </Button>
          <Button
            onClick={() => setActiveTab('faq')}
            variant={activeTab === 'faq' ? 'default' : 'ghost'}
            className={`h-11 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'faq' 
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Giải quyết sự cố
          </Button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          
          {/* TAB 1: ADMIN GUIDE */}
          {activeTab === 'admin' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Introduction Card */}
              <Card className="bg-slate-900 border-slate-800 text-slate-50 shadow-[0_0_15px_rgba(6,182,212,0.02)]">
                <CardHeader className="pb-3 border-b border-slate-800/50">
                  <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Quản lý & Giám sát Vận hành (Admin / Manager)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-sm text-slate-300 leading-relaxed space-y-4">
                  <p>
                    Quản lý vận hành toàn bộ hệ thống thông qua Web Dashboard chính. Khi nhân sự thực hiện xác nhận ca hoặc check-in vị trí trên Telegram Bot, thông tin sẽ được truyền trực tiếp về Web theo thời gian thực (Realtime) bằng công nghệ Socket.
                  </p>
                  <div className="bg-slate-950/40 border border-slate-850 p-3 rounded-lg flex items-start gap-2 text-xs">
                    <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-400">
                      Hệ thống tự động quét ca làm việc mỗi phút một lần thông qua Cron Job để kích hoạt quy trình gửi tin nhắn, báo trễ, và ghi nhận vi phạm.
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Step By Step Checklist */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Step 1: User management & Link Telegram */}
                <Card className="bg-slate-900 border-slate-800 text-slate-50">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 text-xs flex items-center justify-center font-bold">1</span>
                      TẠO USER & LIÊN KẾT TELEGRAM
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs text-slate-300">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Vào trang <strong>Nhân Sự</strong>, click <strong>+ Thêm User</strong> để thêm nhân viên mới (chỉ cần Username và Họ tên, không cần mật khẩu cho vai trò STAFF).</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Nhấp vào nút màu vàng <strong>⚡ Liên kết Telegram</strong> trên danh sách.</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Gửi mã <strong>QR Code</strong> hoặc đường link mở bot hiển thị trên màn hình cho nhân viên quét/truy cập.</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Khi nhân viên nhấn <strong>Start</strong> trên Telegram Bot, hệ thống sẽ tự động xác minh và cập nhật trạng thái liên kết thành công.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 2: Shift settings & Assign Shift */}
                <Card className="bg-slate-900 border-slate-800 text-slate-50">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 text-xs flex items-center justify-center font-bold">2</span>
                      THIẾT LẬP CA & PHÂN LỊCH LÀM
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs text-slate-300">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Vào trang <strong>Phân Ca</strong> để thiết lập các ca làm việc (khung giờ bắt đầu - kết thúc) và nhấn <strong>Thêm ca</strong>.</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Tại khung <strong>Phân ca làm việc</strong>, chọn nhân viên cần giao ca, chọn ca làm thích hợp.</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Nhấp chọn các ngày trong tuần (T2, T3... CN) và đặt khoảng thời gian áp dụng (Ví dụ: 1 tuần hoặc 1 tháng).</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Nhấn <strong>Phân ca</strong>. Lịch phân ca sẽ được lưu và tự động chạy lịch trình điểm danh.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 3: Office Geolocation setup */}
                <Card className="bg-slate-900 border-slate-800 text-slate-50">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 text-xs flex items-center justify-center font-bold">3</span>
                      CẤU HÌNH TỌA ĐỘ VĂN PHÒNG
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs text-slate-300">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p><strong>Cách 1:</strong> Thiết lập trực tiếp tại bảng <strong>Cấu hình tọa độ văn phòng</strong> trên trang Dashboard chính. Nhập vĩ độ (Latitude), kinh độ (Longitude) và bán kính cho phép (mét), sau đó lưu cấu hình.</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p><strong>Cách 2 (Tiện lợi):</strong> Chat với Bot bằng tài khoản Admin, nhập lệnh <code>/setoffice</code> rồi đính kèm chia sẻ Location (Vị trí) thực tế tại văn phòng.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Step 4: Monitor and Resolve Violations */}
                <Card className="bg-slate-900 border-slate-800 text-slate-50">
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold tracking-wide text-slate-200 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 text-xs flex items-center justify-center font-bold">4</span>
                      XỬ LÝ CẢNH BÁO TRỄ / VẮNG MẶT
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs text-slate-300">
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Nhận các cảnh báo trực tiếp từ Telegram Bot của quản lý nếu nhân viên chưa sẵn sàng lúc T-5 hoặc đi trễ quá 5 phút.</p>
                      </div>
                      <div className="flex gap-2">
                        <ChevronRight className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                        <p>Tại tin nhắn cảnh báo trên Telegram, quản lý có thể nhấn nhanh: <strong>Nhắc lại</strong> (remind nhân viên) hoặc <strong>Ghi vi phạm</strong> để tự động lập biên bản vào log hệ thống.</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          )}

          {/* TAB 2: STAFF GUIDE */}
          {activeTab === 'staff' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Staff Instructions */}
              <Card className="bg-slate-900 border-slate-800 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                    <UserCheck className="w-5 h-5" />
                    Quy Trình Điểm Danh Dành Cho Nhân Viên (Staff)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-sm text-slate-300 leading-relaxed">
                  <p>
                    Nhân viên không cần phải đăng nhập tài khoản Web, mọi thao tác báo sẵn sàng, xin đi trễ, báo nghỉ và check-in GPS đều thực hiện thông qua <strong>Telegram Bot</strong> của công ty.
                  </p>

                  <div className="space-y-4 pt-2">
                    {/* Step 1 */}
                    <div className="flex items-start gap-3 p-3 bg-slate-950/40 rounded-lg border border-slate-850">
                      <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">1</div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-slate-200 text-sm">Liên kết tài khoản ban đầu</h4>
                        <p className="text-xs text-slate-400">
                          Quét mã QR hoặc nhấn vào link liên kết Telegram do quản lý cung cấp. Bấm nút <strong>Start</strong> trên màn hình hội thoại Telegram Bot để kích hoạt. Hệ thống sẽ báo <code>Liên kết thành công</code>.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-3 p-3 bg-slate-950/40 rounded-lg border border-slate-850">
                      <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">2</div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-slate-200 text-sm">Xác nhận ca làm việc (T-10 phút)</h4>
                        <p className="text-xs text-slate-400">
                          Before ca làm bắt đầu 10 phút, Bot sẽ gửi tin nhắc chuẩn bị. Bạn bắt buộc phải bấm nút <strong>`✅ Tôi đã sẵn sàng`</strong> để chuyển trạng thái sang <strong>Sẵn sàng</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-3 p-3 bg-slate-950/40 rounded-lg border border-slate-850">
                      <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">3</div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-slate-200 text-sm">Gửi vị trí GPS để check-in (T-0 phút)</h4>
                        <p className="text-xs text-slate-400">
                          Đến giờ vào ca làm, bot sẽ mở nút bấm <strong>`📍 Chia sẻ vị trí để check-in`</strong> ở phía dưới bàn phím. Hãy nhấn vào nút này hoặc gửi định vị thực tế của bạn bằng nút đính kèm vị trí 📎 trên Telegram.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-start gap-3 p-3 bg-slate-950/40 rounded-lg border border-slate-850">
                      <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-bold flex items-center justify-center flex-shrink-0 text-xs">4</div>
                      <div className="space-y-1">
                        <h4 className="font-semibold text-slate-200 text-sm">Hoàn thành điểm danh</h4>
                        <p className="text-xs text-slate-400">
                          Nếu vị trí của bạn hợp lệ (nằm trong bán kính văn phòng), Bot sẽ phản hồi check-in thành công và đổi trạng thái trên Web của quản lý thành <strong>Đã check-in</strong>.
                        </p>
                      </div>
                    </div>

                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: FAQ & TROUBLESHOOTING */}
          {activeTab === 'faq' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="bg-slate-900 border-slate-800 text-slate-50">
                <CardHeader>
                  <CardTitle className="text-lg text-cyan-400 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-500" />
                    Các Sự Cố Điểm Danh Và Cách Xử Lý
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 text-sm text-slate-300">
                  
                  {/* Issue 1 */}
                  <div className="space-y-2 border-b border-slate-850 pb-4">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 font-bold shrink-0">Lỗi 1</Badge>
                      <h4 className="font-semibold text-slate-200">Bot báo check-in thất bại vì ở quá xa văn phòng?</h4>
                    </div>
                    <p className="text-xs text-slate-400 pl-16">
                      <strong>Nguyên nhân:</strong> Điện thoại của nhân viên có thể chưa xác định được vị trí GPS chính xác (do ở phòng kín, tòa nhà cao tầng làm sóng GPS yếu), hoặc tọa độ văn phòng do quản trị viên thiết lập bị sai lệch.<br/>
                      <strong>Cách khắc phục:</strong> Nhân viên nên di chuyển ra khu vực thoáng, kiểm tra xem đã bật định vị chính xác cao trên máy chưa, đợi 30 giây rồi thực hiện gửi lại Location. Quản lý có thể tăng bán kính văn phòng lên (ví dụ: 150m) để giảm thiểu sai số của thiết bị.
                    </p>
                  </div>

                  {/* Issue 2 */}
                  <div className="space-y-2 border-b border-slate-850 pb-4">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 font-bold shrink-0">Lỗi 2</Badge>
                      <h4 className="font-semibold text-slate-200">Bấm nút liên kết Telegram báo mã lỗi hoặc không chạy?</h4>
                    </div>
                    <p className="text-xs text-slate-400 pl-16">
                      <strong>Nguyên nhân:</strong> Mã liên kết bảo mật (Link token QR) chỉ tồn tại trong vòng **10 phút**. Quá thời gian này link/QR sẽ tự động hết hạn (`EXPIRED`).<br/>
                      <strong>Cách khắc phục:</strong> Quản trị viên hãy đóng hộp thoại liên kết cũ trên màn hình Nhân sự và bấm lại nút <strong>⚡ Liên kết Telegram</strong> để tạo lại mã mới có hiệu lực 10 phút tiếp theo.
                    </p>
                  </div>

                  {/* Issue 3 */}
                  <div className="space-y-2 pb-2">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-red-400 border-red-500/30 bg-red-500/10 font-bold shrink-0">Lỗi 3</Badge>
                      <h4 className="font-semibold text-slate-200">Bot không tự động gửi nhắc nhở khi đến ca làm việc?</h4>
                    </div>
                    <p className="text-xs text-slate-400 pl-16">
                      <strong>Nguyên nhân:</strong> User chưa liên kết thành công với Telegram Bot (Cột Telegram trên Web vẫn hiện nút vàng chưa có ID số), hoặc Token Bot trong cấu hình của server bị sai/ngắt kết nối, hoặc Scheduler Service đang gặp sự cố.<br/>
                      <strong>Cách khắc phục:</strong> Kiểm tra trạng thái liên kết Telegram trên trang Nhân sự. Kỹ thuật viên kiểm tra trạng thái hoạt động của container <code>attendance_redis</code> và <code>attendance_backend</code> trên máy chủ.
                    </p>
                  </div>

                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
