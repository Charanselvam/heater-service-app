'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, AlertCircle, TrendingUp,
  TrendingDown, Package, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { InventoryItem } from '../../page'

// ─── Reason presets ───────────────────────────────────────────────────────────

const IN_REASONS  = ['Restock / Purchase', 'Return from job', 'Stock correction', 'Other']
const OUT_REASONS = ['Used in service', 'Damaged / disposed', 'Stock correction', 'Other']

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdjustStockPage() {
  const { user, loading: authLoading } = useAuth()
  const router       = useRouter()
  const { id }       = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const typeParam    = searchParams.get('type') // 'in' | 'out'

  const [item, setItem]         = useState<InventoryItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [adjustType, setAdjustType] = useState<'in' | 'out'>(typeParam === 'out' ? 'out' : 'in')
  const [qty, setQty]               = useState('1')
  const [reason, setReason]         = useState('')
  const [notes, setNotes]           = useState('')
  const [qtyError, setQtyError]     = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [success, setSuccess]           = useState(false)

  useEffect(() => { if (!authLoading && !user) router.push('/login') }, [authLoading, user, router])

  const fetchItem = useCallback(async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('inventory_items').select('*').eq('id', id).single()
    if (error || !data) setLoadError('Could not load item.')
    else setItem(data)
    setIsLoading(false)
  }, [id])

  useEffect(() => { if (user) fetchItem() }, [user, fetchItem])

  function validate(): boolean {
    const n = Number(qty)
    if (!qty || isNaN(n) || n <= 0) {
      setQtyError('Enter a quantity greater than 0')
      return false
    }
    if (adjustType === 'out' && item && n > item.quantity) {
      setQtyError(`Only ${item.quantity} ${item.unit} in stock`)
      return false
    }
    setQtyError('')
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate() || !item) return
    setIsSubmitting(true)
    setSubmitError('')

    const delta    = adjustType === 'in' ? Number(qty) : -Number(qty)
    const newQty   = item.quantity + delta

    // 1. Update item quantity
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ quantity: newQty })
      .eq('id', id)

    if (updateError) {
      setSubmitError(updateError.message)
      setIsSubmitting(false)
      return
    }

    // 2. Log the transaction
    await supabase.from('inventory_transactions').insert([{
      item_id:     id,
      type:        adjustType,
      quantity:    Number(qty),
      reason:      reason || null,
      notes:       notes.trim() || null,
      created_by:  user!.id,
    }])

    setItem(prev => prev ? { ...prev, quantity: newQty } : prev)
    setSuccess(true)
    setIsSubmitting(false)
  }

  // ── States ──────────────────────────────────────────────────────────────────
  if (authLoading || isLoading) return (
    <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading…</span>
    </div>
  )
  if (loadError || !item) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="font-semibold">{loadError || 'Item not found'}</p>
      <Link href="/inventory"><Button variant="outline">Back to Inventory</Button></Link>
    </div>
  )

  const isOut       = adjustType === 'out'
  const reasonList  = isOut ? OUT_REASONS : IN_REASONS
  const newQtyPreview = success
    ? item.quantity
    : Math.max(0, item.quantity + (isOut ? -Number(qty || 0) : Number(qty || 0)))

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-5 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
      </div>
      <div>
        <p className="text-xl font-black text-foreground">Stock Updated</p>
        <p className="text-sm text-muted-foreground mt-1">
          {item.name} is now <span className="font-semibold text-foreground">{item.quantity} {item.unit}</span>
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => { setSuccess(false); setQty('1'); setReason(''); setNotes('') }}>
          Adjust again
        </Button>
        <Link href="/inventory"><Button>Back to Inventory</Button></Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/inventory">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-black text-foreground tracking-tight">Adjust Stock</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.name}</p>
          </div>
        </div>

        {/* Item summary */}
        <Card className="mb-5 overflow-hidden">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground truncate">{item.name}</p>
              {item.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black text-foreground tabular-nums">{item.quantity}</p>
              <p className="text-xs text-muted-foreground">{item.unit} current</p>
            </div>
          </CardContent>
        </Card>

        {submitError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5">

            {/* ── Type toggle ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setAdjustType('in'); setReason('') }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all
                  ${adjustType === 'in'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-muted text-muted-foreground hover:border-foreground/30'
                  }`}
              >
                <TrendingUp className="h-4 w-4" /> Add Stock
              </button>
              <button
                type="button"
                onClick={() => { setAdjustType('out'); setReason('') }}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-semibold text-sm transition-all
                  ${adjustType === 'out'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'border-muted text-muted-foreground hover:border-foreground/30'
                  }`}
              >
                <TrendingDown className="h-4 w-4" /> Deduct Stock
              </button>
            </div>

            {/* ── Quantity ─────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="qty" className="text-sm font-medium">
                    Quantity ({item.unit})
                    <span className="text-destructive text-xs ml-0.5">*</span>
                  </Label>
                  <Input
                    id="qty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={adjustType === 'out' ? item.quantity : undefined}
                    value={qty}
                    onChange={e => { setQty(e.target.value); setQtyError('') }}
                    className={`text-2xl font-black h-14 text-center tabular-nums
                      ${qtyError ? 'border-destructive' : ''}`}
                  />
                  {qtyError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {qtyError}
                    </p>
                  )}
                </div>

                {/* Preview */}
                {qty && !isNaN(Number(qty)) && Number(qty) > 0 && (
                  <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-3">
                    <span className="text-sm text-muted-foreground">New quantity</span>
                    <span className={`text-lg font-black tabular-nums
                      ${newQtyPreview === 0 ? 'text-rose-500' : newQtyPreview <= item.low_stock_threshold ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {newQtyPreview} {item.unit}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Reason ───────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Reason</p>

                <div className="flex flex-wrap gap-2">
                  {reasonList.map(r => (
                    <button
                      key={r} type="button"
                      onClick={() => setReason(r)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-all
                        ${reason === r
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/60 text-muted-foreground border-muted hover:border-foreground/30'
                        }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                <Textarea
                  placeholder="Additional notes (optional)…"
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="resize-none text-sm"
                />
              </CardContent>
            </Card>
          </div>

          {/* Sticky footer */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t px-4 py-3">
            <div className="max-w-md mx-auto flex items-center gap-3">
              <Link href="/inventory" className="flex-1">
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
              </Link>
              <Button
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 font-semibold ${isOut ? 'bg-rose-600 hover:bg-rose-700' : ''}`}
              >
                {isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                  : isOut
                    ? <><TrendingDown className="mr-2 h-4 w-4" />Deduct</>
                    : <><TrendingUp className="mr-2 h-4 w-4" />Add Stock</>
                }
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
