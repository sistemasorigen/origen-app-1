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

// Podium styles for each position
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
      ...props
    },
    ref
  ) => {
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

    const iconSize = {
      sm: "h-4 w-4",
      default: "h-5 w-5",
      lg: "h-6 w-6",
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
          const config = PODIUM_CONFIG[ranking.rank as 1 | 2 | 3]
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
              {/* Avatar with crown */}
              <div className="relative mb-2" aria-hidden="true">
                {showAvatar && ranking.avatarUrl ? (
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
                      config.bg,
                      config.color,
                      config.ringColor
                    )}
                  >
                    {initial}
                  </div>
                )}

                {/* Crown badge */}
                {medalStyle !== "minimal" && (
                  <div
                    className={cn(
                      "bg-white absolute -right-1 -bottom-1 flex items-center justify-center rounded-full shadow-sm border border-gray-100",
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
                  "max-w-24 truncate text-center font-semibold text-gray-900",
                  textSize
                )}
                title={displayName}
              >
                {displayName}
              </span>

              {/* Value */}
              {showValue && (
                <span
                  className={cn(
                    "text-gray-500 font-medium tabular-nums",
                    size === "sm" ? "text-xs" : "text-sm"
                  )}
                >
                  {ranking.value.toLocaleString()}
                  {valueLabel ? ` ${valueLabel}` : ""}
                </span>
              )}

              {/* Podium block */}
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
