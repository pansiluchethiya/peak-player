'use client';

interface Props {
  accentColor?: string;
}

export function AmbientBackground({ accentColor = 'var(--color-accent)' }: Props) {
  return (
    <div className="ambient-background" aria-hidden="true">
      <div
        className="ambient-glow"
        style={{
          background: `radial-gradient(circle at 50% 50%, color-mix(in srgb, ${accentColor} 18%, transparent) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}
