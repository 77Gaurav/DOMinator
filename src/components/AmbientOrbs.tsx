export function AmbientOrbs() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div
        className="ambient-orb animate-float"
        style={{
          background: "var(--gradient-orb-1)",
          top: "-10%",
          left: "-10%",
          width: "55vw",
          height: "55vw",
        }}
      />
      <div
        className="ambient-orb animate-pulse-glow"
        style={{
          background: "var(--gradient-orb-2)",
          bottom: "-15%",
          right: "-10%",
          width: "60vw",
          height: "60vw",
          animationDelay: "2s",
        }}
      />
      <div
        className="ambient-orb"
        style={{
          background: "var(--gradient-orb-1)",
          top: "30%",
          right: "10%",
          width: "30vw",
          height: "30vw",
          opacity: 0.3,
        }}
      />
    </div>
  );
}
