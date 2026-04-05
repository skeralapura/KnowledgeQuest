"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface StudentStats {
  total_xp: number;
  explorer_level: number;
  streak_count: number;
  streak_freeze_remaining: number;
}

export function NavBar() {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    fetch("/api/student-stats")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setStats(data); })
      .catch(() => null);
  }, [pathname]); // refresh on route change

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "var(--color-bg-base)",
        borderBottom: "1px solid var(--color-border)",
        padding: "0 16px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: "100%",
      }}
    >
      {/* Logo / home link */}
      <Link
        href="/quest-board"
        aria-label="KnowledgeQuest — back to Quest Board"
        style={{
          fontFamily: "var(--font-sora)",
          fontWeight: 700,
          fontSize: 18,
          color: "var(--color-accent-violet)",
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
        }}
      >
        <span aria-hidden="true">⚗️</span>
        KnowledgeQuest
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <NavLink href="/quest-board" label="Quests" active={pathname === "/quest-board"} />
        <NavLink href="/report" label="Report" active={pathname === "/report"} />
      </div>

      {/* Stats row — hidden on mobile via CSS class */}
      {stats && (
        <div className="navbar-stats" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Streak */}
          <div
            title={`${stats.streak_count}-day streak${stats.streak_freeze_remaining > 0 ? ` · ${stats.streak_freeze_remaining} freeze remaining` : ""}`}
            aria-label={`${stats.streak_count}-day streak`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: "var(--font-sora)",
              fontWeight: 600,
              fontSize: 14,
              color: stats.streak_count > 0 ? "var(--color-accent-amber)" : "var(--color-text-muted)",
            }}
          >
            <span aria-hidden="true">🔥</span>
            <span>{stats.streak_count}</span>
          </div>

          {/* XP + level pill */}
          <div
            aria-label={`Level ${stats.explorer_level}, ${stats.total_xp} XP`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(124,110,245,0.12)",
              border: "1px solid rgba(124,110,245,0.3)",
              borderRadius: "var(--radius-pill)",
              padding: "3px 12px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sora)",
                fontWeight: 700,
                fontSize: 12,
                color: "var(--color-accent-violet)",
              }}
            >
              Lv {stats.explorer_level}
            </span>
            <span
              aria-hidden="true"
              style={{
                width: 1,
                height: 12,
                background: "rgba(124,110,245,0.3)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontWeight: 500,
                fontSize: 12,
                color: "var(--color-text-secondary)",
              }}
            >
              {stats.total_xp} XP
            </span>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      style={{
        fontFamily: "var(--font-dm-sans)",
        fontWeight: 500,
        fontSize: 14,
        color: active ? "var(--color-accent-violet)" : "var(--color-text-secondary)",
        textDecoration: "none",
        padding: "6px 10px",
        borderRadius: "var(--radius-sm)",
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        background: active ? "rgba(124,110,245,0.10)" : "transparent",
        transition: "color 150ms ease-out, background 150ms ease-out",
      }}
    >
      {label}
    </Link>
  );
}
