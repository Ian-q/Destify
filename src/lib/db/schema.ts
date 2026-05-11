import { pgTable, uuid, text, boolean, date, timestamp, jsonb, pgEnum, integer, uniqueIndex } from 'drizzle-orm/pg-core';

export const idpConvention = pgEnum('idp_convention', ['1949', '1968']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const permanentProfile = pgTable('permanent_profile', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  citizenships: text('citizenships').array().notNull().default([]),
  homeCountry: text('home_country'),
  idpConvention: idpConvention('idp_convention'),
  idpExpiry: date('idp_expiry'),
  controlledMeds: text('controlled_meds').array().notNull().default([]),
  hasMinors: boolean('has_minors').notNull().default(false),
  extras: jsonb('extras').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tripStatus = pgEnum('trip_status', ['planning', 'booked', 'active', 'past']);
export const tripPurpose = pgEnum('trip_purpose', ['tourism', 'business', 'family', 'study']);

export const trip = pgTable('trip', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  status: tripStatus('status').notNull().default('planning'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leg = pgTable('leg', {
  id: uuid('id').primaryKey().defaultRandom(),
  tripId: uuid('trip_id').notNull().references(() => trip.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  fromCountry: text('from_country').notNull(),
  toCountry: text('to_country').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
}, (t) => ({
  tripSeqUnique: uniqueIndex('leg_trip_seq_unique').on(t.tripId, t.seq),
}));

export const tripContext = pgTable('trip_context', {
  tripId: uuid('trip_id').primaryKey().references(() => trip.id, { onDelete: 'cascade' }),
  travelingWithMinors: boolean('traveling_with_minors').notNull().default(false),
  drivingAtDestination: boolean('driving_at_destination').notNull().default(false),
  carryingControlledMeds: boolean('carrying_controlled_meds').notNull().default(false),
  purpose: tripPurpose('purpose'),
  extras: jsonb('extras').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
