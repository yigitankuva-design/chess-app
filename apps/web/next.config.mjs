import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})({
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },
  // Madde 2026-09-14 (3b): çoklu-çekirdekli Stockfish (SharedArrayBuffer)
  // sadece bu iki header ile açılır — Zafer'in onayladığı risk azaltma:
  // TÜM siteye DEĞİL, SADECE motor kullanılan sayfalara uygulanır (bota
  // karşı maç + Analiz Et akışları). Tarayıcı bu header'ları desteklemeyen
  // eski bir ortamda göndermeye devam eder ama etkisi olmaz — motor zaten
  // lib/chess/stockfish.ts'teki özellik-algılamasıyla tek-thread'e düşer.
  //
  // Madde 2026-09-19 (bot hamle etmeme hatasi — GERÇEK KÖK NEDEN): yukarıdaki
  // Cross-Origin-Embedder-Policy: require-corp AÇIKKEN, tarayıcı worker
  // olarak yüklenen HER dosyanın (public/stockfish/*.js, *.wasm) kendi
  // Cross-Origin-Resource-Policy header'ı taşımasını ZORUNLU tutuyor —
  // Vercel'in statik dosya sunumu bunu varsayılan eklemiyordu. Sonuç:
  // tarayıcı `new Worker('/stockfish/...')` isteğini SESSİZCE
  // (net::ERR_BLOCKED_BY_RESPONSE) engelliyordu — motor HİÇ başlamıyordu,
  // "Bot yanıt vermedi" hatası (bkz. lib/chess/stockfish.ts zaman aşımı)
  // HER SEFERİNDE tetikleniyordu. Canlıda doğrudan test edilip doğrulandı.
  async headers() {
    const crossOriginIsolation = [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
    ];
    return [
      { source: '/play', headers: crossOriginIsolation },
      { source: '/analiz/:path*', headers: crossOriginIsolation },
      {
        source: '/stockfish/:path*',
        headers: [
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ];
  },
});

export default pwaConfig;
