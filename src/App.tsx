import { type ChangeEvent, type CSSProperties, type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Switch, useLocation, useParams } from "wouter";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Database,
  ExternalLink,
  Globe,
  Inbox,
  LockKeyhole,
  LogIn,
  LogOut,
  Menu,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
  UserPlus,
  UserRound,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const MIN_REPLY_CHARS = 20;

type AuthUser = {
  id: number;
  name: string;
  email: string;
  photo?: string;
  photoThumb?: string;
  admin?: number;
};

type AuthState = { user: AuthUser | null; token: string | null; loading: boolean };
const AuthContext = createContext<AuthState & { login: (identifier: string, password: string) => Promise<void>; logout: () => void }>({
  user: null,
  token: null,
  loading: true,
  login: async () => undefined,
  logout: () => undefined,
});

function useSession() {
  return useContext(AuthContext);
}

function storedAuth(): { user: AuthUser | null; token: string | null } {
  try {
    const value = localStorage.getItem("chatmodz_auth");
    if (value) return JSON.parse(value);
  } catch {
    // A missing browser storage should not prevent the login page from rendering.
  }
  return { user: null, token: null };
}

function useAuthState(): AuthState & { login: (identifier: string, password: string) => Promise<void>; logout: () => void } {
  const initial = storedAuth();
  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [loading, setLoading] = useState(Boolean(initial.token));

  useEffect(() => {
    if (!initial.token) return;
    fetch("/api/chatmodz/auth/me", { headers: { Authorization: `Bearer ${initial.token}` } })
      .then((response) => response.ok ? response.json() : null)
      .then((freshUser) => {
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem("chatmodz_auth", JSON.stringify({ user: freshUser, token: initial.token }));
        } else {
          localStorage.removeItem("chatmodz_auth");
          setUser(null);
          setToken(null);
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [initial.token]);

  const login = async (identifier: string, password: string) => {
    const response = await fetch("/api/chatmodz/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to sign in");
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem("chatmodz_auth", JSON.stringify({ user: data.user, token: data.token }));
  };

  const logout = () => {
    if (token) fetch("/api/chatmodz/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
    localStorage.removeItem("chatmodz_auth");
    setUser(null);
    setToken(null);
  };

  return { user, token, loading, login, logout };
}

function authFetch(token: string | null, url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers as Record<string, string> || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
    },
  });
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const result = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) result[index] = raw.charCodeAt(index);
  return result;
}

async function subscribeToPush(token: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push notifications are not supported in this browser");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted");
  const keyResponse = await authFetch(token, "/api/chatmodz/push/vapid-key");
  const keyData = await keyResponse.json();
  if (!keyResponse.ok) throw new Error(keyData.error || "Push notifications are not configured");
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
  });
  const response = await authFetch(token, "/api/chatmodz/push/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) throw new Error((await response.json()).error || "Could not enable notifications");
}

async function unsubscribeFromPush(token: string) {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await authFetch(token, "/api/chatmodz/push/unsubscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

type ConvUser = { id: number; name: string; photo?: string };
type ConvLock = { moderatorId: number; moderatorName: string; lockedAt: number; expiresAt: number };
type Conversation = {
  key: string;
  fakeUser: ConvUser;
  realUser: ConvUser;
  lastMessage: string;
  lastTime: number;
  msgCount: number;
  lock: ConvLock | null;
  lastSenderFake: boolean;
  lastMsgRead: boolean;
};
type Message = { id: number; u1: number; u2: number; message: string; time: number; read: number; mediaUrl?: string; mediaType?: string };
type Stats = { activeLocks: number; totalConversations: number; messagesSent: number };

function countMeaningfulChars(value: string) {
  return Array.from(value).filter((character) => !/\s/u.test(character)).length;
}

function timeAgo(timestamp: number) {
  const seconds = Date.now() / 1000 - timestamp;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function photoUrl(photo?: string) {
  if (!photo) return "";
  if (photo.startsWith("http") || photo.startsWith("/")) return photo;
  return `/api/uploads/${photo}`;
}

function Avatar({ photo, name, size = 36 }: { photo?: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.32) };
  if (photo && !failed) {
    return <img className="real-avatar" src={photoUrl(photo)} alt={name} style={style} onError={() => setFailed(true)} />;
  }
  return <div className="avatar" style={style}>{initials || "?"}</div>;
}

function Logo() {
  return <Link href="/" className="brand-mark"><span className="brand-dot" /><span>chatmodz</span></Link>;
}

function StatusPill({ children, type }: { children: ReactNode; type: string }) {
  return <span className={`status-pill ${type}`}><span className="status-dot" />{children}</span>;
}

function Toast({ message }: { message: string }) {
  return message ? <div className="toast-note" role="status">{message}</div> : null;
}

function LandingPage() {
  return <div className="landing-page">
    <header className="landing-nav"><Logo /><div className="landing-nav-actions"><Link href="/apply" className="button ghost">Apply to operate</Link><Link href="/login" className="button primary"><LogIn size={14} /> Operator sign in</Link></div></header>
    <main className="landing-main">
      <section className="landing-hero">
        <div className="eyebrow">Private conversation operations</div>
        <h1>Better conversations.<br /><em>One focused desk.</em></h1>
        <p>Chatmodz gives trained conversation operators a secure, distraction-free workspace for thoughtful replies across connected dating communities.</p>
        <div className="landing-actions"><Link href="/login" className="button amber">Open operator desk <ChevronRight size={15} /></Link><span className="landing-note"><ShieldCheck size={14} /> Source identities stay hidden from operators</span></div>
      </section>
      <section className="landing-grid">
        <article><div className="landing-icon"><Inbox size={18} /></div><h2>One live queue</h2><p>See only the conversations that need attention, with real member and managed-profile context.</p></article>
        <article><div className="landing-icon teal-icon"><LockKeyhole size={18} /></div><h2>Protected by design</h2><p>Conversation locks, short sessions, audit trails, and role-based access keep the desk accountable.</p></article>
        <article><div className="landing-icon"><Activity size={18} /></div><h2>Delivery you can trust</h2><p>Replies, media, notifications, and delivery activity are handled through authenticated site adapters.</p></article>
      </section>
    </main>
    <footer className="landing-footer">
      <span>Chatmodz operations desk · Built for privacy, clarity, and consistency.</span>
      <Link href="/admin" className="auth-back" style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: 0 }}>
        <Shield size={13} /> Admin Control Room
      </Link>
    </footer>
  </div>;
}

function LoginPage() {
  const { user, login } = useSession();
  const [, setLocation] = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (user) setLocation("/"); }, [user, setLocation]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(identifier, password);
      setLocation("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="auth-page">
    <div className="auth-card">
      <Logo />
      <div className="eyebrow">Secure operator access</div>
      <h1>Welcome back.</h1>
      <p>Sign in with the credentials issued by your operations administrator.</p>
      <form onSubmit={submit} className="auth-form">
        <label htmlFor="identifier">Operator email</label>
        <input id="identifier" className="form-field" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required />
        <label htmlFor="password">Password</label>
        <input id="password" className="form-field" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        {error && <div className="auth-error"><AlertTriangle size={14} />{error}</div>}
        <button className="button primary auth-submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"} <ChevronRight size={15} /></button>
      </form>
      <div className="auth-links"><Link href="/apply" className="auth-back">Apply to become an operator</Link><Link href="/welcome" className="auth-back"><ChevronLeft size={14} /> Back to Chatmodz</Link></div>
    </div>
  </div>;
}

function AdminLoginPage() {
  const { user, login, logout } = useSession();
  const [, setLocation] = useLocation();
  const [identifier, setIdentifier] = useState("admin@chatmodz.io");
  const [password, setPassword] = useState("admin12345");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && (user.admin ?? 0) >= 2) {
      setLocation("/admin");
    }
  }, [user, setLocation]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(identifier, password);
      window.setTimeout(() => {
        setLocation("/admin");
      }, 50);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to authenticate administrator");
    } finally {
      setSubmitting(false);
    }
  };

  const fillDefaultAdmin = () => {
    setIdentifier("admin@chatmodz.io");
    setPassword("admin12345");
  };

  if (user && (user.admin ?? 0) < 2) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Logo />
          <div className="eyebrow" style={{ color: "#d97706" }}>Administrator privileges required</div>
          <h1>Restricted portal.</h1>
          <p>You are signed in as <strong>{user.name}</strong> ({user.email}), which has standard operator access.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            <button
              className="button danger"
              onClick={async () => {
                await logout();
                setLocation("/admin");
              }}
            >
              <LogOut size={14} /> Sign out & log in as Admin
            </button>
            <Link href="/" className="button ghost">
              Return to Operator Queue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ border: "1px solid rgba(217, 119, 6, 0.4)", boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Logo />
          <span style={{ fontSize: 11, background: "rgba(217, 119, 6, 0.15)", color: "#b45309", padding: "3px 8px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Shield size={12} /> Root Admin
          </span>
        </div>
        <div className="eyebrow" style={{ color: "#d97706" }}>Command center access</div>
        <h1>Operations Admin</h1>
        <p>Restricted control desk for managing moderator applications, operators, platform webhooks, and Supabase database controls.</p>

        <div style={{ background: "rgba(0,0,0,0.03)", border: "1px dashed rgba(0,0,0,0.15)", borderRadius: 8, padding: "12px 14px", margin: "14px 0", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 600, color: "var(--foreground)" }}>Default Admin Credentials:</div>
            <div style={{ color: "var(--muted-foreground)", fontFamily: "monospace", marginTop: 2 }}>admin@chatmodz.io / admin12345</div>
          </div>
          <button type="button" className="button ghost compact" onClick={fillDefaultAdmin} style={{ fontSize: 11, whiteSpace: "nowrap" }}>
            Fill Credentials
          </button>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label htmlFor="adminIdentifier">Administrator email</label>
          <input
            id="adminIdentifier"
            className="form-field"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="adminPassword">Password</label>
          <input
            id="adminPassword"
            className="form-field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <div className="auth-error"><AlertTriangle size={14} />{error}</div>}
          <button className="button amber auth-submit" disabled={submitting} style={{ background: "#d97706", borderColor: "#b45309", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {submitting ? "Authenticating…" : "Sign in to Control Room"} <ShieldCheck size={16} />
          </button>
        </form>
        <div className="auth-links">
          <Link href="/login" className="auth-back">Standard operator desk</Link>
          <Link href="/welcome" className="auth-back"><ChevronLeft size={14} /> Back to Chatmodz</Link>
        </div>
      </div>
    </div>
  );
}

function ApplyPage() {
  const [form, setForm] = useState({ fullName: "", email: "", location: "", experience: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/chatmodz/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit application");
      setSubmitted(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="auth-page"><div className="auth-card application-card"><Logo /><div className="eyebrow">Join the operations team</div><h1>Apply to operate.</h1>{submitted ? <div className="application-success"><ShieldCheck size={24} /><strong>Application received.</strong><span>Our operations team will review your details and contact you if the next training cohort is a fit.</span><Link href="/welcome" className="button primary">Back to Chatmodz</Link></div> : <><p>Tell us about your communication experience. Approved operators receive a one-time activation code and training access.</p><form onSubmit={submit} className="auth-form"><label htmlFor="fullName">Full name</label><input id="fullName" className="form-field" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /><label htmlFor="applicationEmail">Email address</label><input id="applicationEmail" className="form-field" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /><label htmlFor="location">Location</label><input id="location" className="form-field" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /><label htmlFor="experience">Relevant experience</label><textarea id="experience" className="form-field application-textarea" value={form.experience} onChange={(event) => setForm({ ...form, experience: event.target.value })} placeholder="Customer support, community moderation, writing, or relationship-focused work…" /><span className="tiny-text">Do not include member or source-site credentials.</span>{error && <div className="auth-error"><AlertTriangle size={14} />{error}</div>}<button className="button primary auth-submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit application"} <ChevronRight size={15} /></button></form><Link href="/welcome" className="auth-back"><ChevronLeft size={14} /> Back to Chatmodz</Link></>}</div></div>;
}

const navItems = [
  { href: "/", label: "Queue", icon: Inbox },
  { href: "/reports", label: "Reports", icon: BarChart3, adminOnly: true },
  { href: "/admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

function Shell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const current = navItems.find((item) => item.href === location)?.label ?? "Conversation";
  const initials = user?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "?";
  return <div className="app-frame">
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <Logo />
      <div className="sidebar-label">Operations</div>
      <nav>{navItems.filter((item) => !item.adminOnly || (user?.admin ?? 0) >= 2).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${location === href ? "active" : ""}`} onClick={() => setMobileOpen(false)}><Icon /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-label">Workspace</div>
      <Link href="/settings" className={`nav-link ${location === "/settings" ? "active" : ""}`} onClick={() => setMobileOpen(false)}><UserRound /><span>Account</span></Link>
      <div className="sidebar-spacer" />
      <div className="operator-chip"><Avatar photo={user?.photo} name={user?.name || "Operator"} size={32} /><div><strong>{user?.name || "Operator"}</strong><small>{(user?.admin ?? 0) >= 2 ? "Administrator" : "Operator"} · active</small></div><button className="icon-button" style={{ marginLeft: "auto", color: "#9aa7b8" }} aria-label="Sign out" onClick={() => { logout(); setLocation("/login"); }}><LogOut size={15} /></button></div>
    </aside>
    {mobileOpen && <button className="mobile-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <main className="content-shell">
      <header className="topbar"><div style={{ display: "flex", alignItems: "center", gap: 12 }}><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button><div className="crumb"><span>Control room</span><ChevronRight size={12} style={{ verticalAlign: "middle", margin: "0 5px" }} /><strong>{current}</strong></div></div><div className="top-actions"><StatusPill type="active">Secure session</StatusPill><Avatar photo={user?.photo} name={user?.name || "Operator"} size={30} /></div></header>
      {children}
    </main>
  </div>;
}

function Metric({ label, value, detail, color = "var(--amber)" }: { label: string; value: string; detail: string; color?: string }) {
  return <div className="metric-card" style={{ "--metric-color": color } as CSSProperties}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}

function useModeratorData() {
  const { token } = useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<Stats>({ activeLocks: 0, totalConversations: 0, messagesSent: 0 });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [conversationResponse, statsResponse] = await Promise.all([
        authFetch(token, "/api/chatmodz/conversations"),
        authFetch(token, "/api/chatmodz/stats"),
      ]);
      if (conversationResponse.ok) setConversations((await conversationResponse.json()).conversations || []);
      if (statsResponse.ok) setStats(await statsResponse.json());
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { load(); const interval = window.setInterval(load, 15000); return () => window.clearInterval(interval); }, [load]);
  return { conversations, stats, loading, reload: load };
}

function QueuePage() {
  const { user } = useSession();
  const { conversations, stats, loading, reload } = useModeratorData();
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<"all" | "mine" | "available">("all");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => conversations.filter((conversation) => {
    const matchesFilter = filter === "all" || (filter === "mine" ? conversation.lock?.moderatorId === user?.id : !conversation.lock);
    const haystack = `${conversation.fakeUser.name} ${conversation.realUser.name} ${conversation.lastMessage}`.toLowerCase();
    return matchesFilter && haystack.includes(search.toLowerCase());
  }), [conversations, filter, search, user?.id]);
  const unread = conversations.filter((conversation) => !conversation.lastSenderFake).length;
  const refresh = async () => { await reload(); setNotice("Queue refreshed"); window.setTimeout(() => setNotice(""), 2200); };
  return <Shell><div className="page">
    <div className="page-head"><div><div className="eyebrow">Operator queue / live</div><h1 className="page-title">Good morning, {user?.name?.split(" ")[0] || "operator"}.</h1><p className="page-subtitle">Work the real queue without exposing partner-site identity.</p></div><div className="queue-head-status"><StatusPill type="active">Live data</StatusPill><span className="tiny-text mono">Auto-refresh 15s</span></div></div>
    <div className="metric-grid"><Metric label="Open conversations" value={String(stats.totalConversations)} detail={`${unread} waiting for a reply`} /><Metric label="Your sent replies" value={String(stats.messagesSent)} detail="Recorded by the live activity log" color="var(--teal)" /><Metric label="Active locks" value={String(stats.activeLocks)} detail="Locks expire after 10 minutes" color="var(--ink)" /><Metric label="Queue status" value={loading ? "…" : "Live"} detail="No demo records are shown" color="var(--teal)" /></div>
    <section className="panel"><div className="panel-head"><div><div className="panel-title">Anonymous conversations</div><div className="panel-kicker" style={{ marginTop: 5 }}>Operator view · site origin withheld</div></div><button className="button ghost compact" onClick={refresh}><RefreshCw size={13} /> Refresh</button></div>
      <div className="filters">{(["all", "mine", "available"] as const).map((item) => <button key={item} className={`filter-button ${filter === item ? "selected" : ""}`} onClick={() => setFilter(item)}>{item === "all" ? "All conversations" : item === "mine" ? "Locked by me" : "Available"}</button>)}<div className="search-wrap"><Search size={15} /><input className="search-field" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search names or messages" aria-label="Search conversations" /></div></div>
      <div className="queue-list">{loading ? <div className="empty-state"><RefreshCw className="spin" size={25} /><strong>Loading live conversations</strong><span>Fetching the authenticated operator queue.</span></div> : filtered.length ? filtered.map((conversation, index) => <ConversationRow key={conversation.key} conversation={conversation} userId={user?.id || 0} onOpen={() => setLocation(`/conversation/${conversation.key}`)} style={{ animationDelay: `${index * 35}ms` }} />) : <div className="empty-state"><Inbox size={27} /><strong>No conversations match this view</strong><span>The live source returned no matching conversations.</span></div>}</div>
    </section><Toast message={notice} />
  </div></Shell>;
}

function ConversationRow({ conversation, userId, onOpen, style }: { conversation: Conversation; userId: number; onOpen: () => void; style?: CSSProperties }) {
  const needsReply = !conversation.lastSenderFake;
  const mine = conversation.lock?.moderatorId === userId;
  const otherLock = conversation.lock && !mine;
  return <button className={`queue-row live-row ${needsReply ? "needs-reply" : ""}`} onClick={onOpen} style={style}>
    <div className="queue-person"><div className="avatar-stack"><Avatar photo={conversation.fakeUser.photo} name={conversation.fakeUser.name} size={36} /><Avatar photo={conversation.realUser.photo} name={conversation.realUser.name} size={22} /></div><div><strong>{conversation.fakeUser.name} <span className="arrow-muted">→</span> {conversation.realUser.name}</strong><small>{conversation.msgCount} messages · {timeAgo(conversation.lastTime)}</small></div></div>
    <div className="queue-snippet"><strong><span className={`priority-dot ${needsReply ? "high" : "normal"}`} />{conversation.lastMessage || "No text in the latest message"}</strong><small>{needsReply ? "Reply needed" : conversation.lastMsgRead ? "Follow-up available" : "Waiting for member"} · source hidden</small></div>
    <div>{mine ? <StatusPill type="active">Locked by you</StatusPill> : otherLock ? <StatusPill type="pending">Locked</StatusPill> : <span className="button amber compact">Open</span>}</div><ChevronRight size={16} color="var(--ink-soft)" />
  </button>;
}

function MediaBubble({ message }: { message: Message }) {
  if (!message.mediaUrl || !message.mediaType) return null;
  const url = message.mediaUrl.startsWith("/") || message.mediaUrl.startsWith("http") ? message.mediaUrl : `/api/uploads/${message.mediaUrl}`;
  if (message.mediaType === "image") return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Attached media" className="message-media" /></a>;
  if (message.mediaType === "video") return <video src={url} controls className="message-media" preload="metadata" />;
  if (message.mediaType === "audio") return <div className="audio-media"><Volume2 size={15} /><audio src={url} controls preload="metadata" /></div>;
  return null;
}

function ConversationPage() {
  const params = useParams<{ id: string }>();
  const { user, token } = useSession();
  const [, setLocation] = useLocation();
  const { conversations, reload } = useModeratorData();
  const selected = conversations.find((conversation) => conversation.key === params.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<Record<string, ConvUser>>({});
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [media, setMedia] = useState<{ file: File; preview: string; type: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(selected));
  const [sending, setSending] = useState(false);
  const [locking, setLocking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lockedByMe = selected?.lock?.moderatorId === user?.id;
  const isAdmin = (user?.admin ?? 0) >= 2;
  const meaningful = countMeaningfulChars(draft);
  const canSend = Boolean(selected && lockedByMe && (draft.trim() || media) && (isAdmin || meaningful >= MIN_REPLY_CHARS));

  const loadMessages = useCallback(async () => {
    if (!selected || !token) return;
    setLoading(true);
    const response = await authFetch(token, `/api/chatmodz/conversations/${selected.key}/messages`);
    if (response.ok) {
      const data = await response.json();
      setMessages(data.messages || []);
      setUsers(data.users || {});
    }
    setLoading(false);
  }, [selected, token]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => {
    if (!selected || !token) return;
    setSuggestions([]);
  }, [selected, token]);
  useEffect(() => {
    if (!selected || !lockedByMe || !token) return;
    const interval = window.setInterval(() => { authFetch(token, `/api/chatmodz/conversations/${selected.key}/keepalive`, { method: "POST" }).catch(() => undefined); }, 120000);
    return () => window.clearInterval(interval);
  }, [selected, lockedByMe, token]);

  if (!selected) return <Shell><div className="page"><div className="empty-state panel"><AlertTriangle size={28} /><strong>Conversation not found</strong><span>This live queue item may have expired or been removed.</span><Link href="/" className="button primary" style={{ marginTop: 16 }}>Back to queue</Link></div></div></Shell>;

  const notify = (value: string) => { setNotice(value); window.setTimeout(() => setNotice(""), 2400); };
  const toggleLock = async () => {
    setLocking(true);
    const endpoint = lockedByMe ? "unlock" : "lock";
    const response = await authFetch(token, `/api/chatmodz/conversations/${selected.key}/${endpoint}`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) notify(data.error || "The conversation lock could not be changed");
    else { notify(lockedByMe ? "Conversation released" : "Conversation locked to you"); await reload(); }
    setLocking(false);
  };
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const type = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "";
    if (!type) { notify("Choose an image, video, or audio file"); return; }
    if (file.size > 50 * 1024 * 1024) { notify("Media must be 50 MB or smaller"); return; }
    if (media) URL.revokeObjectURL(media.preview);
    setMedia({ file, preview: URL.createObjectURL(file), type });
  };
  const send = async () => {
    if (!canSend || !selected) return;
    setSending(true);
    try {
      let mediaUrl = "";
      let mediaType = "";
      if (media) {
        const form = new FormData();
        form.append("media", media.file);
        const upload = await authFetch(token, "/api/chat/upload", { method: "POST", body: form });
        const uploaded = await upload.json();
        if (!upload.ok) throw new Error(uploaded.error || "Media upload failed");
        mediaUrl = uploaded.url;
        mediaType = uploaded.type;
      }
      const response = await authFetch(token, `/api/chatmodz/conversations/${selected.key}/reply`, { method: "POST", body: JSON.stringify({ message: draft.trim(), mediaUrl, mediaType }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Reply failed");
      setMessages((current) => [...current, data.message]);
      setDraft("");
      if (media) { URL.revokeObjectURL(media.preview); setMedia(null); }
      await reload();
      notify("Reply delivered to the connected site");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Reply failed");
    } finally {
      setSending(false);
    }
  };
  const keyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isAdmin && (event.ctrlKey || event.metaKey) && ["c", "v", "x"].includes(event.key.toLowerCase())) event.preventDefault();
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); }
  };
  return <Shell><div className="page">
    <div className="page-head conversation-page-head"><button className="button ghost compact" onClick={() => setLocation("/")}><ChevronLeft size={13} /> Queue</button><div className="tiny-text mono">Live conversation · {selected.key}</div></div>
    <div className="conversation-layout">
      <section className="panel conversation-main"><div className="conversation-top"><div className="conversation-identity"><div className="avatar-stack large"><Avatar photo={selected.fakeUser.photo} name={selected.fakeUser.name} size={44} /><Avatar photo={selected.realUser.photo} name={selected.realUser.name} size={26} /></div><div><h2>{selected.fakeUser.name} <span className="arrow-muted">→</span> {selected.realUser.name}</h2><small>Real participant context · connected source identity withheld</small></div></div><div className="conversation-actions">{selected.lock && <StatusPill type={lockedByMe ? "active" : "pending"}>{lockedByMe ? "Locked by you" : "Locked"}</StatusPill>}<button className={`button compact ${lockedByMe ? "ghost" : "amber"}`} onClick={toggleLock} disabled={locking || (selected.lock !== null && !lockedByMe)}>{lockedByMe ? <><UnlockKeyhole size={13} /> Release</> : <><LockKeyhole size={13} /> Lock to me</>}</button></div></div>
        <div className="messages">{loading ? <div className="empty-state"><RefreshCw className="spin" size={24} /><strong>Loading messages</strong></div> : messages.length ? messages.map((message, index) => { const byFake = message.u1 === selected.fakeUser.id; const sender = users[String(message.u1)] || (byFake ? selected.fakeUser : selected.realUser); return <div key={message.id} className={`message ${byFake ? "operator" : "member"}`}><Avatar photo={sender.photo} name={sender.name} size={27} /><div><div className="bubble">{message.mediaUrl && <MediaBubble message={message} />}{message.message && <p>{message.message}</p>}<div className="message-meta">{timeAgo(message.time)} {index === messages.length - 1 && <strong>{byFake ? "Waiting for member" : "Needs reply"}</strong>}</div></div></div></div>; }) : <div className="empty-state"><MessageSquare size={25} /><strong>No messages in this conversation</strong><span>The connected source returned an empty thread.</span></div>}</div>
        <div className="composer">{suggestions.length > 0 && <div className="canned-row">{suggestions.map((suggestion) => <button key={suggestion} className="canned" onClick={() => setDraft(suggestion)}>{suggestion}</button>)}</div>}{media && <div className="media-pending"><span>{media.type} attached</span><button className="icon-button" onClick={() => { URL.revokeObjectURL(media.preview); setMedia(null); }} aria-label="Remove attachment"><X size={14} /></button></div>}<div className="composer-row"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown} onCopy={(event) => { if (!isAdmin) event.preventDefault(); }} onCut={(event) => { if (!isAdmin) event.preventDefault(); }} onPaste={(event) => { if (!isAdmin) event.preventDefault(); }} onDrop={(event) => { if (!isAdmin) event.preventDefault(); }} placeholder={lockedByMe ? "Write a thoughtful reply…" : "Lock this conversation before replying"} disabled={!lockedByMe || sending} aria-label="Reply message" /><div className="composer-tools"><input ref={inputRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={handleFile} /><button className="icon-button" onClick={() => inputRef.current?.click()} disabled={!lockedByMe || sending} aria-label="Attach media"><Paperclip size={16} /></button><button className="button primary" onClick={send} disabled={!canSend || sending}><Send size={14} /> {sending ? "Sending…" : "Send"}</button></div></div><div className={`reply-counter ${!isAdmin && meaningful > 0 && meaningful < MIN_REPLY_CHARS ? "short" : ""}`}>{isAdmin ? "Administrator override enabled" : `${meaningful}/${MIN_REPLY_CHARS} non-space characters required`} · Enter to send, Shift+Enter for a new line</div></div>
      </section>
      <aside className="panel conversation-side"><div className="side-section"><div className="side-title">Conversation details</div><div className="detail-line"><span>Latest activity</span><span>{timeAgo(selected.lastTime)}</span></div><div className="detail-line"><span>Messages</span><span>{selected.msgCount}</span></div><div className="detail-line"><span>Assignment</span><span>{lockedByMe ? "You" : selected.lock ? selected.lock.moderatorName : "Available"}</span></div></div><div className="side-section"><div className="side-title">Operator guardrails</div><div className="notice"><ShieldCheck size={13} /> Partner-site identity is never shown here. Keep replies warm, direct, and personal.</div></div><div className="side-section"><div className="side-title">Lock policy</div><div className="tiny-text"><Clock3 size={13} style={{ verticalAlign: "middle", marginRight: 5 }} /> Locks last 10 minutes and are renewed while this conversation is open.</div></div></aside>
    </div><Toast message={notice} />
  </div></Shell>;
}

function ReportsPage() {
  const { user, token } = useSession();
  const { conversations, stats, loading, reload } = useModeratorData();
  const [notice, setNotice] = useState("");
  const needsReply = conversations.filter((conversation) => !conversation.lastSenderFake).length;
  const locked = conversations.filter((conversation) => conversation.lock).length;
  const refresh = async () => { await reload(); setNotice("Report refreshed from live activity"); window.setTimeout(() => setNotice(""), 2200); };
  if ((user?.admin ?? 0) < 2) return <Shell><div className="page"><div className="empty-state panel"><AlertTriangle size={28} /><strong>Administrator access required</strong><span>Operational reports are only available to administrators.</span><Link href="/" className="button primary" style={{ marginTop: 16 }}>Back to queue</Link></div></div></Shell>;
  if (!token) return null;
  return <Shell><div className="page"><div className="page-head"><div><div className="eyebrow">Admin / operational truth</div><h1 className="page-title">Reports</h1><p className="page-subtitle">Live moderator activity from the connected conversation source.</p></div><button className="button primary" onClick={refresh}><RefreshCw size={14} /> Refresh report</button></div>
    <div className="metric-grid"><Metric label="Total conversations" value={String(stats.totalConversations)} detail="Real cross-user threads" /><Metric label="Waiting for reply" value={String(needsReply)} detail="Latest sender is a member" color="var(--teal)" /><Metric label="Active locks" value={String(locked)} detail="Current queue snapshot" color="var(--ink)" /><Metric label="Replies by you" value={String(stats.messagesSent)} detail="Recorded in the activity log" color="var(--teal)" /></div>
    <section className="panel report-panel"><div className="panel-head"><div><div className="panel-title">Queue accountability</div><div className="panel-kicker" style={{ marginTop: 5 }}>No synthetic charts or placeholder rows</div></div><CircleHelp size={17} color="var(--ink-soft)" /></div><div className="report-list"><div><span>Authenticated data source</span><strong>{loading ? "Loading…" : "Connected"}</strong></div><div><span>Conversation locks</span><strong>{stats.activeLocks} active</strong></div><div><span>Replies attributed to current operator</span><strong>{stats.messagesSent}</strong></div><div><span>Site attribution</span><strong>Administrator-only adapter data</strong></div></div><div className="report-callout"><ShieldCheck size={17} /><div><strong>Privacy boundary is active</strong><p>Operator responses include real participants and photos needed for the conversation, but no connected-site name, domain, or source identifier is exposed.</p></div></div></section><Toast message={notice} /></div></Shell>;
}

function SettingsPage() {
  const { user, token, logout } = useSession();
  const [, setLocation] = useLocation();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    navigator.serviceWorker.ready.then((registration) => registration.pushManager.getSubscription()).then((subscription) => setPushEnabled(Boolean(subscription))).catch(() => undefined);
  }, []);
  const togglePush = async () => {
    if (!token) return;
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromPush(token);
        setPushEnabled(false);
        setNotice("Push notifications disabled");
      } else {
        await subscribeToPush(token);
        setPushEnabled(true);
        setNotice("Push notifications enabled");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update notifications");
    } finally {
      setPushLoading(false);
      window.setTimeout(() => setNotice(""), 2600);
    }
  };
  return <Shell><div className="page"><div className="page-head"><div><div className="eyebrow">Workspace / account</div><h1 className="page-title">Account</h1><p className="page-subtitle">Your authenticated operator identity and session controls.</p></div><StatusPill type="active">Protected workspace</StatusPill></div><section className="panel settings-panel"><h2>Account details</h2><p>These details are visible to authorized administrators, not to members.</p><div className="form-grid"><div className="form-group"><label>Display name</label><input className="form-field" value={user?.name || ""} readOnly /></div><div className="form-group"><label>Email address</label><input className="form-field" value={user?.email || ""} readOnly /></div><div className="form-group full"><label>Role</label><input className="form-field" value={(user?.admin ?? 0) >= 2 ? "Administrator" : "Operator"} readOnly /></div></div><div className="setting-row" style={{ marginTop: 22 }}><div><strong>Push notifications</strong><small>Receive a browser alert when new member messages need attention.</small></div><button className={`toggle ${pushEnabled ? "on" : ""}`} onClick={togglePush} disabled={pushLoading} aria-label="Toggle push notifications"><span /></button></div><div style={{ marginTop: 22 }}><button className="button danger" onClick={() => { logout(); setLocation("/login"); }}><LogOut size={14} /> Sign out</button></div></section><Toast message={notice} /></div></Shell>;
}

type AdminData = {
  applications: any[];
  operators: any[];
  sites: any[];
  report: { summary?: any; byOperator?: any[]; bySite?: any[] };
  dbStatus?: any;
};

function AdminPage() {
  const { token, user, logout } = useSession();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<"applications" | "operators" | "sites" | "database" | "report">("applications");
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [data, setData] = useState<AdminData>({ applications: [], operators: [], sites: [], report: {}, dbStatus: null });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [expandedApp, setExpandedApp] = useState<number | null>(null);

  // Approval Modal state
  const [approvedModal, setApprovedModal] = useState<{
    applicantName: string;
    email: string;
    activationCode: string;
    expiresInHours: number;
  } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Create Operator Modal
  const [showOperatorModal, setShowOperatorModal] = useState(false);
  const [newOp, setNewOp] = useState({ fullName: "", email: "", password: "", role: "operator" });
  const [opSubmitting, setOpSubmitting] = useState(false);
  const [opError, setOpError] = useState("");

  // Create Site Modal
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [newSite, setNewSite] = useState({ displayName: "", internalName: "", endpointBaseUrl: "", secretEnvKey: "", integrationType: "hybrid" });
  const [siteSubmitting, setSiteSubmitting] = useState(false);
  const [siteError, setSiteError] = useState("");

  // SQL Schema state
  const [sqlCopied, setSqlCopied] = useState(false);
  const [showSqlViewer, setShowSqlViewer] = useState(false);
  const [sqlContent, setSqlContent] = useState("");

  const load = useCallback(async () => {
    if (!token || (user?.admin ?? 0) < 2) return;
    setLoading(true);
    try {
      const [applications, operators, sites, report, dbStatus] = await Promise.all([
        authFetch(token, "/api/chatmodz/admin/applications"),
        authFetch(token, "/api/chatmodz/admin/operators"),
        authFetch(token, "/api/chatmodz/admin/sites"),
        authFetch(token, "/api/chatmodz/admin/report"),
        authFetch(token, "/api/chatmodz/admin/db-status"),
      ]);
      setData({
        applications: applications.ok ? (await applications.json()).applications || [] : [],
        operators: operators.ok ? (await operators.json()).operators || [] : [],
        sites: sites.ok ? (await sites.json()).sites || [] : [],
        report: report.ok ? await report.json() : {},
        dbStatus: dbStatus.ok ? await dbStatus.json() : null,
      });
    } finally {
      setLoading(false);
    }
  }, [token, user?.admin]);

  useEffect(() => { load(); }, [load]);

  if ((user?.admin ?? 0) < 2) {
    return (
      <Shell>
        <div className="page">
          <div className="empty-state panel" style={{ maxWidth: 500, margin: "40px auto", textAlign: "center", padding: "40px 24px" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(217, 119, 6, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#d97706" }}>
              <Shield size={26} />
            </div>
            <strong style={{ fontSize: 18, marginBottom: 8, display: "block" }}>Administrator Access Required</strong>
            <p style={{ color: "var(--muted-foreground)", fontSize: 13, marginBottom: 20 }}>
              The ChatModz Control Room is strictly reserved for platform administrators (Level 2+). You are currently logged in with standard operator access.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                className="button amber"
                onClick={async () => {
                  await logout();
                  setLocation("/admin");
                }}
              >
                Sign in with Administrator Account
              </button>
              <Link href="/" className="button ghost">
                Return to Operator Desk
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  const action = async (url: string, method = "POST", body?: unknown) => {
    const response = await authFetch(token, url, { method, body: body ? JSON.stringify(body) : undefined });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Action failed");
    return result;
  };

  const approve = async (app: any) => {
    try {
      const result = await action(`/api/chatmodz/admin/applications/${app.id}/approve`);
      setApprovedModal({
        applicantName: app.full_name,
        email: app.email,
        activationCode: result.activationCode,
        expiresInHours: result.expiresInHours || 72,
      });
      setNotice(`Application approved for ${app.full_name}`);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Approval failed");
    }
  };

  const reject = async (id: number) => {
    try {
      await action(`/api/chatmodz/admin/applications/${id}/reject`);
      setNotice("Application declined");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Rejection failed");
    }
  };

  const deleteApp = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this application?")) return;
    try {
      await action(`/api/chatmodz/admin/applications/${id}`, "DELETE");
      setNotice("Application deleted");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const setOperatorStatus = async (id: number, status: string) => {
    try {
      await action(`/api/chatmodz/admin/operators/${id}/status`, "POST", { status });
      setNotice("Operator status updated");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Status update failed");
    }
  };

  const setSiteStatus = async (id: number, status: string) => {
    try {
      await action(`/api/chatmodz/admin/sites/${id}/status`, "POST", { status });
      setNotice("Site status updated");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Site update failed");
    }
  };

  const handleCreateOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpSubmitting(true);
    setOpError("");
    try {
      await action("/api/chatmodz/admin/operators/create", "POST", newOp);
      setShowOperatorModal(false);
      setNewOp({ fullName: "", email: "", password: "", role: "operator" });
      setNotice("Operator created successfully");
      await load();
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Could not create operator");
    } finally {
      setOpSubmitting(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiteSubmitting(true);
    setSiteError("");
    try {
      await action("/api/chatmodz/admin/sites", "POST", newSite);
      setShowSiteModal(false);
      setNewSite({ displayName: "", internalName: "", endpointBaseUrl: "", secretEnvKey: "", integrationType: "hybrid" });
      setNotice("Platform registered successfully");
      await load();
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : "Could not register site");
    } finally {
      setSiteSubmitting(false);
    }
  };

  const fetchSqlSchema = async () => {
    if (sqlContent) return sqlContent;
    try {
      const res = await authFetch(token, "/api/chatmodz/admin/sql-schema");
      if (res.ok) {
        const json = await res.json();
        setSqlContent(json.sql);
        return json.sql;
      }
    } catch {}
    return "-- ChatModz Supabase schema available in /database/schema.supabase.sql";
  };

  const copySupabaseSql = async () => {
    try {
      const sql = await fetchSqlSchema();
      await navigator.clipboard.writeText(sql);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 3000);
      setNotice("Full Supabase SQL migration script copied to clipboard!");
    } catch {
      setNotice("Unable to copy SQL directly");
    }
  };

  const filteredApplications = data.applications.filter((a) => {
    if (appFilter === "pending") return a.status === "pending";
    if (appFilter === "approved") return a.status === "approved";
    if (appFilter === "rejected") return a.status === "rejected";
    return true;
  });

  const pendingAppsCount = data.applications.filter((a) => a.status === "pending").length;
  const summary = data.report.summary || {};
  const dbStatus = data.dbStatus;
  const isSupabase = dbStatus?.activeMode === "supabase_postgres" || Boolean(dbStatus?.supabase?.connected);

  return (
    <Shell>
      <div className="page">
        {/* Page Head */}
        <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div className="eyebrow" style={{ color: "#d97706", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Shield size={13} /> Super-Admin Control Room
            </div>
            <h1 className="page-title">Operations Admin Desk</h1>
            <p className="page-subtitle">
              Review moderator applicants, manage active team accounts, configure site adapters, and monitor Supabase PostgreSQL.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6, background: isSupabase ? "rgba(16, 185, 129, 0.12)" : "rgba(217, 119, 6, 0.12)", color: isSupabase ? "#059669" : "#b45309", fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: isSupabase ? "#10b981" : "#f59e0b" }} />
              {isSupabase ? "Supabase Connected" : "Local Memory Engine"}
            </span>
            <button className="button ghost compact" onClick={load} title="Refresh data">
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="admin-tabs" style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 10, overflowX: "auto" }}>
          <button
            className={`filter-button ${tab === "applications" ? "selected" : ""}`}
            onClick={() => setTab("applications")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Users size={14} /> Applicants
            {pendingAppsCount > 0 && (
              <span style={{ background: "#d97706", color: "#fff", fontSize: 11, padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                {pendingAppsCount}
              </span>
            )}
          </button>
          <button
            className={`filter-button ${tab === "operators" ? "selected" : ""}`}
            onClick={() => setTab("operators")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <ShieldCheck size={14} /> Operators & Admins ({data.operators.length})
          </button>
          <button
            className={`filter-button ${tab === "sites" ? "selected" : ""}`}
            onClick={() => setTab("sites")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Globe size={14} /> Connected Sites ({data.sites.length})
          </button>
          <button
            className={`filter-button ${tab === "database" ? "selected" : ""}`}
            onClick={() => setTab("database")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Database size={14} /> Supabase & SQL
          </button>
          <button
            className={`filter-button ${tab === "report" ? "selected" : ""}`}
            onClick={() => setTab("report")}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <BarChart3 size={14} /> Reports & Attribution
          </button>
        </div>

        {loading ? (
          <div className="empty-state panel"><RefreshCw className="spin" size={25} /><strong>Loading administrator data…</strong></div>
        ) : tab === "applications" ? (
          /* APPLICATIONS TAB */
          <section className="panel">
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div className="panel-title">Moderator Applications</div>
                <div className="panel-kicker">Review applicants, examine communication experience, and issue single-use activation codes</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "pending", "approved", "rejected"] as const).map((filter) => (
                  <button
                    key={filter}
                    className={`filter-button ${appFilter === filter ? "selected" : ""}`}
                    onClick={() => setAppFilter(filter)}
                    style={{ fontSize: 12, padding: "4px 10px", textTransform: "capitalize" }}
                  >
                    {filter}
                    {filter === "pending" && pendingAppsCount > 0 ? ` (${pendingAppsCount})` : ""}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Location</th>
                    <th>Experience</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.length ? (
                    filteredApplications.map((application) => (
                      <tr key={application.id}>
                        <td>
                          <strong>{application.full_name}</strong>
                          <br />
                          <span className="tiny-text" style={{ fontFamily: "monospace" }}>{application.email}</span>
                          <br />
                          <span className="tiny-text" style={{ color: "var(--muted-foreground)" }}>
                            Applied {new Date(application.created_at || Date.now()).toLocaleDateString()}
                          </span>
                        </td>
                        <td>{application.location || "—"}</td>
                        <td className="table-long" style={{ maxWidth: 300 }}>
                          <div style={{ maxHeight: expandedApp === application.id ? "none" : "3.6em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expandedApp === application.id ? "normal" : "nowrap" }}>
                            {application.experience || "No background details provided"}
                          </div>
                          {application.experience && application.experience.length > 50 && (
                            <button
                              type="button"
                              onClick={() => setExpandedApp(expandedApp === application.id ? null : application.id)}
                              style={{ background: "none", border: "none", color: "#d97706", fontSize: 11, padding: 0, marginTop: 4, cursor: "pointer", fontWeight: 600 }}
                            >
                              {expandedApp === application.id ? "Show less" : "Read full background"}
                            </button>
                          )}
                        </td>
                        <td>
                          <StatusPill type={application.status === "pending" ? "pending" : application.status === "approved" ? "active" : "disabled"}>
                            {application.status}
                          </StatusPill>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="inline-actions" style={{ justifyContent: "flex-end" }}>
                            {application.status === "pending" ? (
                              <>
                                <button
                                  className="button amber compact"
                                  onClick={() => approve(application)}
                                  title="Approve applicant and issue operator activation code"
                                  style={{ background: "#d97706", color: "#fff", borderColor: "#b45309" }}
                                >
                                  Approve
                                </button>
                                <button
                                  className="button ghost compact"
                                  onClick={() => reject(application.id)}
                                  title="Decline application"
                                  style={{ color: "#ef4444" }}
                                >
                                  Decline
                                </button>
                              </>
                            ) : (
                              <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginRight: 6 }}>
                                {application.status === "approved" ? "Approved" : "Declined"}
                              </span>
                            )}
                            <button
                              className="button ghost compact"
                              onClick={() => deleteApp(application.id)}
                              title="Delete application record"
                              style={{ color: "var(--muted-foreground)", padding: "4px 6px" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "30px 20px", color: "var(--muted-foreground)" }}>
                        No {appFilter !== "all" ? appFilter : ""} applications found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : tab === "operators" ? (
          /* OPERATORS TAB */
          <section className="panel">
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div className="panel-title">Active Moderators & Administrators</div>
                <div className="panel-kicker">Manage staff accounts, assign administrative roles, or suspend access immediately</div>
              </div>
              <button
                className="button primary compact"
                onClick={() => setShowOperatorModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <UserPlus size={14} /> Add Moderator / Admin
              </button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Operator</th>
                    <th>Public ID</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Active</th>
                    <th style={{ textAlign: "right" }}>Update Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.operators.map((operator) => (
                    <tr key={operator.id}>
                      <td>
                        <strong>{operator.full_name}</strong>
                        <br />
                        <span className="tiny-text">{operator.email}</span>
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                        {operator.public_id || `cmz_oper_${operator.id}`}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          background: operator.role === "admin" ? "rgba(217, 119, 6, 0.15)" : "rgba(0,0,0,0.05)",
                          color: operator.role === "admin" ? "#b45309" : "var(--foreground)",
                        }}>
                          {operator.role === "admin" ? "Administrator" : "Operator"}
                        </span>
                      </td>
                      <td>
                        <StatusPill type={operator.status === "active" ? "active" : operator.status === "training" ? "pending" : "disabled"}>
                          {operator.status}
                        </StatusPill>
                      </td>
                      <td>{operator.last_active_at ? new Date(operator.last_active_at).toLocaleString() : "Never"}</td>
                      <td style={{ textAlign: "right" }}>
                        <select
                          className="form-field compact-select"
                          value={operator.status}
                          onChange={(event) => setOperatorStatus(operator.id, event.target.value)}
                          style={{ maxWidth: 130 }}
                        >
                          <option value="training">Training</option>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : tab === "sites" ? (
          /* SITES TAB */
          <section className="panel">
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div className="panel-title">Connected Platforms & Sites</div>
                <div className="panel-kicker">Manage webhook dispatch targets, site secrets, and integration types</div>
              </div>
              <button
                className="button primary compact"
                onClick={() => setShowSiteModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Plus size={14} /> Connect Partner Platform
              </button>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Endpoint URL</th>
                    <th>Secret Env Key</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sites.map((site) => (
                    <tr key={site.id}>
                      <td>
                        <strong>{site.display_name}</strong>
                        <br />
                        <span className="tiny-text mono">{site.internal_name}</span>
                      </td>
                      <td className="table-long" style={{ maxWidth: 260, fontFamily: "monospace", fontSize: 11 }}>
                        {site.endpoint_base_url || "Inbound Only Webhook"}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>{site.secret_env_key || "—"}</td>
                      <td>
                        <StatusPill type={site.status === "active" ? "active" : site.status === "paused" ? "pending" : "disabled"}>
                          {site.status}
                        </StatusPill>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <select
                          className="form-field compact-select"
                          value={site.status}
                          onChange={(event) => setSiteStatus(site.id, event.target.value)}
                          style={{ maxWidth: 130 }}
                        >
                          <option value="active">Active</option>
                          <option value="paused">Paused</option>
                          <option value="disconnected">Disconnected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : tab === "database" ? (
          /* SUPABASE & DATABASE TAB */
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Status Summary Banner */}
            <section className="panel" style={{ borderLeft: isSupabase ? "4px solid #10b981" : "4px solid #f59e0b" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div className="eyebrow" style={{ color: isSupabase ? "#059669" : "#b45309" }}>
                    Database Architecture
                  </div>
                  <h2 style={{ fontSize: 20, margin: "4px 0 6px" }}>
                    {isSupabase ? "Supabase PostgreSQL Database Active" : "In-Memory Database Engine Active"}
                  </h2>
                  <p style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
                    Connected Supabase Project URL: <code style={{ color: "var(--foreground)", background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: 4 }}>https://xmqrntslxacmvkljgvsc.supabase.co</code>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="button primary compact" onClick={copySupabaseSql} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {sqlCopied ? <Check size={14} /> : <Copy size={14} />}
                    {sqlCopied ? "SQL Copied!" : "Copy Full Supabase SQL"}
                  </button>
                  <a
                    href="https://supabase.com/dashboard/project/xmqrntslxacmvkljgvsc/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="button ghost compact"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    Supabase SQL Editor <ExternalLink size={13} />
                  </a>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 18 }}>
                <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Active Mode</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, fontFamily: "monospace" }}>
                    {dbStatus?.activeMode || "in_memory"}
                  </div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Registered Operators</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {data.operators.length}
                  </div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Total Applications</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {data.applications.length}
                  </div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Connected Platforms</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {data.sites.length}
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Setup Instructions */}
            <section className="panel">
              <div className="panel-title">How to Run the Database SQL in Supabase</div>
              <p style={{ color: "var(--muted-foreground)", fontSize: 13, marginBottom: 16 }}>
                Follow these 3 quick steps to create all database tables, triggers, and the default admin in your Supabase project:
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#d97706", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>1</div>
                  <strong>Copy SQL Script</strong>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "6px 0 12px" }}>
                    Click the button below to copy the complete PostgreSQL schema (found in <code>database/schema.supabase.sql</code>).
                  </p>
                  <button className="button amber compact" onClick={copySupabaseSql} style={{ width: "100%", justifyContent: "center" }}>
                    {sqlCopied ? "✓ SQL Copied to Clipboard" : "Copy SQL Script"}
                  </button>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#2563eb", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>2</div>
                  <strong>Open Supabase SQL Editor</strong>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "6px 0 12px" }}>
                    Navigate to your Supabase project dashboard and open a new SQL query tab.
                  </p>
                  <a
                    href="https://supabase.com/dashboard/project/xmqrntslxacmvkljgvsc/sql/new"
                    target="_blank"
                    rel="noreferrer"
                    className="button ghost compact"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Open SQL Editor <ExternalLink size={13} />
                  </a>
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#059669", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, marginBottom: 10 }}>3</div>
                  <strong>Paste & Click Run</strong>
                  <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "6px 0 12px" }}>
                    Paste into the editor and hit <strong>Run</strong>. Tables, foreign keys, indexes, and initial admin credentials will be created immediately!
                  </p>
                  <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                    ✓ Tables: operators, applications, sites, conversations, messages
                  </div>
                </div>
              </div>

              {/* View Schema toggle */}
              <div style={{ marginTop: 20 }}>
                <button
                  type="button"
                  className="button ghost compact"
                  onClick={async () => {
                    await fetchSqlSchema();
                    setShowSqlViewer(!showSqlViewer);
                  }}
                  style={{ fontSize: 12 }}
                >
                  {showSqlViewer ? "Hide SQL Schema" : "Inspect Complete SQL Schema"}
                </button>
                {showSqlViewer && (
                  <pre style={{
                    background: "#1e1e24",
                    color: "#f3f4f6",
                    padding: 16,
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "monospace",
                    maxHeight: 320,
                    overflowY: "auto",
                    marginTop: 10,
                  }}>
                    {sqlContent || "Loading schema..."}
                  </pre>
                )}
              </div>
            </section>
          </div>
        ) : (
          /* REPORT TAB */
          <section className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">Delivery and Attribution Report</div>
                <div className="panel-kicker">Operator productivity, conversation volumes, and partner site telemetry</div>
              </div>
            </div>
            <div className="metric-grid admin-metrics">
              <Metric label="Conversations" value={String(summary.conversations || 0)} detail="Stored in Chatmodz" />
              <Metric label="Replies" value={String(summary.replies || 0)} detail="Operator-authored messages" color="#059669" />
              <Metric label="Failed Deliveries" value={String(summary.failed_deliveries || 0)} detail="Requires adapter follow-up" color="#ef4444" />
            </div>
            <div className="report-columns" style={{ marginTop: 20 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Activity by Operator</h3>
                {(data.report.byOperator || []).map((row) => (
                  <div className="report-line" key={row.id}>
                    <span>{row.name}</span>
                    <strong>{row.replies} replies</strong>
                  </div>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Activity by Connected Site</h3>
                {(data.report.bySite || []).map((row) => (
                  <div className="report-line" key={row.id}>
                    <span>
                      {row.display_name} <small style={{ color: "var(--muted-foreground)" }}>({row.status})</small>
                    </span>
                    <strong>
                      {row.conversations} conversations · {row.failed_deliveries || 0} failed
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* APPLICATION APPROVAL MODAL */}
        {approvedModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}>
            <div style={{
              background: "var(--card)",
              color: "var(--card-foreground)",
              borderRadius: 12,
              border: "1px solid var(--border)",
              maxWidth: 520,
              width: "100%",
              padding: 26,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#059669", fontWeight: 700 }}>
                  <ShieldCheck size={22} /> Application Approved!
                </div>
                <button
                  type="button"
                  onClick={() => setApprovedModal(null)}
                  style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 16px" }}>
                <strong>{approvedModal.applicantName}</strong> ({approvedModal.email}) has been approved. A new operator account was provisioned in the database. Share this single-use activation code with them:
              </p>

              <div style={{
                background: "rgba(0,0,0,0.04)",
                border: "1px dashed rgba(0,0,0,0.2)",
                borderRadius: 8,
                padding: "16px 20px",
                textAlign: "center",
                margin: "16px 0",
              }}>
                <div style={{ fontSize: 11, textTransform: "uppercase", color: "var(--muted-foreground)", letterSpacing: 1, marginBottom: 6 }}>
                  One-Time Operator Activation Code
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, letterSpacing: 2, color: "#d97706" }}>
                  {approvedModal.activationCode}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 6 }}>
                  Valid for {approvedModal.expiresInHours} hours · Single use only
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
                <button
                  className="button primary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(approvedModal.activationCode);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2500);
                  }}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {codeCopied ? <Check size={15} /> : <Copy size={15} />}
                  {codeCopied ? "Code Copied to Clipboard" : "Copy Activation Code"}
                </button>

                <button
                  className="button ghost"
                  onClick={async () => {
                    const message = `Hi ${approvedModal.applicantName},\n\nCongratulations! Your application to become a ChatModz conversation operator has been approved.\n\nPlease activate your desk with your one-time code:\nActivation Code: ${approvedModal.activationCode}\n\nSign in at: ${window.location.origin}/login\n\nWelcome to the team!`;
                    await navigator.clipboard.writeText(message);
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 2500);
                  }}
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  {inviteCopied ? <Check size={15} /> : <MessageSquare size={15} />}
                  {inviteCopied ? "Invitation Message Copied!" : "Copy Full Welcome & Invite Message"}
                </button>

                <button
                  className="button ghost compact"
                  onClick={() => setApprovedModal(null)}
                  style={{ width: "100%", justifyContent: "center", marginTop: 6 }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE OPERATOR MODAL */}
        {showOperatorModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}>
            <div style={{
              background: "var(--card)",
              color: "var(--card-foreground)",
              borderRadius: 12,
              border: "1px solid var(--border)",
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <UserPlus size={18} /> Provision Moderator or Admin Account
                </div>
                <button
                  type="button"
                  onClick={() => setShowOperatorModal(false)}
                  style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateOperator} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Full Name</label>
                  <input
                    className="form-field"
                    value={newOp.fullName}
                    onChange={(e) => setNewOp({ ...newOp, fullName: e.target.value })}
                    placeholder="e.g. Alex Johnson"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Email Address</label>
                  <input
                    className="form-field"
                    type="email"
                    value={newOp.email}
                    onChange={(e) => setNewOp({ ...newOp, email: e.target.value })}
                    placeholder="alex@chatmodz.io"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Initial Password</label>
                  <input
                    className="form-field"
                    type="password"
                    value={newOp.password}
                    onChange={(e) => setNewOp({ ...newOp, password: e.target.value })}
                    placeholder="Minimum 6 characters"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>System Role</label>
                  <select
                    className="form-field"
                    value={newOp.role}
                    onChange={(e) => setNewOp({ ...newOp, role: e.target.value as any })}
                  >
                    <option value="operator">Operator (Queue & Conversations only)</option>
                    <option value="admin">Administrator (Full Control Room Access)</option>
                  </select>
                </div>

                {opError && <div className="auth-error"><AlertTriangle size={14} />{opError}</div>}

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" className="button ghost" onClick={() => setShowOperatorModal(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="button primary" disabled={opSubmitting} style={{ flex: 1 }}>
                    {opSubmitting ? "Creating…" : "Create Account"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CREATE SITE MODAL */}
        {showSiteModal && (
          <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}>
            <div style={{
              background: "var(--card)",
              color: "var(--card-foreground)",
              borderRadius: 12,
              border: "1px solid var(--border)",
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
                  <Globe size={18} /> Register Partner Platform
                </div>
                <button
                  type="button"
                  onClick={() => setShowSiteModal(false)}
                  style={{ background: "none", border: "none", color: "var(--muted-foreground)", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateSite} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Display Name</label>
                  <input
                    className="form-field"
                    value={newSite.displayName}
                    onChange={(e) => setNewSite({ ...newSite, displayName: e.target.value })}
                    placeholder="e.g. Velvet Match US"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Internal Identifier (Slug)</label>
                  <input
                    className="form-field mono"
                    value={newSite.internalName}
                    onChange={(e) => setNewSite({ ...newSite, internalName: e.target.value })}
                    placeholder="e.g. velvet_match_us"
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Webhook Base URL</label>
                  <input
                    className="form-field"
                    value={newSite.endpointBaseUrl}
                    onChange={(e) => setNewSite({ ...newSite, endpointBaseUrl: e.target.value })}
                    placeholder="https://api.velvetmatch.com/chatmodz"
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 }}>Secret Environment Key</label>
                  <input
                    className="form-field mono"
                    value={newSite.secretEnvKey}
                    onChange={(e) => setNewSite({ ...newSite, secretEnvKey: e.target.value })}
                    placeholder="e.g. VELVET_MATCH_SECRET"
                    required
                  />
                </div>

                {siteError && <div className="auth-error"><AlertTriangle size={14} />{siteError}</div>}

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button type="button" className="button ghost" onClick={() => setShowSiteModal(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="button primary" disabled={siteSubmitting} style={{ flex: 1 }}>
                    {siteSubmitting ? "Registering…" : "Register Site"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Toast message={notice} />
      </div>
    </Shell>
  );
}

function AuthenticatedRouter() {
  const { user, loading } = useSession();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="auth-loading">
        <RefreshCw className="spin" size={24} />
        <span>Checking secure session…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/admin" component={AdminLoginPage} />
        <Route path="/admin/login" component={AdminLoginPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/apply" component={ApplyPage} />
        <Route path="/welcome" component={LandingPage} />
        <Route component={LandingPage} />
      </Switch>
    );
  }

  return (
    <ErrorBoundary resetKey={location}>
      <Switch>
        <Route path="/" component={QueuePage} />
        <Route path="/conversation/:id" component={ConversationPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </ErrorBoundary>
  );
}

function App() {
  const auth = useAuthState();
  return <QueryClientProvider client={queryClient}><AuthContext.Provider value={auth}><TooltipProvider><AuthenticatedRouter /><Toaster /></TooltipProvider></AuthContext.Provider></QueryClientProvider>;
}

export default App;