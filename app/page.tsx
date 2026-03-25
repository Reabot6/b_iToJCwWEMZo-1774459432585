import { DPUploader } from '@/components/dp-uploader';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NIMEPA DP Generator',
  description: 'Generate your profile photo for the NIMEPA beach cleanup flyer',
};

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center py-12"
      style={{
        background: 'linear-gradient(160deg, #003d5c 0%, #005f8a 35%, #0088bb 70%, #00aadd 100%)',
      }}
    >
      {/* Decorative wave circles — matches flyer ocean aesthetic */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div style={{
          position: 'absolute', top: '-120px', right: '-120px',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'rgba(0,170,221,0.12)', border: '1.5px solid rgba(0,170,221,0.2)',
        }} />
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'rgba(0,170,221,0.08)', border: '1.5px solid rgba(0,170,221,0.15)',
        }} />
        <div style={{
          position: 'absolute', bottom: '-150px', left: '-100px',
          width: '480px', height: '480px', borderRadius: '50%',
          background: 'rgba(0,100,160,0.18)', border: '1.5px solid rgba(0,170,221,0.12)',
        }} />
        {/* Subtle fish/wave pattern dots */}
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: `${20 + i * 14}%`,
            left: `${3 + (i % 2) * 5}%`,
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
          }} />
        ))}
      </div>

      <div className="w-full max-w-3xl mx-auto px-4 space-y-8 relative z-10">

        {/* Header */}
        <div className="text-center space-y-4">
          {/* NIMEPA badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <div className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            <span className="text-sm font-semibold text-white tracking-wide uppercase">
              NIMEPA · Inaugural Beach Cleanup
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
            Create Your<br />
            <span style={{ color: '#7de8ff' }}>Display Picture</span>
          </h1>

          <p className="text-base text-cyan-100 max-w-xl mx-auto leading-relaxed"
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.2)' }}>
            Upload your photo — we'll remove the background and place you on the
            official NIMEPA flyer. Drag to position, resize, then download.
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 pt-2">
            {['Upload', 'Position', 'Download'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.35)' }}>
                    {i + 1}
                  </div>
                  <span className="text-xs text-cyan-200 font-medium">{step}</span>
                </div>
                {i < 2 && <div className="w-8 h-px" style={{ background: 'rgba(255,255,255,0.25)' }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Uploader — rendered on a frosted card */}
        <div className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            boxShadow: '0 8px 48px rgba(0,60,100,0.35), 0 2px 8px rgba(0,0,0,0.12)',
          }}>
          <DPUploader />
        </div>

        {/* Footer tip */}
        <p className="text-center text-xs text-cyan-300 pb-4"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
          🌊 Saturday, 28th March 2026 · Atican Beach Resort, Lekki, Lagos &nbsp;·&nbsp; info@nimepa.org
        </p>
      </div>
    </main>
  );
}