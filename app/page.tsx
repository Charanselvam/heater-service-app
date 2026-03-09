'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider' // ADD THIS
import { PlusCircle, Phone, MapPin, Search, Trash2, Calendar, Edit, Clock, CheckCircle, ShieldAlert, LogOut, Settings } from 'lucide-react' // ADD LogOut, Settings
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useRouter } from 'next/navigation' // ADD THIS

export default function Home() {
  const { user, role, loading: authLoading, signOut } = useAuth() // ADD THIS
  const router = useRouter() // ADD THIS
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (!authLoading && !user) router.push('/login') // ADD THIS
    if (user) fetchServices()
  }, [user, authLoading]) // UPDATE DEPENDENCY

  async function fetchServices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('service_logs')
      .select('*')
      .order('service_date', { ascending: false })
    
    if (data) setServices(data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (role !== 'admin') return alert('Only Admins can delete logs') // ADD THIS
    if (!window.confirm('Are you sure you want to delete this service log?')) return;
    
    const { error } = await supabase.from('service_logs').delete().eq('id', id)
    if (!error) {
      setServices(services.filter(service => service.id !== id))
    } else {
      alert('Failed to delete the entry.')
    }
  }

  const filteredServices = services.filter(item => 
    item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.phone_number?.includes(searchTerm) ||
    item.job_token?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusVariant = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'pending':
        return 'destructive'
      case 'warranty':
        return 'secondary'
      default:
        return 'default'
    }
  }

  if (authLoading) return <div className="p-10 text-center">Loading...</div> // ADD THIS
  if (!user) return null // ADD THIS

  return (
    <div className="p-4 pb-24">
      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div> {/* CHANGE FROM h1 only */}
          <h1 className="text-2xl font-extrabold text-slate-800">Recent Logs</h1>
          <div className="text-sm text-slate-500 mt-1">
            <span className="font-medium text-blue-600 capitalize">{role}</span>
            <span className="mx-2">•</span>
            <span>{user?.email}</span>
          </div>
        </div>
        <div className="flex gap-2"> {/* CHANGE FROM single Link */}
          {role === 'admin' && (
            <Link href="/admin/settings">
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button variant="destructive" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
          <Link href="/add">
            <Button className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Entry
            </Button>
          </Link>
        </div>
      </header>

      {/* Rest of your existing code remains the same */}
      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          placeholder="Search by name, phone, or token..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-slate-500">Loading records...</span>
        </div>
      ) : filteredServices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-slate-500 font-medium">No service logs found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredServices.map((item) => (
            <Card key={item.id} className="relative group hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                {/* Action Buttons */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <Link href={`/edit/${item.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:text-red-500"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 pr-16">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant={getStatusVariant(item.status)}>
                        {item.status === 'pending' && <Clock className="mr-1 h-3 w-3" />}
                        {item.status === 'warranty' && <ShieldAlert className="mr-1 h-3 w-3" />}
                        {item.status === 'completed' && <CheckCircle className="mr-1 h-3 w-3" />}
                        {item.status || 'Completed'}
                      </Badge>
                      <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" variant="outline">Token: {item.job_token || 'N/A'}</Badge>
                      <Badge variant="secondary">{item.heater_brand} • {item.capacity}</Badge>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">{item.customer_name}</h3>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-slate-600 mt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {new Date(item.service_date).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  
                  {item.phone_number && (
                    <a href={`tel:${item.phone_number}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                      <Phone className="h-4 w-4 text-slate-400" /> {item.phone_number}
                    </a>
                  )}
                  
                  {item.address && (
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" /> 
                      <span>{item.address} {item.city && `, ${item.city}`}</span>
                    </div>
                  )}
                </div>
                
                {item.technician_notes && (
                  <div className="mt-4 pt-4 border-t text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">
                    <span className="font-semibold block mb-1 text-slate-900">Notes / Service Type:</span>
                    {item.technician_notes}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}