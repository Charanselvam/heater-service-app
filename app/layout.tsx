import type { Metadata } from 'next'
import { Inter, Geist } from 'next/font/google'
import './globals.css'
import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { AuthProvider } from '@/components/AuthProvider'
import { ThemeProvider } from "@/components/theme-provider"

// You defined geist but used inter in the body. 
// If you want to use Geist, pass it to className. 
// For now, sticking to your original 'inter' usage.
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          
          {/* Global Navigation Bar */}
          <nav className="bg-primary text-primary-foreground shadow-md sticky top-0 z-50">
            <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
              <Wrench size={24} />
              <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-90 transition-opacity">
                ServiceTracker
              </Link>
            </div>
          </nav>

          {/* Main Content Wrapper */}
          {/* Added bg-background explicitly here as a fallback, though body handles it */}
          <main className="max-w-3xl mx-auto min-h-screen bg-background">
            <AuthProvider>
              {children}
            </AuthProvider>
          </main>

        </ThemeProvider>
      </body>
    </html>
  )
}