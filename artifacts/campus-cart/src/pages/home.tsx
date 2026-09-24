import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, ArrowUpRight, Check, LockKeyhole, ShoppingBag } from 'lucide-react';
import { useGetCampusCartConfig, useVerifyPilotInvite } from '@workspace/api-client-react';
import { PilotShell, SectionLabel } from '@/components/pilot-shell';

export default function Home() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [, navigate] = useLocation();
  const invite = useVerifyPilotInvite();
  const config = useGetCampusCartConfig();
  const submit = (event: FormEvent) => {
    event.preventDefault(); setError('');
    if (!code.trim()) { setError('Enter your invitation code to continue.'); return; }
    invite.mutate({ data: { inviteCode: code.trim() } }, { onSuccess: () => navigate('/sign-up'), onError: () => setError('That code could not be verified. Check the code and try again.') });
  };
  return <PilotShell>
    <div className="mx-auto max-w-[1180px] px-5 pt-12 md:px-10 md:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.06fr_.94fr] lg:gap-20">
        <div className="page-enter">
          <SectionLabel>A SMALL STUDY ABOUT A BIG EVERYDAY TASK</SectionLabel>
          <h1 className="display max-w-[680px] text-[clamp(3.9rem,7.5vw,7.8rem)]">The thing you need, <em className="font-normal text-[#bd9154]">off your mind.</em></h1>
          <p className="mt-8 max-w-[490px] text-lg leading-[1.65] text-muted-foreground">Tell us what you’re looking for. Campus Cart helps us understand how a simpler shopping request might work for campus life.</p>
          <div className="mt-9 flex flex-wrap items-center gap-4 text-sm font-semibold"><span className="flex items-center gap-2"><Check size={16} className="text-[#ac8247]"/> Takes a few minutes</span><span className="flex items-center gap-2"><Check size={16} className="text-[#ac8247]"/> No order placed</span></div>
        </div>
        <div className="page-enter relative lg:pl-6" style={{animationDelay: '.1s'}}>
          <div className="absolute -right-4 -top-5 hidden size-28 rounded-full border border-[#d0ac70]/45 lg:block"/>
          <div className="relative overflow-hidden rounded-[30px] border border-[#d8c9ae] bg-[#f0e6d1] p-5 shadow-[0_28px_80px_-45px_rgba(25,55,86,.5)] sm:p-8">
            <div className="absolute -right-20 -top-28 size-72 rounded-full border-[38px] border-[#e0cba6]/50"/>
            <div className="relative mb-9 flex items-center justify-between"><span className="mono text-[10px] font-bold text-[#826a48]">01 / GET STARTED</span><span className="grid size-11 place-items-center rounded-full bg-[#173657] text-[#eed6a6]"><ShoppingBag size={19}/></span></div>
            <h2 className="display relative max-w-[330px] text-4xl sm:text-5xl">You’re invited to imagine a better errand.</h2>
            <p className="relative mt-5 text-sm leading-relaxed text-[#625f55]">This is a private research pilot. Enter your invitation code to create an account with your verified @nd.edu email.</p>
            <form onSubmit={submit} className="relative mt-8">
              <label htmlFor="invite" className="label">Invitation code</label>
              <input id="invite" data-testid="input-invite-code" className="field !bg-[#fbf8ef]" value={code} onChange={e => setCode(e.target.value)} placeholder="Enter your code" autoComplete="off" maxLength={128}/>
              {error && <p data-testid="status-invite-error" role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
              <button data-testid="button-verify-invite" disabled={invite.isPending} className="btn-primary lift mt-3 w-full">{invite.isPending ? 'Checking code…' : 'Continue with invitation'} <ArrowRight size={17}/></button>
            </form>
            <p className="relative mt-6 text-center text-xs text-[#68635a]">Already participating? <Link href="/sign-in" data-testid="link-existing-participant" className="font-bold text-primary underline underline-offset-4">Sign in</Link></p>
          </div>
        </div>
      </div>
      <div className="mt-24 grid border-t border-border md:grid-cols-[.8fr_1.2fr] md:gap-16 md:pt-11">
        <div className="pt-10 md:pt-0"><SectionLabel>WHY THIS EXISTS</SectionLabel><h2 className="display max-w-sm text-4xl md:text-5xl">A small request can tell us a lot.</h2></div>
        <div className="grid gap-6 py-8 sm:grid-cols-2 md:py-0"><div className="border-l-2 border-[#be9557] pl-5"><h3 className="font-bold">Your actual needs</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Describe an item, a preferred merchant if you have one, and your maximum total budget including taxes and fees.</p></div><div className="border-l-2 border-[#be9557] pl-5"><h3 className="font-bold">A safer way to learn</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">We record requests for research. The prototype does not buy anything, place orders, or charge cards.</p></div></div>
      </div>
      <div className="mt-16 grid gap-8 rounded-[28px] bg-primary p-7 text-primary-foreground md:grid-cols-[1fr_auto] md:items-center md:p-12">
        <div><span className="mono text-[10px] text-[#ddbc83]">CLEAR BY DESIGN</span><h2 className="display mt-3 text-3xl md:text-4xl">Know what happens next.</h2><p className="mt-3 max-w-[670px] text-sm leading-relaxed text-[#d5dce2]">You’ll review your request before it’s recorded. If card setup is available, it’s an optional, separate test-mode step with explicit consent. No purchase or charge will be made in this session.</p></div><Link href="/sign-in" data-testid="link-pilot-sign-in" className="inline-flex items-center gap-2 text-sm font-bold text-[#e9c27f]">Already have an account <ArrowUpRight size={17}/></Link>
      </div>
      <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground"><LockKeyhole size={15}/><span data-testid="text-capabilities">{config.data?.audioEnabled ? 'Voice and typing available' : 'Typing available · Voice unavailable for this pilot'}. {config.data?.cardSetupEnabled ? 'Optional test-mode card setup available.' : 'Card setup currently unavailable.'}</span></div>
    </div>
  </PilotShell>;
}