'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import {
  ArrowLeft, Save, Calendar, Hash, User, Phone, MapPin,
  Tag, FileText, Loader2, X, AlertCircle, CheckCircle2,
  Building2, MailOpen, ImageOff, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  service_date: string
  job_token: string
  customer_name: string
  phone_number: string
  address: string
  city: string
  pincode: string
  heater_brand: string
  capacity: string
  technician_notes: string
  status: 'pending' | 'completed' | 'warranty'
  payment_status: 'pending' | 'partial' | 'paid' | 'refunded' | 'partial_refunded'
}

interface Option { name?: string; size?: string }

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: FormData = {
  service_date: '', job_token: '', customer_name: '',
  phone_number: '', address: '', city: '', pincode: '',
  heater_brand: '', capacity: '', technician_notes: '',
  status: 'pending', payment_status: 'pending',
}

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'Pending',   icon: '⏳' },
  { value: 'completed', label: 'Completed', icon: '✅' },
  { value: 'warranty',  label: 'Warranty',  icon: '🛡️' },
]

const PAYMENT_OPTIONS = [
  { value: 'pending',          label: 'Unpaid',        icon: '⏳' },
  { value: 'partial',          label: 'Partial Paid',  icon: '💸' },
  { value: 'paid',             label: 'Paid',          icon: '✅' },
  { value: 'refunded',         label: 'Refunded',      icon: '🔄' },
  { value: 'partial_refunded', label: 'Partial Refund',icon: '🔄' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [] } catch { return [] }
  }
  return []
}

/** Splits a stored address string back into street / city / pincode */
function splitStoredAddress(raw: string): { address: string; city: string; pincode: string } {
  // Format written by add page: "street, city, - 600001"
  const pincodeMatch = raw.match(/[-–]\s*(\d{6})\s*$/)
  const pincode = pincodeMatch ? pincodeMatch[1] : ''
  const withoutPin = raw.replace(/,?\s*[-–]\s*\d{6}\s*$/, '').trim()

  // Last comma-separated segment is the city
  const parts = withoutPin.split(',').map(s => s.trim()).filter(Boolean)
  const city = parts.length > 1 ? parts.pop()! : ''
  const address = parts.join(', ')
  return { address, city, pincode }
}

async function lookupPincode(pin: string): Promise<{ city: string } | null> {
  if (pin.length !== 6) return null
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`)
    const json = await res.json()
    if (json?.[0]?.Status === 'Success') {
      const po = json[0].PostOffice?.[0]
      return { city: po?.District ?? po?.Name ?? '' }
    }
  } catch { /* ignore */ }
  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
      {label}{required && <span className="text-destructive ml-0.5">*</span>}
    </p>
  )
}

function Field({
  id, label, icon, required, error, hint, children,
}: {
  id?: string; label: string; icon?: React.ReactNode
  required?: boolean; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {label}
        {required && <span className="text-destructive text-xs">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-emerald-600 dark:text-emerald-400">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  )
}

// ─── Full-page states ─────────────────────────────────────────────────────────

function PageLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm font-medium">{label}</p>
    </div>
  )
}

function PageError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <div>
        <p className="font-semibold text-foreground mb-1">Failed to load</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" /> Retry
        </Button>
        <Link href="/"><Button variant="ghost">Go Home</Button></Link>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function EditService() {
  const router       = useRouter()
  const { id }       = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()

  const [formData, setFormData]       = useState<FormData>(EMPTY_FORM)
  const [brands, setBrands]           = useState<Option[]>([])
  const [capacities, setCapacities]   = useState<Option[]>([])
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls]     = useState<string[]>([])
  const [fieldErrors, setFieldErrors]     = useState<Partial<Record<keyof FormData, string>>>({})

  const [isLoading, setIsLoading]     = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError]     = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')

  const [pincodeLoading, setPincodeLoading] = useState(false)
  const [pincodeFound, setPincodeFound]     = useState(false)

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [authLoading, user, router])

  // ── Field setter ────────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
    setFieldErrors(prev => ({ ...prev, [key]: undefined }))
  }, [])

  // ── Options ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchOptions() {
      const [bRes, cRes] = await Promise.all([
        supabase.from('heater_brands').select('name').eq('is_active', true),
        supabase.from('heater_capacities').select('size').eq('is_active', true),
      ])
      if (bRes.data) setBrands(bRes.data)
      if (cRes.data) setCapacities(cRes.data)
    }
    fetchOptions()
  }, [])

  // ── Fetch service ───────────────────────────────────────────────────────────
  const fetchService = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setLoadError(null)

    const { data, error } = await supabase
      .from('service_logs').select('*').eq('id', id).single()

    if (error || !data) {
      setLoadError(error?.message ?? 'Service not found')
    } else {
      // Parse stored address back into parts
      const stored = splitStoredAddress(data.address ?? '')

      setFormData({
        service_date:     data.service_date      ?? '',
        job_token:        data.job_token         ?? '',
        customer_name:    data.customer_name     ?? '',
        phone_number:     data.phone_number      ?? '',
        address:          stored.address,
        city:             data.city ?? stored.city,
        pincode:          stored.pincode,
        heater_brand:     data.heater_brand      ?? '',
        capacity:         data.capacity          ?? '',
        technician_notes: data.technician_notes  ?? '',
        status:           data.status            ?? 'pending',
        payment_status:   data.payment_status    ?? 'pending',
      })
      setCurrentImages(parseImages(data.images))
    }
    setIsLoading(false)
  }, [id])

  useEffect(() => {
    if (user && id) fetchService()
  }, [user, id, fetchService])

  // ── Pincode ─────────────────────────────────────────────────────────────────
  async function handlePincodeChange(value: string) {
    const cleaned = value.replace(/\D/g, '').slice(0, 6)
    set('pincode', cleaned)
    setPincodeFound(false)
    if (cleaned.length === 6) {
      setPincodeLoading(true)
      const result = await lookupPincode(cleaned)
      setPincodeLoading(false)
      if (result) { set('city', result.city); setPincodeFound(true) }
    }
  }

  // ── Images ──────────────────────────────────────────────────────────────────
  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setSelectedFiles(prev => [...prev, ...files])
    setPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
  }

  function removeNewImage(i: number) {
    URL.revokeObjectURL(previewUrls[i])
    setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))
    setPreviewUrls(prev => prev.filter((_, idx) => idx !== i))
  }

  async function removeExistingImage(url: string) {
    try {
      const parts    = url.split('/')
      const filePath = parts.slice(-3).join('/') // service-logs/id/file.jpg
      await supabase.storage.from('service-images').remove([filePath])
    } catch { /* best-effort */ }
    setCurrentImages(prev => prev.filter(u => u !== url))
  }

  async function uploadImages(files: File[], serviceId: string): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const ext      = file.name.split('.').pop() ?? 'jpg'
      const filePath = `service-logs/${serviceId}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage
        .from('service-images').upload(filePath, file, { cacheControl: '3600', upsert: false })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('service-images').getPublicUrl(filePath)
      urls.push(publicUrl)
    }
    return urls
  }

  // ── Validation ──────────────────────────────────────────────────────────────
  function validate(): boolean {
    const errors: Partial<Record<keyof FormData, string>> = {}
    if (!formData.customer_name.trim()) errors.customer_name = 'Customer name is required'
    if (!formData.service_date)         errors.service_date  = 'Service date is required'
    if (formData.phone_number && !/^\d{10}$/.test(formData.phone_number.replace(/\s/g, '')))
      errors.phone_number = 'Enter a valid 10-digit number'
    if (formData.pincode && formData.pincode.length !== 6)
      errors.pincode = 'Pincode must be 6 digits'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    setSubmitError('')

    try {
      const addressFull = [
        formData.address,
        formData.city,
        formData.pincode ? `- ${formData.pincode}` : '',
      ].filter(Boolean).join(', ')

      let updatedImages = [...currentImages]
      if (selectedFiles.length > 0) {
        const newUrls = await uploadImages(selectedFiles, id)
        updatedImages = [...updatedImages, ...newUrls]
      }

      const { error } = await supabase.from('service_logs').update({
        service_date:     formData.service_date     || null,
        job_token:        formData.job_token        || null,
        customer_name:    formData.customer_name,
        phone_number:     formData.phone_number     || null,
        address:          addressFull               || null,
        city:             formData.city             || null,
        heater_brand:     formData.heater_brand     || null,
        capacity:         formData.capacity         || null,
        technician_notes: formData.technician_notes || null,
        status:           formData.status,
        payment_status:   formData.payment_status,
        images:           updatedImages,
      }).eq('id', id)

      if (error) throw error
      router.push('/')
      router.refresh()
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Something went wrong.')
      setIsSubmitting(false)
    }
  }

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (authLoading)  return <PageLoader label="Authenticating…" />
  if (!user)        return null
  if (isLoading)    return <PageLoader label="Loading service details…" />
  if (loadError)    return <PageError message={loadError} onRetry={fetchService} />

  const totalPhotos = currentImages.length + previewUrls.length

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground tracking-tight">Edit Service</h1>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {formData.customer_name || 'Loading…'}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
            #{id?.slice(0, 8)}
          </Badge>
        </div>

        {/* Submit error banner */}
        {submitError && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5">

            {/* ── Job Details ─────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Job Details" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field id="service_date" label="Date" icon={<Calendar className="h-3.5 w-3.5" />} required error={fieldErrors.service_date}>
                    <Input
                      id="service_date" type="date" required
                      value={formData.service_date}
                      onChange={e => set('service_date', e.target.value)}
                      className={fieldErrors.service_date ? 'border-destructive' : ''}
                    />
                  </Field>

                  <Field id="job_token" label="Token / No." icon={<Hash className="h-3.5 w-3.5" />}>
                    <Input
                      id="job_token" placeholder="e.g. 1/3, 1A"
                      value={formData.job_token}
                      onChange={e => set('job_token', e.target.value)}
                    />
                  </Field>

                  <Field id="status" label="Status">
                    <Select value={formData.status} onValueChange={v => set('status', v as FormData['status'])}>
                      <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.icon} {o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Customer Info ────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Customer Information" required />
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field id="customer_name" label="Full Name" icon={<User className="h-3.5 w-3.5" />} required error={fieldErrors.customer_name}>
                      <Input
                        id="customer_name" required placeholder="e.g. Mr. Ganesh"
                        value={formData.customer_name}
                        onChange={e => set('customer_name', e.target.value)}
                        className={fieldErrors.customer_name ? 'border-destructive' : ''}
                      />
                    </Field>

                    <Field id="phone_number" label="Phone Number" icon={<Phone className="h-3.5 w-3.5" />} error={fieldErrors.phone_number}>
                      <Input
                        id="phone_number" type="tel" inputMode="numeric"
                        maxLength={10} placeholder="10-digit number"
                        value={formData.phone_number}
                        onChange={e => set('phone_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className={fieldErrors.phone_number ? 'border-destructive' : ''}
                      />
                    </Field>
                  </div>

                  <Field id="address" label="Street Address" icon={<MapPin className="h-3.5 w-3.5" />}>
                    <Input
                      id="address" placeholder="House / flat, street, landmark"
                      value={formData.address}
                      onChange={e => set('address', e.target.value)}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      id="pincode" label="Pincode"
                      icon={<MailOpen className="h-3.5 w-3.5" />}
                      error={fieldErrors.pincode}
                      hint={pincodeFound ? '✓ Location auto-filled' : undefined}
                    >
                      <div className="relative">
                        <Input
                          id="pincode" inputMode="numeric" maxLength={6}
                          placeholder="e.g. 600001"
                          value={formData.pincode}
                          onChange={e => handlePincodeChange(e.target.value)}
                          className={`pr-8 font-mono tracking-widest ${fieldErrors.pincode ? 'border-destructive' : ''}`}
                        />
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                          {pincodeLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          {pincodeFound && !pincodeLoading && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                        </div>
                      </div>
                    </Field>

                    <Field id="city" label="City / District" icon={<Building2 className="h-3.5 w-3.5" />}>
                      <Input
                        id="city" placeholder="e.g. Chennai"
                        value={formData.city}
                        onChange={e => set('city', e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Payment ──────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Payment" />
                <Select value={formData.payment_status} onValueChange={v => set('payment_status', v as FormData['payment_status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.icon} {o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* ── Equipment ────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Equipment" />
                <div className="grid grid-cols-2 gap-4">
                  <Field id="heater_brand" label="Brand" icon={<Tag className="h-3.5 w-3.5" />}>
                    <Select value={formData.heater_brand} onValueChange={v => set('heater_brand', v)}>
                      <SelectTrigger id="heater_brand"><SelectValue placeholder="Select brand" /></SelectTrigger>
                      <SelectContent>
                        {brands.map(b => (
                          <SelectItem key={b.name} value={b.name!}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field id="capacity" label="Capacity">
                    <Select value={formData.capacity} onValueChange={v => set('capacity', v)}>
                      <SelectTrigger id="capacity"><SelectValue placeholder="Select capacity" /></SelectTrigger>
                      <SelectContent>
                        {capacities.map(c => (
                          <SelectItem key={c.size} value={c.size!}>{c.size}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              </CardContent>
            </Card>

            {/* ── Notes ────────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <SectionLabel label="Service Notes" />
                <Textarea
                  id="technician_notes"
                  placeholder="Describe the issue, parts replaced, or work performed…"
                  rows={4}
                  value={formData.technician_notes}
                  onChange={e => set('technician_notes', e.target.value)}
                  className="resize-none text-sm"
                />
              </CardContent>
            </Card>

            {/* ── Photos ───────────────────────────────────────────────────── */}
            <Card className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel label="Service Photos" />
                  {totalPhotos > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full -mt-3">
                      {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Existing images */}
                {currentImages.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Existing
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {currentImages.map((url, i) => (
                        <div key={i} className="relative rounded-xl overflow-hidden border bg-muted aspect-square group">
                          <Image
                            src={url} alt="existing photo" fill
                            className="object-cover" sizes="96px"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                          <button
                            type="button"
                            onClick={() => removeExistingImage(url)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-rose-600 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New preview images */}
                {previewUrls.length > 0 && (
                  <div className="mb-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                      New to add
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {previewUrls.map((url, i) => (
                        <div key={i} className="relative rounded-xl overflow-hidden border-2 border-emerald-500/30 bg-muted aspect-square group">
                          <Image
                            src={url} alt="new photo" fill
                            className="object-cover" sizes="96px" unoptimized
                          />
                          <button
                            type="button"
                            onClick={() => removeNewImage(i)}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center hover:bg-rose-600 transition-colors"
                          >
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload zone */}
                <label
                  htmlFor="image-upload"
                  className={`flex flex-col items-center justify-center gap-2 w-full rounded-xl border-2 border-dashed cursor-pointer transition-all text-muted-foreground
                    ${totalPhotos > 0 ? 'h-16' : 'h-28'}
                    border-muted-foreground/25 bg-muted/30 hover:bg-muted/50 hover:border-muted-foreground/40`}
                >
                  <span className="text-xl">{totalPhotos > 0 ? '➕' : '📷'}</span>
                  <span className="text-xs font-medium">
                    {totalPhotos > 0 ? 'Add more photos' : 'Tap to add photos'}
                  </span>
                  <input
                    id="image-upload" type="file" multiple accept="image/*"
                    className="hidden" onChange={handleImageSelect}
                  />
                </label>

                {currentImages.length === 0 && previewUrls.length === 0 && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-muted-foreground/50">
                    <ImageOff className="h-4 w-4" />
                    <span className="text-xs">No photos attached yet</span>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* Sticky footer */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-t px-4 py-3">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <Link href="/" className="flex-1">
                <Button variant="outline" type="button" className="w-full">Cancel</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting} className="flex-1 font-semibold">
                {isSubmitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</>
                  : <><Save className="mr-2 h-4 w-4" />Update Entry</>
                }
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}