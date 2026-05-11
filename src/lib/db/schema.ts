import { pgTable, uuid, text, boolean, date, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

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
