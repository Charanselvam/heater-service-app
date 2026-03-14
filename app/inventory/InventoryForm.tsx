'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, AlertCircle, Package,
  Hash, Tag, Ruler, IndentDecrease, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  name: string
  category: string
  unit: string
  quantity: string       // string for input, parsed on submit
  low_stock_threshold: string
  cost_price: string
  notes: string
}

const EMPTY: FormData = {
  name: '', category: '', unit: 'pcs',
  quantity: '0', low_stock_threshold: '5',
  cost_price: '', notes: '',
}

const UNIT_PRESETS = ['pcs', 'nos', 'kg', 'g', 'litre', 'ml', 'mtr', 'roll', 'box', 'set']

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
}

function Field({
  id, label, icon, required, error, children,
}: {
  id?: string; label: string; icon?: React.ReactNode
  required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
        {required && <span className="text-destructive text-xs ml-0.5">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  )
}

// ─── Main form (used for both add + edit) ─────────────────────────────────────

export default function InventoryForm({ mode }: { mode: 'add' | 'edit' }) {
  const { user, role, loading: authLoading } = useAuth()
  const router = useRouter()
  const params = useParams<{ id: string }>()

  const [formData, setFormData]     = useState<FormData>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [isLoading, setIsLoading]   = useState(mode === 'edit')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [loadError, setLoadError]       = useState('')

  // ── Guards ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user)           router.push('/login')
    if (!authLoading && role !== 'admin') router.push('/inventory')
  }, [authLoading, user, role, router])

// ── Load existing (edit mode) ───────────────────────────────────────────────
const { id } = params ?? {}

const fetchItem = useCallback(async () => {
  if (!id) return
  setIsLoading(true)
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    setLoadError('Could not load item.')
  } else {
    setFormData({
      name:                data.name         ?? '',
      category:            data.category     ?? '',
      unit:                data.unit         ?? 'pcs',
      quantity:            String(data.quantity          ?? 0),
      low_stock_threshold: String(data.low_stock_threshold ?? 5),
      cost_price:          data.cost_price != null ? String(data.cost_price) : '',
      notes:               data.notes        ?? '',
    })
  }
  setIsLoading(false)
}, [id])

useEffect(() => {
  if (mode === 'edit' && user) fetchItem()
}, [mode, user, fetchItem])


  // ── Helpers ─────────────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof FormData>(key: K, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: undefined }))
  }, [])

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.name.trim())          errors.name     = 'Item name is required'
    if (!formData.unit.trim())          errors.unit     = 'Unit is required'
    if (isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0)
      errors.quantity = 'Enter a valid quantity (≥ 0)'
    if (isNaN(Number(formData.low_stock_threshold)) || Number(formData.low_stock_threshold) < 0)
      errors.low_stock_threshold = 'Enter a valid threshold (≥ 0)'
    if (formData.cost_price && isNaN(Number(formData.cost_price)))
      errors.cost_price = 'Enter a valid price'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    setSubmitError('')

    const payload = {
      name:                formData.name.trim(),
      category:            formData.category.trim()  || null,
      unit:                formData.unit.trim(),
      quantity:            Number(formData.quantity),
      low_stock_threshold: Number(formData.low_stock_threshold),
      cost_price:          formData.cost_price ? Number(formData.cost_price) : null,
      notes:               formData.notes.trim()      || null,
    }

    const { error } = mode === 'add'
      ? await supabase.from('inventory_items').insert([payload])
      : await supabase.from('inventory_items').update(payload).eq('id', params!.id)

    if (error) {
      setSubmitError(error.message)
      setIsSubmitting(false)
    } else {
      router.push('/inventory')
      router.refresh()
    }
  }

  // ── Loading / error states ──────────────────────────────────────────────────
  if (authLoading || isLoading) return (
    <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-medium">{authLoading ? 'Authenticating…' : 'Loading item…'}</span>
    </div>
  )
  if (loadError) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="font-semibold">{loadError}</p>
      <Link href="/inventory"><Button variant="outline">Back to Inventory</Button></Link>
    </div>
  )
  if (!user || role !== 'admin') return null

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/inventory">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">
                {mode === 'add' ? 'Add Inventory Item' : 'Edit Item'}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {mode === 'add' ? 'Register a new part or consumable' : formData.name}
              </p>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5">

            {/* ── Item details ───────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <SectionLabel label="Item Details" />

                <Field id="name" label="Item Name" icon={<Package className="h-3.5 w-3.5" />} required error={fieldErrors.name}>
                  <Input
                    id="name" placeholder="e.g. Anode Rod, Pressure Relief Valve"
                    value={formData.name}
                    onChange={e => set('name', e.target.value)}
                    className={fieldErrors.name ? 'border-destructive' : ''}
                  />
                </Field>

                <Field id="category" label="Category" icon={<Tag className="h-3.5 w-3.5" />}>
                  <Input
                    id="category" placeholder="e.g. Spare Parts, Consumables, Tools"
                    value={formData.category}
                    onChange={e => set('category', e.target.value)}
                  />
                </Field>

                <Field id="unit" label="Unit" icon={<Ruler className="h-3.5 w-3.5" />} required error={fieldErrors.unit}>
                  <div className="space-y-2">
                    <Input
                      id="unit" placeholder="e.g. pcs, kg, litre"
                      value={formData.unit}
                      onChange={e => set('unit', e.target.value)}
                      className={fieldErrors.unit ? 'border-destructive' : ''}
                    />
                    {/* Unit presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {UNIT_PRESETS.map(u => (
                        <button
                          key={u} type="button"
                          onClick={() => set('unit', u)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition-all
                            ${formData.unit === u
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-muted/60 text-muted-foreground border-muted hover:border-foreground/30'
                            }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>
              </CardContent>
            </Card>

            {/* ── Stock ──────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <SectionLabel label="Stock Levels" />
                <div className="grid grid-cols-2 gap-4">
                  <Field id="quantity" label="Current Quantity" icon={<Hash className="h-3.5 w-3.5" />} required error={fieldErrors.quantity}>
                    <Input
                      id="quantity" type="number" inputMode="numeric" min={0}
                      value={formData.quantity}
                      onChange={e => set('quantity', e.target.value)}
                      className={fieldErrors.quantity ? 'border-destructive' : ''}
                    />
                  </Field>

                  <Field id="low_stock_threshold" label="Low Stock Alert" icon={<IndentDecrease className="h-3.5 w-3.5" />} required error={fieldErrors.low_stock_threshold}>
                    <Input
                      id="low_stock_threshold" type="number" inputMode="numeric" min={0}
                      value={formData.low_stock_threshold}
                      onChange={e => set('low_stock_threshold', e.target.value)}
                      className={fieldErrors.low_stock_threshold ? 'border-destructive' : ''}
                    />
                    <p className="text-[11px] text-muted-foreground">Alert when qty ≤ this</p>
                  </Field>
                </div>

                <Field id="cost_price" label="Cost Price per Unit (₹)" error={fieldErrors.cost_price}>
                  <Input
                    id="cost_price" type="number" inputMode="decimal" min={0} placeholder="Optional"
                    value={formData.cost_price}
                    onChange={e => set('cost_price', e.target.value)}
                    className={fieldErrors.cost_price ? 'border-destructive' : ''}
                  />
                </Field>
              </CardContent>
            </Card>

            {/* ── Notes ──────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Notes" />
                <Textarea
                  id="notes"
                  placeholder="Compatible models, supplier info, storage location…"
                  rows={3}
                  value={formData.notes}
                  onChange={e => set('notes', e.target.value)}
                  className="resize-none text-sm"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sticky footer */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <Link href="/inventory" className="flex-1">
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting} className="flex-1 font-semibold">
                {isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{mode === 'add' ? 'Saving…' : 'Updating…'}</>
                  : <><Save className="mr-2 h-4 w-4" />{mode === 'add' ? 'Save Item' : 'Update Item'}</>
                }
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
