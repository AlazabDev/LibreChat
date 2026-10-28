export function AzLogo({ size = 28 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-md bg-primary font-mono font-bold text-primary-foreground shadow-glow"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      Az
    </div>
  );
}
