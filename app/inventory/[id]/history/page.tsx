'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertCircle, TrendingUp, TrendingDown, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { InventoryItem } from '../../page'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  type: 'in' | 'out'
  quantity: number
  reason: string | null
  notes: string | null
  created_at: string
  created_by: string
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function InventoryHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const router   = useRouter()
  const { id }   = useParams<{ id: string }>()

  const [item, setItem]               = useState<InventoryItem | null>(null)
  const [txns, setTxns]               = useState<Transaction[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [loadError, setLoadError]     = useState('')

  useEffect(() => { if (!authLoading && !user) router.push('/login') }, [authLoading, user, router])

  const fetchData = useCallback(async () => {
    if (!id) return
    const [itemRes, txnRes] = await Promise.all([
      supabase.from('inventory_items').select('*').eq('id', id).single(),
      supabase.from('inventory_transactions')
        .select('*').eq('item_id', id).order('created_at', { ascending: false }),
    ])
    if (itemRes.error || !itemRes.data) {
      setLoadError('Could not load item.')
    } else {
      setItem(itemRes.data)
      setTxns(txnRes.data ?? [])
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => { if (user) fetchData() }, [user, fetchData])

  if (authLoading || isLoading) return (
    <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading history…</span>
    </div>
  )
  if (loadError || !item) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="font-semibold">{loadError}</p>
      <Link href="/inventory"><Button variant="outline">Back</Button></Link>
    </div>
  )

  const totalIn  = txns.filter(t => t.type === 'in').reduce((s, t) => s + t.quantity, 0)
  const totalOut = txns.filter(t => t.type === 'out').reduce((s, t) => s + t.quantity, 0)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-16">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/inventory">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground tracking-tight">Stock History</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.name}</p>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono">
            {item.quantity} {item.unit}
          </Badge>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Transactions', value: txns.length,  color: 'text-foreground' },
            { label: 'Total Added',  value: totalIn,      color: 'text-emerald-500' },
            { label: 'Total Used',   value: totalOut,     color: 'text-rose-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-muted/40 border rounded-xl px-3 py-3 text-center">
              <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        {txns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Package className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">No transactions yet</p>
            <p className="text-sm text-muted-foreground">Stock adjustments will appear here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {txns.map(txn => (
              <Card key={txn.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-xl shrink-0 mt-0.5
                      ${txn.type === 'in' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                      {txn.type === 'in'
                        ? <TrendingUp className="h-4 w-4 text-emerald-500" />
                        : <TrendingDown className="h-4 w-4 text-rose-500" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-lg font-black tabular-nums
                            ${txn.type === 'in' ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {txn.type === 'in' ? '+' : '-'}{txn.quantity}
                          </span>
                          <span className="text-sm text-muted-foreground">{item.unit}</span>
                          {txn.reason && (
                            <Badge variant="secondary" className="text-[11px]">{txn.reason}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(txn.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {txn.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{txn.notes}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
