import express, { Router, type IRouter, type Request, type Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { and, desc, eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import OpenAI from "openai";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  db, participantsTable, shoppingRequestsTable, funnelEventsTable, participantFeedbackTable,
} from "@workspace/db";
import {
  VerifyPilotInviteBody, SaveMyParticipantBody, CreateShoppingRequestBody,
  RecordFunnelEventBody, SubmitParticipantFeedbackBody, VerifyCardSetupBody,
} from "@workspace/api-zod";

const router: IRouter = Router();
const supportedMerchants = () => (process.env.CAMPUS_CART_SUPPORTED_MERCHANTS ?? "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const stripeKey = () => process.env.STRIPE_SECRET_KEY;
const stripe = () => new Stripe(stripeKey()!);
const transcriptionSettings = () => {
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    return { apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL };
  }
  return null;
};
const audioTypes: Record<string, string> = {
  "audio/webm": "webm", "audio/mp4": "mp4", "audio/ogg": "ogg", "audio/wav": "wav",
};

async function identity(req: Request, preferCampusEmail = false) {
  const { userId } = getAuth(req);
  if (!userId) return null;
  const user = await clerkClient.users.getUser(userId);
  const verifiedEmails = user.emailAddresses.filter((entry) => entry.verification?.status === "verified");
  const email = (preferCampusEmail
    ? verifiedEmails.find((entry) => entry.emailAddress.toLowerCase().endsWith("@nd.edu"))
    : verifiedEmails[0])?.emailAddress;
  return email ? { userId, email: email.toLowerCase() } : null;
}

async function participant(req: Request) {
  const auth = await identity(req);
  if (!auth) return null;
  const [record] = await db.select().from(participantsTable).where(eq(participantsTable.clerkUserId, auth.userId));
  return record ?? null;
}

function hasPilotCookie(req: Request) {
  return Boolean(process.env.SESSION_SECRET) && req.signedCookies?.campus_cart_access === "accepted";
}

function isPilotCodeAccepted(code: string) {
  const codes = (process.env.CAMPUS_CART_INVITE_CODES ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return codes.includes(code);
}

router.get("/campus-cart/config", (_req, res) => {
  res.json({
    audioEnabled: Boolean(transcriptionSettings()),
    cardSetupEnabled: Boolean(stripeKey()?.startsWith("sk_test_")),
    paymentMode: "test",
    purchasingEnabled: false,
    supportedMerchants: supportedMerchants(),
  });
});

router.post("/campus-cart/requests/transcription", async (req, res, next): Promise<void> => {
  if (!await participant(req)) { res.status(401).json({ error: "Participant profile required" }); return; }
  if (!transcriptionSettings()) { res.status(503).json({ error: "Transcription unavailable" }); return; }
  const mediaType = req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!audioTypes[mediaType]) { res.status(415).json({ error: "Unsupported audio format" }); return; }
  next();
}, express.raw({ type: () => true, limit: "10mb" }), async (req, res): Promise<void> => {
  const mediaType = req.headers["content-type"]!.split(";")[0].trim().toLowerCase();
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    res.status(400).json({ error: "Recording is empty" }); return;
  }
  let directory: string | undefined;
  try {
    directory = await mkdtemp(join(tmpdir(), "campus-cart-audio-"));
    const path = join(directory, `request.${audioTypes[mediaType]}`);
    await writeFile(path, req.body, { mode: 0o600 });
    req.body = undefined;
    const client = new OpenAI(transcriptionSettings()!);
    const result = await client.audio.transcriptions.create({
      model: "gpt-4o-mini-transcribe",
      file: createReadStream(path),
    });
    const text = result.text.trim();
    if (!text) { res.status(422).json({ error: "No speech detected; type your request instead" }); return; }
    res.json({ text });
  } catch (error) {
    req.log.error({ err: error }, "Request transcription failed");
    res.status(502).json({ error: "Could not transcribe recording; type your request instead" });
  } finally {
    req.body = undefined;
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});

router.post("/campus-cart/pilot/access", (req, res) => {
  const parsed = VerifyPilotInviteBody.safeParse(req.body);
  if (!process.env.SESSION_SECRET) { res.status(503).json({ error: "Pilot access unavailable" }); return; }
  if (!parsed.success || !isPilotCodeAccepted(parsed.data.inviteCode)) {
    res.status(400).json({ error: "Invite code not accepted" }); return;
  }
  res.cookie("campus_cart_access", "accepted", { signed: true, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 6 * 60 * 60 * 1000 });
  res.json({ accepted: true });
});

router.get("/campus-cart/participants/me", async (req, res): Promise<void> => {
  const record = await participant(req);
  if (!record) { res.status(401).json({ error: "Sign-in required" }); return; }
  const [latest] = await db.select({ id: shoppingRequestsTable.id }).from(shoppingRequestsTable)
    .where(eq(shoppingRequestsTable.participantId, record.id)).limit(1);
  res.json({ participantId: record.id, role: record.role, hasRequest: Boolean(latest), cardStatus: record.cardStatus });
});

router.put("/campus-cart/participants/me", async (req, res): Promise<void> => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "Sign-in required" }); return; }
  const auth = await identity(req, true);
  const parsed = SaveMyParticipantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose Student or Staff to continue." }); return;
  }
  if (!auth) {
    res.status(403).json({ error: "Verify an @nd.edu email in your account before continuing." }); return;
  }
  const inviteCode = parsed.data.inviteCode?.trim();
  if (inviteCode && !isPilotCodeAccepted(inviteCode)) {
    res.status(400).json({ error: "That invitation code was not accepted. Check your pilot invitation and try again." }); return;
  }
  if (!hasPilotCookie(req) && !(inviteCode && process.env.SESSION_SECRET)) {
    res.status(403).json({ error: "Your pilot invitation is missing or expired. Enter your invitation code above, then select Continue." }); return;
  }
  const [record] = await db.insert(participantsTable).values({ clerkUserId: auth.userId, email: auth.email, role: parsed.data.role })
    .onConflictDoUpdate({ target: participantsTable.clerkUserId, set: { role: parsed.data.role, email: auth.email } }).returning();
  const [latest] = await db.select({ id: shoppingRequestsTable.id }).from(shoppingRequestsTable).where(eq(shoppingRequestsTable.participantId, record.id)).limit(1);
  res.json({ participantId: record.id, role: record.role, hasRequest: Boolean(latest), cardStatus: record.cardStatus });
});

router.post("/campus-cart/requests", async (req, res): Promise<void> => {
  const person = await participant(req);
  const parsed = CreateShoppingRequestBody.safeParse(req.body);
  if (!person) { res.status(401).json({ error: "Participant profile required" }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const merchant = parsed.data.merchant?.trim() || null;
  const supportStatus = !merchant ? "unspecified" : supportedMerchants().some((m) => m.toLowerCase() === merchant.toLowerCase()) ? "supported" : "unsupported";
  const [record] = await db.insert(shoppingRequestsTable).values({ ...parsed.data, merchant, participantId: person.id, supportStatus }).returning();
  res.status(201).json(record);
});

router.get("/campus-cart/participants/me/request", async (req, res): Promise<void> => {
  const person = await participant(req);
  if (!person) { res.status(401).json({ error: "Sign-in required" }); return; }
  const [record] = await db.select().from(shoppingRequestsTable).where(eq(shoppingRequestsTable.participantId, person.id)).orderBy(desc(shoppingRequestsTable.createdAt)).limit(1);
  res.json({ request: record ?? null });
});

router.post("/campus-cart/events", async (req, res): Promise<void> => {
  const person = await participant(req);
  const parsed = RecordFunnelEventBody.safeParse(req.body);
  if (!person) { res.status(401).json({ error: "Sign-in required" }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.insert(funnelEventsTable).values({ participantId: person.id, eventType: parsed.data.eventType });
  res.status(201).json({ created: true });
});

router.post("/campus-cart/feedback", async (req, res): Promise<void> => {
  const person = await participant(req);
  const parsed = SubmitParticipantFeedbackBody.safeParse(req.body);
  if (!person) { res.status(401).json({ error: "Sign-in required" }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.insert(participantFeedbackTable).values({ participantId: person.id, feedback: parsed.data.feedback });
  res.status(201).json({ created: true });
});

router.get("/campus-cart/cards/me", async (req, res): Promise<void> => {
  const person = await participant(req);
  if (!person) { res.status(401).json({ error: "Sign-in required" }); return; }
  res.json({ status: person.cardStatus, paymentMode: "test" });
});

router.post("/campus-cart/cards/setup", async (req, res): Promise<void> => {
  const person = await participant(req);
  if (!person) { res.status(401).json({ error: "Sign-in required" }); return; }
  if (!stripeKey()?.startsWith("sk_test_")) { res.status(503).json({ error: "Stripe test mode is not configured" }); return; }
  let customerId = person.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({ email: person.email, metadata: { participantId: person.id } });
    customerId = customer.id;
    await db.update(participantsTable).set({ stripeCustomerId: customerId }).where(eq(participantsTable.id, person.id));
  }
  const origin = `${req.protocol}://${req.get("host")}`;
  const session = await stripe().checkout.sessions.create({
    mode: "setup", customer: customerId,
    success_url: `${origin}/request?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/request?setup=cancelled`,
  });
  await db.insert(funnelEventsTable).values({ participantId: person.id, eventType: "setup_started" });
  await db.update(participantsTable).set({ cardStatus: "setup_pending" }).where(eq(participantsTable.id, person.id));
  res.json({ url: session.url });
});

router.post("/campus-cart/cards/verify", async (req, res): Promise<void> => {
  const person = await participant(req);
  const parsed = VerifyCardSetupBody.safeParse(req.body);
  if (!person) { res.status(401).json({ error: "Sign-in required" }); return; }
  if (!stripeKey()?.startsWith("sk_test_")) { res.status(503).json({ error: "Stripe test mode is not configured" }); return; }
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const session = await stripe().checkout.sessions.retrieve(parsed.data.sessionId, { expand: ["setup_intent"] });
  if (session.customer !== person.stripeCustomerId || session.mode !== "setup" || session.status !== "complete") {
    res.json({ status: person.cardStatus, paymentMode: "test" }); return;
  }
  const setupIntent = session.setup_intent as Stripe.SetupIntent;
  const paymentMethodId = typeof setupIntent.payment_method === "string" ? setupIntent.payment_method : setupIntent.payment_method?.id;
  await db.update(participantsTable).set({ cardStatus: "connected", stripePaymentMethodId: paymentMethodId }).where(eq(participantsTable.id, person.id));
  await db.insert(funnelEventsTable).values({ participantId: person.id, eventType: "setup_completed", verified: true });
  res.json({ status: "connected", paymentMode: "test" });
});

router.delete("/campus-cart/cards/me", async (req, res): Promise<void> => {
  const person = await participant(req);
  if (!person) { res.status(401).json({ error: "Sign-in required" }); return; }
  if (person.stripePaymentMethodId && stripeKey()?.startsWith("sk_test_")) await stripe().paymentMethods.detach(person.stripePaymentMethodId);
  await db.update(participantsTable).set({ cardStatus: "not_connected", stripePaymentMethodId: null }).where(eq(participantsTable.id, person.id));
  res.json({ status: "not_connected", paymentMode: "test" });
});

async function requireResearcher(req: Request, res: Response) {
  const auth = await identity(req);
  const allowed = (process.env.CAMPUS_CART_RESEARCHER_EMAILS ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!auth) { res.status(401).json({ error: "Researcher sign-in required" }); return null; }
  if (!allowed.includes(auth.email)) { res.status(403).json({ error: "Researcher access required" }); return null; }
  return auth;
}

async function dashboardData() {
  const records = await db.execute(sql`
    SELECT p.id AS participant_id, p.role, r.item, r.category, r.merchant, r.budget_cents,
      COUNT(*) FILTER (WHERE e.event_type='card_step_viewed')::int AS card_step_views,
      COUNT(*) FILTER (WHERE e.event_type='setup_started')::int AS setup_starts,
      COUNT(*) FILTER (WHERE e.event_type='setup_completed' AND e.verified=true)::int AS setup_completions,
      MAX(f.feedback) AS feedback
    FROM campus_cart_participants p
    LEFT JOIN LATERAL (SELECT * FROM campus_cart_requests WHERE participant_id=p.id ORDER BY created_at DESC LIMIT 1) r ON true
    LEFT JOIN campus_cart_funnel_events e ON e.participant_id=p.id
    LEFT JOIN campus_cart_feedback f ON f.participant_id=p.id
    GROUP BY p.id,p.role,r.item,r.category,r.merchant,r.budget_cents`);
  const rows = records.rows as any[];
  const rank = (field: "merchant" | "category") => [...new Map(rows.map((r) => [r[field] ?? (field === "merchant" ? "Unspecified" : "Uncategorized"), 0]))]
    .map(([label]) => ({ label, uniqueParticipants: new Set(rows.filter((r) => (r[field] ?? (field === "merchant" ? "Unspecified" : "Uncategorized")) === label).map((r) => r.participant_id)).size }))
    .sort((a, b) => b.uniqueParticipants - a.uniqueParticipants);
  const mapped = rows.map((r) => ({ participantId: r.participant_id, role: r.role, item: r.item, category: r.category, merchant: r.merchant, budgetCents: r.budget_cents, cardStepViews: r.card_step_views, setupStarts: r.setup_starts, setupCompletions: r.setup_completions, abandoned: r.setup_starts > r.setup_completions, feedback: r.feedback }));
  return { paymentMode: "test", participants: rows.length, cardStepViews: mapped.reduce((s,r)=>s+r.cardStepViews,0), setupStarts: mapped.reduce((s,r)=>s+r.setupStarts,0), verifiedSetupCompletions: mapped.reduce((s,r)=>s+r.setupCompletions,0), abandoned: mapped.filter((r)=>r.abandoned).length, merchantRankings: rank("merchant"), categoryRankings: rank("category"), records: mapped };
}

router.get("/research/dashboard", async (req, res): Promise<void> => {
  if (!await requireResearcher(req, res)) return;
  res.json(await dashboardData());
});

router.get("/research/export.csv", async (req, res): Promise<void> => {
  if (!await requireResearcher(req, res)) return;
  const data = await dashboardData();
  const escape = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [["participant_id","role","item","category","merchant","budget_cents","card_step_views","setup_starts","setup_completions","abandoned","feedback"].join(","), ...data.records.map((r) => [r.participantId,r.role,r.item,r.category,r.merchant,r.budgetCents,r.cardStepViews,r.setupStarts,r.setupCompletions,r.abandoned,r.feedback].map(escape).join(","))];
  res.type("text/csv").send(lines.join("\n"));
});

export default router;