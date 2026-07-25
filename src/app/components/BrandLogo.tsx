type BrandLogoProps = {
  /** dark = light backgrounds; white = dark backgrounds */
  variant?: "dark" | "white";
  /** full wordmark logo vs icon mark only */
  markOnly?: boolean;
  className?: string;
  priority?: boolean;
};

const SRC = {
  dark: {
    full: "/brand/doligrid-logo-dark.svg",
    mark: "/brand/doligrid-mark-dark.svg",
  },
  white: {
    full: "/brand/doligrid-logo-white.svg",
    mark: "/brand/doligrid-mark-white.svg",
  },
} as const;

export default function BrandLogo({
  variant = "dark",
  markOnly = false,
  className = "",
  priority = false,
}: BrandLogoProps) {
  const src = markOnly ? SRC[variant].mark : SRC[variant].full;
  const alt = markOnly ? "DoliGrid" : "DoliGrid ERP";

  return (
    <img
      src={src}
      alt={alt}
      className={`brand-logo ${markOnly ? "brand-logo-mark" : "brand-logo-full"} ${className}`.trim()}
      width={markOnly ? 38 : 200}
      height={markOnly ? 38 : 40}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
