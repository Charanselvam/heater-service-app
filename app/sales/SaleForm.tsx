'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2, AlertCircle, User, Phone,
  Calendar, Hash, Plus, Trash2, Search, X, Eye,
  RefreshCw, Mail, Building2, Tag, ChevronDown,
  IndianRupee, Percent, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  _key: string            // local-only stable key
  id?: string             // db id (edit mode)
  product_id: string | null
  item_type: 'heater' | 'spare' | 'labour' | 'amc'
  description: string
  hsn_sac: string
  unit: string
  quantity: number
  unit_price: number
  discount_pct: number
  gst_rate: number
}

interface SaleHeader {
  invoice_number: string
  sale_date: string
  customer_name: string
  customer_phone: string
  customer_email: string
  customer_gstin: string
  customer_address: string
  customer_city: string
  customer_state: string
  customer_pincode: string
  sale_type: 'B2B' | 'B2C'
  supply_type: 'intrastate' | 'interstate'
  payment_method: string
  notes: string
  status: 'draft' | 'sent' | 'paid' | 'cancelled'
}

interface CatalogItem {
  id: string
  name: string
  type: 'heater' | 'spare' | 'labour' | 'amc'
  hsn_sac: string | null
  unit: string
  price: number
  gst_rate: number
}

// ─── GST calculation ──────────────────────────────────────────────────────────

interface LineCalc {
  gross: number          // qty * unit_price
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

function calcLine(item: LineItem, supplyType: string): LineCalc {
  const gross    = item.quantity * item.unit_price
  const discount = gross * (item.discount_pct / 100)
  const taxable  = gross - discount
  const taxRate  = item.gst_rate / 100

  if (supplyType === 'intrastate') {
    const cgst = taxable * (taxRate / 2)
    const sgst = taxable * (taxRate / 2)
    return { gross, discount, taxable, cgst, sgst, igst: 0, total: taxable + cgst + sgst }
  } else {
    const igst = taxable * taxRate
    return { gross, discount, taxable, cgst: 0, sgst: 0, igst, total: taxable + igst }
  }
}

interface Totals {
  subtotal: number
  discount: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

function calcTotals(items: LineItem[], supplyType: string): Totals {
  return items.reduce<Totals>((acc, item) => {
    const c = calcLine(item, supplyType)
    return {
      subtotal: acc.subtotal + c.gross,
      discount: acc.discount + c.discount,
      taxable:  acc.taxable  + c.taxable,
      cgst:     acc.cgst     + c.cgst,
      sgst:     acc.sgst     + c.sgst,
      igst:     acc.igst     + c.igst,
      total:    acc.total    + c.total,
    }
  }, { subtotal: 0, discount: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 })
}

function r2(n: number) { return Math.round(n * 100) / 100 }
function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function uid() { return Math.random().toString(36).slice(2) }

// ─── Initial state ────────────────────────────────────────────────────────────

const EMPTY_HEADER: SaleHeader = {
  invoice_number: '',
  sale_date:      new Date().toISOString().split('T')[0],
  customer_name:  '',
  customer_phone: '',
  customer_email: '',
  customer_gstin: '',
  customer_address: '',
  customer_city:  '',
  customer_state: '',
  customer_pincode: '',
  sale_type:      'B2C',
  supply_type:    'intrastate',
  payment_method: '',
  notes:          '',
  status:         'draft',
}

const EMPTY_LINE = (): LineItem => ({
  _key:        uid(),
  product_id:  null,
  item_type:   'spare',
  description: '',
  hsn_sac:     '',
  unit:        'nos',
  quantity:    1,
  unit_price:  0,
  discount_pct: 0,
  gst_rate:    18,
})

const TYPE_LABELS = {
  heater: '🔥 Heater',
  spare:  '🔧 Spare',
  labour: '👷 Labour',
  amc:    '📋 AMC',
}

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Credit']
const STATUS_OPTIONS   = [
  { value: 'draft',     label: '📝 Draft' },
  { value: 'sent',      label: '📤 Sent' },
  { value: 'paid',      label: '✅ Paid' },
  { value: 'cancelled', label: '❌ Cancelled' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{label}</p>
}

function Field({ id, label, icon, required, error, children }: {
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

// ─── Customer lookup ──────────────────────────────────────────────────────────

function CustomerLookup({ value, onChange, onSelect }: {
  value: string
  onChange: (v: string) => void
  onSelect: (c: {
    customer_name: string; customer_phone: string; customer_email: string
    customer_gstin: string; customer_address: string; customer_city: string
    customer_state: string; customer_pincode: string
  }) => void
}) {
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen]       = useState(false)
  const [busy, setBusy]       = useState(false)

  useEffect(() => {
    const term = value.trim()
    if (term.length < 2) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setBusy(true)
      const { data } = await supabase
        .from('sales')
        .select('customer_name, customer_phone, customer_email, customer_gstin, customer_address, customer_city, customer_state, customer_pincode')
        .or(`customer_name.ilike.%${term}%,customer_phone.ilike.%${term}%,customer_gstin.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(6)

      // Deduplicate by name+phone
      const seen = new Set<string>()
      const unique = (data ?? []).filter(r => {
        const k = `${r.customer_name}|${r.customer_phone}`
        if (seen.has(k)) return false
        seen.add(k); return true
      })
      setResults(unique)
      setOpen(unique.length > 0)
      setBusy(false)
    }, 300)
    return () => clearTimeout(t)
  }, [value])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-customer-lookup]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="relative" data-customer-lookup>
      <div className="relative">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="e.g. Ganesh Traders" autoComplete="off" />
        {busy && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-popover border rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 border-b">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Previous customers</p>
          </div>
          {results.map((c, i) => (
            <button key={i} type="button"
              className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
              onClick={() => { onSelect(c); setOpen(false) }}
            >
              <div className="p-1.5 rounded-lg bg-muted shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{c.customer_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[c.customer_phone, c.customer_gstin, c.customer_city].filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Catalog picker ───────────────────────────────────────────────────────────

function CatalogPicker({ catalog, onSelect }: {
  catalog: CatalogItem[]
  onSelect: (item: CatalogItem) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)

  const filtered = useMemo(() => {
    const t = search.toLowerCase()
    return catalog.filter(c =>
      c.name.toLowerCase().includes(t) || c.type.includes(t)
    )
  }, [catalog, search])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-catalog-picker]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <div className="relative" data-catalog-picker>
      <button
        type="button"
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 text-xs font-semibold text-primary hover:text-primary/80 transition-colors px-3 py-2 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10"
      >
        <Plus className="h-3.5 w-3.5" /> Add from catalog
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-popover border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search catalog…"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <button type="button" onClick={() => setOpen(false)}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No items found</p>
            ) : (
              filtered.map(item => (
                <button key={item.id} type="button"
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
                  onClick={() => { onSelect(item); setOpen(false); setSearch('') }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[item.type]} · GST {item.gst_rate}%{item.hsn_sac ? ` · HSN ${item.hsn_sac}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground shrink-0 tabular-nums">
                    ₹{fmt(item.price)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Line item row ────────────────────────────────────────────────────────────

function LineItemRow({ item, supplyType, onChange, onRemove }: {
  item: LineItem
  supplyType: string
  onChange: (updates: Partial<LineItem>) => void
  onRemove: () => void
}) {
  const calc = calcLine(item, supplyType)

  return (
    <div className="border rounded-xl p-4 bg-muted/20 space-y-3">
      {/* Row 1: type + description + remove */}
      <div className="flex items-start gap-2">
        <select
          value={item.item_type}
          onChange={e => onChange({ item_type: e.target.value as LineItem['item_type'] })}
          className="text-xs bg-muted border rounded-lg px-2 py-1.5 font-medium shrink-0"
        >
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Input
          value={item.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder="Description *"
          className="flex-1 text-sm"
        />
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1.5">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Row 2: HSN, unit, qty, price, discount, gst */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <div className="col-span-1">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">HSN/SAC</p>
          <Input
            value={item.hsn_sac}
            onChange={e => onChange({ hsn_sac: e.target.value })}
            placeholder="e.g. 8516"
            className="text-xs font-mono h-8"
          />
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Unit</p>
          <Input
            value={item.unit}
            onChange={e => onChange({ unit: e.target.value })}
            placeholder="nos"
            className="text-xs h-8"
          />
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Qty</p>
          <Input
            type="number" min={0.001} step="0.001"
            value={item.quantity}
            onChange={e => onChange({ quantity: parseFloat(e.target.value) || 0 })}
            className="text-xs h-8 tabular-nums"
          />
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Price ₹</p>
          <Input
            type="number" min={0} step="0.01"
            value={item.unit_price}
            onChange={e => onChange({ unit_price: parseFloat(e.target.value) || 0 })}
            className="text-xs h-8 tabular-nums"
          />
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Disc %</p>
          <Input
            type="number" min={0} max={100} step="0.01"
            value={item.discount_pct}
            onChange={e => onChange({ discount_pct: parseFloat(e.target.value) || 0 })}
            className="text-xs h-8 tabular-nums"
          />
        </div>
        <div className="col-span-1">
          <p className="text-[10px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">GST %</p>
          <select
            value={item.gst_rate}
            onChange={e => onChange({ gst_rate: parseFloat(e.target.value) })}
            className="w-full text-xs bg-muted border rounded-lg px-2 h-8 tabular-nums"
          >
            {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>
      </div>

      {/* Row 3: line total breakdown */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t">
        <span>Taxable: <strong className="text-foreground">₹{fmt(calc.taxable)}</strong></span>
        {supplyType === 'intrastate' ? (
          <>
            <span>CGST: ₹{fmt(calc.cgst)}</span>
            <span>SGST: ₹{fmt(calc.sgst)}</span>
          </>
        ) : (
          <span>IGST: ₹{fmt(calc.igst)}</span>
        )}
        <span className="ml-auto font-bold text-foreground">
          Line total: ₹{fmt(calc.total)}
        </span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SaleForm({ mode }: { mode: 'add' | 'edit' }) {
  const { user, loading: authLoading } = useAuth()
  const router  = useRouter()
  const params  = useParams<{ id: string }>()
  const id      = params?.id ?? null
  const isEdit  = mode === 'edit'

  const [header, setHeader]             = useState<SaleHeader>(EMPTY_HEADER)
  const [items, setItems]               = useState<LineItem[]>([])
  const [catalog, setCatalog]           = useState<CatalogItem[]>([])
  const [fieldErrors, setFieldErrors]   = useState<Partial<Record<keyof SaleHeader, string>>>({})
  const [submitError, setSubmitError]   = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading]       = useState(isEdit)
  const [loadError, setLoadError]       = useState<string | null>(null)

  const totals = useMemo(() => calcTotals(items, header.supply_type), [items, header.supply_type])

  const setH = useCallback(<K extends keyof SaleHeader>(key: K, value: SaleHeader[K]) => {
    setHeader(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: undefined }))
  }, [])

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => { if (!authLoading && !user) router.push('/login') }, [authLoading, user, router])

  // ── Load catalog + generate invoice number ──────────────────────────────────
  useEffect(() => {
    async function init() {
      const [catRes, settingsRes, countRes] = await Promise.all([
        supabase.from('product_catalog').select('*').eq('is_active', true).order('type').order('name'),
        supabase.from('company_settings').select('invoice_prefix').single(),
        supabase.from('sales').select('id', { count: 'exact', head: true }),
      ])
      if (catRes.data) setCatalog(catRes.data)
      if (!isEdit) {
        const prefix = settingsRes.data?.invoice_prefix ?? 'INV'
        const count  = (countRes.count ?? 0) + 1
        const year   = new Date().getFullYear()
        setH('invoice_number', `${prefix}-${year}-${String(count).padStart(4, '0')}`)
      }
    }
    init()
  }, [isEdit, setH])

  // ── Load existing sale (edit) ───────────────────────────────────────────────
  const fetchSale = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    const [saleRes, itemsRes] = await Promise.all([
      supabase.from('sales').select('*').eq('id', id).single(),
      supabase.from('sale_items').select('*').eq('sale_id', id).order('sort_order'),
    ])
    if (saleRes.error || !saleRes.data) {
      setLoadError(saleRes.error?.message ?? 'Sale not found')
    } else {
      const s = saleRes.data
      setHeader({
        invoice_number:   s.invoice_number,
        sale_date:        s.sale_date,
        customer_name:    s.customer_name,
        customer_phone:   s.customer_phone   ?? '',
        customer_email:   s.customer_email   ?? '',
        customer_gstin:   s.customer_gstin   ?? '',
        customer_address: s.customer_address ?? '',
        customer_city:    s.customer_city    ?? '',
        customer_state:   s.customer_state   ?? '',
        customer_pincode: s.customer_pincode ?? '',
        sale_type:        s.sale_type,
        supply_type:      s.supply_type,
        payment_method:   s.payment_method   ?? '',
        notes:            s.notes            ?? '',
        status:           s.status,
      })
      setItems((itemsRes.data ?? []).map(i => ({
        _key:         uid(),
        id:           i.id,
        product_id:   i.product_id,
        item_type:    i.item_type,
        description:  i.description,
        hsn_sac:      i.hsn_sac   ?? '',
        unit:         i.unit,
        quantity:     i.quantity,
        unit_price:   i.unit_price,
        discount_pct: i.discount_pct,
        gst_rate:     i.gst_rate,
      })))
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => { if (isEdit && user && id) fetchSale() }, [isEdit, user, id, fetchSale])

  // ── Line item helpers ───────────────────────────────────────────────────────
  function addFromCatalog(cat: CatalogItem) {
    setItems(prev => [...prev, {
      _key: uid(), product_id: cat.id, item_type: cat.type,
      description: cat.name, hsn_sac: cat.hsn_sac ?? '',
      unit: cat.unit, quantity: 1, unit_price: cat.price,
      discount_pct: 0, gst_rate: cat.gst_rate,
    }])
  }

  function addBlankLine() {
    setItems(prev => [...prev, EMPTY_LINE()])
  }

  function updateItem(key: string, updates: Partial<LineItem>) {
    setItems(prev => prev.map(i => i._key === key ? { ...i, ...updates } : i))
  }

  function removeItem(key: string) {
    setItems(prev => prev.filter(i => i._key !== key))
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Partial<Record<keyof SaleHeader, string>> = {}
    if (!header.customer_name.trim()) errors.customer_name = 'Required'
    if (!header.sale_date)            errors.sale_date     = 'Required'
    if (!header.invoice_number.trim()) errors.invoice_number = 'Required'
    if (header.sale_type === 'B2B' && !header.customer_gstin.trim())
      errors.customer_gstin = 'GSTIN required for B2B'
    if (items.length === 0) { setSubmitError('Add at least one line item.'); setFieldErrors(errors); return false }
    if (items.some(i => !i.description.trim())) {
      setSubmitError('All line items must have a description.'); setFieldErrors(errors); return false
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    setSubmitError('')

    const t = totals
    const salePayload = {
      invoice_number:   header.invoice_number,
      sale_date:        header.sale_date,
      customer_name:    header.customer_name,
      customer_phone:   header.customer_phone   || null,
      customer_email:   header.customer_email   || null,
      customer_gstin:   header.customer_gstin   || null,
      customer_address: header.customer_address || null,
      customer_city:    header.customer_city    || null,
      customer_state:   header.customer_state   || null,
      customer_pincode: header.customer_pincode || null,
      sale_type:        header.sale_type,
      supply_type:      header.supply_type,
      subtotal:         r2(t.subtotal),
      discount_amount:  r2(t.discount),
      taxable_amount:   r2(t.taxable),
      cgst_amount:      r2(t.cgst),
      sgst_amount:      r2(t.sgst),
      igst_amount:      r2(t.igst),
      total_amount:     r2(t.total),
      payment_method:   header.payment_method || null,
      notes:            header.notes          || null,
      status:           header.status,
      created_by:       user!.id,
    }

    try {
      let saleId = id

      if (!isEdit) {
        const { data, error } = await supabase.from('sales').insert([salePayload]).select('id').single()
        if (error || !data) throw error ?? new Error('Insert failed')
        saleId = data.id
      } else {
        const { error } = await supabase.from('sales').update(salePayload).eq('id', id!)
        if (error) throw error
        // Delete existing items and re-insert
        await supabase.from('sale_items').delete().eq('sale_id', id!)
      }

      const itemPayloads = items.map((item, idx) => {
        const c = calcLine(item, header.supply_type)
        return {
          sale_id:        saleId,
          product_id:     item.product_id  || null,
          item_type:      item.item_type,
          description:    item.description,
          hsn_sac:        item.hsn_sac     || null,
          unit:           item.unit,
          quantity:       item.quantity,
          unit_price:     item.unit_price,
          discount_pct:   item.discount_pct,
          gst_rate:       item.gst_rate,
          taxable_amount: r2(c.taxable),
          cgst_amount:    r2(c.cgst),
          sgst_amount:    r2(c.sgst),
          igst_amount:    r2(c.igst),
          line_total:     r2(c.total),
          sort_order:     idx,
        }
      })

      const { error: itemError } = await supabase.from('sale_items').insert(itemPayloads)
      if (itemError) throw itemError

      router.push(`/sales/${saleId}/invoice`)
      router.refresh()
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Something went wrong.')
      setIsSubmitting(false)
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (authLoading || (isEdit && isLoading)) return (
    <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-medium">{authLoading ? 'Authenticating…' : 'Loading sale…'}</span>
    </div>
  )
  if (!user) return null
  if (loadError) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="font-semibold">{loadError}</p>
      <Link href="/sales"><Button variant="outline">Back to Sales</Button></Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-6 pb-28">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/sales">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground tracking-tight">
              {isEdit ? 'Edit Invoice' : 'New Invoice'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              {header.invoice_number || '—'}
            </p>
          </div>
          {isEdit && id && (
            <Link href={`/sales/${id}/invoice`}>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
              </Button>
            </Link>
          )}
        </div>

        {submitError && (
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5">

            {/* ── Invoice meta ──────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Invoice Details" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <Field id="invoice_number" label="Invoice No." required error={fieldErrors.invoice_number}>
                    <Input
                      id="invoice_number" value={header.invoice_number}
                      onChange={e => setH('invoice_number', e.target.value)}
                      className={`font-mono ${fieldErrors.invoice_number ? 'border-destructive' : ''}`}
                    />
                  </Field>
                  <Field id="sale_date" label="Date" required error={fieldErrors.sale_date}>
                    <Input id="sale_date" type="date" value={header.sale_date}
                      onChange={e => setH('sale_date', e.target.value)}
                      className={fieldErrors.sale_date ? 'border-destructive' : ''} />
                  </Field>
                  <Field id="status" label="Status">
                    <Select value={header.status} onValueChange={v => setH('status', v as SaleHeader['status'])}>
                      <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field id="payment_method" label="Payment">
                    <Select value={header.payment_method} onValueChange={v => setH('payment_method', v)}>
                      <SelectTrigger id="payment_method"><SelectValue placeholder="Method" /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                {/* Supply type toggles */}
                <div className="flex gap-3 mt-4">
                  <div className="flex gap-1 bg-muted/40 border rounded-xl p-1">
                    {(['B2B', 'B2C'] as const).map(t => (
                      <button key={t} type="button"
                        onClick={() => setH('sale_type', t)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                          ${header.sale_type === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                      >{t}</button>
                    ))}
                  </div>
                  <div className="flex gap-1 bg-muted/40 border rounded-xl p-1">
                    {([['intrastate', 'Intrastate'], ['interstate', 'Interstate']] as const).map(([v, l]) => (
                      <button key={v} type="button"
                        onClick={() => setH('supply_type', v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                          ${header.supply_type === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                      >{l}</button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Customer ──────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Bill To" />
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field id="customer_name" label="Customer Name" icon={<User className="h-3.5 w-3.5" />} required error={fieldErrors.customer_name}>
                      <CustomerLookup
                        value={header.customer_name}
                        onChange={v => setH('customer_name', v)}
                        onSelect={c => setHeader(prev => ({ ...prev, ...c }))}
                      />
                    </Field>
                    <Field id="customer_phone" label="Phone" icon={<Phone className="h-3.5 w-3.5" />}>
                      <Input id="customer_phone" type="tel" inputMode="numeric" maxLength={10}
                        value={header.customer_phone}
                        onChange={e => setH('customer_phone', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field id="customer_email" label="Email" icon={<Mail className="h-3.5 w-3.5" />}>
                      <Input id="customer_email" type="email" value={header.customer_email}
                        onChange={e => setH('customer_email', e.target.value)} />
                    </Field>
                    {header.sale_type === 'B2B' && (
                      <Field id="customer_gstin" label="GSTIN" required error={fieldErrors.customer_gstin}>
                        <Input id="customer_gstin"
                          value={header.customer_gstin}
                          onChange={e => setH('customer_gstin', e.target.value.toUpperCase())}
                          className={`font-mono tracking-wider ${fieldErrors.customer_gstin ? 'border-destructive' : ''}`}
                          placeholder="22AAAAA0000A1Z5"
                          maxLength={15}
                        />
                      </Field>
                    )}
                  </div>
                  <Field id="customer_address" label="Address" icon={<Building2 className="h-3.5 w-3.5" />}>
                    <Input id="customer_address" value={header.customer_address}
                      onChange={e => setH('customer_address', e.target.value)}
                      placeholder="Street address" />
                  </Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field id="customer_city" label="City">
                      <Input id="customer_city" value={header.customer_city}
                        onChange={e => setH('customer_city', e.target.value)} placeholder="Chennai" />
                    </Field>
                    <Field id="customer_state" label="State">
                      <Input id="customer_state" value={header.customer_state}
                        onChange={e => setH('customer_state', e.target.value)} placeholder="Tamil Nadu" />
                    </Field>
                    <Field id="customer_pincode" label="Pincode">
                      <Input id="customer_pincode" inputMode="numeric" maxLength={6}
                        value={header.customer_pincode}
                        onChange={e => setH('customer_pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="font-mono tracking-widest" placeholder="600001" />
                    </Field>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Line items ────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <SectionLabel label="Line Items" />
                  {items.length > 0 && (
                    <Badge variant="secondary" className="text-[11px] -mt-3">
                      {items.length} item{items.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  {items.map(item => (
                    <LineItemRow
                      key={item._key}
                      item={item}
                      supplyType={header.supply_type}
                      onChange={updates => updateItem(item._key, updates)}
                      onRemove={() => removeItem(item._key)}
                    />
                  ))}
                  {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                      <FileText className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No items yet. Add from catalog or create a custom line.</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <CatalogPicker catalog={catalog} onSelect={addFromCatalog} />
                  <button type="button" onClick={addBlankLine}
                    className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-muted hover:border-foreground/30">
                    <Plus className="h-3.5 w-3.5" /> Custom line
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* ── GST Summary ───────────────────────────────────────────────── */}
            {items.length > 0 && (
              <Card className="overflow-hidden">
                <CardContent className="p-5">
                  <SectionLabel label="Tax Summary" />
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal</span>
                      <span className="tabular-nums font-medium">₹{fmt(totals.subtotal)}</span>
                    </div>
                    {totals.discount > 0 && (
                      <div className="flex justify-between text-muted-foreground">
                        <span>Discount</span>
                        <span className="tabular-nums text-rose-500">−₹{fmt(totals.discount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                      <span>Taxable Amount</span>
                      <span className="tabular-nums font-medium">₹{fmt(totals.taxable)}</span>
                    </div>

                    {/* HSN-wise GST breakdown */}
                    <div className="my-3 pt-3 border-t space-y-1">
                      {header.supply_type === 'intrastate' ? (
                        <>
                          <div className="flex justify-between text-muted-foreground">
                            <span>CGST</span>
                            <span className="tabular-nums">₹{fmt(totals.cgst)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>SGST</span>
                            <span className="tabular-nums">₹{fmt(totals.sgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-muted-foreground">
                          <span>IGST</span>
                          <span className="tabular-nums">₹{fmt(totals.igst)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between font-black text-xl pt-2 border-t">
                      <span>Total</span>
                      <span className="tabular-nums">₹{fmt(totals.total)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Notes ─────────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Notes / Terms" />
                <Textarea value={header.notes} onChange={e => setH('notes', e.target.value)}
                  placeholder="Payment terms, warranty notes, remarks…"
                  rows={3} className="resize-none text-sm" />
              </CardContent>
            </Card>
          </div>

          {/* Sticky footer */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-md border-t px-4 py-3">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="flex-1 text-sm">
                <span className="text-muted-foreground">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="font-black text-lg tabular-nums">₹{fmt(totals.total)}</span>
              </div>
              <Link href="/sales">
                <Button variant="outline" type="button" className="h-9">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting} className="h-9 font-semibold min-w-32">
                {isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEdit ? 'Updating…' : 'Saving…'}</>
                  : <><Save className="mr-2 h-4 w-4" />{isEdit ? 'Update' : 'Save & Preview'}</>
                }
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
