"use client";

export default function BackgroundEffects() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Main Background Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_35%)]" />

      {/* Floating Glow Orbs */}
      <div className="animate-float absolute left-[10%] top-[15%] h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />

      <div className="animate-float absolute right-[10%] top-[25%] h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="animate-float absolute bottom-[10%] left-[30%] h-96 w-96 rounded-full bg-pink-500/10 blur-3xl" />

      <div className="animate-float absolute bottom-[20%] right-[20%] h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />

      {/* Grid Overlay */}
      <div
        className="
          absolute inset-0
          bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),
          linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]
          bg-[size:60px_60px]
          opacity-20
        "
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Noise Texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url('https://grainy-gradients.vercel.app/noise.svg')",
        }}
      />
    </div>
  );
}