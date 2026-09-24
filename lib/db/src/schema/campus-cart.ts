import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const participantsTable = pgTable("campus_cart_participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  cardStatus: text("card_status").notNull().default("not_connected"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shoppingRequestsTable = pgTable("campus_cart_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  participantId: uuid("participant_id").notNull().references(() => participantsTable.id),
  item: text("item").notNull(),
  category: text("category").notNull(),
  merchant: text("merchant"),
  budgetCents: integer("budget_cents").notNull(),
  supportStatus: text("support_status").notNull(),
  status: text("status").notNull().default("received"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const funnelEventsTable = pgTable("campus_cart_funnel_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  participantId: uuid("participant_id").notNull().references(() => participantsTable.id),
  eventType: text("event_type").notNull(),
  paymentMode: text("payment_mode").notNull().default("test"),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const participantFeedbackTable = pgTable("campus_cart_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  participantId: uuid("participant_id").notNull().references(() => participantsTable.id),
  feedback: text("feedback").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});