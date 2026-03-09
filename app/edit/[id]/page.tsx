'use client'
import { useState, useEffect, useCallback } from 'react' // ✅ ADD useCallback
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { ArrowLeft, Save, Calendar, Hash, User, Phone, MapPin, Tag, FileText, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function EditService() {
  const router = useRouter()
  const params = useParams()
  const id = params.id
  
  const { user, loading: authLoading } = useAuth()
  const [brands, setBrands] = useState<any[]>([])
  const [capacities, setCapacities] = useState<any[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    service_date: '',
    job_token: '',
    customer_name: '',
    phone_number: '',
    address: '',
    heater_brand: '',
    capacity: '',
    technician_notes: '',
    status: ''
  })

  // ✅ DEFINE fetchOptions FIRST (before useEffect that uses it)
  const fetchOptions = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([
      supabase.from('heater_brands').select('name').eq('is_active', true),
      supabase.from('heater_capacities').select('size').eq('is_active', true)
    ])
    if (bRes.data) setBrands(bRes.data)
    if (cRes.data) setCapacities(cRes.data)
  }, [])

  // ✅ DEFINE fetchService SECOND (before useEffect that uses it)
  const fetchService = useCallback(async () => {
    if (!id) return
    
    setIsLoading(true)
    setError(null)
    
    const { data, error } = await supabase
      .from('service_logs')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      setError('Could not load service data')
      console.error('Error fetching service:', error)
    } else if (data) {
      setFormData({
        service_date: data.service_date || '',
        job_token: data.job_token || '',
        customer_name: data.customer_name || '',
        phone_number: data.phone_number || '',
        address: data.address || '',
        heater_brand: data.heater_brand || '',
        capacity: data.capacity || '',
        technician_notes: data.technician_notes || '',
        status: data.status || 'pending'
      })
    }
    setIsLoading(false)
  }, [id]) // ✅ Include id in dependency array

  // ✅ NOW useEffect can safely call both functions
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
    
    // Run setup
    fetchOptions()
    if (id) fetchService()
    
  }, [user, authLoading, id, fetchOptions, fetchService]) // ✅ Add functions to deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    
    const { error } = await supabase
      .from('service_logs')
      .update(formData)
      .eq('id', id)
    
    if (!error) {
      router.push('/')
      router.refresh()
    } else {
      setError('Error updating  ' + error.message)
      setIsSubmitting(false)
    }
  }

  // Auth loading state
  if (authLoading) {
    return (
      <div className="p-10 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        <p>Authenticating...</p>
      </div>
    )
  }

  // Redirect if not authenticated
  if (!user) return null

  // Data loading state
  if (isLoading) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading service details...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4 flex justify-center">
          <Link href="/">
            <Button>Return to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="outline" size="icon" className="rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Edit Service Entry</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Badge variant="outline">ID: {id?.slice(0,8)}...</Badge>
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
                  onChange={e => setFormData({...formData, service_date: e.target.value})}
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
                  onChange={e => setFormData({...formData, job_token: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({...formData, status: value})}
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
                  onChange={e => setFormData({...formData, customer_name: e.target.value})}
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
                    onChange={e => setFormData({...formData, phone_number: e.target.value})}
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
                    onChange={e => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Heater Details - DYNAMIC OPTIONS */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="heater_brand" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Heater Brand
                </Label>
                <Select
                  value={formData.heater_brand}
                  onValueChange={(value) => setFormData({...formData, heater_brand: value})}
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
                  onValueChange={(value) => setFormData({...formData, capacity: value})}
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
                onChange={e => setFormData({...formData, technician_notes: e.target.value})}
              />
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
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Update Entry
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}