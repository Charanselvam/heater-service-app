'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

export default function EditService() {
  const router = useRouter()
  const params = useParams()
  const id = params.id

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  useEffect(() => {
    async function fetchService() {
      const { data, error } = await supabase
        .from('service_logs')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
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
      } else if (error) {
        alert('Could not load service data')
        router.push('/')
      }
      setIsLoading(false)
    }

    if (id) fetchService()
  }, [id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    const { error } = await supabase
      .from('service_logs')
      .update(formData)
      .eq('id', id)
    
    if (!error) {
      router.push('/')
      router.refresh()
    } else {
      alert('Error updating data: ' + error.message)
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return <div className="p-10 text-center font-semibold text-slate-500">Loading service details...</div>
  }

  return (
    <div className="p-4 pb-20 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:text-blue-600 transition-colors border border-slate-200">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-extrabold text-slate-800">Edit Service Entry</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-5">
        
        {/* Date & Token & Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label-text">Date</label>
            <input type="date" required className="input-field" 
              value={formData.service_date}
              onChange={e => setFormData({...formData, service_date: e.target.value})} 
            />
          </div>
          <div>
            <label className="label-text">Token / No.</label>
            <input type="text" placeholder="e.g. 1/3, 1A" className="input-field"
              value={formData.job_token}
              onChange={e => setFormData({...formData, job_token: e.target.value})} 
            />
          </div>
          <div>
            <label className="label-text">Status</label>
            <select className="input-field"
              value={formData.status}
              onChange={e => setFormData({...formData, status: e.target.value})}
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="warranty">Warranty</option>
            </select>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Customer Info */}
        <div>
          <label className="label-text">Customer Name <span className="text-red-500">*</span></label>
          <input type="text" required className="input-field"
            value={formData.customer_name}
            onChange={e => setFormData({...formData, customer_name: e.target.value})} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Phone Number</label>
            <input type="tel" className="input-field"
              value={formData.phone_number}
              onChange={e => setFormData({...formData, phone_number: e.target.value})} 
            />
          </div>
          <div>
            <label className="label-text">Address / Location</label>
            <input type="text" className="input-field"
              value={formData.address}
              onChange={e => setFormData({...formData, address: e.target.value})} 
            />
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Heater Details */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text">Heater Brand</label>
            <select className="input-field"
              value={formData.heater_brand}
              onChange={e => setFormData({...formData, heater_brand: e.target.value})}
            >
              <option value="" disabled>Select Brand</option>
              <option value="Vijoy">Vijoy</option>
              <option value="Elac">Elac</option>
              <option value="Leo">Leo</option>
              <option value="V-Guard">V-Guard</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="label-text">Capacity</label>
            <select className="input-field"
               value={formData.capacity}
               onChange={e => setFormData({...formData, capacity: e.target.value})}
            >
              <option value="10 Ltr">10 Ltr</option>
              <option value="15 Ltr">15 Ltr</option>
              <option value="25 Ltr">25 Ltr</option>
              <option value="50 Ltr">50 Ltr</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label-text">Service Notes</label>
          <textarea className="input-field" rows={3}
            value={formData.technician_notes}
            onChange={e => setFormData({...formData, technician_notes: e.target.value})}
          ></textarea>
        </div>

        <div className="pt-4 flex gap-3">
          <Link href="/" className="flex-1 py-3 bg-white border border-slate-300 text-slate-700 text-center rounded-xl font-bold hover:bg-slate-50 transition-colors">
            Cancel
          </Link>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? 'Updating...' : <><Save size={20} /> Update Entry</>}
          </button>
        </div>
      </form>
    </div>
  )
}