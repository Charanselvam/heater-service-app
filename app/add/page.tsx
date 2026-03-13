'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { ArrowLeft, Save, Calendar, Hash, User, Phone, MapPin, Tag, FileText, X } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

export default function AddService() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [brands, setBrands] = useState<any[]>([])
  const [capacities, setCapacities] = useState<any[]>([])

  // Image upload states
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])

  const [formData, setFormData] = useState({
    service_date: new Date().toISOString().split('T')[0],
    job_token: '',
    customer_name: '',
    phone_number: '',
    address: '',
    heater_brand: '',
    capacity: '',
    technician_notes: '',
    status: 'pending',
    images: [] as string[],
    payment_status: 'pending',
  })

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    fetchOptions()
  }, [user, authLoading])

  async function fetchOptions() {
    const [bRes, cRes] = await Promise.all([
      supabase.from('heater_brands').select('name').eq('is_active', true),
      supabase.from('heater_capacities').select('size').eq('is_active', true)
    ])
    if (bRes.data) setBrands(bRes.data)
    if (cRes.data) setCapacities(cRes.data)
  }

  // Image upload helper
  async function uploadImages(files: File[], serviceId: string): Promise<string[]> {
    const urls: string[] = []
    for (const file of files) {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `service-logs/${serviceId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('service-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('service-images')
        .getPublicUrl(filePath)

      urls.push(publicUrl)
    }
    return urls
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setSelectedFiles(prev => [...prev, ...files])
    const newPreviews = files.map(file => URL.createObjectURL(file))
    setPreviewUrls(prev => [...prev, ...newPreviews])
  }

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index])
    setPreviewUrls(prev => prev.filter((_, i) => i !== index))
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const baseData = { ...formData, images: [] as string[] }

      if (selectedFiles.length > 0) {
        // 1. Insert to get ID
        const { data: inserted, error: insertError } = await supabase
          .from('service_logs')
          .insert([baseData])
          .select('id')
          .single()

        if (insertError || !inserted) throw insertError || new Error('Insert failed')

        // 2. Upload images
        const imageUrls = await uploadImages(selectedFiles, inserted.id)

        // 3. Update record with image URLs
        const { error: updateError } = await supabase
          .from('service_logs')
          .update({ images: imageUrls })
          .eq('id', inserted.id)

        if (updateError) throw updateError

      } else {
        // No images - just insert normally
        const { error: insertError } = await supabase
          .from('service_logs')
          .insert([baseData])

        if (insertError) throw insertError
      }

      router.push('/')
      router.refresh()
    } catch (error: any) {
      alert('Error saving data: ' + error.message)
      setIsSubmitting(false)
    }
  }

  if (authLoading) return <div className="p-10 text-center">Loading...</div>
  if (!user) return null

  return (
    <div className="p-4 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">New Service Entry</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline" className="ml-2">New</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Date, Token & Status */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service_date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Date
                </Label>
                <Input
                  id="service_date"
                  type="date"
                  required
                  value={formData.service_date}
                  onChange={e => setFormData({ ...formData, service_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_token" className="flex items-center gap-2">
                  <Hash className="h-4 w-4" /> Token / No.
                </Label>
                <Input
                  id="job_token"
                  placeholder="e.g. 1/3, 1A"
                  value={formData.job_token}
                  onChange={e => setFormData({ ...formData, job_token: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">⏳ Pending</SelectItem>
                    <SelectItem value="completed">✅ Completed</SelectItem>
                    <SelectItem value="warranty">🛡️ Warranty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Customer Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer_name" className="flex items-center gap-2">
                  <User className="h-4 w-4" /> Customer Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customer_name"
                  required
                  placeholder="e.g. Mr. Ganesh"
                  value={formData.customer_name}
                  onChange={e => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_number" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> Phone Number
                  </Label>
                  <Input
                    id="phone_number"
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.phone_number}
                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Address / Location
                  </Label>
                  <Input
                    id="address"
                    placeholder="e.g. 123 Main St"
                    value={formData.address}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <Separator />
            <div className="space-y-2">
              <Label htmlFor="payment_status" className="flex items-center gap-2">
                💰 Payment Status
              </Label>
              <Select
                value={formData.payment_status}
                onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Pending</SelectItem>
                  <SelectItem value="partial">💸 Partial Paid</SelectItem>
                  <SelectItem value="paid">✅ Paid</SelectItem>
                  <SelectItem value="refunded">🔄 Refunded</SelectItem>
                  <SelectItem value="partial_refunded">🔄 Partial Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Heater Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heater_brand" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Heater Brand
                </Label>
                <Select
                  value={formData.heater_brand}
                  onValueChange={(value) => setFormData({ ...formData, heater_brand: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Select
                  value={formData.capacity}
                  onValueChange={(value) => setFormData({ ...formData, capacity: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Capacity" />
                  </SelectTrigger>
                  <SelectContent>
                    {capacities.map((c) => (
                      <SelectItem key={c.size} value={c.size}>{c.size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Service Notes */}
            <div className="space-y-2">
              <Label htmlFor="technician_notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Service Notes
              </Label>
              <Textarea
                id="technician_notes"
                placeholder="Describe the issue or service performed..."
                rows={4}
                value={formData.technician_notes}
                onChange={e => setFormData({ ...formData, technician_notes: e.target.value })}
              />
            </div>

            {/* Images Section */}
            <Separator />
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                📸 Service Images (optional)
              </Label>

              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="cursor-pointer"
              />

              {previewUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative rounded-lg overflow-hidden border group">
                      <img src={url} alt="preview" className="w-full h-28 object-cover" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 opacity-80 hover:opacity-100"
                        onClick={() => removeNewImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex gap-3 justify-end">
            <Link href="/">
              <Button variant="outline" type="button">Cancel</Button>
            </Link>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Entry
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}