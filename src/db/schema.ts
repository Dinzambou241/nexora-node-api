import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const streamCache = pgTable("stream_cache", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'movie' ou 'series'
  tmdbId: text("tmdb_id").notNull(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});
