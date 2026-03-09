'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, Settings, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default function AdminSettings() {
  const { user, role, loading } = useAuth()
  const router = useRouter()
  const [brands, setBrands] = useState<any[]>([])
  const [capacities, setCapacities] = useState<any[]>([])
  const [newBrand, setNewBrand] = useState('')
  const [newCapacity, setNewCapacity] = useState('')

  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && role !== 'admin') router.push('/')
    if (role === 'admin') {
      fetchBrands()
      fetchCapacities()
    }
  }, [user, role, loading])

  const fetchBrands = async () => {
    const { data } = await supabase.from('heater_brands').select('*').order('name')
    if (data) setBrands(data)
  }

  const fetchCapacities = async () => {
    const { data } = await supabase.from('heater_capacities').select('*').order('size')
    if (data) setCapacities(data)
  }

  const addBrand = async () => {
    if (!newBrand) return
    await supabase.from('heater_brands').insert([{ name: newBrand }])
    setNewBrand('')
    fetchBrands()
  }

  const addCapacity = async () => {
    if (!newCapacity) return
    await supabase.from('heater_capacities').insert([{ size: newCapacity }])
    setNewCapacity('')
    fetchCapacities()
  }

  const deleteItem = async (table: string, id: number) => {
    if(!confirm('Delete this item?')) return
    await supabase.from(table).delete().eq('id', id)
    table === 'heater_brands' ? fetchBrands() : fetchCapacities()
  }

  if (loading || role !== 'admin') return <div className="p-10 text-center">Access Denied or Loading...</div>

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Admin Console</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Heater Brands</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="New Brand" />
              <Button onClick={addBrand} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {brands.map(b => (
                <Badge key={b.id} variant="secondary" className="px-3 py-1">
                  {b.name}
                  <button onClick={() => deleteItem('heater_brands', b.id)} className="ml-2 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Capacities</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} placeholder="New Capacity" />
              <Button onClick={addCapacity} size="icon"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {capacities.map(c => (
                <Badge key={c.id} variant="outline" className="px-3 py-1">
                  {c.size}
                  <button onClick={() => deleteItem('heater_capacities', c.id)} className="ml-2 hover:text-red-500">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}