"use client";

export function SkipToContent() {
  return (
    <a
      href="#main-content"
      style={{
        position: "absolute",
        top: -60,
        left: 16,
        zIndex: 9999,
        background: "var(--color-accent-violet)",
        color: "var(--color-text-primary)",
        padding: "8px 16px",
        borderRadius: "var(--radius-sm)",
        fontFamily: "var(--font-dm-sans)",
        fontSize: 14,
        fontWeight: 500,
        textDecoration: "none",
        transition: "top 200ms ease-out",
      }}
      onFocus={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = "16px"; }}
      onBlur={(e) => { (e.currentTarget as HTMLAnchorElement).style.top = "-60px"; }}
    >
      Skip to content
    </a>
  );
}
