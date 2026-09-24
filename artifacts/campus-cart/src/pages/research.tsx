import { useState } from 'react';
import { useUser } from '@clerk/react';
import { Link } from 'wouter';
import { ArrowDownToLine, ArrowRight, BarChart3, ChevronDown, LockKeyhole, Search, ShoppingBag, Users } from 'lucide-react';
import { useExportResearchCsv, useGetResearchDashboard, getExportResearchCsvQueryKey, getGetResearchDashboardQueryKey } from '@workspace/api-client-react';
import { ErrorPanel, LoadingPanel, PilotShell, SectionLabel } from '@/components/pilot-shell';

const money = (cents: number | null) => cents == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
export default function ResearchPage() {
  const { user, isLoaded } = useUser();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'student' | 'staff'>('all');
  const [csvError, setCsvError] = useState('');
  const [exporting, setExporting] = useState(false);
  const dashboard = useGetResearchDashboard({ query: { queryKey: getGetResearchDashboardQueryKey() } });
  const csv = useExportResearchCsv({ query: { enabled: false, queryKey: getExportResearchCsvQueryKey() } });
  const exportCsv = async () => {
    setCsvError(''); setExporting(true);
    try {
      const result = await csv.refetch();
      if (result.error || typeof result.data !== 'string') throw new Error('Export unavailable');
      const file = new Blob([result.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `campus-cart-research-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    } catch { setCsvError('CSV export failed. Please try again.'); } finally { setExporting(false); }
  };
  const records = dashboard.data?.records.filter(record => (filter === 'all' || record.role === filter) && [record.participantId, record.item, record.category, record.merchant].some(value => value?.toLowerCase().includes(search.toLowerCase()))) ?? [];
  const topMerchants = dashboard.data?.merchantRankings ?? [];
  const topCategories = dashboard.data?.categoryRankings ?? [];
  const maxRank = Math.max(1, ...topMerchants.map(x => x.uniqueParticipants), ...topCategories.map(x => x.uniqueParticipants));
  return <PilotShell compact><div className="mx-auto max-w-[1180px] px-5 pt-11 md:px-10 md:pt-16">
    <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><SectionLabel>PRIVATE RESEARCH VIEW</SectionLabel><h1 className="display text-5xl md:text-6xl">What we’re learning.</h1><p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">Anonymized pilot activity, in one place. Requested purchases are research signals—not transactions.</p></div><span className="mono inline-flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-[10px] text-muted-foreground"><LockKeyhole size={12}/> RESEARCHER ACCESS · TEST MODE</span></div>
    {!isLoaded || dashboard.isLoading ? <LoadingPanel/> : !user?.emailAddresses.some(e => e.emailAddress.toLowerCase().endsWith('@nd.edu') && e.verification?.status === 'verified') ? <ErrorPanel title="Verified campus email required." detail="Sign in with and verify your @nd.edu email before accessing pilot research."/> : dashboard.isError ? <ErrorPanel title="Research data is unavailable." detail="Only authorized researchers can view these anonymized records. If you have access, try again." onRetry={() => dashboard.refetch()}/> : dashboard.data ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {label: 'Participants', value: dashboard.data.participants, icon: Users, note: 'In this pilot'},
          {label: 'Card step viewed', value: dashboard.data.cardStepViews, icon: BarChart3, note: 'Reached disclosure'},
          {label: 'Setup started', value: dashboard.data.setupStarts, icon: ArrowRight, note: 'Opened test-mode setup'},
          {label: 'Verified setups', value: dashboard.data.verifiedSetupCompletions, icon: ShoppingBag, note: 'No purchase made'},
        ].map((metric, index) => <div key={metric.label} data-testid={`metric-${metric.label.toLowerCase().replaceAll(' ', '-')}`} className={`rounded-[22px] border p-6 ${index === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}><div className="flex justify-between gap-3"><span className={`text-xs font-semibold ${index === 0 ? 'text-[#cdd9e2]' : 'text-muted-foreground'}`}>{metric.label}</span><metric.icon size={17} className={index === 0 ? 'text-[#e2bd7f]' : 'text-[#af8550]'}/></div><p className="display mt-8 text-[3.2rem] leading-none">{metric.value}</p><p className={`mt-3 text-xs ${index === 0 ? 'text-[#cdd9e2]' : 'text-muted-foreground'}`}>{metric.note}</p></div>)}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d6c49f] bg-[#f1e4cc] px-5 py-4"><p className="text-xs leading-relaxed text-[#66553d]"><strong data-testid="metric-abandoned">{dashboard.data.abandoned}</strong> participants left card setup before verified completion. A research observation, not a failed purchase.</p><button data-testid="button-refresh-research" onClick={() => dashboard.refetch()} className="text-xs font-bold text-primary underline underline-offset-4">Refresh data</button></div>
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <Ranking title="Requested merchants" subtitle="Preferred merchants named in requests" items={topMerchants} max={maxRank} testId="merchant"/>
        <Ranking title="Requested categories" subtitle="Types of items participants described" items={topCategories} max={maxRank} testId="category"/>
      </div>
      <section className="mt-14"><div className="mb-6 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><SectionLabel>ANONYMIZED PARTICIPATION</SectionLabel><h2 className="display text-4xl">The records.</h2><p className="mt-2 text-sm text-muted-foreground">Participant IDs replace personal identity. No orders or charges are represented here.</p></div><button data-testid="button-export-csv" disabled={exporting} onClick={exportCsv} className="btn-outline lift w-full md:w-auto"><ArrowDownToLine size={17}/>{exporting ? 'Preparing CSV…' : 'Export CSV'}</button></div>
        {csvError && <p role="alert" data-testid="status-csv-error" className="mb-4 text-sm text-destructive">{csvError}</p>}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"/><input data-testid="input-search-records" className="field !pl-11" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search anonymized records"/></label><label className="relative min-w-40"><select data-testid="select-role-filter" className="field appearance-none" value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">All roles</option><option value="student">Students</option><option value="staff">Staff</option></select><ChevronDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"/></label></div>
        <div className="overflow-x-auto rounded-[22px] border border-border bg-card"><table className="w-full min-w-[850px] border-collapse text-left text-xs"><thead className="border-b border-border bg-[#eae4d7] text-muted-foreground"><tr>{['Participant', 'Role', 'Requested item', 'Category', 'Merchant', 'Max. total', 'Card activity', 'Feedback'].map(head => <th key={head} className="px-5 py-4 font-bold">{head}</th>)}</tr></thead><tbody className="divide-y divide-border">{records.map(record => <tr data-testid={`row-participant-${record.participantId}`} key={record.participantId} className="hover:bg-[#f2ece0]"><td className="px-5 py-4 font-mono text-[10px]">{record.participantId.slice(0, 13)}…</td><td className="px-5 py-4 capitalize">{record.role}</td><td className="max-w-[190px] px-5 py-4 font-semibold">{record.item || '—'}</td><td className="px-5 py-4">{record.category || '—'}</td><td className="px-5 py-4">{record.merchant || '—'}</td><td className="px-5 py-4">{money(record.budgetCents)}</td><td className="px-5 py-4 whitespace-nowrap">{record.cardStepViews} viewed · {record.setupStarts} started · {record.setupCompletions} verified{record.abandoned ? <span className="block text-[#9b6b31]">Left setup</span> : null}</td><td className="max-w-[180px] px-5 py-4 text-muted-foreground">{record.feedback || '—'}</td></tr>)}</tbody></table>{records.length === 0 && <div data-testid="status-no-records" className="p-12 text-center"><div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-[#e8dbc2]"><Search size={20}/></div><h3 className="display text-2xl">{dashboard.data.records.length ? 'No matching records.' : 'The study starts here.'}</h3><p className="mt-2 text-sm text-muted-foreground">{dashboard.data.records.length ? 'Try another search or role filter.' : 'Anonymized participation will appear once requests are recorded.'}</p></div>}</div>
        <p className="mt-4 text-xs text-muted-foreground" data-testid="text-record-count">Showing {records.length} of {dashboard.data.records.length} records</p>
      </section>
    </> : <ErrorPanel title="Research data is unavailable." onRetry={() => dashboard.refetch()}/>}
    <div className="mt-14"><Link href="/request" data-testid="link-participant-flow" className="inline-flex items-center gap-2 text-xs font-bold text-primary">Back to participant space <ArrowRight size={15}/></Link></div>
  </div></PilotShell>;
}

function Ranking({ title, subtitle, items, max, testId }: { title: string; subtitle: string; items: { label: string; uniqueParticipants: number }[]; max: number; testId: string }) {
  return <div className="rounded-[26px] border border-border bg-card p-6 sm:p-8"><div className="mb-7 flex items-start justify-between"><div><h3 className="display text-3xl">{title}</h3><p className="mt-2 text-xs text-muted-foreground">{subtitle}</p></div><BarChart3 size={20} className="text-[#aa8047]"/></div>{items.length ? <div className="space-y-5">{items.slice(0, 6).map((entry, index) => <div data-testid={`ranking-${testId}-${index}`} key={entry.label}><div className="mb-2 flex justify-between gap-4 text-sm"><span className="font-semibold">{entry.label}</span><span className="font-mono text-xs text-muted-foreground">{entry.uniqueParticipants}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#eae4d7]"><div className="h-full rounded-full bg-[#b78b4b]" style={{ width: `${entry.uniqueParticipants / max * 100}%` }}/></div></div>)}</div> : <div className="rounded-2xl bg-background p-7 text-sm text-muted-foreground">No requested {testId}s recorded yet.</div>}</div>;
}