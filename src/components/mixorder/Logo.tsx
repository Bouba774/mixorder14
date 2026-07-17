import logo from "@/assets/mixorder-logo.asset.json";

// Single source of truth for the MixOrder brand mark.
export const LOGO_URL = logo.url;
export const LOGO_FALLBACK_URL = "/favicon.png";

interface LogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export function Logo({ size = 40, className = "", glow = false }: LogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-2xl"
        />
      )}
      <img
        src={LOGO_URL}
        alt="MixOrder"
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        draggable={false}
        onError={(e) => {
          const img = e.currentTarget;
          if (img.dataset.fallback !== "1") {
            img.dataset.fallback = "1";
            img.src = LOGO_FALLBACK_URL;
          }
        }}
        className="object-contain select-none"
        style={{ width: size, height: size, background: "transparent" }}
      />
    </div>
  );
}
