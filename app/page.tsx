'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import {
  PlusCircle, Phone, MapPin, Search, Trash2, Calendar,
  Edit, Clock, CheckCircle, ShieldAlert, LogOut, Settings,
  UserCheck, UserPlus, X, AlertTriangle, ChevronDown,
  Wrench, RefreshCw, Filter
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { ModeToggle } from '@/components/modetoggle'
import Image from 'next/image'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select"

// ─── Types ────────────────────────────────────────────────────────────────────

type ServiceStatus = 'pending' | 'completed' | 'warranty'
type PaymentStatus = 'paid' | 'partial' | 'pending' | 'refunded' | 'partial_refunded'

interface ServiceLog {
  id: string
  customer_name: string
  phone_number?: string
  address?: string
  city?: string
  service_date: string
  status: ServiceStatus
  payment_status: PaymentStatus
  job_token?: string
  heater_brand?: string
  capacity?: string
  technician_notes?: string
  images?: string | string[]
  assigned_technician?: string
}

interface Technician {
  id: string
  email: string
}

type FilterTab = 'all' | ServiceStatus

interface Toast {
  id: string
  message: string
  type: 'success' | 'error'
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToastStack({ toasts, onRemove }: { toasts: Toast[], onRemove: (id: string) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border text-sm font-medium
            pointer-events-auto animate-in slide-in-from-bottom-4 duration-300
            ${t.type === 'success'
              ? 'bg-emerald-950 border-emerald-700 text-emerald-200'
              : 'bg-rose-950 border-rose-700 text-rose-200'
            }`}
        >
          {t.type === 'success'
            ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            : <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => onRemove(t.id)} className="opacity-60 hover:opacity-100 transition-opacity">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

function StatsBar({ services, role }: { services: ServiceLog[], role: string | null }) {
  const stats = useMemo(() => ({
    total: services.length,
    pending: services.filter(s => s.status === 'pending').length,
    completed: services.filter(s => s.status === 'completed').length,
    warranty: services.filter(s => s.status === 'warranty').length,
    unassigned: services.filter(s => s.status === 'pending' && !s.assigned_technician).length,
  }), [services])

  const items = role === 'admin'
    ? [
        { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
        { label: 'Unassigned', value: stats.unassigned, color: 'text-rose-400' },
        { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
        { label: 'Warranty', value: stats.warranty, color: 'text-sky-400' },
      ]
    : [
        { label: 'Total', value: stats.total, color: 'text-foreground' },
        { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
        { label: 'Completed', value: stats.completed, color: 'text-emerald-400' },
        { label: 'Warranty', value: stats.warranty, color: 'text-sky-400' },
      ]

  return (
    <div className="grid grid-cols-4 gap-3 mb-6">
      {items.map(({ label, value, color }) => (
        <div key={label} className="bg-muted/40 border rounded-xl px-4 py-3 text-center">
          <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
          <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  )
}

function FilterTabs({
  active, onChange, counts
}: {
  active: FilterTab
  onChange: (t: FilterTab) => void
  counts: Record<FilterTab, number>
}) {
  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'completed', label: 'Completed' },
    { key: 'warranty', label: 'Warranty' },
  ]

  return (
    <div className="flex gap-1 mb-4 bg-muted/40 border rounded-xl p-1">
      {tabs.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-2 rounded-lg transition-all
            ${active === key
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
            }`}
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

function SkeletonCard() {
  return (
    <div className="border rounded-2xl p-5 bg-card animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 bg-muted rounded-full" />
        <div className="h-5 w-24 bg-muted rounded-full" />
        <div className="h-5 w-20 bg-muted rounded-full" />
      </div>
      <div className="h-6 w-48 bg-muted rounded mb-4" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-4 w-28 bg-muted rounded" />
        <div className="h-4 w-40 bg-muted rounded col-span-2" />
      </div>
    </div>
  )
}

// ─── Image gallery helper ─────────────────────────────────────────────────────

function parseImages(raw: string | string[] | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ─── Status / Payment config ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  pending:   { icon: <Clock className="h-3 w-3" />,        variant: 'destructive', label: 'Pending' },
  completed: { icon: <CheckCircle className="h-3 w-3" />,  variant: 'default',     label: 'Completed' },
  warranty:  { icon: <ShieldAlert className="h-3 w-3" />,  variant: 'secondary',   label: 'Warranty' },
}

const PAYMENT_LABELS: Record<string, { label: string; className: string }> = {
  paid:             { label: 'Paid',            className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  partial:          { label: 'Partial',         className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  pending:          { label: 'Unpaid',          className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  refunded:         { label: 'Refunded',        className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
  partial_refunded: { label: 'Partial Refund',  className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' },
}

// ─── Service Card ─────────────────────────────────────────────────────────────

interface ServiceCardProps {
  item: ServiceLog
  role: string | null
  onDelete: (id: string) => void
  onAssign: (id: string) => void
}

function ServiceCard({ item, role, onDelete, onAssign }: ServiceCardProps) {
  const images = parseImages(item.images)
  const status = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.completed
  const payment = PAYMENT_LABELS[item.payment_status] ?? { label: 'Unknown', className: 'bg-muted text-muted-foreground border-muted' }
  const isAdmin = role === 'admin'

  return (
    <Card className="group relative hover:shadow-lg transition-all duration-200 border bg-card overflow-hidden">
      {/* Left accent bar by status */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl
        ${item.status === 'pending' ? 'bg-amber-500' : item.status === 'warranty' ? 'bg-sky-500' : 'bg-emerald-500'}`}
      />

      <CardContent className="p-5 pl-6">
        {/* Top row: badges + actions */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={status.variant} className="gap-1 text-[11px]">
              {status.icon} {status.label}
            </Badge>

            {item.job_token && (
              <Badge variant="outline" className="text-[11px] font-mono bg-muted/60">
                #{item.job_token}
              </Badge>
            )}

            {item.heater_brand && (
              <Badge variant="secondary" className="text-[11px]">
                {item.heater_brand}{item.capacity ? ` · ${item.capacity}` : ''}
              </Badge>
            )}

            <Badge variant="outline" className={`text-[11px] ${payment.className}`}>
              {payment.label}
            </Badge>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && item.status === 'pending' && !item.assigned_technician && (
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={() => onAssign(item.id)}
                title="Assign technician"
              >
                <UserPlus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Link href={`/edit/${item.id}`}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                <Edit className="h-3.5 w-3.5" />
              </Button>
            </Link>
            {isAdmin && (
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Customer name */}
        <h3 className="text-lg font-bold text-foreground leading-tight mb-3">
          {item.customer_name}
        </h3>

        {/* Meta grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 opacity-60 shrink-0" />
            <span>
              {new Date(item.service_date).toLocaleDateString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              })}
            </span>
          </div>

          {item.phone_number && (
            <a
              href={`tel:${item.phone_number}`}
              className="flex items-center gap-2 hover:text-primary transition-colors"
            >
              <Phone className="h-3.5 w-3.5 opacity-60 shrink-0" />
              {item.phone_number}
            </a>
          )}

          {item.address && (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin className="h-3.5 w-3.5 opacity-60 shrink-0 mt-0.5" />
              <span>{item.address}{item.city ? `, ${item.city}` : ''}</span>
            </div>
          )}
        </div>

        {/* Assignment badge */}
        {isAdmin && item.assigned_technician && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {item.assigned_technician}
            </span>
          </div>
        )}

        {/* Notes */}
        {item.technician_notes && (
          <div className="mt-3 pt-3 border-t text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70 block mb-1">
              Notes
            </span>
            {item.technician_notes}
          </div>
        )}

        {/* Photo gallery */}
        {images.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Photos
              </span>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {images.length}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 snap-x scrollbar-hide">
              {images.slice(0, 6).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 snap-start rounded-lg overflow-hidden ring-1 ring-border hover:ring-primary transition-all"
                >
                  <Image src={url} alt="Service photo" width={80} height={80} className="w-20 h-20 object-cover" />
                </a>
              ))}
              {images.length > 6 && (
                <div className="flex-shrink-0 w-20 h-20 bg-muted border border-dashed rounded-lg flex items-center justify-center text-xs text-muted-foreground font-medium">
                  +{images.length - 6}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const { user, role, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const { toasts, addToast, removeToast } = useToast()

  const [services, setServices]       = useState<ServiceLog[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [searchTerm, setSearchTerm]   = useState('')
  const [filterTab, setFilterTab]     = useState<FilterTab>('all')

  const [deleteId, setDeleteId]   = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [assignId, setAssignId]               = useState<string | null>(null)
  const [selectedTechnician, setSelectedTech] = useState('')
  const [isAssigning, setIsAssigning]         = useState(false)

  const debouncedSearch = useDebounce(searchTerm, 300)
  const isAdmin = role === 'admin'

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  // ── Data fetching ───────────────────────────────────────────────────────────
  const fetchServices = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from('service_logs')
      .select('*')
      .order('service_date', { ascending: false })

    if (error) {
      addToast('Failed to load service logs.', 'error')
    } else if (data) {
      setServices(data)
    }

    setLoading(false)
    setRefreshing(false)
  }, [addToast])

  const fetchTechnicians = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('role', 'technician')
      .order('email')
    if (data) setTechnicians(data)
  }, [])

  useEffect(() => {
    if (user) {
      fetchServices()
      if (isAdmin) fetchTechnicians()
    }
  }, [user, isAdmin, fetchServices, fetchTechnicians])

  // ── Derived data ────────────────────────────────────────────────────────────
  const baseFiltered = useMemo(() => {
    const term = debouncedSearch.toLowerCase()
    return services.filter(item =>
      item.customer_name?.toLowerCase().includes(term) ||
      item.phone_number?.includes(term) ||
      item.job_token?.toLowerCase().includes(term)
    )
  }, [services, debouncedSearch])

  const tabCounts = useMemo<Record<FilterTab, number>>(() => ({
    all:       baseFiltered.length,
    pending:   baseFiltered.filter(s => s.status === 'pending').length,
    completed: baseFiltered.filter(s => s.status === 'completed').length,
    warranty:  baseFiltered.filter(s => s.status === 'warranty').length,
  }), [baseFiltered])

  const filteredServices = useMemo(() =>
    filterTab === 'all' ? baseFiltered : baseFiltered.filter(s => s.status === filterTab),
    [baseFiltered, filterTab]
  )

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteId || !isAdmin) return
    setIsDeleting(true)
    const { error } = await supabase.from('service_logs').delete().eq('id', deleteId)
    if (error) {
      addToast('Failed to delete entry.', 'error')
    } else {
      setServices(prev => prev.filter(s => s.id !== deleteId))
      addToast('Service log deleted.')
    }
    setDeleteId(null)
    setIsDeleting(false)
  }

  async function confirmAssign() {
    if (!assignId || !selectedTechnician || !isAdmin) return
    setIsAssigning(true)
    const { error } = await supabase
      .from('service_logs')
      .update({ assigned_technician: selectedTechnician })
      .eq('id', assignId)

    if (error) {
      addToast('Failed to assign technician.', 'error')
    } else {
      setServices(prev =>
        prev.map(s => s.id === assignId ? { ...s, assigned_technician: selectedTechnician } : s)
      )
      addToast(`Assigned to ${selectedTechnician}`)
    }
    setAssignId(null)
    setSelectedTech('')
    setIsAssigning(false)
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex items-center gap-3 text-muted-foreground">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
        <span className="text-sm font-medium">Authenticating…</span>
      </div>
    </div>
  )
  if (!user) return null

  const pageTitle = isAdmin ? 'Service Dashboard' : 'My Service Logs'
  const deleteTarget = services.find(s => s.id === deleteId)

  return (
    <div className="min-h-screen bg-background">
      <ToastStack toasts={toasts} onRemove={removeToast} />

      {/* ── Delete Dialog ──────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Service Log
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action is permanent. The log for{' '}
              <span className="font-semibold text-foreground">{deleteTarget?.customer_name}</span>{' '}
              will be erased.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Assign Dialog ──────────────────────────────────────────────────── */}
      <AlertDialog open={!!assignId} onOpenChange={open => { if (!open) { setAssignId(null); setSelectedTech('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Assign Technician
            </AlertDialogTitle>
            <AlertDialogDescription>
              Choose a technician for{' '}
              <span className="font-semibold text-foreground">
                {services.find(s => s.id === assignId)?.customer_name}
              </span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Select value={selectedTechnician} onValueChange={setSelectedTech}>
            <SelectTrigger>
              <SelectValue placeholder="Select technician…" />
            </SelectTrigger>
            <SelectContent>
              {technicians.length === 0 && (
                <SelectItem value="__none__" disabled>No technicians found</SelectItem>
              )}
              {technicians.map(tech => (
                <SelectItem key={tech.id} value={tech.email}>
                  {tech.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAssign}
              disabled={!selectedTechnician || isAssigning}
            >
              {isAssigning ? 'Assigning…' : 'Confirm Assignment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Page Content ───────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => fetchServices(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
              <ModeToggle />
              {isAdmin && (
                <Link href="/admin/settings">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={signOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-primary capitalize">{role}</span>
              <span className="mx-1.5">·</span>
              <span>{user?.email}</span>
            </p>
            <Link href="/add">
              <Button size="sm" className="h-8 text-xs font-semibold">
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Entry
              </Button>
            </Link>
          </div>
        </header>

        {/* Stats */}
        {!loading && <StatsBar services={services} role={role} />}

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search name, phone, or token…"
            className="pl-10 bg-muted/40 border-muted h-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs — show all-status tabs for non-admin, only show if data exists */}
        {!loading && !isAdmin && (
          <FilterTabs active={filterTab} onChange={setFilterTab} counts={tabCounts} />
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-4 mt-2">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No results found</p>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? `No logs match "${searchTerm}"` : 'No service logs yet. Add your first entry.'}
            </p>
            {searchTerm && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearchTerm('')}>
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {filteredServices.map(item => (
              <ServiceCard
                key={item.id}
                item={item}
                role={role}
                onDelete={setDeleteId}
                onAssign={setAssignId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}