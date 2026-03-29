'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, Edit, Loader2, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanySettings {
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
}

interface Sale {
  id: string
  invoice_number: string
  sale_date: string
  customer_name: string
  customer_phone: string | null
  customer_email: string | null
  customer_gstin: string | null
  customer_address: string | null
  customer_city: string | null
  customer_state: string | null
  customer_pincode: string | null
  sale_type: 'B2B' | 'B2C'
  supply_type: 'intrastate' | 'interstate'
  subtotal: number
  discount_amount: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  total_amount: number
  payment_method: string | null
  notes: string | null
  status: string
}

interface SaleItem {
  id: string
  item_type: string
  description: string
  hsn_sac: string | null
  unit: string
  quantity: number
  unit_price: number
  discount_pct: number
  gst_rate: number
  taxable_amount: number
  cgst_amount: number
  sgst_amount: number
  igst_amount: number
  line_total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Convert number to words (Indian system)
function toWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertGroup(n: number): string {
    if (n === 0) return ''
    if (n < 20) return ones[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '') + ' '
    return ones[Math.floor(n / 100)] + ' Hundred ' + convertGroup(n % 100)
  }

  const n = Math.floor(num)
  if (n === 0) return 'Zero'
  let result = ''
  if (n >= 10000000) result += convertGroup(Math.floor(n / 10000000)) + 'Crore '
  if (n >= 100000)   result += convertGroup(Math.floor((n % 10000000) / 100000)) + 'Lakh '
  if (n >= 1000)     result += convertGroup(Math.floor((n % 100000) / 1000)) + 'Thousand '
  result += convertGroup(n % 1000)
  return result.trim()
}

// Build HSN-wise GST summary
function buildHsnSummary(items: SaleItem[], supplyType: string) {
  const map: Record<string, { hsn: string; taxable: number; cgst: number; sgst: number; igst: number; rate: number }> = {}
  items.forEach(item => {
    const key = `${item.hsn_sac ?? 'NA'}_${item.gst_rate}`
    if (!map[key]) map[key] = { hsn: item.hsn_sac ?? 'N/A', taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: item.gst_rate }
    map[key].taxable += item.taxable_amount
    map[key].cgst    += item.cgst_amount
    map[key].sgst    += item.sgst_amount
    map[key].igst    += item.igst_amount
  })
  return Object.values(map)
}

// ─── Main invoice component ───────────────────────────────────────────────────

export default function InvoicePage() {
  const { user, loading: authLoading } = useAuth()
  const router  = useRouter()
  const { id }  = useParams<{ id: string }>()

  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [sale, setSale]       = useState<Sale | null>(null)
  const [items, setItems]     = useState<SaleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => { if (!authLoading && !user) router.push('/login') }, [authLoading, user, router])

  useEffect(() => {
    async function load() {
      const [coRes, saleRes, itemsRes] = await Promise.all([
        supabase.from('company_settings').select('*').single(),
        supabase.from('sales').select('*').eq('id', id).single(),
        supabase.from('sale_items').select('*').eq('sale_id', id).order('sort_order'),
      ])
      if (saleRes.error || !saleRes.data) { setError('Invoice not found'); setLoading(false); return }
      setCompany(coRes.data)
      setSale(saleRes.data)
      setItems(itemsRes.data ?? [])
      setLoading(false)
    }
    if (user && id) load()
  }, [user, id])

  if (authLoading || loading) return (
    <div className="flex items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading invoice…</span>
    </div>
  )
  if (error || !sale) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-6">
      <AlertCircle className="h-8 w-8 text-destructive" />
      <p className="font-semibold">{error || 'Invoice not found'}</p>
      <Link href="/sales"><Button variant="outline">Back to Sales</Button></Link>
    </div>
  )

  const hsnRows   = buildHsnSummary(items, sale.supply_type)
  const inWords   = `${toWords(Math.floor(sale.total_amount))} Rupees${
    Math.round((sale.total_amount % 1) * 100) > 0
      ? ` and ${toWords(Math.round((sale.total_amount % 1) * 100))} Paise`
      : ''} Only`
  const isIntra   = sale.supply_type === 'intrastate'

  return (
    <>
      {/* Print CSS injected in head */}
      <style>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; max-width: 100% !important; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>

      {/* Toolbar — hidden on print */}
      <div className="no-print sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href="/sales">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <span className="font-semibold text-foreground">{sale.invoice_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/sales/${id}/edit`}>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
            </Link>
            <Button size="sm" className="h-8 text-xs" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / Save PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Invoice — A4-style */}
      <div className="no-print bg-muted/20 min-h-screen py-8 px-4">
        <InvoiceDocument company={company} sale={sale} items={items} hsnRows={hsnRows} inWords={inWords} isIntra={isIntra} />
      </div>

      {/* Print-only version (no outer padding) */}
      <div className="hidden print:block">
        <InvoiceDocument company={company} sale={sale} items={items} hsnRows={hsnRows} inWords={inWords} isIntra={isIntra} />
      </div>
    </>
  )
}

// ─── Invoice document ─────────────────────────────────────────────────────────

function InvoiceDocument({ company, sale, items, hsnRows, inWords, isIntra }: {
  company: CompanySettings | null
  sale: Sale
  items: SaleItem[]
  hsnRows: ReturnType<typeof buildHsnSummary>
  inWords: string
  isIntra: boolean
}) {
  return (
    <div className="invoice-page max-w-4xl mx-auto bg-white text-gray-900 shadow-xl rounded-lg overflow-hidden print:shadow-none print:rounded-none">

      {/* ── Header band ─────────────────────────────────────────────────── */}
      <div className="bg-gray-900 text-white px-8 py-5 flex items-start justify-between gap-4">
        <div>
          {company?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo_url} alt="logo" className="h-10 mb-2 object-contain" />
          )}
          <h1 className="text-xl font-black tracking-tight">{company?.name ?? 'Your Company'}</h1>
          {company?.address && <p className="text-gray-300 text-xs mt-0.5">{company.address}</p>}
          <p className="text-gray-300 text-xs">
            {[company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')}
          </p>
          {company?.gstin && (
            <p className="text-gray-200 text-xs mt-1 font-mono">GSTIN: {company.gstin}</p>
          )}
          {company?.phone && <p className="text-gray-300 text-xs">Ph: {company.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-3xl font-black tracking-tight text-white">TAX INVOICE</p>
          <p className="text-gray-300 text-sm font-mono mt-1">{sale.invoice_number}</p>
          <p className="text-gray-300 text-sm mt-0.5">Date: {fmtDate(sale.sale_date)}</p>
          <span className={`inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold
            ${sale.status === 'paid' ? 'bg-emerald-500 text-white'
              : sale.status === 'sent' ? 'bg-sky-500 text-white'
              : sale.status === 'cancelled' ? 'bg-red-500 text-white'
              : 'bg-gray-600 text-gray-200'}`}>
            {sale.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* ── Bill To / Supply type ────────────────────────────────────────── */}
      <div className="px-8 py-5 grid grid-cols-2 gap-6 border-b">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Bill To</p>
          <p className="font-bold text-base">{sale.customer_name}</p>
          {sale.customer_address && <p className="text-gray-600 text-sm mt-0.5">{sale.customer_address}</p>}
          <p className="text-gray-600 text-sm">
            {[sale.customer_city, sale.customer_state, sale.customer_pincode].filter(Boolean).join(', ')}
          </p>
          {sale.customer_phone && <p className="text-gray-600 text-sm mt-1">Ph: {sale.customer_phone}</p>}
          {sale.customer_email && <p className="text-gray-600 text-sm">{sale.customer_email}</p>}
          {sale.customer_gstin && (
            <p className="text-gray-800 text-xs font-mono mt-1 font-semibold">GSTIN: {sale.customer_gstin}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Invoice Details</p>
          <table className="ml-auto text-sm text-gray-700">
            <tbody>
              <tr><td className="text-gray-500 pr-4">Type</td><td className="font-semibold text-right">{sale.sale_type}</td></tr>
              <tr><td className="text-gray-500 pr-4">Supply</td><td className="font-semibold text-right capitalize">{sale.supply_type}</td></tr>
              {sale.payment_method && (
                <tr><td className="text-gray-500 pr-4">Payment</td><td className="font-semibold text-right">{sale.payment_method}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Line items table ─────────────────────────────────────────────── */}
      <div className="px-8 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 text-xs font-bold uppercase tracking-wide text-gray-700 w-6">#</th>
              <th className="text-left py-2 text-xs font-bold uppercase tracking-wide text-gray-700">Description</th>
              <th className="text-center py-2 text-xs font-bold uppercase tracking-wide text-gray-700">HSN/SAC</th>
              <th className="text-center py-2 text-xs font-bold uppercase tracking-wide text-gray-700">Qty</th>
              <th className="text-center py-2 text-xs font-bold uppercase tracking-wide text-gray-700">Unit</th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wide text-gray-700">Rate</th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wide text-gray-700">Disc%</th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wide text-gray-700">Taxable</th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wide text-gray-700">GST%</th>
              <th className="text-right py-2 text-xs font-bold uppercase tracking-wide text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50/60' : ''}>
                <td className="py-2 pr-2 text-gray-500 text-xs align-top">{idx + 1}</td>
                <td className="py-2 pr-3 align-top">
                  <p className="font-medium">{item.description}</p>
                  <p className="text-xs text-gray-500 capitalize">{item.item_type}</p>
                </td>
                <td className="py-2 text-center text-xs font-mono text-gray-600 align-top">{item.hsn_sac ?? '—'}</td>
                <td className="py-2 text-center tabular-nums align-top">{item.quantity}</td>
                <td className="py-2 text-center text-gray-600 align-top">{item.unit}</td>
                <td className="py-2 text-right tabular-nums align-top">₹{fmt(item.unit_price)}</td>
                <td className="py-2 text-right tabular-nums text-gray-600 align-top">{item.discount_pct}%</td>
                <td className="py-2 text-right tabular-nums align-top">₹{fmt(item.taxable_amount)}</td>
                <td className="py-2 text-right tabular-nums text-gray-600 align-top">{item.gst_rate}%</td>
                <td className="py-2 text-right tabular-nums font-semibold align-top">₹{fmt(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── HSN-wise GST summary ─────────────────────────────────────────── */}
      <div className="px-8 pb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">HSN / SAC Tax Summary</p>
        <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-3 py-1.5 font-bold text-gray-700">HSN/SAC</th>
              <th className="text-right px-3 py-1.5 font-bold text-gray-700">Taxable ₹</th>
              <th className="text-right px-3 py-1.5 font-bold text-gray-700">Rate</th>
              {isIntra ? (
                <>
                  <th className="text-right px-3 py-1.5 font-bold text-gray-700">CGST ₹</th>
                  <th className="text-right px-3 py-1.5 font-bold text-gray-700">SGST ₹</th>
                </>
              ) : (
                <th className="text-right px-3 py-1.5 font-bold text-gray-700">IGST ₹</th>
              )}
              <th className="text-right px-3 py-1.5 font-bold text-gray-700">Total Tax ₹</th>
            </tr>
          </thead>
          <tbody>
            {hsnRows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-1.5 font-mono">{row.hsn}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(row.taxable)}</td>
                <td className="px-3 py-1.5 text-right">{row.rate}%</td>
                {isIntra ? (
                  <>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(row.cgst)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmt(row.sgst)}</td>
                  </>
                ) : (
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(row.igst)}</td>
                )}
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                  {fmt(isIntra ? row.cgst + row.sgst : row.igst)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Totals + amount in words ─────────────────────────────────────── */}
      <div className="px-8 pb-6 flex gap-6 items-start">
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Amount in Words</p>
          <p className="text-sm font-semibold text-gray-800 italic">{inWords}</p>

          {sale.notes && (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Notes / Terms</p>
              <p className="text-xs text-gray-600">{sale.notes}</p>
            </div>
          )}
        </div>

        <div className="w-64 shrink-0">
          <table className="w-full text-sm">
            <tbody>
              <tr className="text-gray-600">
                <td className="py-1">Subtotal</td>
                <td className="py-1 text-right tabular-nums">₹{fmt(sale.subtotal)}</td>
              </tr>
              {sale.discount_amount > 0 && (
                <tr className="text-gray-600">
                  <td className="py-1">Discount</td>
                  <td className="py-1 text-right tabular-nums text-red-600">−₹{fmt(sale.discount_amount)}</td>
                </tr>
              )}
              <tr className="text-gray-600">
                <td className="py-1">Taxable Amount</td>
                <td className="py-1 text-right tabular-nums">₹{fmt(sale.taxable_amount)}</td>
              </tr>
              {isIntra ? (
                <>
                  <tr className="text-gray-600">
                    <td className="py-1">CGST</td>
                    <td className="py-1 text-right tabular-nums">₹{fmt(sale.cgst_amount)}</td>
                  </tr>
                  <tr className="text-gray-600">
                    <td className="py-1">SGST</td>
                    <td className="py-1 text-right tabular-nums">₹{fmt(sale.sgst_amount)}</td>
                  </tr>
                </>
              ) : (
                <tr className="text-gray-600">
                  <td className="py-1">IGST</td>
                  <td className="py-1 text-right tabular-nums">₹{fmt(sale.igst_amount)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-900">
                <td className="py-2 font-black text-base">Total</td>
                <td className="py-2 text-right tabular-nums font-black text-base">₹{fmt(sale.total_amount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bank details + signature ─────────────────────────────────────── */}
      <div className="px-8 pb-8 border-t pt-5 grid grid-cols-2 gap-6">
        {(company?.bank_name || company?.account_number) && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Bank Details</p>
            <div className="text-xs text-gray-700 space-y-0.5">
              {company?.bank_name     && <p><span className="text-gray-500">Bank:</span> {company.bank_name}</p>}
              {company?.account_number && <p><span className="text-gray-500">A/C No:</span> <span className="font-mono">{company.account_number}</span></p>}
              {company?.ifsc_code     && <p><span className="text-gray-500">IFSC:</span> <span className="font-mono">{company.ifsc_code}</span></p>}
              {company?.upi_id        && <p><span className="text-gray-500">UPI:</span> {company.upi_id}</p>}
            </div>
          </div>
        )}
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">For {company?.name ?? 'Company'}</p>
          <div className="h-14 border-b border-dashed border-gray-300 mt-2" />
          <p className="text-xs text-gray-500 mt-1">Authorised Signatory</p>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-100 px-8 py-2 text-center">
        <p className="text-[10px] text-gray-500">This is a computer-generated invoice. No signature required.</p>
      </div>
    </div>
  )
}
