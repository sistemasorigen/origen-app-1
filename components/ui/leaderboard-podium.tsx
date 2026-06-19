"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Crown } from "lucide-react"

import { cn } from "@/lib/utils"

// Types (inlined)
interface LeaderboardRanking {
  userId: string
  userName: string | null
  rank: number
  value: number
  avatarUrl?: string | null
  avatarEmoji?: string
}

// Variants
const podiumVariants = cva("flex items-end justify-center gap-4", {
  variants: {
    size: {
      sm: "gap-2",
      default: "gap-4",
      lg: "gap-6",
    },
  },
  defaultVariants: {
    size: "default",
  },
})

// Podium styles for each position — light theme
const PODIUM_CONFIG = {
  1: {
    icon: Crown,
    color: "text-amber-500",
    bg: "bg-amber-100",
    block: "bg-gradient-to-t from-amber-100 to-amber-200",
    ringColor: "ring-amber-300",
    height: "h-32",
    heightSm: "h-24",
    heightLg: "h-40",
  },
  2: {
    icon: Crown,
    color: "text-gray-400",
    bg: "bg-gray-100",
    block: "bg-gradient-to-t from-gray-100 to-gray-200",
    ringColor: "ring-gray-300",
    height: "h-24",
    heightSm: "h-20",
    heightLg: "h-32",
  },
  3: {
    icon: Crown,
    color: "text-orange-400",
    bg: "bg-orange-100",
    block: "bg-gradient-to-t from-orange-100 to-orange-200",
    ringColor: "ring-orange-300",
    height: "h-20",
    heightSm: "h-16",
    heightLg: "h-28",
  },
} as const

// Podium styles for each position — dark theme
const PODIUM_DARK_CONFIG = {
  1: { textColor: '#F59E0B',               blockBg: 'rgba(245,158,11,0.15)',  blockBorder: 'rgba(245,158,11,0.5)'   },
  2: { textColor: 'rgba(148,163,184,0.9)', blockBg: 'rgba(255,255,255,0.07)', blockBorder: 'rgba(148,163,184,0.35)' },
  3: { textColor: 'rgba(251,146,60,0.9)',  blockBg: 'rgba(255,255,255,0.05)', blockBorder: 'rgba(251,146,60,0.35)'  },
} as const

// Props
interface LeaderboardPodiumProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof podiumVariants> {
  /** Top 3 rankings (expects at least 1, ideally 3) */
  rankings: LeaderboardRanking[]
  /** Show value below name */
  showValue?: boolean
  /** Show avatar */
  showAvatar?: boolean
  /** Crown badge style variant */
  medalStyle?: "classic" | "modern" | "minimal"
  /** Label shown under the value (e.g. "pts") */
  valueLabel?: string
  /** Color theme */
  theme?: 'light' | 'dark'
}

const LeaderboardPodium = React.forwardRef<
  HTMLDivElement,
  LeaderboardPodiumProps
>(
  (
    {
      className,
      size,
      rankings,
      showValue = true,
      showAvatar = true,
      medalStyle = "classic",
      valueLabel,
      theme = 'light',
      ...props
    },
    ref
  ) => {
    const isDark = theme === 'dark'

    // Get top 3, reorder for podium display: 2nd, 1st, 3rd
    const top3 = rankings.slice(0, 3)
    const podiumOrder = [
      top3.find((r) => r.rank === 2),
      top3.find((r) => r.rank === 1),
      top3.find((r) => r.rank === 3),
    ].filter(Boolean) as LeaderboardRanking[]

    if (podiumOrder.length === 0) {
      return null
    }

    const avatarSize = {
      sm: "h-10 w-10 text-sm",
      default: "h-14 w-14 text-lg",
      lg: "h-20 w-20 text-2xl",
    }[size ?? "default"]

    const emojiSize = {
      sm: "text-3xl",
      default: "text-4xl",
      lg: "text-5xl",
    }[size ?? "default"]

    const textSize = {
      sm: "text-xs",
      default: "text-sm",
      lg: "text-base",
    }[size ?? "default"]

    return (
      <div
        ref={ref}
        className={cn(podiumVariants({ size }), className)}
        role="list"
        aria-label="Top 3 rankings"
        {...props}
      >
        {podiumOrder.map((ranking) => {
          const config     = PODIUM_CONFIG[ranking.rank as 1 | 2 | 3]
          const darkConfig = PODIUM_DARK_CONFIG[ranking.rank as 1 | 2 | 3]
          if (!config) return null

          const displayName =
            ranking.userName || `Familia ${ranking.userId.slice(0, 6)}`
          const initial = displayName.charAt(0).toUpperCase()
          const podiumHeight = {
            sm: config.heightSm,
            default: config.height,
            lg: config.heightLg,
          }[size ?? "default"]

          const itemLabel = `Puesto ${ranking.rank}: ${displayName}${showValue ? `, ${ranking.value.toLocaleString()} puntos` : ""}`

          return (
            <div
              key={ranking.userId}
              role="listitem"
              aria-label={itemLabel}
              className="flex flex-col items-center"
            >
              {/* Avatar */}
              <div className="relative mb-2" aria-hidden="true">
                {ranking.avatarEmoji ? (
                  <span className={cn("block text-center leading-none", emojiSize)}>
                    {ranking.avatarEmoji}
                  </span>
                ) : showAvatar && ranking.avatarUrl ? (
                  <img
                    src={ranking.avatarUrl}
                    alt={`${displayName} avatar`}
                    className={cn(
                      "rounded-full object-cover ring-2 ring-offset-2",
                      avatarSize,
                      config.ringColor
                    )}
                  />
                ) : (
                  <div
                    className={cn(
                      "flex items-center justify-center rounded-full font-semibold ring-2 ring-offset-2",
                      avatarSize,
                      isDark
                        ? "bg-white/10 text-white ring-white/20 ring-offset-transparent"
                        : cn(config.bg, config.color, config.ringColor)
                    )}
                  >
                    {initial}
                  </div>
                )}

                {/* Crown badge — only when no emoji */}
                {!ranking.avatarEmoji && medalStyle !== "minimal" && (
                  <div
                    className={cn(
                      "absolute -right-1 -bottom-1 flex items-center justify-center rounded-full shadow-sm",
                      isDark ? "bg-white/10 border border-white/20" : "bg-white border border-gray-100",
                      size === "sm"
                        ? "h-5 w-5"
                        : size === "lg"
                          ? "h-8 w-8"
                          : "h-6 w-6"
                    )}
                  >
                    <config.icon
                      className={cn(
                        config.color,
                        size === "sm"
                          ? "h-3 w-3"
                          : size === "lg"
                            ? "h-5 w-5"
                            : "h-4 w-4"
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Name */}
              <span
                className={cn(
                  "max-w-24 truncate text-center font-semibold",
                  textSize,
                  isDark ? "text-white" : "text-gray-900"
                )}
                title={displayName}
              >
                {displayName}
              </span>

              {/* Value */}
              {showValue && (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    size === "sm" ? "text-xs" : "text-sm",
                    !isDark && "text-gray-500"
                  )}
                  style={isDark ? { color: darkConfig.textColor } : undefined}
                >
                  {ranking.value.toLocaleString()}
                  {valueLabel ? ` ${valueLabel}` : ""}
                </span>
              )}

              {/* Podium block */}
              {isDark ? (
                <div
                  aria-hidden="true"
                  className={cn(
                    "mt-2 w-[5.5rem] rounded-t-lg border border-b-0 flex flex-col",
                    size === "sm" && "w-20",
                    size === "lg" && "w-24",
                    podiumHeight,
                    medalStyle === "modern" && "rounded-t-xl"
                  )}
                  style={{ background: darkConfig.blockBg, borderColor: darkConfig.blockBorder }}
                >
                  <div
                    className="flex h-8 items-center justify-center font-bold"
                    style={{ color: darkConfig.textColor }}
                  >
                    {ranking.rank}
                  </div>
                </div>
              ) : (
                <div
                  aria-hidden="true"
                  className={cn(
                    "mt-2 w-[5.5rem] rounded-t-lg border border-b-0",
                    size === "sm" && "w-20",
                    size === "lg" && "w-24",
                    podiumHeight,
                    config.block,
                    ranking.rank === 1 ? "border-amber-200" : ranking.rank === 2 ? "border-gray-200" : "border-orange-200",
                    medalStyle === "modern" && "rounded-t-xl"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 items-center justify-center font-bold",
                      config.color
                    )}
                  >
                    {ranking.rank}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }
)
LeaderboardPodium.displayName = "LeaderboardPodium"

export { LeaderboardPodium, podiumVariants }
export type { LeaderboardPodiumProps, LeaderboardRanking }
