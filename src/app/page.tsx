import ContentTester from "@/components/ContentTester";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return (
    <main className="min-h-screen px-6 py-12 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <section className="w-full max-w-4xl mx-auto rounded-3xl bg-white/10 backdrop-blur-lg p-10 shadow-[0_24px_60px_rgba(0,0,0,0.3)] border border-white/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl">
            🎬
          </div>
          <div>
            <p className="m-0 text-sm uppercase tracking-[0.08em] text-purple-300">API de Streaming</p>
            <h1 className="text-2xl font-bold text-white">ORION STREAM API</h1>
          </div>
        </div>
        
        <div className="mt-8 space-y-4">
          <div className="bg-black/30 rounded-lg p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">📡 Routes disponibles</h2>
            <ul className="space-y-2 text-sm text-gray-300 font-mono">
              <li className="flex items-center gap-2">
                <span className="text-green-400">GET</span>
                <span>/api/sources/movie/:tmdbId</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">GET</span>
                <span>/api/sources/series/:tmdbId/:season/:episode</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">GET</span>
                <span>/api/proxy/m3u8?url=...&referer=...</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-blue-400">GET</span>
                <span>/api/proxy/ts?url=...&referer=...</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">GET</span>
                <span>/api/health</span>
              </li>
            </ul>
          </div>

          <div className="bg-black/30 rounded-lg p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">✨ Fonctionnalités</h2>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>• Scraping automatique depuis French-Stream</li>
              <li>• Support 🎬 Films + 📺 Séries (VF/VOSTFR)</li>
              <li>• Cache intelligent en base de données (30min)</li>
              <li>• Proxy M3U8 et segments TS</li>
              <li>• Fallback embed si M3U8 trop lent</li>
              <li>• Blocage des pubs et pop-ups</li>
              <li>• Support Vidzy uniquement</li>
            </ul>
          </div>

          <div className="bg-black/30 rounded-lg p-4 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-2">📝 Exemples</h2>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-gray-400 mb-1">Film :</p>
                <code className="block text-xs text-purple-300 break-all">
                  GET /api/sources/movie/299534
                </code>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Série :</p>
                <code className="block text-xs text-green-300 break-all">
                  GET /api/sources/series/1396/1/1
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
          <span>✅ API opérationnelle</span>
          <span>Version 2.0</span>
        </div>

        {/* Interface de test */}
        <div className="mt-8 pt-8 border-white/20">
          <ContentTester />
        </div>
      </section>
    </main>
  );
}
