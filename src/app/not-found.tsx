import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#090d16] text-white text-center">
      <div>
        <h2 className="text-2xl font-bold mb-2">404 - الصفحة غير موجودة</h2>
        <p className="text-xs text-gray-400 mb-6">الصفحة التي تبحث عنها غير متوفرة حالياً.</p>
        <Link
          href="/dashboard"
          className="text-xs px-4 py-2 rounded-xl bg-green-500 text-black font-semibold hover:bg-green-400 transition"
        >
          العودة للوحة التحكم
        </Link>
      </div>
    </div>
  );
}
