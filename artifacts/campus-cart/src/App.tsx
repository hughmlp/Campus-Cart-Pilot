import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Redirect, useLocation, Router as WouterRouter, Link } from 'wouter';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import Home from '@/pages/home';
import RequestPage from '@/pages/request';
import ResearchPage from '@/pages/research';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}
if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'bottom' as const,
  },
  variables: {
    colorPrimary: '#173657',
    colorForeground: '#1c3047',
    colorMutedForeground: '#66727a',
    colorDanger: '#b1513f',
    colorBackground: '#fbf9f2',
    colorInput: '#fbf9f2',
    colorInputForeground: '#1c3047',
    colorNeutral: '#cfc4ae',
    fontFamily: '"DM Sans", sans-serif',
    borderRadius: '14px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f2] rounded-[26px] w-[440px] max-w-full overflow-hidden border border-[#d9cfb9] shadow-[0_28px_70px_-45px_rgba(25,55,86,.5)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: '!text-[#1c3047] !font-bold !tracking-tight',
    headerSubtitle: '!text-[#66727a]',
    socialButtonsBlockButtonText: '!text-[#1c3047] !font-semibold',
    formFieldLabel: '!text-[#1c3047] !font-semibold',
    footerActionLink: '!text-[#173657] !font-bold',
    footerActionText: '!text-[#66727a]',
    dividerText: '!text-[#66727a]',
    identityPreviewEditButton: '!text-[#173657]',
    formFieldSuccessText: '!text-[#346448]',
    alertText: '!text-[#1c3047]',
    logoBox: '!justify-center',
    logoImage: '!size-12 !rounded-xl',
    socialButtonsBlockButton: '!border-[#d9cfb9] !bg-[#fbf9f2] !rounded-xl',
    formButtonPrimary: '!bg-[#173657] !text-[#fbf9f2] !rounded-xl !font-bold hover:!bg-[#254b70]',
    formFieldInput: '!bg-[#fbf9f2] !text-[#1c3047] !border-[#cfc4ae] !rounded-xl',
    footerAction: '!bg-transparent',
    dividerLine: '!bg-[#d9cfb9]',
    alert: '!bg-[#f1e4cc] !border-[#d9cfb9]',
    otpCodeFieldInput: '!border-[#cfc4ae] !text-[#1c3047]',
    formFieldRow: '!text-[#1c3047]',
    main: '!gap-5',
  },
};

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const id = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== id) client.clear();
      previous.current = id;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function AuthFrame({ children, heading }: { children: ReactNode; heading: string }) {
  return <div className="grain min-h-[100dvh] bg-[#e9e1d0]">
    <div className="grid min-h-[100dvh] lg:grid-cols-[.92fr_1.08fr]">
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -bottom-48 -left-32 size-[600px] rounded-full border-[85px] border-[#2d5273]/70"/>
        <div className="absolute -right-40 top-1/4 size-[440px] rounded-full border-[1px] border-[#b58d55]/50"/>
        <Link href="/" data-testid="link-auth-home-desktop" className="relative flex items-center gap-3 text-xl font-bold tracking-[-.05em]"><img src={`${basePath}/logo.svg`} alt="" className="size-10 rounded-xl"/> campus<span className="-ml-3 text-[#e4ba78]">cart</span></Link>
        <div className="relative max-w-xl"><span className="font-mono text-[10px] tracking-[.18em] text-[#e3bc80]">AN INVITATION TO THINK DIFFERENTLY</span><h1 className="display mt-6 text-[clamp(3.6rem,5vw,6rem)]">A simpler way to say what you need.</h1><p className="mt-7 max-w-md text-base leading-relaxed text-[#d0dce5]">A private research pilot for Notre Dame students and staff. Your request helps us learn; it never places an order.</p></div>
        <span className="relative flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#d8bc8d]"><LockKeyhole size={13}/> TEST MODE · INDEPENDENT PILOT</span>
      </div>
      <div className="flex flex-col px-5 py-6 sm:px-9 lg:px-14 lg:py-10">
        <div className="mb-10 flex justify-between gap-4 lg:justify-end"><Link href="/" data-testid="link-auth-home" className="inline-flex items-center gap-2 text-xs font-bold text-[#586778]"><ArrowLeft size={15}/> Back to pilot</Link><span className="rounded-full border border-[#cbb682] px-3 py-1 text-[10px] font-bold tracking-widest text-[#795923]">TEST MODE</span></div>
        <div className="flex flex-1 flex-col items-center justify-center pb-16"><div className="mb-8 w-full max-w-[440px]"><span className="font-mono text-[10px] tracking-[.16em] text-[#98703b]">CAMPUS CART / PRIVATE PILOT</span><h2 className="display mt-3 text-4xl text-[#1c3047] sm:text-5xl">{heading}</h2><p className="mt-3 text-sm leading-relaxed text-[#66727a]">Use your verified @nd.edu email to participate.</p></div>{children}<p className="mt-7 max-w-[440px] text-center text-xs leading-relaxed text-[#66727a]">Independent research pilot. Not an official University of Notre Dame service. No purchase or charge will be made in this session.</p></div>
      </div>
    </div>
  </div>;
}
function SignInPage() {
  return <AuthFrame heading="Welcome back."><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/request`}/></AuthFrame>;
}
function SignUpPage() {
  return <AuthFrame heading="Join the study."><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/request`}/></AuthFrame>;
}
function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/request"/></Show><Show when="signed-out"><Home/></Show></>;
}
function ProtectedRequest() {
  return <><Show when="signed-in"><RequestPage/></Show><Show when="signed-out"><Redirect to="/"/></Show></>;
}
function ProtectedResearch() {
  return <><Show when="signed-in"><ResearchPage/></Show><Show when="signed-out"><Redirect to="/"/></Show></>;
}
function Missing() {
  return <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 text-center"><p className="font-mono text-xs tracking-widest text-[#a0753e]">PAGE NOT FOUND</p><h1 className="display mt-5 text-5xl">Not on the list.</h1><p className="mt-4 text-sm text-muted-foreground">This page isn’t part of the pilot.</p><Link href="/" data-testid="link-not-found-home" className="btn-primary mt-8">Return to Campus Cart</Link></div>;
}
function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}
function Router() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={HomeRedirect}/>
    <Route path="/sign-in/*?" component={SignInPage}/>
    <Route path="/sign-up/*?" component={SignUpPage}/>
    <Route path="/request" component={ProtectedRequest}/>
    <Route path="/research" component={ProtectedResearch}/>
    <Route component={Missing}/>
  </Switch></RoutedErrorBoundary>;
}
function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in with your campus email' } }, signUp: { start: { title: 'Join the study', subtitle: 'Create an account with your campus email' } } }}
    routerPush={to => setLocation(stripBase(to))}
    routerReplace={to => setLocation(stripBase(to), { replace: true })}
  ><QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator/><Router/></QueryClientProvider></ClerkProvider>;
}
function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes/></WouterRouter>;
}
export default App;