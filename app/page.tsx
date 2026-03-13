'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { PlusCircle, Phone, MapPin, Search, Trash2, Calendar, Edit, Clock, CheckCircle, ShieldAlert, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useRouter } from 'next/navigation'
import { ModeToggle } from '@/components/modetoggle' 
// Import Alert Dialog components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function Home() {
  const { user, role, loading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  
  // State for the delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
    if (user) fetchServices()
  }, [user, authLoading])

  async function fetchServices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('service_logs')
      .select('*')
      .order('service_date', { ascending: false })

    if (data) setServices(data)
    setLoading(false)
  }

  // Triggered when user clicks "Delete" in the dialog
  async function confirmDelete() {
    if (!deleteId || role !== 'admin') return;

    setIsDeleting(true);
    const { error } = await supabase.from('service_logs').delete().eq('id', deleteId);
    
    if (!error) {
      setServices(services.filter(service => service.id !== deleteId));
      setDeleteId(null); // Close dialog
    } else {
      alert('Failed to delete the entry.');
    }
    setIsDeleting(false);
  }

  const filteredServices = services.filter(item =>
    item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.phone_number?.includes(searchTerm) ||
    item.job_token?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'destructive'
      case 'warranty':
        return 'secondary'
      default:
        return 'default'
    }
  }

  if (authLoading) return <div className="p-10 text-center text-muted-foreground">Loading...</div>
  if (!user) return null

  return (
    <div className="p-4 pb-24 bg-background min-h-screen">
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the service log for 
              <span className="font-semibold text-foreground"> {services.find(s => s.id === deleteId)?.customer_name}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Recent Logs</h1>
          <div className="text-sm text-muted-foreground mt-1">
            <span className="font-medium text-primary capitalize">{role}</span>
            <span className="mx-2">•</span>
            <span>{user?.email}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <ModeToggle />
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

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          <span className="text-muted-foreground">Loading records...</span>
        </div>
      ) : filteredServices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground font-medium">No service logs found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredServices.map((item) => (
            <Card key={item.id} className="relative group hover:shadow-md transition-shadow bg-card text-card-foreground">
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
                    className="h-8 w-8 hover:text-destructive"
                    onClick={() => {
                      if (role !== 'admin') {
                        alert('Only Admins can delete logs');
                        return;
                      }
                      setDeleteId(item.id);
                    }}
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
                      <Badge className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800" variant="outline">
                        Token: {item.job_token || 'N/A'}
                      </Badge>
                      <Badge variant="secondary">{item.heater_brand} • {item.capacity}</Badge>
                      <Badge
                        variant={
                          item.payment_status === 'paid' ? 'default' :
                            item.payment_status === 'partial' ? 'secondary' :
                              item.payment_status?.includes('refund') ? 'outline' :
                                'destructive'
                        }
                        className="ml-2"
                      >
                        {item.payment_status === 'pending' && 'Pending Payment'}
                        {item.payment_status === 'partial' && 'Partial Paid'}
                        {item.payment_status === 'paid' && 'Paid'}
                        {item.payment_status === 'refunded' && 'Refunded'}
                        {item.payment_status === 'partial_refunded' && 'Partial Refund'}
                        {!item.payment_status && 'Unknown'}
                      </Badge>
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{item.customer_name}</h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground mt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 opacity-70" />
                    {new Date(item.service_date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>

                  {item.phone_number && (
                    <a href={`tel:${item.phone_number}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Phone className="h-4 w-4 opacity-70" /> {item.phone_number}
                    </a>
                  )}

                  {item.address && (
                    <div className="flex items-start gap-2 sm:col-span-2">
                      <MapPin className="h-4 w-4 opacity-70 mt-0.5 shrink-0" />
                      <span>{item.address} {item.city && `, ${item.city}`}</span>
                    </div>
                  )}
                </div>

                {item.technician_notes && (
                  <div className="mt-4 pt-4 border-t text-sm bg-muted/50 p-3 rounded-lg text-muted-foreground">
                    <span className="font-semibold block mb-1 text-foreground">Notes / Service Type:</span>
                    {item.technician_notes}
                  </div>
                )}
                {item.images && (
                  (() => {
                    const imagesArray = (() => {
                      if (Array.isArray(item.images)) return item.images;
                      if (typeof item.images === 'string') {
                        try {
                          const parsed = JSON.parse(item.images);
                          return Array.isArray(parsed) ? parsed : [];
                        } catch {
                          return [];
                        }
                      }
                      return [];
                    })();

                    return imagesArray.length > 0 ? (
                      <div className="mt-5 pt-4 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">📸 Service Photos</p>
                          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                            {imagesArray.length}
                          </span>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-3 snap-x scrollbar-hide">
                          {imagesArray.slice(0, 6).map((url: string, index: number) => (
                            <a
                              key={index}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 snap-start ring-1 ring-border hover:ring-primary transition-all rounded-xl overflow-hidden"
                            >
                              <img
                                src={url}
                                alt="Service photo"
                                className="w-24 h-24 object-cover"
                              />
                            </a>
                          ))}

                          {imagesArray.length > 6 && (
                            <div className="flex-shrink-0 w-24 h-24 bg-muted border border-dashed rounded-xl flex items-center justify-center text-xs text-muted-foreground">
                              +{imagesArray.length - 6} more
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })()
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}