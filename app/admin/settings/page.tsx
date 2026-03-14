'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, Settings, ArrowLeft, Loader2, AlertCircle, Tag, Gauge } from 'lucide-react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Brand    { id: number; name: string; is_active: boolean }
interface Capacity { id: number; size: string; is_active: boolean }

type Table = 'heater_brands' | 'heater_capacities'

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
      {label}
    </p>
  )
}

// ─── Chip item ────────────────────────────────────────────────────────────────

function Chip({
  label, onDelete, deleting,
}: {
  label: string
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-muted border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground">
      {label}
      <button
        onClick={onDelete}
        disabled={deleting}
        className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 ml-0.5"
        aria-label={`Delete ${label}`}
      >
        {deleting
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <Trash2 className="h-3 w-3" />}
      </button>
    </span>
  )
}

// ─── Manage section ───────────────────────────────────────────────────────────

function ManageSection<T extends { id: number }>({
  icon, title, items, getLabel, table, inputPlaceholder,
  onAdd, onDelete, deletingId,
}: {
  icon: React.ReactNode
  title: string
  items: T[]
  getLabel: (item: T) => string
  table: Table
  inputPlaceholder: string
  onAdd: (table: Table, value: string) => Promise<void>
  onDelete: (table: Table, id: number) => Promise<void>
  deletingId: number | null
}) {
  const [value, setValue]     = useState('')
  const [adding, setAdding]   = useState(false)
  const [error, setError]     = useState('')

  async function handleAdd() {
    const trimmed = value.trim()
    if (!trimmed) { setError('Enter a value first.'); return }
    const exists = items.some(i => getLabel(i).toLowerCase() === trimmed.toLowerCase())
    if (exists) { setError('Already exists.'); return }
    setAdding(true)
    setError('')
    await onAdd(table, trimmed)
    setValue('')
    setAdding(false)
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">{icon}</div>
          <SectionLabel label={title} />
        </div>

        {/* Add input */}
        <div className="flex gap-2 mb-4">
          <Input
            value={value}
            onChange={e => { setValue(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={inputPlaceholder}
            className={error ? 'border-destructive' : ''}
          />
          <Button
            onClick={handleAdd}
            disabled={adding}
            size="icon"
            className="shrink-0"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1 mb-3">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}

        {/* Chips */}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No {title.toLowerCase()} yet. Add one above.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map(item => (
              <Chip
                key={item.id}
                label={getLabel(item)}
                onDelete={() => onDelete(table, item.id)}
                deleting={deletingId === item.id}
              />
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-4">
          {items.length} {items.length === 1 ? 'entry' : 'entries'}
        </p>
      </CardContent>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSettings() {
  const { user, role, loading: authLoading } = useAuth()
  const router = useRouter()

  const [brands, setBrands]         = useState<Brand[]>([])
  const [capacities, setCapacities] = useState<Capacity[]>([])
  const [loadError, setLoadError]   = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // ── Auth + role guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user)           router.push('/login')
    if (!authLoading && role !== 'admin') router.push('/')
  }, [authLoading, user, role, router])

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoadError('')
    const [bRes, cRes] = await Promise.all([
      supabase.from('heater_brands').select('*').order('name'),
      supabase.from('heater_capacities').select('*').order('size'),
    ])
    if (bRes.error || cRes.error) {
      setLoadError('Failed to load settings. Please refresh.')
    } else {
      if (bRes.data) setBrands(bRes.data)
      if (cRes.data) setCapacities(cRes.data)
    }
  }, [])

  useEffect(() => {
    if (role === 'admin') fetchAll()
  }, [role, fetchAll])

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleAdd(table: Table, value: string) {
    const payload = table === 'heater_brands' ? { name: value } : { size: value }
    const { error } = await supabase.from(table).insert([payload])
    if (!error) fetchAll()
  }

  async function handleDelete(table: Table, id: number) {
    setDeletingId(id)
    await supabase.from(table).delete().eq('id', id)
    table === 'heater_brands'
      ? setBrands(prev => prev.filter(b => b.id !== id))
      : setCapacities(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (authLoading || role !== 'admin') return (
    <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-medium">
        {authLoading ? 'Authenticating…' : 'Checking access…'}
      </span>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-16">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Admin Console</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Manage dropdown options</p>
            </div>
          </div>
        </div>

        {/* Load error */}
        {loadError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {loadError}
          </div>
        )}

        {/* Sections */}
        <div className="grid sm:grid-cols-2 gap-5">
          <ManageSection
            icon={<Tag className="h-4 w-4" />}
            title="Heater Brands"
            items={brands}
            getLabel={b => b.name}
            table="heater_brands"
            inputPlaceholder="e.g. Racold"
            onAdd={handleAdd}
            onDelete={handleDelete}
            deletingId={deletingId}
          />

          <ManageSection
            icon={<Gauge className="h-4 w-4" />}
            title="Capacities"
            items={capacities}
            getLabel={c => c.size}
            table="heater_capacities"
            inputPlaceholder="e.g. 25 Litre"
            onAdd={handleAdd}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </div>
      </div>
    </div>
  )
}