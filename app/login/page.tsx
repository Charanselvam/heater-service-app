'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wrench, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'login' | 'signup'

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  id, label, type, value, onChange, placeholder, error, suffix,
}: {
  id: string
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
  suffix?: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete={id}
          className={`${suffix ? 'pr-10' : ''} ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {suffix}
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode]         = useState<Mode>('login')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const isLogin = mode === 'login'

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)

    const { error: authError } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'signup' : 'login')
    setError('')
    setPassword('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Wrench className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">ServiceTracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-card border rounded-2xl shadow-sm p-6 space-y-5">

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} noValidate className="space-y-4">
            <Field
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
            />

            <Field
              id="current-password"
              label="Password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPass
                    ? <EyeOff className="h-4 w-4" />
                    : <Eye className="h-4 w-4" />}
                </button>
              }
            />

            <Button type="submit" disabled={loading} className="w-full font-semibold h-10">
              {loading
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isLogin ? 'Signing in…' : 'Creating account…'}</>
                : isLogin ? 'Sign In' : 'Create Account'
              }
            </Button>
          </form>

          {/* Mode switch */}
          <div className="text-center">
            <button
              onClick={switchMode}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin
                ? <>Don&apos;t have an account? <span className="text-primary font-medium">Sign up</span></>
                : <>Already have an account? <span className="text-primary font-medium">Sign in</span></>
              }
            </button>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-xs text-center text-muted-foreground mt-5 px-2">
          New accounts default to <span className="font-medium">Technician</span> role.
          Contact your admin for access upgrades.
        </p>
      </div>
    </div>
  )
}