'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Edit2, Save, X, Loader2,
  AlertCircle, Package, Settings, Tag, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CatalogItem {
  id: string
  name: string
  type: 'heater' | 'spare' | 'labour' | 'amc'
  description: string | null
  hsn_sac: string | null
  unit: string
  price: number
  gst_rate: number
  is_active: boolean
}

interface CompanySettings {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  gstin: string | null
  phone: string | null
  email: string | null
  logo_url: string | null
  bank_name: string | null
  account_number: string | null
  ifsc_code: string | null
  upi_id: string | null
  invoice_prefix: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  heater: { label: '🔥 Heater',  color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
  spare:  { label: '🔧 Spare',   color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  labour: { label: '👷 Labour',  color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  amc:    { label: '📋 AMC',     color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
}

const GST_RATES = [0, 5, 12, 18, 28]
const UNIT_OPTIONS = ['nos', 'job', 'year', 'kg', 'mtr', 'litre', 'set', 'pair']

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(n)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
}

function Field({ id, label, required, error, children }: {
  id?: string; label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}{required && <span className="text-destructive ml-0.5 text-xs">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  )
}

// ─── Catalog item form ────────────────────────────────────────────────────────

interface ItemFormData {
  name: string
  type: CatalogItem['type']
  description: string
  hsn_sac: string
  unit: string
  price: string
  gst_rate: number
  is_active: boolean
}

const EMPTY_ITEM: ItemFormData = {
  name: '', type: 'spare', description: '', hsn_sac: '',
  unit: 'nos', price: '', gst_rate: 18, is_active: true,
}

function ItemFormModal({ initial, onSave, onClose }: {
  initial: ItemFormData | null
  onSave: (data: ItemFormData) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm]   = useState<ItemFormData>(initial ?? EMPTY_ITEM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const setF = (k: keyof ItemFormData, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) < 0) { setError('Enter a valid price.'); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-bold text-foreground">{initial ? 'Edit Item' : 'Add Catalog Item'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <Field id="name" label="Item Name" required>
            <Input id="name" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Racold Eterno 2 - 25L" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="type" label="Type" required>
              <select value={form.type} onChange={e => setF('type', e.target.value)}
                className="w-full bg-background border rounded-lg px-3 py-2 text-sm">
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field id="unit" label="Unit" required>
              <select value={form.unit} onChange={e => setF('unit', e.target.value)}
                className="w-full bg-background border rounded-lg px-3 py-2 text-sm">
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id="price" label="Price (₹)" required>
              <Input id="price" type="number" min={0} step="0.01"
                value={form.price} onChange={e => setF('price', e.target.value)}
                className="tabular-nums" placeholder="0.00" />
            </Field>
            <Field id="gst_rate" label="GST Rate">
              <select value={form.gst_rate} onChange={e => setF('gst_rate', Number(e.target.value))}
                className="w-full bg-background border rounded-lg px-3 py-2 text-sm">
                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field id="hsn_sac" label="HSN / SAC Code">
              <Input id="hsn_sac" value={form.hsn_sac}
                onChange={e => setF('hsn_sac', e.target.value)}
                className="font-mono tracking-wider" placeholder="e.g. 8516" />
            </Field>
            <Field id="description" label="Description">
              <Input id="description" value={form.description ?? ''}
                onChange={e => setF('description', e.target.value)} placeholder="Optional" />
            </Field>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setF('is_active', e.target.checked)} className="rounded" />
            <span className="text-sm font-medium">Active (visible in invoice form)</span>
          </label>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Company settings form ────────────────────────────────────────────────────

function CompanySettingsForm({ initial, onSave }: {
  initial: CompanySettings | null
  onSave: (data: Partial<CompanySettings>) => Promise<void>
}) {
  const [form, setForm]     = useState<Partial<CompanySettings>>(initial ?? {})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const setF = (k: keyof CompanySettings, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSave() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <SectionLabel label="Company / Business Details" />
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field id="co_name" label="Company Name" required>
              <Input id="co_name" value={form.name ?? ''} onChange={e => setF('name', e.target.value)} />
            </Field>
            <Field id="co_gstin" label="GSTIN">
              <Input id="co_gstin" value={form.gstin ?? ''} onChange={e => setF('gstin', e.target.value.toUpperCase())}
                className="font-mono tracking-wider" placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </Field>
          </div>

          <Field id="co_address" label="Address">
            <Input id="co_address" value={form.address ?? ''} onChange={e => setF('address', e.target.value)} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field id="co_city" label="City">
              <Input id="co_city" value={form.city ?? ''} onChange={e => setF('city', e.target.value)} />
            </Field>
            <Field id="co_state" label="State">
              <Input id="co_state" value={form.state ?? ''} onChange={e => setF('state', e.target.value)} />
            </Field>
            <Field id="co_pincode" label="Pincode">
              <Input id="co_pincode" value={form.pincode ?? ''} onChange={e => setF('pincode', e.target.value)} className="font-mono" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field id="co_phone" label="Phone">
              <Input id="co_phone" value={form.phone ?? ''} onChange={e => setF('phone', e.target.value)} type="tel" />
            </Field>
            <Field id="co_email" label="Email">
              <Input id="co_email" value={form.email ?? ''} onChange={e => setF('email', e.target.value)} type="email" />
            </Field>
          </div>

          <Field id="co_logo" label="Logo URL">
            <Input id="co_logo" value={form.logo_url ?? ''} onChange={e => setF('logo_url', e.target.value)} placeholder="https://…" />
          </Field>

          <div className="pt-3 border-t">
            <SectionLabel label="Bank Details (for invoice)" />
            <div className="grid grid-cols-2 gap-3">
              <Field id="co_bank" label="Bank Name">
                <Input id="co_bank" value={form.bank_name ?? ''} onChange={e => setF('bank_name', e.target.value)} />
              </Field>
              <Field id="co_acc" label="Account Number">
                <Input id="co_acc" value={form.account_number ?? ''} onChange={e => setF('account_number', e.target.value)} className="font-mono" />
              </Field>
              <Field id="co_ifsc" label="IFSC Code">
                <Input id="co_ifsc" value={form.ifsc_code ?? ''} onChange={e => setF('ifsc_code', e.target.value.toUpperCase())} className="font-mono" />
              </Field>
              <Field id="co_upi" label="UPI ID">
                <Input id="co_upi" value={form.upi_id ?? ''} onChange={e => setF('upi_id', e.target.value)} />
              </Field>
            </div>
          </div>

          <Field id="co_prefix" label="Invoice Number Prefix">
            <div className="flex items-center gap-2">
              <Input id="co_prefix" value={form.invoice_prefix ?? 'INV'}
                onChange={e => setF('invoice_prefix', e.target.value.toUpperCase())}
                className="w-28 font-mono font-bold" maxLength={6} />
              <span className="text-sm text-muted-foreground">e.g. {form.invoice_prefix ?? 'INV'}-2025-0001</span>
            </div>
          </Field>

          <Button onClick={handleSave} disabled={saving} className="w-full font-semibold">
            {saving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              : saved
                ? <><Check className="mr-2 h-4 w-4 text-emerald-400" />Saved!</>
                : <><Save className="mr-2 h-4 w-4" />Save Company Settings</>
            }
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function CatalogPage() {
  const { user, role, loading: authLoading } = useAuth()
  const router = useRouter()

  const [catalog, setCatalog]       = useState<CatalogItem[]>([])
  const [company, setCompany]       = useState<CompanySettings | null>(null)
  const [loading, setLoading]       = useState(true)
  const [loadError, setLoadError]   = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [editItem, setEditItem]     = useState<{ data: ItemFormData; id?: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [tab, setTab]               = useState<'catalog' | 'company'>('catalog')

  useEffect(() => {
    if (!authLoading && !user)            router.push('/login')
    if (!authLoading && role !== 'admin') router.push('/')
  }, [authLoading, user, role, router])

  const fetchAll = useCallback(async () => {
    const [catRes, coRes] = await Promise.all([
      supabase.from('product_catalog').select('*').order('type').order('name'),
      supabase.from('company_settings').select('*').single(),
    ])
    if (catRes.error) { setLoadError('Failed to load.'); return }
    setCatalog(catRes.data ?? [])
    setCompany(coRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { if (role === 'admin') fetchAll() }, [role, fetchAll])

  async function handleSaveItem(formData: ItemFormData, itemId?: string) {
    const payload = {
      name:        formData.name.trim(),
      type:        formData.type,
      description: formData.description.trim() || null,
      hsn_sac:     formData.hsn_sac.trim()     || null,
      unit:        formData.unit,
      price:       Number(formData.price),
      gst_rate:    formData.gst_rate,
      is_active:   formData.is_active,
    }
    if (itemId) {
      await supabase.from('product_catalog').update(payload).eq('id', itemId)
    } else {
      await supabase.from('product_catalog').insert([payload])
    }
    await fetchAll()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await supabase.from('product_catalog').delete().eq('id', id)
    setCatalog(prev => prev.filter(c => c.id !== id))
    setDeletingId(null)
  }

  async function handleToggleActive(item: CatalogItem) {
    await supabase.from('product_catalog').update({ is_active: !item.is_active }).eq('id', item.id)
    setCatalog(prev => prev.map(c => c.id === item.id ? { ...c, is_active: !c.is_active } : c))
  }

  async function handleSaveCompany(data: Partial<CompanySettings>) {
    if (company?.id) {
      await supabase.from('company_settings').update(data).eq('id', company.id)
    } else {
      await supabase.from('company_settings').insert([data])
    }
    await fetchAll()
  }

  if (authLoading || (loading && role === 'admin')) return (
    <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading…</span>
    </div>
  )
  if (!user || role !== 'admin') return null

  const displayed = filterType === 'all' ? catalog : catalog.filter(c => c.type === filterType)

  return (
    <div className="min-h-screen bg-background">
      {editItem && (
        <ItemFormModal
          initial={editItem.data}
          onSave={data => handleSaveItem(data, editItem.id)}
          onClose={() => setEditItem(null)}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-6 pb-16">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin/settings">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground tracking-tight">Sales Catalog</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Products, prices & company details</p>
            </div>
          </div>
        </div>

        {loadError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {loadError}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex gap-1 bg-muted/40 border rounded-xl p-1 mb-6">
          {([['catalog', 'Product Catalog'], ['company', 'Company & Invoice']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all
                ${tab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'company' ? (
          <CompanySettingsForm initial={company} onSave={handleSaveCompany} />
        ) : (
          <>
            {/* Filter + add */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="flex gap-1 bg-muted/40 border rounded-xl p-1 flex-1">
                <button onClick={() => setFilterType('all')}
                  className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all
                    ${filterType === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                  All ({catalog.length})
                </button>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => {
                  const count = catalog.filter(c => c.type === k).length
                  return (
                    <button key={k} onClick={() => setFilterType(k)}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap
                        ${filterType === k ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                      {k.charAt(0).toUpperCase() + k.slice(1)} ({count})
                    </button>
                  )
                })}
              </div>
              <Button size="sm" className="h-8 text-xs shrink-0"
                onClick={() => setEditItem({ data: EMPTY_ITEM })}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Item
              </Button>
            </div>

            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-2xl">
                <Package className="h-8 w-8 text-muted-foreground mb-3 opacity-40" />
                <p className="font-semibold text-foreground mb-1">No catalog items</p>
                <p className="text-sm text-muted-foreground">Add products, spares, labour charges, and AMC plans.</p>
                <Button size="sm" className="mt-4" onClick={() => setEditItem({ data: EMPTY_ITEM })}>
                  <Plus className="mr-2 h-4 w-4" /> Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {displayed.map(item => {
                  const cfg = TYPE_CONFIG[item.type]
                  return (
                    <div key={item.id}
                      className={`flex items-center gap-3 border rounded-xl px-4 py-3 bg-card transition-all
                        ${!item.is_active ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm truncate">{item.name}</span>
                          <Badge variant="outline" className={`text-[11px] shrink-0 ${cfg.color}`}>{cfg.label}</Badge>
                          {item.hsn_sac && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              HSN {item.hsn_sac}
                            </span>
                          )}
                          {!item.is_active && (
                            <span className="text-[10px] text-muted-foreground">(inactive)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>GST {item.gst_rate}%</span>
                          <span>/ {item.unit}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-lg font-black tabular-nums text-foreground">₹{fmt(item.price)}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleToggleActive(item)}
                          title={item.is_active ? 'Deactivate' : 'Activate'}
                          className={`h-7 w-7 flex items-center justify-center rounded-lg transition-colors
                            ${item.is_active ? 'text-emerald-500 hover:text-muted-foreground' : 'text-muted-foreground hover:text-emerald-500'}`}>
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditItem({
                          id: item.id,
                          data: {
                            name: item.name, type: item.type,
                            description: item.description ?? '',
                            hsn_sac: item.hsn_sac ?? '',
                            unit: item.unit, price: String(item.price),
                            gst_rate: item.gst_rate, is_active: item.is_active,
                          }
                        })}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                          {deletingId === item.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
