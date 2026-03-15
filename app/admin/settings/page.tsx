'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Plus, Trash2, Settings, ArrowLeft, Loader2,
  AlertCircle, Tag, Gauge, Cpu,
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Brand    { id: number; name: string; is_active: boolean }
interface Capacity { id: number; size: string; is_active: boolean }
interface Model    { id: string; brand: string; model: string; is_active: boolean }

type SimpleTable = 'heater_brands' | 'heater_capacities'

// ─── Shared sub-components ────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
      {label}
    </p>
  )
}

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

// ─── Simple section (brands / capacities) ────────────────────────────────────

function ManageSection<T extends { id: number }>({
  icon, title, items, getLabel, table, inputPlaceholder, onAdd, onDelete, deletingId,
}: {
  icon: React.ReactNode
  title: string
  items: T[]
  getLabel: (item: T) => string
  table: SimpleTable
  inputPlaceholder: string
  onAdd: (table: SimpleTable, value: string) => Promise<void>
  onDelete: (table: SimpleTable, id: number) => Promise<void>
  deletingId: number | null
}) {
  const [value, setValue]   = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError]   = useState('')

  async function handleAdd() {
    const trimmed = value.trim()
    if (!trimmed) { setError('Enter a value first.'); return }
    if (items.some(i => getLabel(i).toLowerCase() === trimmed.toLowerCase())) {
      setError('Already exists.'); return
    }
    setAdding(true); setError('')
    await onAdd(table, trimmed)
    setValue(''); setAdding(false)
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">{icon}</div>
          <SectionLabel label={title} />
        </div>
        <div className="flex gap-2 mb-4">
          <Input
            value={value}
            onChange={e => { setValue(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder={inputPlaceholder}
            className={error ? 'border-destructive' : ''}
          />
          <Button onClick={handleAdd} disabled={adding} size="icon" className="shrink-0">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-destructive flex items-center gap-1 mb-3">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}
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

// ─── Models section ───────────────────────────────────────────────────────────

function ModelsSection({
  brands, models, onAdd, onDelete, deletingId,
}: {
  brands: Brand[]
  models: Model[]
  onAdd: (brand: string, model: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  deletingId: string | null
}) {
  const [selectedBrand, setSelectedBrand] = useState('')
  const [modelName, setModelName]         = useState('')
  const [adding, setAdding]               = useState(false)
  const [error, setError]                 = useState('')
  const [filterBrand, setFilterBrand]     = useState('__all__')

  async function handleAdd() {
    const trimmed = modelName.trim()
    if (!selectedBrand) { setError('Select a brand first.'); return }
    if (!trimmed)        { setError('Enter a model name.');  return }
    if (models.some(m =>
      m.brand.toLowerCase() === selectedBrand.toLowerCase() &&
      m.model.toLowerCase() === trimmed.toLowerCase()
    )) { setError('Model already exists for this brand.'); return }

    setAdding(true); setError('')
    await onAdd(selectedBrand, trimmed)
    setModelName(''); setAdding(false)
  }

  const displayed = filterBrand === '__all__'
    ? models
    : models.filter(m => m.brand === filterBrand)

  // Group by brand
  const grouped = displayed.reduce<Record<string, Model[]>>((acc, m) => {
    ;(acc[m.brand] ??= []).push(m)
    return acc
  }, {})

  // Only show brand filter tabs for brands that have at least one model
  const brandsWithModels = brands.filter(b => models.some(m => m.brand === b.name))

  return (
    <Card className="overflow-hidden sm:col-span-2">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Cpu className="h-4 w-4" />
          </div>
          <SectionLabel label="Heater Models" />
        </div>

        {/* Add row */}
        <div className="flex flex-col sm:flex-row gap-2 mb-1">
          <Select
            value={selectedBrand}
            onValueChange={v => { setSelectedBrand(v); setError('') }}
          >
            <SelectTrigger className={`sm:w-44 shrink-0 ${!selectedBrand && error ? 'border-destructive' : ''}`}>
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.map(b => (
                <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2 flex-1">
            <Input
              value={modelName}
              onChange={e => { setModelName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. Eterno 2, HSE-VAS"
              className={`flex-1 ${modelName.trim() === '' && error && selectedBrand ? 'border-destructive' : ''}`}
            />
            <Button onClick={handleAdd} disabled={adding} size="icon" className="shrink-0">
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1 mb-3 mt-2">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}

        {/* Brand filter tabs */}
        {brandsWithModels.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-4 mb-4">
            <button
              onClick={() => setFilterBrand('__all__')}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all
                ${filterBrand === '__all__'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/60 text-muted-foreground border-muted hover:border-foreground/30'}`}
            >
              All ({models.length})
            </button>
            {brandsWithModels.map(b => {
              const count = models.filter(m => m.brand === b.name).length
              return (
                <button
                  key={b.id}
                  onClick={() => setFilterBrand(b.name)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all
                    ${filterBrand === b.name
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/60 text-muted-foreground border-muted hover:border-foreground/30'}`}
                >
                  {b.name} ({count})
                </button>
              )
            })}
          </div>
        )}

        {/* Model chips */}
        {models.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No models yet. Select a brand above and add one.
          </p>
        ) : displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No models for this brand yet.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([brand, brandModels]) => (
              <div key={brand}>
                {/* Show brand sub-heading only when viewing all */}
                {filterBrand === '__all__' && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {brand}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {brandModels.map(m => (
                    <Chip
                      key={m.id}
                      label={m.model}
                      onDelete={() => onDelete(m.id)}
                      deleting={deletingId === m.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-4">
          {models.length} {models.length === 1 ? 'model' : 'models'}
          {brandsWithModels.length > 0 && ` across ${brandsWithModels.length} brand${brandsWithModels.length !== 1 ? 's' : ''}`}
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
  const [models, setModels]         = useState<Model[]>([])
  const [loadError, setLoadError]   = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user)            router.push('/login')
    if (!authLoading && role !== 'admin') router.push('/')
  }, [authLoading, user, role, router])

  const fetchAll = useCallback(async () => {
    setLoadError('')
    const [bRes, cRes, mRes] = await Promise.all([
      supabase.from('heater_brands').select('*').order('name'),
      supabase.from('heater_capacities').select('*').order('size'),
      supabase.from('heater_models').select('*').order('brand').order('model'),
    ])
    if (bRes.error || cRes.error || mRes.error) {
      setLoadError('Failed to load settings. Please refresh.')
    } else {
      if (bRes.data) setBrands(bRes.data)
      if (cRes.data) setCapacities(cRes.data)
      if (mRes.data) setModels(mRes.data)
    }
  }, [])

  useEffect(() => {
    if (role === 'admin') fetchAll()
  }, [role, fetchAll])

  async function handleAdd(table: SimpleTable, value: string) {
    const payload = table === 'heater_brands' ? { name: value } : { size: value }
    const { error } = await supabase.from(table).insert([payload])
    if (!error) fetchAll()
  }

  async function handleDelete(table: SimpleTable, id: number) {
    setDeletingId(id)
    await supabase.from(table).delete().eq('id', id)
    table === 'heater_brands'
      ? setBrands(prev => prev.filter(b => b.id !== id))
      : setCapacities(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  async function handleAddModel(brand: string, model: string) {
    const { error } = await supabase.from('heater_models').insert([{ brand, model }])
    if (!error) {
      const { data } = await supabase
        .from('heater_models').select('*').order('brand').order('model')
      if (data) setModels(data)
    }
  }

  async function handleDeleteModel(id: string) {
    setDeletingModelId(id)
    await supabase.from('heater_models').delete().eq('id', id)
    setModels(prev => prev.filter(m => m.id !== id))
    setDeletingModelId(null)
  }

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

        {loadError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {loadError}
          </div>
        )}

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

          {/* Models spans full width */}
          <ModelsSection
            brands={brands}
            models={models}
            onAdd={handleAddModel}
            onDelete={handleDeleteModel}
            deletingId={deletingModelId}
          />
        </div>
      </div>
    </div>
  )
}