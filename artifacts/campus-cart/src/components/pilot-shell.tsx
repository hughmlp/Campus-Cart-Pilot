import { Link } from 'wouter';
import { ArrowUpRight, ShoppingBag } from 'lucide-react';
import { useClerk, useUser } from '@clerk/react';
import type { ReactNode } from 'react';

export function PilotShell({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  return <div className="grain min-h-[100dvh] bg-background">
    <header className="relative z-10 border-b border-border/70">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-3 px-5 py-4 md:px-10 md:py-5">
        <Link href="/" data-testid="link-home" className="group flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform group-hover:-rotate-6"><ShoppingBag size={19}/></span>
          <span className="text-[18px] font-bold tracking-[-.055em]">campus<span className="text-[#b88b48]">cart</span><span className="ml-1.5 align-top text-[9px] font-semibold tracking-[.06em] text-muted-foreground">PILOT</span></span>
        </Link>
        <div className="flex items-center gap-3 md:gap-6">
          <span className="mono hidden text-[10px] text-muted-foreground sm:inline">Notre Dame research pilot</span>
          <span className="rounded-full border border-[#c29b58]/40 bg-[#eecb89]/20 px-2.5 py-1 text-[10px] font-bold tracking-[.08em] text-[#795923]" data-testid="status-test-mode">TEST MODE</span>
          {user ? <><Link href="/research" data-testid="link-research" className="hidden text-xs font-bold text-muted-foreground hover:text-foreground sm:inline">Research</Link><button type="button" data-testid="button-sign-out" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })} className="text-xs font-bold text-muted-foreground hover:text-foreground">Sign out</button></> : <Link href="/sign-in" data-testid="link-sign-in" className="text-xs font-bold text-foreground hover:underline">Sign in <ArrowUpRight className="inline" size={13}/></Link>}
        </div>
      </div>
    </header>
    <main>{children}</main>
    <footer className={`relative z-10 mx-auto flex max-w-[1180px] flex-col gap-3 border-t border-border/70 px-5 py-6 text-xs leading-relaxed text-muted-foreground md:flex-row md:items-start md:justify-between md:px-10 ${compact ? 'mt-12' : 'mt-24'}`}>
      <p className="max-w-[570px]" data-testid="text-independent-disclaimer">Campus Cart is an independent research pilot for invited Notre Dame students and staff. It is not an official University of Notre Dame service or affiliated with the university.</p>
      <p>Research prototype · No purchases or charges in this session</p>
    </footer>
  </div>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mono mb-5 flex items-center gap-3 text-[10px] font-bold text-[#9a7139]"><span className="h-px w-6 bg-[#b88b48]"/>{children}</div>;
}

export function LoadingPanel() {
  return <div className="animate-pulse space-y-5 rounded-[24px] border border-border bg-card p-7" data-testid="status-loading"><div className="h-4 w-24 rounded bg-muted"/><div className="h-10 w-2/3 rounded bg-muted"/><div className="h-16 w-full rounded bg-muted"/><div className="h-12 w-36 rounded bg-muted"/></div>;
}

export function ErrorPanel({ title = 'We couldn’t load this right now.', onRetry, detail }: { title?: string; onRetry?: () => void; detail?: string }) {
  return <div className="rounded-[24px] border border-border bg-card p-7" data-testid="status-error"><div className="mb-3 size-9 rounded-full bg-[#e8c779]/30"/><h2 className="display text-2xl">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{detail || 'Please try again. If this keeps happening, your pilot access may need to be renewed.'}</p>{onRetry && <button data-testid="button-retry" onClick={onRetry} className="btn-outline lift mt-6">Try again</button>}</div>;
}