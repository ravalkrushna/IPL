/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { usePlayers } from "@/hooks/usePlayers"

export const Route = createFileRoute("/auction/players")({
  validateSearch: z.object({
    page: z.number().catch(1),
    search: z.string().catch(""),
    sold: z.boolean().optional(),
  }),
  component: PlayersPoolPage,
})

function PlayersPoolPage() {
  const { page, search, sold } = Route.useSearch()
  const navigate = Route.useNavigate()

  const size = 15

  const { data: players, isLoading } = usePlayers({
    search,
    isSold: sold,
    page,
    size,
  })

  return (
  <div className="p-6 max-w-screen-2xl mx-auto space-y-6 pb-16">
      {/* ✅ Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Players Pool
        </h1>
        <p className="text-sm text-muted-foreground">
          Browse and filter auction players
        </p>
      </div>

      {/* ✅ Toolbar */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">

          <Input
            placeholder="Search players..."
            value={search}
            className="max-w-sm"
            onChange={(e) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  search: e.target.value,
                  page: 1,
                }),
              })
            }
          />

          <Separator orientation="vertical" className="h-6" />

          <div className="flex gap-2">

            <Button
              size="sm"
              variant={sold === undefined ? "default" : "outline"}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    sold: undefined,
                    page: 1,
                  }),
                })
              }
            >
              All
            </Button>

            <Button
              size="sm"
              variant={sold === false ? "default" : "outline"}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    sold: false,
                    page: 1,
                  }),
                })
              }
            >
              Unsold
            </Button>

            <Button
              size="sm"
              variant={sold === true ? "default" : "outline"}
              onClick={() =>
                navigate({
                  search: (prev) => ({
                    ...prev,
                    sold: true,
                    page: 1,
                  }),
                })
              }
            >
              Sold
            </Button>

          </div>
        </div>
      </Card>

      {/* ✅ Table */}
      <Card className="p-0">
        <div className="relative w-full overflow-auto">

          <Table>

            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Player</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Base Price</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>

              {/* ✅ Loading Skeleton */}
              {isLoading &&
                Array.from({ length: size }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell className="py-3">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-24 bg-muted rounded animate-pulse" />
                    </TableCell>
                    <TableCell>
                      <div className="h-4 w-16 bg-muted rounded animate-pulse ml-auto" />
                    </TableCell>
                    <TableCell>
                      <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))}

              {/* ✅ Data */}
              {!isLoading && players?.length ? (
                players.map((player: any, index: number) => (
                  <TableRow
                    key={player.id}
                    className={`
                      hover:bg-muted/50 transition-colors
                      ${index % 2 === 0 ? "bg-background" : "bg-muted/20"}
                    `}
                  >
                    <TableCell className="font-medium">
                      {player.name}
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {player.country}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline">
                        {player.specialism}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right font-medium">
                      ₹ {Number(player.basePrice).toLocaleString()}
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={player.isSold ? "secondary" : "default"}
                      >
                        {player.isSold ? "Sold" : "Available"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : null}

              {/* ✅ Empty State */}
              {!isLoading && !players?.length && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-10 text-muted-foreground"
                  >
                    No players found
                  </TableCell>
                </TableRow>
              )}

            </TableBody>
          </Table>

        </div>
      </Card>

      {/* ✅ Pagination */}
      <div className="flex justify-center items-center gap-4">

        <Button
          size="sm"
          variant="outline"
          disabled={page === 1}
          onClick={() =>
            navigate({
              search: (prev) => ({
                ...prev,
                page: prev.page - 1,
              }),
            })
          }
        >
          Previous
        </Button>

        <div className="text-sm text-muted-foreground">
          Page <span className="font-semibold text-foreground">{page}</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={!players || players.length < size}
          onClick={() =>
            navigate({
              search: (prev) => ({
                ...prev,
                page: prev.page + 1,
              }),
            })
          }
        >
          Next
        </Button>

      </div>
    </div>
  )
}