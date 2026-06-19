"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  Crown,
  EllipsisIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface LeaderboardRankingItem {
  userId: string
  userName: string | null
  rank: number
  value: number
  byline?: string | null
  avatarUrl?: string | null
  avatarEmoji?: string
  rankChange?: number
  displayed?: boolean
}

interface LeaderboardRankingsProps extends React.HTMLAttributes<HTMLDivElement> {
  rankings: LeaderboardRankingItem[]
  onUserClick?: (ranking: LeaderboardRankingItem) => void
  currentUserId?: string
  showPagination?: boolean
  defaultPageSize?: 10 | 25 | 50 | 100
  theme?: 'light' | 'dark'
}

const crownColorMap: Record<1 | 2 | 3, string> = {
  1: "text-amber-500",
  2: "text-gray-400",
  3: "text-orange-400",
}

const pageSizeOptions = [10, 25, 50, 100] as const

type LeaderboardRow =
  | { type: "ranking"; ranking: LeaderboardRankingItem }
  | { type: "ellipsis"; key: string }

function formatLeaderboardValue(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString()
}

const LeaderboardRankings = React.forwardRef<
  HTMLDivElement,
  LeaderboardRankingsProps
>(
  (
    {
      className,
      rankings,
      onUserClick,
      currentUserId,
      showPagination = false,
      defaultPageSize = 10,
      theme = 'light',
      ...props
    },
    ref
  ) => {
    const isDark = theme === 'dark'

    const [pageSize, setPageSize] = React.useState<10 | 25 | 50 | 100>(
      defaultPageSize
    )
    const [currentPage, setCurrentPage] = React.useState(1)

    const totalPages = Math.max(1, Math.ceil(rankings.length / pageSize))

    React.useEffect(() => {
      setCurrentPage(1)
    }, [pageSize])

    React.useEffect(() => {
      if (currentPage > totalPages) {
        setCurrentPage(totalPages)
      }
    }, [currentPage, totalPages])

    const pagedRankings = showPagination
      ? rankings.slice((currentPage - 1) * pageSize, currentPage * pageSize)
      : rankings

    const rows = React.useMemo<LeaderboardRow[]>(() => {
      const nextRows: LeaderboardRow[] = []
      let hiddenRunCount = 0

      pagedRankings.forEach((ranking, index) => {
        const isDisplayed = ranking.displayed !== false
        if (!isDisplayed) {
          hiddenRunCount += 1
          return
        }

        if (hiddenRunCount > 0) {
          nextRows.push({ type: "ellipsis", key: `ellipsis-${index}` })
          hiddenRunCount = 0
        }

        nextRows.push({ type: "ranking", ranking })
      })

      if (hiddenRunCount > 0) {
        nextRows.push({ type: "ellipsis", key: "ellipsis-tail" })
      }

      return nextRows
    }, [pagedRankings])

    return (
      <div
        ref={ref}
        className={cn(
          "w-full rounded-2xl border",
          isDark
            ? "bg-white/5 border-white/10"
            : "bg-white border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.05)]",
          className
        )}
        {...props}
      >
        <div
          role="list"
          aria-label="Leaderboard rankings"
          className={cn(
            "divide-y",
            isDark ? "divide-white/8" : "divide-gray-100"
          )}
        >
          {rows.map((row) => {
            if (row.type === "ellipsis") {
              return (
                <div
                  key={row.key}
                  role="listitem"
                  aria-label="Collapsed leaderboard rows"
                  className={cn(
                    "flex items-center justify-center px-4 py-2",
                    isDark ? "text-white/30" : "text-gray-400"
                  )}
                >
                  <EllipsisIcon className="h-5 w-5" />
                </div>
              )
            }

            const ranking = row.ranking
            const displayName =
              ranking.userName || `Usuario ${ranking.userId.slice(0, 6)}`
            const showCrown = ranking.rank <= 3
            const crownColor = crownColorMap[ranking.rank as 1 | 2 | 3]
            const isCurrentUser = currentUserId === ranking.userId
            const isFirst = ranking.rank === 1

            return (
              <div
                key={ranking.userId}
                role="listitem"
                tabIndex={onUserClick ? 0 : undefined}
                onClick={() => onUserClick?.(ranking)}
                onKeyDown={
                  onUserClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          onUserClick(ranking)
                        }
                      }
                    : undefined
                }
                className={cn(
                  "flex items-center gap-3 px-4 py-3",
                  isDark ? (
                    isFirst
                      ? "bg-amber-500/10"
                      : isCurrentUser
                        ? "border-2 border-white/20 bg-white/10 rounded-xl mx-2 my-1"
                        : ""
                  ) : (
                    isFirst && "bg-amber-50/60",
                    isCurrentUser && "border-2 border-gray-900 bg-gray-50 rounded-xl mx-2 my-1"
                  ),
                  onUserClick && (isDark ? "hover:bg-white/10 cursor-pointer transition-colors" : "hover:bg-gray-50 cursor-pointer transition-colors")
                )}
              >
                {/* Rank + crown */}
                <div className="flex w-10 items-center gap-1 shrink-0">
                  <span className={cn(
                    "w-5 text-sm font-semibold tabular-nums text-center",
                    isDark
                      ? (isFirst ? "text-amber-400" : "text-white/40")
                      : (isFirst ? "text-amber-500" : "text-gray-400")
                  )}>
                    {ranking.rank}
                  </span>
                  {showCrown ? (
                    <Crown
                      className={cn("h-4 w-4", crownColor)}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>

                {/* Avatar */}
                {ranking.avatarEmoji ? (
                  <span className="text-2xl shrink-0">{ranking.avatarEmoji}</span>
                ) : ranking.avatarUrl ? (
                  <img
                    src={ranking.avatarUrl}
                    alt={`${displayName} avatar`}
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold shrink-0",
                    isDark
                      ? "bg-white/10 text-white"
                      : (isFirst ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-500")
                  )}>
                    {(ranking.userName ?? ranking.userId)
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}

                {/* Name + byline */}
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "truncate font-semibold text-sm",
                    isDark
                      ? (isFirst ? "text-white" : "text-white/80")
                      : (isFirst ? "text-gray-900" : "text-gray-700")
                  )}>
                    {displayName}
                  </p>
                  {ranking.byline ? (
                    <p className={cn(
                      "truncate text-xs font-normal",
                      isDark ? "text-white/40" : "text-gray-400"
                    )}>
                      {ranking.byline}
                    </p>
                  ) : null}
                </div>

                {/* Value + trend */}
                <div className="flex items-center gap-2 text-right shrink-0">
                  {typeof ranking.rankChange === "number" &&
                  ranking.rankChange !== 0 ? (
                    <p
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium",
                        ranking.rankChange > 0
                          ? "text-green-500"
                          : "text-red-400"
                      )}
                    >
                      {ranking.rankChange > 0 ? (
                        <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {Math.abs(ranking.rankChange)}
                    </p>
                  ) : null}
                  <div>
                    <p className={cn(
                      "leading-none font-semibold tabular-nums",
                      isDark
                        ? (isFirst ? "text-amber-400 text-lg" : "text-white text-base")
                        : (isFirst ? "text-amber-500 text-lg" : "text-gray-900 text-base")
                    )}>
                      {formatLeaderboardValue(ranking.value)}
                    </p>
                    <p className={cn(
                      "text-[11px] font-medium text-right",
                      isDark ? "text-white/35" : "text-gray-400"
                    )}>pts</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {showPagination ? (
          <div className={cn(
            "flex items-center justify-between gap-3 border-t px-4 py-2",
            isDark ? "border-white/10" : "border-gray-100"
          )}>
            <div className="flex items-center gap-2">
              <label
                htmlFor="leaderboard-page-size"
                className={isDark ? "text-white/50 text-sm" : "text-gray-500 text-sm"}
              >
                Mostrar
              </label>
              <select
                id="leaderboard-page-size"
                value={pageSize}
                onChange={(e) =>
                  setPageSize(Number(e.target.value) as 10 | 25 | 50 | 100)
                }
                className={cn(
                  "rounded-lg border px-2 py-1 text-sm focus:outline-none focus:ring-2",
                  isDark
                    ? "bg-white/10 text-white border-white/20 focus:ring-white/20"
                    : "bg-white text-gray-500 border-gray-200 focus:ring-gray-200"
                )}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Página anterior"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "rounded-md border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  isDark
                    ? "border-white/20 hover:bg-white/10 text-white"
                    : "border-gray-200 hover:bg-gray-100"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className={isDark ? "text-white/50 text-sm" : "text-gray-500 text-sm"}>
                {currentPage} / {totalPages}
              </span>

              <Button
                variant="ghost"
                size="icon"
                aria-label="Página siguiente"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  "rounded-md border p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  isDark
                    ? "border-white/20 hover:bg-white/10 text-white"
                    : "border-gray-200 hover:bg-gray-100"
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    )
  }
)

LeaderboardRankings.displayName = "LeaderboardRankings"

export { LeaderboardRankings }
export type { LeaderboardRankingItem, LeaderboardRankingsProps }
