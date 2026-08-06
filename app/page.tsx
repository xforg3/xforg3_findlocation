"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // 1. Tambahkan import useRouter

interface CardItem {
  id: number;
  title: string;
  description: string;
  type: string;
}

export default function Home() {
  const router = useRouter(); // 2. Inisialisasi router
  const [selectedCard, setSelectedCard] = useState<CardItem | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cards: CardItem[] = [
    { id: 1, title: "Verifikasi OTP", description: "Layanan verifikasi kode keamanan", type: "otp" },
    { id: 2, title: "Layanan Peta", description: "Cari fasilitas terdekat", type: "map" },
    { id: 3, title: "Pengiriman Paket", description: "Cek status pengiriman", type: "info" },
    { id: 4, title: "Cuaca Lokal", description: "Informasi perkiraan cuaca", type: "info" },
    { id: 5, title: "Promosi", description: "Lihat penawaran diskon", type: "info" },
    { id: 6, title: "Pengaturan", description: "Kelola preferensi akun", type: "info" },
  ];

  // 3. Handler saat kartu diklik
  const handleCardClick = (card: CardItem) => {
    if (card.type === "otp") {
      // Jika kartu OTP diklik, langsung arahkan ke halaman /otp
      router.push("/otp");
    } else {
      setSelectedCard(card);
    }
  };

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setError("Fitur Geolocation tidak didukung oleh peramban ini.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setError(null);
      },
      (err) => {
        setError(`Gagal mendapatkan lokasi: ${err.message}`);
      }
    );
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50 text-gray-800">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Pilih Layanan</h1>

        {/* Grid 6 Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {cards.map((card) => (
            <div
              key={card.id}
              onClick={() => handleCardClick(card)} // Menggunakan handler navigasi
              className={`p-6 bg-white rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition ${selectedCard?.id === card.id ? "ring-2 ring-blue-500" : ""}`}>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h2>
              <p className="text-sm text-gray-600">{card.description}</p>
            </div>
          ))}
        </div>

        {/* Detail/Aksi untuk kartu non-OTP */}
        {selectedCard && (
          <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-xl font-bold mb-4">{selectedCard.title}</h3>
            <p className="text-gray-600 mb-4">Konten untuk {selectedCard.title} siap dikembangkan.</p>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <button onClick={handleRequestLocation} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition">
                Bagikan Lokasi Saya
              </button>

              {location && (
                <div className="mt-4 p-3 bg-emerald-50 text-emerald-800 rounded-md text-sm">
                  <p>
                    <strong>Latitude:</strong> {location.lat}
                  </p>
                  <p>
                    <strong>Longitude:</strong> {location.lng}
                  </p>
                </div>
              )}

              {error && <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
