'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  PlusCircle, Search, X, ReceiptText, ArrowLeft,
  RefreshCw, Filter, Eye, Edit, CheckCircle,
  Clock, XCircle, Send, IndianRupee, Calendar,
  User, FileText, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sale {
  id: string
  invoice_number: string
  sale_date: string
  customer_name: string
  customer_phone: string | null
  customer_gstin: string | null
  sale_type: 'B2B' | 'B2C'
  supply_type: 'intrastate' | 'interstate'
  subtotal: number
  total_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
  payment_method: string | null
  item_count: number
  created_at: string
}

type StatusFilter = 'all' | 'draft' | 'sent' | 'paid' | 'cancelled'

function useDebounce<T>(value: T, delay = 300): T {
  const [d, setD] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return d
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft:     { label: 'Draft',     icon: <FileText className="h-3 w-3" />,   className: 'bg-muted/80 text-muted-foreground border-muted' },
  sent:      { label: 'Sent',      icon: <Send className="h-3 w-3" />,        className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  paid:      { label: 'Paid',      icon: <CheckCircle className="h-3 w-3" />, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  cancelled: { label: 'Cancelled', icon: <XCircle className="h-3 w-3" />,     className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ sales }: { sales: Sale[] }) {
  const stats = useMemo(() => {
    const paid  = sales.filter(s => s.status === 'paid')
    const open  = sales.filter(s => s.status === 'sent')
    return {
      total:    sales.length,
      revenue:  paid.reduce((s, i) => s + i.total_amount, 0),
      open:     open.reduce((s, i) => s + i.total_amount, 0),
      draft:    sales.filter(s => s.status === 'draft').length,
    }
  }, [sales])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { label: 'Invoices',    value: stats.total,                    color: 'text-foreground',   prefix: '' },
        { label: 'Revenue',     value: fmt(stats.revenue),             color: 'text-emerald-500',  prefix: '₹' },
        { label: 'Outstanding', value: fmt(stats.open),                color: 'text-amber-500',    prefix: '₹' },
        { label: 'Drafts',      value: stats.draft,                    color: 'text-muted-foreground', prefix: '' },
      ].map(({ label, value, color, prefix }) => (
        <div key={label} className="bg-muted/40 border rounded-xl px-3 py-3 text-center">
          <div className={`text-xl font-black tabular-nums leading-none ${color}`}>
            {prefix}{value}
          </div>
          <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-1">
            {label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

function FilterTabs({ active, onChange, counts }: {
  active: StatusFilter
  onChange: (f: StatusFilter) => void
  counts: Record<StatusFilter, number>
}) {
  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all',       label: 'All' },
    { key: 'draft',     label: 'Draft' },
    { key: 'sent',      label: 'Sent' },
    { key: 'paid',      label: 'Paid' },
    { key: 'cancelled', label: 'Void' },
  ]
  return (
    <div className="flex gap-1 mb-4 bg-muted/40 border rounded-xl p-1 overflow-x-auto">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1 text-xs font-semibold py-1.5 px-1 rounded-lg transition-all whitespace-nowrap
            ${active === key
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'}`}
        >
          <span className="truncate">{label}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums shrink-0
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
        <div className="h-5 w-28 bg-muted rounded-full" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
      <div className="h-6 w-40 bg-muted rounded mb-2" />
      <div className="h-4 w-24 bg-muted rounded" />
    </div>
  )
}

// ─── Sale card ────────────────────────────────────────────────────────────────

function SaleCard({ sale }: { sale: Sale }) {
  const cfg = STATUS_CONFIG[sale.status]

  return (
    <Card className="relative hover:shadow-md transition-all duration-200 border bg-card overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl
        ${sale.status === 'paid' ? 'bg-emerald-500'
          : sale.status === 'sent' ? 'bg-sky-500'
          : sale.status === 'cancelled' ? 'bg-rose-500'
          : 'bg-muted-foreground/30'}`}
      />
      <CardContent className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`gap-1 text-[11px] ${cfg.className}`}>
              {cfg.icon} {cfg.label}
            </Badge>
            <Badge variant="outline" className="text-[11px] font-mono bg-muted/60">
              {sale.invoice_number}
            </Badge>
            <Badge variant="secondary" className="text-[11px]">
              {sale.sale_type}
            </Badge>
            {sale.customer_gstin && (
              <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                GST: {sale.customer_gstin}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Link href={`/sales/${sale.id}/invoice`}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="View invoice">
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Link href={`/sales/${sale.id}/edit`}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        <h3 className="text-lg font-bold text-foreground leading-tight">{sale.customer_name}</h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 opacity-60" />
            {new Date(sale.sale_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {sale.item_count > 0 && (
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 opacity-60" />
              {sale.item_count} item{sale.item_count !== 1 ? 's' : ''}
            </span>
          )}
          {sale.payment_method && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full capitalize">{sale.payment_method}</span>
          )}
        </div>

        {/* Amount summary */}
        <div className="mt-3 pt-3 border-t flex items-end justify-between gap-2">
          <div className="text-xs text-muted-foreground space-y-0.5">
            {sale.supply_type === 'intrastate' ? (
              <>
                <div>CGST: ₹{fmt(sale.cgst_amount)} · SGST: ₹{fmt(sale.sgst_amount)}</div>
              </>
            ) : (
              <div>IGST: ₹{fmt(sale.igst_amount)}</div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-foreground tabular-nums">
              ₹{fmt(sale.total_amount)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const { user, role, loading: authLoading } = useAuth()
  const router = useRouter()

  const [sales, setSales]         = useState<Sale[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter]       = useState<StatusFilter>('all')

  const debouncedSearch = useDebounce(searchTerm)

  useEffect(() => { if (!authLoading && !user) router.push('/login') }, [authLoading, user, router])

  const fetchSales = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data } = await supabase
      .from('sales_summary')
      .select('*')
      .order('sale_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (data) setSales(data as Sale[])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { if (user) fetchSales() }, [user, fetchSales])

  const baseFiltered = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    return sales.filter(s =>
      s.customer_name.toLowerCase().includes(term) ||
      s.invoice_number.toLowerCase().includes(term) ||
      s.customer_phone?.includes(term) ||
      s.customer_gstin?.toLowerCase().includes(term)
    )
  }, [sales, debouncedSearch])

  const counts = useMemo<Record<StatusFilter, number>>(() => ({
    all:       baseFiltered.length,
    draft:     baseFiltered.filter(s => s.status === 'draft').length,
    sent:      baseFiltered.filter(s => s.status === 'sent').length,
    paid:      baseFiltered.filter(s => s.status === 'paid').length,
    cancelled: baseFiltered.filter(s => s.status === 'cancelled').length,
  }), [baseFiltered])

  const filtered = useMemo(() =>
    filter === 'all' ? baseFiltered : baseFiltered.filter(s => s.status === filter),
    [baseFiltered, filter]
  )

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
              <ReceiptText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Sales & Invoices</h1>
              <p className="text-xs text-muted-foreground mt-0.5">B2B · B2C · GST invoicing</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
              onClick={() => fetchSales(true)} disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Link href="/sales/new">
              <Button size="sm" className="h-8 text-xs font-semibold">
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> New Invoice
              </Button>
            </Link>
          </div>
        </div>

        {!loading && <StatsBar sales={sales} />}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search customer, invoice no, GSTIN…"
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

        {loading ? (
          <div className="space-y-4 mt-2">{[1,2,3].map(i => <SkeletonCard key={i} />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No invoices found</p>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? `No matches for "${searchTerm}"` : 'Create your first invoice.'}
            </p>
            {!searchTerm && (
              <Link href="/sales/new" className="mt-4">
                <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> New Invoice</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {filtered.map(sale => <SaleCard key={sale.id} sale={sale} />)}
          </div>
        )}
      </div>
    </div>
  )
}
