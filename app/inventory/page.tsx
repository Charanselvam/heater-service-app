'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  PlusCircle, Search, X, Package, ArrowLeft,
  AlertTriangle, TrendingDown, TrendingUp, Minus,
  Edit, RefreshCw, Filter, ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  name: string
  category: string | null
  unit: string
  quantity: number
  low_stock_threshold: number
  cost_price: number | null
  notes: string | null
  created_at: string
}

type StockFilter = 'all' | 'low' | 'ok'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t) }, [value, delay])
  return d
}

function stockStatus(item: InventoryItem): 'out' | 'low' | 'ok' {
  if (item.quantity === 0) return 'out'
  if (item.quantity <= item.low_stock_threshold) return 'low'
  return 'ok'
}

// ─── Stock badge ──────────────────────────────────────────────────────────────

function StockBadge({ item }: { item: InventoryItem }) {
  const status = stockStatus(item)
  if (status === 'out') return (
    <Badge variant="destructive" className="gap-1 text-[11px]">
      <X className="h-3 w-3" /> Out of stock
    </Badge>
  )
  if (status === 'low') return (
    <Badge variant="outline" className="gap-1 text-[11px] border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400">
      <AlertTriangle className="h-3 w-3" /> Low stock
    </Badge>
  )
  return (
    <Badge variant="outline" className="gap-1 text-[11px] border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <TrendingUp className="h-3 w-3" /> In stock
    </Badge>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ items }: { items: InventoryItem[] }) {
  const stats = useMemo(() => ({
    total:    items.length,
    ok:       items.filter(i => stockStatus(i) === 'ok').length,
    low:      items.filter(i => stockStatus(i) === 'low').length,
    out:      items.filter(i => stockStatus(i) === 'out').length,
  }), [items])

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Total',    value: stats.total, color: 'text-foreground' },
        { label: 'In Stock', value: stats.ok,    color: 'text-emerald-500' },
        { label: 'Low',      value: stats.low,   color: 'text-amber-500' },
        { label: 'Out',      value: stats.out,   color: 'text-rose-500' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-muted/40 border rounded-xl px-4 py-3 text-center">
          <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
          <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

function FilterTabs({ active, onChange, counts }: {
  active: StockFilter
  onChange: (f: StockFilter) => void
  counts: Record<StockFilter, number>
}) {
  const tabs: { key: StockFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'low', label: 'Low / Out' },
    { key: 'ok',  label: 'In Stock' },
  ]
  return (
    <div className="flex gap-1 mb-4 bg-muted/40 border rounded-xl p-1">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-2 rounded-lg transition-all
            ${active === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {label}
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums
            ${active === key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="border rounded-2xl p-5 bg-card animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 w-32 bg-muted rounded-full" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-7 w-20 bg-muted rounded mb-2" />
      <div className="h-4 w-24 bg-muted rounded" />
    </div>
  )
}

// ─── Inventory card ───────────────────────────────────────────────────────────

function InventoryCard({ item, isAdmin }: { item: InventoryItem; isAdmin: boolean }) {
  const status = stockStatus(item)

  return (
    <Card className="relative group hover:shadow-md transition-all duration-200 border bg-card overflow-hidden">
      {/* Left accent */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl
        ${status === 'out' ? 'bg-rose-500' : status === 'low' ? 'bg-amber-500' : 'bg-emerald-500'}`}
      />

      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StockBadge item={item} />
            {item.category && (
              <Badge variant="secondary" className="text-[11px]">{item.category}</Badge>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Stock adjustment buttons */}
            <Link href={`/inventory/${item.id}/adjust?type=out`}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-500" title="Deduct stock">
                <Minus className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href={`/inventory/${item.id}/adjust?type=in`}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-emerald-500" title="Add stock">
                <TrendingUp className="h-3.5 w-3.5" />
              </Button>
            </Link>
            {isAdmin && (
              <Link href={`/inventory/${item.id}/edit`}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        <h3 className="text-lg font-bold text-foreground leading-tight">{item.name}</h3>

        <div className="flex items-baseline gap-1.5 mt-2">
          <span className={`text-3xl font-black tabular-nums
            ${status === 'out' ? 'text-rose-500' : status === 'low' ? 'text-amber-500' : 'text-foreground'}`}>
            {item.quantity}
          </span>
          <span className="text-sm text-muted-foreground font-medium">{item.unit}</span>
        </div>

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span>Threshold: {item.low_stock_threshold} {item.unit}</span>
          {item.cost_price != null && (
            <span>₹{item.cost_price.toLocaleString('en-IN')} / {item.unit}</span>
          )}
        </div>

        {item.notes && (
          <p className="mt-3 pt-3 border-t text-xs text-muted-foreground line-clamp-2">{item.notes}</p>
        )}

        {/* View history link */}
        <Link
          href={`/inventory/${item.id}/history`}
          className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          View history <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { user, role, loading: authLoading } = useAuth()
  const router = useRouter()
  const isAdmin = role === 'admin'

  const [items, setItems]         = useState<InventoryItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter]       = useState<StockFilter>('all')

  const debouncedSearch = useDebounce(searchTerm)

  useEffect(() => { if (!authLoading && !user) router.push('/login') }, [authLoading, user, router])

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name')

    if (data) setItems(data)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { if (user) fetchItems() }, [user, fetchItems])

  const baseFiltered = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    return items.filter(i =>
      i.name.toLowerCase().includes(term) ||
      i.category?.toLowerCase().includes(term)
    )
  }, [items, debouncedSearch])

  const counts = useMemo<Record<StockFilter, number>>(() => ({
    all: baseFiltered.length,
    low: baseFiltered.filter(i => stockStatus(i) === 'low' || stockStatus(i) === 'out').length,
    ok:  baseFiltered.filter(i => stockStatus(i) === 'ok').length,
  }), [baseFiltered])

  const filtered = useMemo(() => {
    if (filter === 'low') return baseFiltered.filter(i => stockStatus(i) !== 'ok')
    if (filter === 'ok')  return baseFiltered.filter(i => stockStatus(i) === 'ok')
    return baseFiltered
  }, [baseFiltered, filter])

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="p-2 rounded-xl bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Inventory</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Parts & consumables</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
              onClick={() => fetchItems(true)} disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {isAdmin && (
              <Link href="/inventory/add">
                <Button size="sm" className="h-8 text-xs font-semibold">
                  <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Item
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        {!loading && <StatsBar items={items} />}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name or category…"
            className="pl-10 bg-muted/40 border-muted h-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <FilterTabs active={filter} onChange={setFilter} counts={counts} />

        {/* Content */}
        {loading ? (
          <div className="space-y-4 mt-2">
            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No items found</p>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? `No items match "${searchTerm}"` : 'No inventory items yet.'}
            </p>
            {searchTerm && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearchTerm('')}>
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {filtered.map(item => (
              <InventoryCard key={item.id} item={item} isAdmin={isAdmin} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
