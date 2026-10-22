"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, AlertCircle, FileText, ImageIcon, MapPin } from "lucide-react";
import { API_BASE_URL, getCurrentUser } from "@/lib/api-client";

export default function RiwayatPage() {
  const [user, setUser] = useState<any>(null);
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fungsi pembantu mengekstrak metadata dari string isi aduan
  const parseComplaintBody = (isiText: string) => {
    if (!isiText) return { category: "Lainnya", date: "", location: "", details: "" };
    
    const categoryMatch = isiText.match(/\[KATEGORI:\s*(.*?)\]/);
    const dateMatch = isiText.match(/\[TANGGAL:\s*(.*?)\]/);
    const locationMatch = isiText.match(/\[LOKASI:\s*(.*?)\]/);
    
    let cleanedIsi = isiText;
    cleanedIsi = cleanedIsi.replace(/\[KATEGORI:.*?\]\n?/gi, "");
    cleanedIsi = cleanedIsi.replace(/\[TANGGAL:.*?\]\n?/gi, "");
    cleanedIsi = cleanedIsi.replace(/\[LOKASI:.*?\]\n?/gi, "");
    cleanedIsi = cleanedIsi.replace(/DETAIL LAPORAN:\n?/gi, "");
    cleanedIsi = cleanedIsi.trim();

    let categoryDisplay = categoryMatch ? categoryMatch[1] : "Lainnya";
    if (categoryDisplay.toLowerCase() === "infrastruktur") categoryDisplay = "Infrastruktur & Fasilitas Umum";
    if (categoryDisplay.toLowerCase() === "lingkungan") categoryDisplay = "Lingkungan & Kebersihan";
    if (categoryDisplay.toLowerCase() === "ketertiban") categoryDisplay = "Ketertiban & Keamanan";
    if (categoryDisplay.toLowerCase() === "pelayanan") categoryDisplay = "Pelayanan Publik";

    return {
      category: categoryDisplay,
      date: dateMatch ? dateMatch[1] : "",
      location: locationMatch ? locationMatch[1] : "",
      details: cleanedIsi
    };
  };

  // 1. Cek User Login
  useEffect(() => {
    async function checkAndFetch() {
      const serverUser = await getCurrentUser();
      if (serverUser) {
        setUser(serverUser);
        fetchRiwayat();
      } else {
        setIsLoading(false);
      }
    }
    checkAndFetch();
  }, []);

  // 2. Fungsi Tarik Data dari API
  const fetchRiwayat = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/riwayat`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setRiwayat(data);
      }
    } catch (error) {
      console.error("Gagal mengambil riwayat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi Pembantu: Ubah status menjadi warna badge yang cantik
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-full text-xs font-bold uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5" /> Menunggu
          </span>
        );
      case "PROSES":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold uppercase tracking-wider">
            <AlertCircle className="w-3.5 h-3.5" /> Diproses
          </span>
        );
      case "SELESAI":
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
          </span>
        );
      default:
        return null;
    }
  };

  // Fungsi Pembantu: Format tanggal jadi lebih enak dibaca
  const formatTanggal = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    };
    return new Date(dateString).toLocaleDateString('id-ID', options);
  };

  // --- TAMPILAN JIKA BELUM LOGIN ---
  if (!user && !isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
        <AlertCircle className="w-16 h-16 text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h1>
        <p className="text-gray-500 mb-6 text-center">Anda harus masuk terlebih dahulu untuk melihat riwayat laporan Anda.</p>
        <Link href="/login" className="bg-black text-white px-6 py-3 rounded-md text-sm font-bold shadow-md hover:bg-gray-800 transition-colors">
          Masuk ke Akun Saya
        </Link>
      </main>
    );
  }

  // --- TAMPILAN UTAMA RIWAYAT ---
  return (
    <main className="min-h-screen bg-gray-50 text-black py-20 md:py-24 px-4 sm:px-6 md:px-12 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 md:mb-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Riwayat Laporan</h1>
          <p className="text-gray-500 mt-2 text-sm">Pantau status pengaduan yang telah Anda kirimkan.</p>
        </header>

        {isLoading ? (
          <div className="flex flex-col gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row gap-6 md:gap-8 animate-shimmer">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-4">
                    <div className="h-6 w-24 bg-gray-200/60 rounded-full"></div>
                    <div className="h-4 w-28 bg-gray-200/60 rounded"></div>
                  </div>
                  <div className="h-7 w-3/4 bg-gray-200/60 rounded mb-4"></div>
                  <div className="h-24 bg-gray-100/40 rounded-lg border border-gray-100 p-4 flex flex-col gap-2">
                    <div className="h-3.5 w-full bg-gray-200/60 rounded"></div>
                    <div className="h-3.5 w-5/6 bg-gray-200/60 rounded"></div>
                    <div className="h-3.5 w-2/3 bg-gray-200/60 rounded"></div>
                  </div>
                </div>
                <div className="md:w-48 flex-shrink-0 flex flex-col gap-2">
                  <div className="h-4 w-20 bg-gray-200/60 rounded"></div>
                  <div className="w-full h-32 md:h-32 bg-gray-100/60 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : riwayat.length === 0 ? (
          <div className="bg-white p-6 sm:p-12 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Belum ada laporan</h2>
            <p className="text-gray-500 text-sm mb-6">Anda belum pernah membuat laporan pengaduan apapun.</p>
            <Link href="/#form-lapor" className="bg-black text-white px-6 py-3 rounded-md text-sm font-bold shadow-md hover:bg-gray-800 transition-colors min-h-[44px] flex items-center">
              Buat Laporan Baru
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {riwayat.map((item) => {
              const parsed = parseComplaintBody(item.isi);
              return (
                <div key={item.id} className="bg-white rounded-2xl p-4 sm:p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow border border-gray-100 flex flex-col md:flex-row gap-6 md:gap-8">
                  
                  {/* Konten Kiri: Teks Laporan */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(item.status)}
                        <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full uppercase">
                          {parsed.category}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-400">
                        {formatTanggal(item.createdAt)}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{item.judul}</h3>
                    
                    {parsed.location && (
                      <p className="text-xs text-gray-500 font-bold mb-3 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" /> Lokasi: <span className="text-gray-700">{parsed.location}</span>
                      </p>
                    )}

                    <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-lg border border-gray-100">
                      {parsed.details}
                    </div>
                  </div>

                {/* Konten Kanan: Foto (Jika Ada) */}
                {item.foto && (
                  <div className="md:w-48 flex-shrink-0 flex flex-col gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" /> Lampiran
                    </span>
                    <div className="w-full h-32 md:h-full min-h-[120px] relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                      {/* Gunakan tag img standar untuk sementara agar tidak perlu config domain image Next.js */}
                      <img 
                        src={item.foto} 
                        alt="Lampiran Laporan" 
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}
      </div>
    </main>
  );
}