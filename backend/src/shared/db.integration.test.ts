import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from './db';

// Upsert/identity smoke test for the Prisma model (issue #3 acceptance).
// Needs a real Postgres, so it only runs when TEST_DATABASE_URL points
// at a dedicated test database (name must contain "test" — the suite
// refuses anything else so it can never touch dev/demo data). Example:
//   docker compose up -d db
//   TEST_DATABASE_URL=postgres://leaguelens:leaguelens-local-only@localhost:5432/leaguelens_test npm run test -w @leaguelens/backend
// Create the (empty) database first; the suite applies migrations itself.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)('Prisma identity rules (integration)', () => {
  let db: ReturnType<typeof createDb>;
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  const email = `schema-test-${runId}@example.test`;
  const createdPlayerIds: string[] = [];
  let userId = '';
  let sleeperConnectionId = '';
  let csvConnectionId = '';

  beforeAll(async () => {
    const url = new URL(testDatabaseUrl as string);
    const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
    if (!dbName.toLowerCase().includes('test')) {
      throw new Error(
        `Refusing to run integration tests against database "${dbName}": name must contain "test"`,
      );
    }
    const backendDir = join(__dirname, '..', '..');
    // Prisma 7 resolves schema/migrations/datasource from prisma.config.ts;
    // the explicit DATABASE_URL here wins over any local env file.
    await promisify(execFile)('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    });

    db = createDb(testDatabaseUrl);
    const user = await db.user.create({ data: { email, displayName: 'Schema Test' } });
    userId = user.id;
    const sleeper = await db.providerConnection.create({
      data: {
        userId,
        provider: 'sleeper',
        externalUserId: `1123581321345580544-${runId}`,
        handle: 'schema-test-handle',
      },
    });
    sleeperConnectionId = sleeper.id;
    const csv = await db.providerConnection.create({
      data: { userId, provider: 'csv', handle: `Office Old-Timers ${runId}` },
    });
    csvConnectionId = csv.id;
  }, 120_000);

  afterAll(async () => {
    // Player is a shared directory (no user cascade), so remove ours
    // explicitly; deleting the user cascades everything else (FR-7.2).
    if (createdPlayerIds.length > 0) {
      await db.player.deleteMany({ where: { id: { in: createdPlayerIds } } });
    }
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it('upserts a Sleeper league and team on their identity keys without duplicating', async () => {
    const externalLeagueId = `1180425791830556672-${runId}`;
    const leagueData = {
      connectionId: sleeperConnectionId,
      externalLeagueId,
      sport: 'nfl' as const,
      season: '2026',
      source: 'sleeper' as const,
    };
    const first = await db.league.upsert({
      where: {
        connectionId_externalLeagueId: { connectionId: sleeperConnectionId, externalLeagueId },
      },
      create: { ...leagueData, name: 'Sunday Funday' },
      update: { name: 'Sunday Funday (renamed)' },
    });
    const second = await db.league.upsert({
      where: {
        connectionId_externalLeagueId: { connectionId: sleeperConnectionId, externalLeagueId },
      },
      create: { ...leagueData, name: 'Sunday Funday' },
      update: { name: 'Sunday Funday (renamed)' },
    });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Sunday Funday (renamed)');
    expect(await db.league.count({ where: { externalLeagueId } })).toBe(1);

    const externalRosterId = '7';
    const teamData = { leagueId: first.id, externalRosterId, ownerName: 'Maya' };
    const teamFirst = await db.team.upsert({
      where: { leagueId_externalRosterId: { leagueId: first.id, externalRosterId } },
      create: { ...teamData, teamName: 'Hurts So Good', wins: 1 },
      update: { wins: 2 },
    });
    const teamSecond = await db.team.upsert({
      where: { leagueId_externalRosterId: { leagueId: first.id, externalRosterId } },
      create: { ...teamData, teamName: 'Hurts So Good', wins: 1 },
      update: { wins: 2 },
    });
    expect(teamSecond.id).toBe(teamFirst.id);
    expect(teamSecond.wins).toBe(2);
    expect(await db.team.count({ where: { leagueId: first.id, externalRosterId } })).toBe(1);
  });

  it('stores provider player IDs as exact strings beyond JS safe integers', async () => {
    const externalPlayerId = '11804257918305566721';
    expect(BigInt(externalPlayerId) > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    const where = { sport_externalPlayerId: { sport: 'nfl' as const, externalPlayerId } };
    const create = {
      sport: 'nfl' as const,
      externalPlayerId,
      fullName: `Test Player ${runId}`,
      position: 'RB',
      proTeam: 'SF',
    };
    const first = await db.player.upsert({ where, create, update: { injuryStatus: 'out' } });
    const second = await db.player.upsert({ where, create, update: { injuryStatus: 'out' } });
    createdPlayerIds.push(first.id);
    expect(second.id).toBe(first.id);
    expect(second.externalPlayerId).toBe(externalPlayerId);
    expect(second.injuryStatus).toBe('out');
    expect(await db.player.count({ where: { externalPlayerId } })).toBe(1);
  });

  it('enforces CSV identity via partial unique indexes without constraining Sleeper rows', async () => {
    const csvLeague = {
      connectionId: csvConnectionId,
      name: `Office Old-Timers ${runId}`,
      sport: 'nfl' as const,
      season: '2026',
      source: 'csv' as const,
    };
    const league = await db.league.create({ data: csvLeague });
    await expect(db.league.create({ data: csvLeague })).rejects.toMatchObject({ code: 'P2002' });

    const team = await db.team.create({
      data: { leagueId: league.id, teamName: 'Spreadsheet Kings', ownerName: 'Maya' },
    });
    await expect(
      db.team.create({
        data: { leagueId: league.id, teamName: 'Spreadsheet Kings', ownerName: 'Other' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(team.externalRosterId).toBeNull();

    // Negative control: Sleeper leagues/teams may share names — only the
    // external IDs key them, so the partial indexes must not fire.
    const sharedName = `Shared Name ${runId}`;
    const mkSleeperLeague = (suffix: string) =>
      db.league.create({
        data: {
          connectionId: sleeperConnectionId,
          externalLeagueId: `999000111-${suffix}-${runId}`,
          name: sharedName,
          sport: 'nfl',
          season: '2026',
          source: 'sleeper',
        },
      });
    const leagueA = await mkSleeperLeague('a');
    await mkSleeperLeague('b');
    const mkSleeperTeam = (rosterId: string) =>
      db.team.create({
        data: {
          leagueId: leagueA.id,
          externalRosterId: rosterId,
          teamName: 'Same Name FC',
          ownerName: 'Someone',
        },
      });
    await mkSleeperTeam('1');
    await mkSleeperTeam('2');
    expect(await db.team.count({ where: { leagueId: leagueA.id, teamName: 'Same Name FC' } })).toBe(
      2,
    );
  });

  it('allows only one open alert per (team, type, player/slot)', async () => {
    const league = await db.league.create({
      data: {
        connectionId: sleeperConnectionId,
        externalLeagueId: `alert-league-${runId}`,
        name: `Alert League ${runId}`,
        sport: 'nfl',
        season: '2026',
        source: 'sleeper',
      },
    });
    const team = await db.team.create({
      data: {
        leagueId: league.id,
        externalRosterId: '3',
        teamName: 'Alert Team',
        ownerName: 'Maya',
        isMine: true,
      },
    });
    const player = await db.player.create({
      data: { sport: 'nfl', fullName: `Hurt Player ${runId}`, position: 'RB' },
    });
    createdPlayerIds.push(player.id);

    const alertData = {
      userId,
      teamId: team.id,
      type: 'injured_starter' as const,
      severity: 'high' as const,
      playerId: player.id,
      message: 'Starter is Out.',
    };
    const open = await db.alert.create({ data: alertData });
    await expect(db.alert.create({ data: alertData })).rejects.toMatchObject({ code: 'P2002' });

    await db.alert.update({
      where: { id: open.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });
    const reopened = await db.alert.create({ data: alertData });
    expect(reopened.id).not.toBe(open.id);
    expect(await db.alert.count({ where: { teamId: team.id, type: 'injured_starter' } })).toBe(2);
  });

  it('cascades a disconnect to cached league data but keeps the shared player directory', async () => {
    const connection = await db.providerConnection.create({
      data: {
        userId,
        provider: 'sleeper',
        externalUserId: `disconnect-${runId}`,
        handle: 'soon-gone',
      },
    });
    const league = await db.league.create({
      data: {
        connectionId: connection.id,
        externalLeagueId: `disconnect-league-${runId}`,
        name: 'Short Lived',
        sport: 'nfl',
        season: '2026',
        source: 'sleeper',
      },
    });
    const team = await db.team.create({
      data: {
        leagueId: league.id,
        externalRosterId: '1',
        teamName: 'Doomed',
        ownerName: 'Maya',
        isMine: true,
      },
    });
    const player = await db.player.create({
      data: { sport: 'nfl', fullName: `Survivor ${runId}`, position: 'QB' },
    });
    createdPlayerIds.push(player.id);
    await db.rosterSlot.create({
      data: { teamId: team.id, playerId: player.id, slotType: 'starter', slotPosition: 'QB' },
    });
    // Empty starter slots (null playerId) coexist on one team.
    await db.rosterSlot.create({
      data: { teamId: team.id, slotType: 'starter', slotPosition: 'RB', slotIndex: 1 },
    });
    await db.rosterSlot.create({
      data: { teamId: team.id, slotType: 'starter', slotPosition: 'RB', slotIndex: 2 },
    });

    await db.providerConnection.delete({ where: { id: connection.id } });
    expect(await db.league.count({ where: { id: league.id } })).toBe(0);
    expect(await db.team.count({ where: { id: team.id } })).toBe(0);
    expect(await db.rosterSlot.count({ where: { teamId: team.id } })).toBe(0);
    expect(await db.player.count({ where: { id: player.id } })).toBe(1);
  });
});
