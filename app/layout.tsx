import type { Metadata } from 'next'
import { Inter, Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { cn } from "@/lib/utils";
import { AuthProvider } from '@/components/AuthProvider'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Heater Service Log',
  description: 'Manage heater maintenance and service requests',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={inter.className}>
        {/* Global Navigation Bar */}
        <nav className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
            <Wrench size={24} />
            <Link href="/" className="text-xl font-bold tracking-tight">
              ServiceTracker
            </Link>
          </div>
        </nav>

        {/* Main Content Wrapper */}
        <main className="max-w-3xl mx-auto min-h-screen">
          <AuthProvider>
            {children}
          </AuthProvider>
        </main>
      </body>
    </html>
  )
}