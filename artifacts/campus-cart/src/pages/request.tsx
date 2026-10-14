import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, CreditCard, LockKeyhole, Mic, PenLine, ShieldCheck, X } from 'lucide-react';
import {
  useGetCampusCartConfig, useGetMyParticipant, useSaveMyParticipant, useCreateShoppingRequest,
  useGetMyShoppingRequest, useRecordFunnelEvent, useSubmitParticipantFeedback, useVerifyPilotInvite,
  useStartCardSetup, useVerifyCardSetup, useGetMyCardStatus, useDisconnectMyCard,
  getGetMyParticipantQueryKey, getGetMyShoppingRequestQueryKey, getGetMyCardStatusQueryKey, getGetResearchDashboardQueryKey,
  type ParticipantProfileInputRole, type ShoppingRequest,
} from '@workspace/api-client-react';
import { ErrorPanel, LoadingPanel, PilotShell, SectionLabel } from '@/components/pilot-shell';

const disclosure = 'This research prototype will save your card through Stripe. No purchase or charge will be made in this session. Future purchases will require separate authorization.';
const stages = ['About you', 'Your request', 'The details', 'Review'];
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

function VerifiedEmailGate({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  if (!isLoaded) return <LoadingPanel />;
  const email = user?.emailAddresses.find(e => e.emailAddress.toLowerCase().endsWith('@nd.edu') && e.verification?.status === 'verified')?.emailAddress;
  if (!email) return <ErrorPanel title="A verified @nd.edu email is required." detail="This invitation-only pilot is for Notre Dame students and staff. Add and verify your @nd.edu email in your account before continuing." />;
  return <><div className="mb-7 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={16} className="text-[#a97d40]"/><span data-testid="text-verified-email">Signed in with verified {email}</span></div>{children}</>;
}

function RequestExperience() {
  const queryClient = useQueryClient();
  const config = useGetCampusCartConfig();
  const profile = useGetMyParticipant();
  const saved = useGetMyShoppingRequest({ query: { queryKey: getGetMyShoppingRequestQueryKey(), enabled: Boolean(profile.data?.participantId) } });
  const card = useGetMyCardStatus({ query: { queryKey: getGetMyCardStatusQueryKey(), enabled: Boolean(profile.data?.participantId) } });
  const saveProfile = useSaveMyParticipant();
  const verifyInvite = useVerifyPilotInvite();
  const createRequest = useCreateShoppingRequest();
  const record = useRecordFunnelEvent();
  const feedbackMutation = useSubmitParticipantFeedback();
  const startCard = useStartCardSetup();
  const verifyCard = useVerifyCardSetup();
  const disconnect = useDisconnectMyCard();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<ParticipantProfileInputRole | ''>('');
  const [narrative, setNarrative] = useState('');
  const [item, setItem] = useState('');
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');
  const [budget, setBudget] = useState('');
  const [consent, setConsent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [error, setError] = useState('');
  const [localRequest, setLocalRequest] = useState<ShoppingRequest | null>(null);
  const [voiceState, setVoiceState] = useState<'idle' | 'starting' | 'recording' | 'transcribing'>('idle');
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const upload = useRef<AbortController | null>(null);
  const recordingSession = useRef(0);
  const cardEventSent = useRef(false);
  const verifiedSession = useRef('');
  const request = localRequest || saved.data?.request;

  useEffect(() => { if (profile.data?.role && !role) setRole(profile.data.role); }, [profile.data?.role, role]);
  useEffect(() => {
    if (request && !cardEventSent.current) {
      cardEventSent.current = true;
      record.mutate({ data: { eventType: 'card_step_viewed' } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetResearchDashboardQueryKey() }) });
    }
  }, [request?.id]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId || sessionId.length < 8 || verifiedSession.current === sessionId) return;
    verifiedSession.current = sessionId;
    verifyCard.mutate({ data: { sessionId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMyCardStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyParticipantQueryKey() });
        window.history.replaceState({}, '', window.location.pathname);
      },
      onError: () => setError('We could not verify the card setup. Please check your status or try again.'),
    });
  }, []);
  const stopTracks = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  const cancelVoice = () => {
    recordingSession.current++;
    upload.current?.abort();
    upload.current = null;
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
      recorder.current = null;
    }
    stopTracks();
    setVoiceState('idle');
  };
  useEffect(() => () => {
    recordingSession.current++;
    upload.current?.abort();
    if (recorder.current) {
      recorder.current.onstop = null;
      if (recorder.current.state !== 'inactive') recorder.current.stop();
    }
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);
  const toggleVoice = async () => {
    if (!config.data?.audioEnabled) return;
    if (voiceState === 'recording') { recorder.current?.stop(); setVoiceState('transcribing'); return; }
    if (voiceState !== 'idle') return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Recording isn’t supported in this browser. You can type your request instead.'); return;
    }
    setVoiceState('starting');
    setError('');
    const session = ++recordingSession.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session !== recordingSession.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error('Unsupported recording format');
      const instance = new MediaRecorder(media, { mimeType });
      const chunks: Blob[] = [];
      instance.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      instance.onerror = () => {
        instance.onstop = null;
        stopTracks();
        recorder.current = null;
        setVoiceState('idle');
        setError('Recording stopped unexpectedly. You can type your request instead.');
      };
      instance.onstop = async () => {
        stopTracks();
        recorder.current = null;
        if (session !== recordingSession.current) return;
        const audio = new Blob(chunks, { type: mimeType });
        if (!audio.size || audio.size > 10 * 1024 * 1024) {
          setError(audio.size ? 'Recording is too large. Please record a shorter request or type it.' : 'No audio was captured. Please try again or type your request.');
          setVoiceState('idle');
          return;
        }
        const controller = new AbortController();
        upload.current = controller;
        try {
          const response = await fetch('/api/campus-cart/requests/transcription', {
            method: 'POST', headers: { 'Content-Type': mimeType }, body: audio,
            credentials: 'same-origin', signal: controller.signal,
          });
          if (!response.ok) throw new Error('Transcription failed');
          const result: { text: string } = await response.json();
          if (!controller.signal.aborted && session === recordingSession.current) setNarrative(previous => [previous.trim(), result.text.trim()].filter(Boolean).join(' ').slice(0, 240));
        } catch {
          if (!controller.signal.aborted && session === recordingSession.current) setError('We couldn’t transcribe that recording. Please try again or type your request.');
        } finally {
          if (!controller.signal.aborted && session === recordingSession.current) setVoiceState('idle');
          if (upload.current === controller) upload.current = null;
        }
      };
      recorder.current = instance;
      instance.start();
      setVoiceState('recording');
    } catch {
      if (session !== recordingSession.current) return;
      stopTracks();
      setVoiceState('idle');
      setError('Microphone access or recording is unavailable. You can type your request instead.');
    }
  };
  const nextFromRole = async () => {
    if (saveProfile.isPending || verifyInvite.isPending) return;
    if (!role) { setError('Choose student or staff to continue.'); return; }
    setError('');
    if (inviteCode.trim()) {
      try {
        await verifyInvite.mutateAsync({ data: { inviteCode: inviteCode.trim() } });
      } catch {
        setError('That invitation code was not accepted. Check your pilot invitation and try again.');
        return;
      }
    }
    saveProfile.mutate({ data: { role } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetMyParticipantQueryKey() }); setStep(1); },
      onError: failure => {
        const data: unknown = failure.data;
        setError(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
          ? data.error
          : 'We could not save your role. Please try again.');
      },
    });
  };
  const toDetails = () => {
    if (voiceState !== 'idle') { setError('Finish recording and transcription before continuing.'); return; }
    if (!narrative.trim()) { setError('Describe what you need to continue.'); return; }
    if (!item) setItem(narrative.trim().slice(0, 240));
    setError(''); setStep(2);
  };
  const toReview = (event: FormEvent) => {
    event.preventDefault();
    const amount = Number(budget);
    if (!item.trim() || !category.trim() || !Number.isFinite(amount) || amount < .01 || amount > 1000000 || !/^\d+(\.\d{1,2})?$/.test(budget)) {
      setError('Add an item, category, and a valid maximum total budget.'); return;
    }
    setError(''); setStep(3);
  };
  const submitRequest = () => {
    setError('');
    createRequest.mutate({ data: { item: item.trim(), category: category.trim(), merchant: merchant.trim() || null, budgetCents: Math.round(Number(budget) * 100) } }, {
      onSuccess: data => {
        setLocalRequest(data);
        queryClient.invalidateQueries({ queryKey: getGetMyShoppingRequestQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyParticipantQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetResearchDashboardQueryKey() });
      },
      onError: () => setError('Your request was not recorded. Please try again. No order was placed.'),
    });
  };
  const beginCard = () => {
    if (!consent || !config.data?.cardSetupEnabled) return;
    setError('');
    startCard.mutate(undefined, {
      onSuccess: result => { window.location.assign(result.url); },
      onError: () => setError('Card setup could not be started. Your request is still recorded; no order was placed.'),
    });
  };
  const removeCard = () => {
    if (!window.confirm('Disconnect your test-mode card from this pilot?')) return;
    disconnect.mutate(undefined, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetMyCardStatusQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetMyParticipantQueryKey() }); },
      onError: () => setError('We could not disconnect the card right now. Please try again.'),
    });
  };
  const submitFeedback = (event: FormEvent) => {
    event.preventDefault();
    if (!feedback.trim()) return;
    feedbackMutation.mutate({ data: { feedback: feedback.trim() } }, { onSuccess: () => { setFeedbackSent(true); setFeedback(''); queryClient.invalidateQueries({ queryKey: getGetResearchDashboardQueryKey() }); }, onError: () => setError('Feedback was not sent. Please try again.') });
  };
  if (config.isLoading || profile.isLoading || saved.isLoading) return <LoadingPanel />;
  const newParticipant = profile.isError && profile.error?.status === 401;
  if (config.isError || (profile.isError && !newParticipant) || saved.isError) return <div className="space-y-5"><ErrorPanel title="We couldn’t open your pilot space." detail="Your invitation may have expired. Re-enter your code below, or try loading again." onRetry={() => { config.refetch(); profile.refetch(); if (profile.data) saved.refetch(); }}/><form className="rounded-[24px] border border-border bg-card p-6" onSubmit={event => { event.preventDefault(); verifyInvite.mutate({ data: { inviteCode: inviteCode.trim() } }, { onSuccess: () => { setError(''); profile.refetch(); }, onError: () => setError('That invitation code could not be verified.') }); }}><label htmlFor="invite-retry" className="label">Renew pilot access</label><div className="flex flex-col gap-3 sm:flex-row"><input id="invite-retry" data-testid="input-renew-invite" className="field" value={inviteCode} onChange={event => setInviteCode(event.target.value)} placeholder="Invitation code" maxLength={128}/><button data-testid="button-renew-invite" className="btn-primary shrink-0" disabled={!inviteCode.trim() || verifyInvite.isPending}>{verifyInvite.isPending ? 'Checking…' : 'Verify code'}</button></div>{error && <p role="alert" data-testid="status-renew-invite-error" className="mt-3 text-sm text-destructive">{error}</p>}</form></div>;
  const supported = merchant.trim() && config.data?.supportedMerchants.some(m => m.toLowerCase() === merchant.trim().toLowerCase());
  return <div className="page-enter grid gap-12 lg:grid-cols-[265px_minmax(0,1fr)] lg:gap-20">
    <aside className="lg:pt-3">
      <SectionLabel>YOUR PILOT SPACE</SectionLabel>
      <h1 className="display text-4xl md:text-5xl">{request ? 'Your request, received.' : 'Let’s make this simple.'}</h1>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{request ? 'Your input is part of this study. Nothing has been purchased.' : 'One thoughtful request at a time. You can check everything before submitting.'}</p>
      {!request && <div className="mt-9 flex gap-1.5 lg:flex-col lg:gap-0">{stages.map((stage, index) => <div key={stage} className={`flex flex-1 items-center gap-3 rounded-xl px-2 py-2 text-xs font-semibold lg:flex-none lg:px-3 lg:py-3 ${step === index ? 'bg-[#e8dbc2] text-primary' : 'text-muted-foreground'}`}><span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${index < step ? 'bg-primary text-primary-foreground' : step === index ? 'border border-primary text-primary' : 'border border-border'}`}>{index < step ? <Check size={12}/> : index + 1}</span><span className="hidden sm:inline">{stage}</span></div>)}</div>}
      <div className="mt-7 rounded-2xl border border-[#d9c497] bg-[#f3e8d1]/60 p-4 text-xs leading-relaxed text-[#695638]"><span className="mono mb-2 block text-[9px] font-bold">RESEARCH, NOT RETAIL</span>TEST MODE. No order or charge will be made in this session.</div>
    </aside>
    <div className="min-w-0">
      <VerifiedEmailGate>
        {error && <div role="alert" data-testid="status-request-error" className="mb-5 flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><X size={17} className="shrink-0"/>{error}</div>}
        {request ? <div className="space-y-7">
          <div className="rounded-[26px] border border-[#c9d4c9] bg-[#e9efe6] p-6 sm:p-9"><span className="mb-6 grid size-12 place-items-center rounded-full bg-[#d3e2d3] text-[#38644a]"><CheckCircle2 size={24}/></span><SectionLabel>SUBMISSION CONFIRMED</SectionLabel><h2 data-testid="status-request-received" className="display text-4xl sm:text-5xl">Request received—no order placed.</h2><p className="mt-4 max-w-xl text-sm leading-relaxed text-[#536b5a]">Thank you. We recorded your request for this research pilot. This is not an order confirmation and no payment has been taken.</p></div>
          {request.supportStatus === 'unsupported' && <div data-testid="status-unsupported-merchant" className="rounded-2xl border border-[#dbbc7d] bg-[#f7ecd2] p-5 text-sm font-semibold text-[#745823]">We can’t purchase from this merchant yet. Your request has been recorded.</div>}
          <div className="rounded-[26px] border border-border bg-card p-6 sm:p-8"><div className="flex items-center justify-between gap-3"><h3 className="display text-2xl">Your recorded request</h3><span className="mono text-[9px] text-muted-foreground">REQUEST ONLY</span></div><div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">{[['Item', request.item], ['Category', request.category], ['Preferred merchant', request.merchant || 'Not specified'], ['Maximum total, including taxes & fees', money(request.budgetCents)]].map(([label, value]) => <div key={label}><span className="text-xs text-muted-foreground">{label}</span><p data-testid={`text-request-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`} className="mt-1 font-semibold">{value}</p></div>)}</div></div>
          <div className="rounded-[26px] border border-border bg-card p-6 sm:p-8"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#e8dbc2] text-primary"><CreditCard size={20}/></span><div><h3 className="font-bold">Optional card setup</h3><p className="text-xs text-muted-foreground">Separate from your recorded request</p></div></div>
            <p className="text-sm leading-relaxed text-muted-foreground">{disclosure}</p>
            {card.data?.status === 'connected' ? <div className="mt-6 flex flex-wrap items-center gap-4"><span data-testid="status-card-connected" className="flex items-center gap-2 text-sm font-bold text-[#38644a]"><ShieldCheck size={18}/> Test-mode card connected</span><button data-testid="button-disconnect-card" className="text-sm font-semibold text-destructive underline underline-offset-4" disabled={disconnect.isPending} onClick={removeCard}>{disconnect.isPending ? 'Disconnecting…' : 'Disconnect card'}</button></div> : <><label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed"><input data-testid="checkbox-stripe-consent" type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 size-4 accent-[#173657]"/><span>I understand the Stripe test-mode card disclosure above and explicitly consent to starting card setup.</span></label><button data-testid="button-start-card-setup" disabled={!consent || !config.data?.cardSetupEnabled || startCard.isPending} onClick={beginCard} className="btn-primary lift mt-4 w-full sm:w-auto">{startCard.isPending ? 'Opening Stripe…' : 'Continue to Stripe test mode'} <ArrowRight size={16}/></button>{!config.data?.cardSetupEnabled && <p data-testid="status-card-unavailable" className="mt-3 text-xs text-muted-foreground">Card setup is currently unavailable for this pilot. Your request has still been recorded; no card is needed.</p>}{card.data?.status === 'setup_pending' && <p data-testid="status-card-pending" className="mt-3 text-xs text-muted-foreground">Your card setup is pending verification. No purchase was made.</p>}</>}
          </div>
          <div className="rounded-[26px] border border-border bg-card p-6 sm:p-8"><h3 className="display text-2xl">One last thought?</h3><p className="mt-2 text-sm text-muted-foreground">Optional feedback about the experience or card-connection step helps us improve this pilot.</p>{feedbackSent ? <p data-testid="status-feedback-sent" className="mt-5 text-sm font-bold text-[#38644a]">Feedback received. Thank you for helping us learn.</p> : <form onSubmit={submitFeedback} className="mt-5"><textarea data-testid="input-feedback" className="field min-h-28 resize-y" maxLength={1200} placeholder="What felt clear? What could be better?" value={feedback} onChange={e => setFeedback(e.target.value)}/><button data-testid="button-submit-feedback" disabled={!feedback.trim() || feedbackMutation.isPending} className="btn-outline lift mt-3">{feedbackMutation.isPending ? 'Sending…' : 'Send feedback'} <ArrowRight size={15}/></button></form>}</div>
        </div> : <div className="rounded-[28px] border border-border bg-card p-6 shadow-[0_22px_55px_-45px_rgba(25,55,86,.42)] sm:p-10">
          <div className="mb-9 flex items-center justify-between border-b border-border pb-6"><span className="mono text-[10px] font-bold text-[#a0753e]">STEP 0{step + 1} / 04</span><span className="text-xs text-muted-foreground">{stages[step]}</span></div>
           {step === 0 && <div className="page-enter"><SectionLabel>FIRST, A LITTLE ABOUT YOU</SectionLabel><h2 className="display text-4xl sm:text-5xl">How are you part of campus?</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">We only ask this to understand whose needs the pilot represents.</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{(['student', 'staff'] as const).map(option => <button key={option} data-testid={`button-role-${option}`} onClick={() => { setRole(option); setError(''); }} className={`lift flex items-center justify-between rounded-2xl border p-5 text-left font-semibold capitalize ${role === option ? 'border-primary bg-[#e8dbc2]/60 text-primary' : 'border-border bg-background'}`}>{option}<span className={`grid size-6 place-items-center rounded-full border ${role === option ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{role === option && <Check size={14}/>}</span></button>)}</div>{newParticipant && <form className="mt-7" onSubmit={event => { event.preventDefault(); if (!inviteCode.trim()) return; verifyInvite.mutate({ data: { inviteCode: inviteCode.trim() } }, { onSuccess: () => setError(''), onError: () => setError('That invitation code could not be verified.') }); }}><label htmlFor="invite-onboarding" className="label">Invitation code</label><div className="flex gap-2"><input id="invite-onboarding" className="field" value={inviteCode} onChange={event => setInviteCode(event.target.value)} maxLength={128} placeholder="Enter or renew your code"/><button type="submit" className="btn-outline shrink-0" disabled={!inviteCode.trim() || verifyInvite.isPending}>{verifyInvite.isPending ? 'Checking…' : 'Verify code'}</button></div><p className="mt-2 text-xs text-muted-foreground">Already entered a valid code? You can continue below.</p></form>}<button data-testid="button-next-role" onClick={nextFromRole} disabled={saveProfile.isPending} className="btn-primary lift mt-9 w-full sm:w-auto">{saveProfile.isPending ? 'Saving…' : 'Continue'} <ArrowRight size={17}/></button></div>}
           {step === 1 && <div className="page-enter"><SectionLabel>PUT IT IN YOUR OWN WORDS</SectionLabel><h2 className="display text-4xl sm:text-5xl">What are you looking for?</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">A sentence is enough. You’ll shape the details on the next screen.</p><textarea data-testid="input-request-narrative" value={narrative} onChange={e => setNarrative(e.target.value)} className="field mt-7 min-h-[180px] resize-y !p-5 text-lg" placeholder="I’m looking for…" maxLength={240}/><div className="mt-4 flex items-center justify-between gap-4"><button data-testid="button-voice-input" type="button" disabled={!config.data?.audioEnabled || voiceState === 'starting' || voiceState === 'transcribing'} onClick={toggleVoice} className="btn-outline lift !min-h-11 !px-4 text-xs"><Mic size={16}/>{!config.data?.audioEnabled ? 'Voice unavailable' : voiceState === 'recording' ? 'Stop recording' : voiceState === 'transcribing' ? 'Transcribing…' : voiceState === 'starting' ? 'Starting…' : 'Speak instead'}</button><span role="status" className="text-right text-xs text-muted-foreground">{!config.data?.audioEnabled ? 'Audio is not enabled for this pilot.' : voiceState === 'recording' ? 'Recording… stop when you’re done.' : voiceState === 'transcribing' ? 'Turning your recording into editable text…' : 'Or type above'}</span></div>{config.data?.audioEnabled && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Your recording is used only to create editable text and is deleted immediately after transcription, including if transcription fails.</p>}<div className="mt-9 flex items-center justify-between gap-3"><button data-testid="button-back-role" onClick={() => { cancelVoice(); setError(''); setStep(0); }} className="text-sm font-semibold text-muted-foreground"><ArrowLeft size={16} className="mr-2 inline"/>Back</button><button data-testid="button-next-request" onClick={toDetails} disabled={voiceState !== 'idle'} className="btn-primary lift">Continue <ArrowRight size={17}/></button></div></div>}
          {step === 2 && <form onSubmit={toReview} className="page-enter"><SectionLabel>MAKE IT SPECIFIC</SectionLabel><h2 className="display text-4xl sm:text-5xl">The details matter.</h2><p className="mt-4 text-sm text-muted-foreground">Nothing is bought here. These fields make your request useful for research.</p><div className="mt-8 space-y-5"><div><label htmlFor="item" className="label">Item you need <span className="text-destructive">*</span></label><input id="item" data-testid="input-item" className="field" value={item} onChange={e => setItem(e.target.value)} maxLength={240} placeholder="Describe the item"/></div><div><label htmlFor="category" className="label">Category <span className="text-destructive">*</span></label><input id="category" data-testid="input-category" className="field" value={category} onChange={e => setCategory(e.target.value)} maxLength={80} placeholder="What kind of item is it?"/></div><div><label htmlFor="merchant" className="label">Preferred merchant <span className="font-normal text-muted-foreground">· optional</span></label><input id="merchant" data-testid="input-merchant" className="field" value={merchant} onChange={e => setMerchant(e.target.value)} maxLength={160} placeholder="Leave blank if you’re flexible"/>{merchant.trim() && !supported && <p data-testid="status-merchant-unsupported-preview" className="mt-2 text-xs text-[#8a662d]">We can’t purchase from this merchant yet. Your request has been recorded only after you submit it.</p>}</div><div><label htmlFor="budget" className="label">Maximum total budget <span className="text-destructive">*</span></label><div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span><input id="budget" data-testid="input-budget" inputMode="decimal" className="field !pl-8" value={budget} onChange={e => setBudget(e.target.value)} placeholder="0.00"/></div><p className="mt-2 text-xs text-muted-foreground">The maximum total you would spend, including taxes and fees. This is not a price quote.</p></div></div><div className="mt-9 flex items-center justify-between gap-3"><button type="button" data-testid="button-back-request" onClick={() => { setError(''); setStep(1); }} className="text-sm font-semibold text-muted-foreground"><ArrowLeft size={16} className="mr-2 inline"/>Back</button><button data-testid="button-review-request" className="btn-primary lift">Review request <ArrowRight size={17}/></button></div></form>}
          {step === 3 && <div className="page-enter"><SectionLabel>CHECK BEFORE YOU SEND</SectionLabel><h2 className="display text-4xl sm:text-5xl">Does this look right?</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">You are submitting a research request, not placing an order.</p><div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-background px-5">{[['Item', item], ['Category', category], ['Preferred merchant', merchant || 'No preference'], ['Maximum total including taxes and fees', money(Math.round(Number(budget) * 100))]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-4 text-sm"><span className="text-muted-foreground">{label}</span><strong className="max-w-[55%] text-right font-semibold break-words">{value}</strong></div>)}</div><div className="mt-5 flex gap-3 rounded-xl bg-[#f4e8d0] p-4 text-xs leading-relaxed text-[#75582d]"><LockKeyhole size={18} className="shrink-0"/><span>TEST MODE. Submitting records your request for research. No purchase, order, or charge will occur.</span></div><div className="mt-9 flex items-center justify-between gap-3"><button data-testid="button-edit-request" onClick={() => { setError(''); setStep(2); }} className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"><PenLine size={16}/>Edit details</button><button data-testid="button-submit-request" disabled={createRequest.isPending} onClick={submitRequest} className="btn-primary lift">{createRequest.isPending ? 'Recording…' : 'Submit request'} <ChevronRight size={17}/></button></div></div>}
        </div>}
      </VerifiedEmailGate>
    </div>
  </div>;
}

export default function RequestPage() {
  return <PilotShell compact><div className="mx-auto max-w-[1180px] px-5 pt-11 md:px-10 md:pt-16"><RequestExperience/></div></PilotShell>;
}