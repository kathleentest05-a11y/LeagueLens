-- CreateEnum
CREATE TYPE "sport" AS ENUM ('nfl', 'nba');

-- CreateEnum
CREATE TYPE "provider" AS ENUM ('sleeper', 'csv');

-- CreateEnum
CREATE TYPE "connection_status" AS ENUM ('connected', 'syncing', 'error');

-- CreateEnum
CREATE TYPE "slot_type" AS ENUM ('starter', 'bench', 'ir');

-- CreateEnum
CREATE TYPE "injury_status" AS ENUM ('healthy', 'questionable', 'doubtful', 'out', 'ir');

-- CreateEnum
CREATE TYPE "status_source" AS ENUM ('sleeper', 'csv', 'manual');

-- CreateEnum
CREATE TYPE "matchup_state" AS ENUM ('pre', 'live', 'final');

-- CreateEnum
CREATE TYPE "alert_type" AS ENUM ('injured_starter', 'bye_week_starter', 'empty_starter_slot', 'lineup_lock_approaching', 'questionable_starter', 'sync_stale');

-- CreateEnum
CREATE TYPE "alert_severity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "alert_status" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "csv_import_status" AS ENUM ('preview', 'confirmed', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "firebase_uid" TEXT,
    "email" TEXT NOT NULL,
    "display_name" TEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'firebase',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "provider" NOT NULL,
    "external_user_id" TEXT,
    "handle" TEXT NOT NULL,
    "status" "connection_status" NOT NULL DEFAULT 'connected',
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "external_league_id" TEXT,
    "name" TEXT NOT NULL,
    "sport" "sport" NOT NULL,
    "season" TEXT NOT NULL,
    "source" "provider" NOT NULL,
    "scoring_settings" JSONB,
    "current_week" INTEGER NOT NULL DEFAULT 1,
    "total_teams" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "external_roster_id" TEXT,
    "external_owner_id" TEXT,
    "team_name" TEXT NOT NULL,
    "owner_name" TEXT NOT NULL,
    "is_mine" BOOLEAN NOT NULL DEFAULT false,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "points_for" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points_against" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "sport" "sport" NOT NULL,
    "external_player_id" TEXT,
    "full_name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "pro_team" TEXT,
    "bye_week" INTEGER,
    "injury_status" "injury_status" NOT NULL DEFAULT 'healthy',
    "status_source" "status_source" NOT NULL DEFAULT 'sleeper',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roster_slots" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "player_id" TEXT,
    "slot_type" "slot_type" NOT NULL,
    "slot_position" TEXT NOT NULL,
    "slot_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matchups" (
    "id" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "external_matchup_id" TEXT,
    "home_team_id" TEXT NOT NULL,
    "away_team_id" TEXT,
    "home_score" DOUBLE PRECISION,
    "away_score" DOUBLE PRECISION,
    "state" "matchup_state" NOT NULL DEFAULT 'pre',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matchups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "type" "alert_type" NOT NULL,
    "severity" "alert_severity" NOT NULL,
    "player_id" TEXT,
    "slot_position" TEXT,
    "message" TEXT NOT NULL,
    "status" "alert_status" NOT NULL DEFAULT 'open',
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_imports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "league_id" TEXT,
    "file_name" TEXT NOT NULL,
    "status" "csv_import_status" NOT NULL DEFAULT 'preview',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "validation_errors" JSONB,
    "imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "provider_connections_user_id_idx" ON "provider_connections"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "provider_connections_user_id_provider_external_user_id_key" ON "provider_connections"("user_id", "provider", "external_user_id");

-- CreateIndex
CREATE INDEX "leagues_connection_id_idx" ON "leagues"("connection_id");

-- CreateIndex
CREATE INDEX "leagues_sport_season_idx" ON "leagues"("sport", "season");

-- CreateIndex
CREATE UNIQUE INDEX "leagues_connection_id_external_league_id_key" ON "leagues"("connection_id", "external_league_id");

-- CreateIndex
CREATE INDEX "teams_league_id_idx" ON "teams"("league_id");

-- CreateIndex
CREATE INDEX "teams_league_id_is_mine_idx" ON "teams"("league_id", "is_mine");

-- CreateIndex
CREATE UNIQUE INDEX "teams_league_id_external_roster_id_key" ON "teams"("league_id", "external_roster_id");

-- CreateIndex
CREATE INDEX "players_sport_full_name_idx" ON "players"("sport", "full_name");

-- CreateIndex
CREATE UNIQUE INDEX "players_sport_external_player_id_key" ON "players"("sport", "external_player_id");

-- CreateIndex
CREATE INDEX "roster_slots_team_id_idx" ON "roster_slots"("team_id");

-- CreateIndex
CREATE INDEX "roster_slots_player_id_idx" ON "roster_slots"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "roster_slots_team_id_player_id_key" ON "roster_slots"("team_id", "player_id");

-- CreateIndex
CREATE INDEX "matchups_league_id_week_idx" ON "matchups"("league_id", "week");

-- CreateIndex
CREATE INDEX "matchups_home_team_id_idx" ON "matchups"("home_team_id");

-- CreateIndex
CREATE INDEX "matchups_away_team_id_idx" ON "matchups"("away_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "matchups_league_id_week_external_matchup_id_key" ON "matchups"("league_id", "week", "external_matchup_id");

-- CreateIndex
CREATE INDEX "alerts_user_id_status_idx" ON "alerts"("user_id", "status");

-- CreateIndex
CREATE INDEX "alerts_team_id_status_idx" ON "alerts"("team_id", "status");

-- CreateIndex
CREATE INDEX "csv_imports_user_id_idx" ON "csv_imports"("user_id");

-- CreateIndex
CREATE INDEX "csv_imports_league_id_idx" ON "csv_imports"("league_id");

-- AddForeignKey
ALTER TABLE "provider_connections" ADD CONSTRAINT "provider_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "provider_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_slots" ADD CONSTRAINT "roster_slots_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_home_team_id_fkey" FOREIGN KEY ("home_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchups" ADD CONSTRAINT "matchups_away_team_id_fkey" FOREIGN KEY ("away_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_imports" ADD CONSTRAINT "csv_imports_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Partial unique indexes (hand-added; Prisma cannot express partial
-- indexes, so these exist only here — see schema.prisma header and
-- TDD 6.2). Postgres treats NULLs as distinct in the unique indexes
-- above, so CSV rows need their own identity enforcement.

-- CSV league identity: (userId via connection, leagueName, sport,
-- season) from TDD 6.1 / FR-5.3. Scoped to rows with no provider league
-- ID, so two Sleeper leagues may still share a name.
CREATE UNIQUE INDEX "leagues_csv_identity_key" ON "leagues"("connection_id", "name", "sport", "season") WHERE "external_league_id" IS NULL;

-- CSV team identity: (leagueId, teamName) for teams with no provider
-- roster ID. Sleeper team names are user-chosen and may repeat, so this
-- must not apply to them.
CREATE UNIQUE INDEX "teams_csv_identity_key" ON "teams"("league_id", "team_name") WHERE "external_roster_id" IS NULL;

-- One open alert per (team, type, player/slot) (PRD Section 9
-- anti-spam). Acknowledged still counts as open; resolved alerts keep
-- their history and stop blocking a fresh alert for the same condition.
CREATE UNIQUE INDEX "alerts_one_open_per_team_type_player_slot_key" ON "alerts"("team_id", "type", COALESCE("player_id", ''), COALESCE("slot_position", '')) WHERE "status" IN ('open', 'acknowledged');
