import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { App, Category, Repository, DownloadTask, VersionInfo } from '@/lib/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Schema & Version Constants
const DATABASE_NAME = 'sheen_catalog.db';
const MIGRATION_FLAG_KEY = 'sheen:sqlite:migrated_v1';

class SQLiteService {
  private db: any = null;
  private isInitialized = false;

  // Web fallback in-memory cache
  private webDb: {
    repositories: Map<string, Repository>;
    apps: Map<string, App>;
    versions: Map<string, VersionInfo[]>;
    categories: Map<string, Category>;
    downloads: Map<string, DownloadTask>;
    favorites: Set<string>;
    searchHistory: Array<{ term: string; timestamp: number }>;
    signatures: Map<string, any>;
  } = {
    repositories: new Map(),
    apps: new Map(),
    versions: new Map(),
    categories: new Map(),
    downloads: new Map(),
    favorites: new Set(),
    searchHistory: [],
    signatures: new Map(),
  };

  constructor() {
    // Lazy initialisation will happen in init()
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    const startTime = Date.now();
    try {
      if (Platform.OS !== 'web') {
        // Native SQLite Initialization
        this.db = await SQLite.openDatabaseAsync(DATABASE_NAME);
        await this.createTablesNative();
      } else {
        // Web Environment Fallback - Load memory cache from AsyncStorage if available
        await this.loadWebDbFromStorage();
      }
      this.isInitialized = true;
      const duration = Date.now() - startTime;
      this.log(`Database initialized successfully in ${duration}ms (Platform: ${Platform.OS})`);
    } catch (error) {
      console.error('[SQLiteService] Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTablesNative(): Promise<void> {
    const queries = [
      // Enable foreign keys
      `PRAGMA foreign_keys = ON;`,

      // Repositories Table
      `CREATE TABLE IF NOT EXISTS Repositories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        priority INTEGER DEFAULT 999,
        lastSyncAt INTEGER,
        lastSyncError TEXT,
        metadata TEXT
      );`,

      // Apps Table
      `CREATE TABLE IF NOT EXISTS Apps (
        id TEXT PRIMARY KEY,
        packageName TEXT NOT NULL,
        name TEXT NOT NULL,
        developer TEXT NOT NULL,
        source TEXT NOT NULL,
        repositoryId TEXT NOT NULL,
        description TEXT NOT NULL,
        shortDescription TEXT,
        iconUrl TEXT,
        iconBlurhash TEXT,
        category TEXT,
        categoryId TEXT,
        color TEXT,
        letter TEXT,
        rating REAL,
        downloads INTEGER,
        license TEXT,
        sourceRepo TEXT,
        homepage TEXT,
        issueTracker TEXT,
        website TEXT,
        added INTEGER,
        lastUpdated INTEGER,
        antiFeatures TEXT,
        permissions TEXT,
        cachedAt INTEGER,
        etag TEXT,
        FOREIGN KEY (repositoryId) REFERENCES Repositories (id) ON DELETE CASCADE
      );`,

      // Versions Table
      `CREATE TABLE IF NOT EXISTS Versions (
        appId TEXT NOT NULL,
        versionName TEXT NOT NULL,
        versionCode INTEGER NOT NULL,
        added INTEGER NOT NULL,
        sizeBytes INTEGER,
        apkUrl TEXT,
        changelog TEXT,
        signingKeyId TEXT,
        minSdk INTEGER,
        targetSdk INTEGER,
        permissions TEXT,
        nativeCode TEXT,
        fileName TEXT,
        PRIMARY KEY (appId, versionCode),
        FOREIGN KEY (appId) REFERENCES Apps (id) ON DELETE CASCADE
      );`,

      // Categories Table
      `CREATE TABLE IF NOT EXISTS Categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        color TEXT NOT NULL,
        appCount INTEGER DEFAULT 0
      );`,

      // Screenshots Table
      `CREATE TABLE IF NOT EXISTS Screenshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        appId TEXT NOT NULL,
        url TEXT NOT NULL,
        blurhash TEXT,
        FOREIGN KEY (appId) REFERENCES Apps (id) ON DELETE CASCADE
      );`,

      // Favorites Table
      `CREATE TABLE IF NOT EXISTS Favorites (
        appId TEXT PRIMARY KEY,
        addedAt INTEGER NOT NULL,
        queued INTEGER DEFAULT 0
      );`,

      // Downloads Table
      `CREATE TABLE IF NOT EXISTS Downloads (
        id TEXT PRIMARY KEY,
        appId TEXT NOT NULL,
        packageName TEXT NOT NULL,
        name TEXT NOT NULL,
        developer TEXT NOT NULL,
        versionName TEXT NOT NULL,
        versionCode INTEGER NOT NULL,
        apkUrl TEXT NOT NULL,
        fileUri TEXT NOT NULL,
        totalBytes INTEGER DEFAULT 0,
        downloadedBytes INTEGER DEFAULT 0,
        speedBps REAL DEFAULT 0,
        status TEXT NOT NULL,
        error TEXT,
        queuedAt INTEGER NOT NULL,
        startedAt INTEGER,
        completedAt INTEGER,
        batchId TEXT,
        repositoryId TEXT NOT NULL,
        iconUrl TEXT
      );`,

      // Search History Table
      `CREATE TABLE IF NOT EXISTS SearchHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT NOT NULL UNIQUE,
        timestamp INTEGER NOT NULL
      );`,

      // App Signatures Table
      `CREATE TABLE IF NOT EXISTS AppSignatures (
        packageName TEXT PRIMARY KEY,
        certificateFingerprint TEXT NOT NULL,
        installedAt INTEGER NOT NULL,
        lastVerifiedAt INTEGER NOT NULL,
        repositorySource TEXT
      );`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_apps_package_name ON Apps (packageName);`,
      `CREATE INDEX IF NOT EXISTS idx_apps_name ON Apps (name);`,
      `CREATE INDEX IF NOT EXISTS idx_apps_developer ON Apps (developer);`,
      `CREATE INDEX IF NOT EXISTS idx_apps_category_id ON Apps (categoryId);`,
      `CREATE INDEX IF NOT EXISTS idx_apps_repository_id ON Apps (repositoryId);`,
      `CREATE INDEX IF NOT EXISTS idx_apps_license ON Apps (license);`,
      `CREATE INDEX IF NOT EXISTS idx_apps_last_updated ON Apps (lastUpdated);`
    ];

    for (const q of queries) {
      await this.db.execAsync(q);
    }
  }

  // Helper logger
  private log(message: string, ...args: any[]) {
  }

  // ─── WEB PERSISTENCE HELPER ───────────────────────────────────────────────
  private async loadWebDbFromStorage(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem('sheen:web:sqlite_emul');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.repositories) this.webDb.repositories = new Map(parsed.repositories);
        if (parsed.apps) this.webDb.apps = new Map(parsed.apps);
        if (parsed.versions) this.webDb.versions = new Map(parsed.versions);
        if (parsed.categories) this.webDb.categories = new Map(parsed.categories);
        if (parsed.downloads) this.webDb.downloads = new Map(parsed.downloads);
        if (parsed.favorites) this.webDb.favorites = new Set(parsed.favorites);
        if (parsed.searchHistory) this.webDb.searchHistory = parsed.searchHistory;
        if (parsed.signatures) this.webDb.signatures = new Map(parsed.signatures);
      }
    } catch (e) {
      this.log('Failed to load Web DB mock from storage:', e);
    }
  }

  private async saveWebDbToStorage(): Promise<void> {
    try {
      const serialized = {
        repositories: Array.from(this.webDb.repositories.entries()),
        apps: Array.from(this.webDb.apps.entries()),
        versions: Array.from(this.webDb.versions.entries()),
        categories: Array.from(this.webDb.categories.entries()),
        downloads: Array.from(this.webDb.downloads.entries()),
        favorites: Array.from(this.webDb.favorites.values()),
        searchHistory: this.webDb.searchHistory,
        signatures: Array.from(this.webDb.signatures.entries()),
      };
      await AsyncStorage.setItem('sheen:web:sqlite_emul', JSON.stringify(serialized));
    } catch (e) {
      this.log('Failed to save Web DB mock to storage:', e);
    }
  }

  // ─── REPOSITORY SYNC FLOW ──────────────────────────────────────────────────
  async syncCatalogData(repos: Repository[], apps: App[], categories: Category[]): Promise<{
    inserted: number;
    updated: number;
    removed: number;
    duration: number;
  }> {
    await this.init();
    const startTime = Date.now();

    let inserted = 0;
    let updated = 0;
    let removed = 0;

    if (Platform.OS !== 'web') {
      // ─── Native Sync Transaction ───
      try {
        // Fetch current app IDs in SQLite to compute removed/updated counts
        const existingAppRows = await this.db.getAllAsync('SELECT id, lastUpdated FROM Apps');
        const existingAppsMap = new Map<string, number>();
        for (const row of existingAppRows as any[]) {
          existingAppsMap.set(row.id, row.lastUpdated);
        }

        const incomingAppIds = new Set(apps.map(a => a.id));

        // Start transaction
        await this.db.execAsync('BEGIN TRANSACTION;');

        // 1. Sync Repositories
        for (const repo of repos) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO Repositories (id, name, type, url, enabled, priority, lastSyncAt, lastSyncError, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              repo.id,
              repo.name,
              repo.type,
              repo.url,
              repo.enabled ? 1 : 0,
              repo.priority,
              repo.lastSyncAt || null,
              repo.lastSyncError || null,
              repo.metadata ? JSON.stringify(repo.metadata) : null,
            ]
          );
        }

        // 2. Sync Categories
        for (const cat of categories) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO Categories (id, name, icon, color, appCount)
             VALUES (?, ?, ?, ?, ?)`,
            [cat.id, cat.name, cat.icon || null, cat.color, cat.appCount]
          );
        }

        // 3. Sync Apps & Versions
        for (const app of apps) {
          const currentLastUpdated = existingAppsMap.get(app.id);

          if (currentLastUpdated === undefined) {
            inserted++;
          } else if (currentLastUpdated !== app.lastUpdated) {
            updated++;
          }

          // Insert or update App row
          await this.db.runAsync(
            `INSERT OR REPLACE INTO Apps (
              id, packageName, name, developer, source, repositoryId, description, shortDescription,
              iconUrl, iconBlurhash, category, categoryId, color, letter, rating, downloads, license,
              sourceRepo, homepage, issueTracker, website, added, lastUpdated, antiFeatures, permissions, cachedAt, etag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              app.id,
              app.packageName,
              app.name,
              app.developer,
              app.source,
              app.repositoryId,
              app.description,
              app.shortDescription || null,
              app.iconUrl || null,
              app.iconBlurhash || null,
              app.category || null,
              app.categoryId || null,
              app.color || null,
              app.letter || null,
              app.rating || null,
              app.downloads || null,
              app.license || null,
              app.sourceRepo || null,
              app.homepage || null,
              app.issueTracker || null,
              app.website || null,
              app.added,
              app.lastUpdated,
              app.antiFeatures ? JSON.stringify(app.antiFeatures) : null,
              app.permissions ? JSON.stringify(app.permissions) : null,
              app.cachedAt,
              app.etag || null,
            ]
          );

          // Clear existing versions for this app to insert the new ones
          await this.db.runAsync('DELETE FROM Versions WHERE appId = ?', [app.id]);

          // Insert Versions
          if (app.versions && app.versions.length > 0) {
            for (const ver of app.versions) {
              await this.db.runAsync(
                `INSERT INTO Versions (
                  appId, versionName, versionCode, added, sizeBytes, apkUrl, changelog, signingKeyId, minSdk, targetSdk, permissions, nativeCode, fileName
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  app.id,
                  ver.versionName,
                  ver.versionCode,
                  ver.added,
                  ver.sizeBytes || null,
                  ver.apkUrl || null,
                  ver.changelog || null,
                  ver.signingKeyId || null,
                  ver.minSdk || null,
                  ver.targetSdk || null,
                  ver.permissions ? JSON.stringify(ver.permissions) : null,
                  ver.nativeCode ? JSON.stringify(ver.nativeCode) : null,
                  ver.fileName || null,
                ]
              );
            }
          }

          // Clear & Sync Screenshots
          await this.db.runAsync('DELETE FROM Screenshots WHERE appId = ?', [app.id]);
          if (app.screenshotUrls && app.screenshotUrls.length > 0) {
            for (let i = 0; i < app.screenshotUrls.length; i++) {
              const url = app.screenshotUrls[i];
              const bh = app.screenshotBlurhashes ? app.screenshotBlurhashes[i] : null;
              await this.db.runAsync(
                `INSERT INTO Screenshots (appId, url, blurhash) VALUES (?, ?, ?)`,
                [app.id, url, bh]
              );
            }
          }
        }

        // 4. Remove defunct Apps no longer in synced repositories
        // Only delete apps if we synced F-Droid or Izzy successfully
        const repositoryIdsSynced = new Set(repos.map(r => r.id));
        const deletedAppRows = await this.db.getAllAsync(
          `SELECT id FROM Apps WHERE repositoryId IN (${Array.from(repositoryIdsSynced).map(() => '?').join(',')})`,
          Array.from(repositoryIdsSynced)
        );

        for (const row of deletedAppRows as any[]) {
          if (!incomingAppIds.has(row.id)) {
            removed++;
            await this.db.runAsync('DELETE FROM Apps WHERE id = ?', [row.id]);
          }
        }

        await this.db.execAsync('COMMIT;');
      } catch (error) {
        await this.db.execAsync('ROLLBACK;');
        console.error('[SQLiteService] Sync transaction failed:', error);
        throw error;
      }
    } else {
      // ─── Web Sync Simulation ───
      for (const repo of repos) {
        this.webDb.repositories.set(repo.id, { ...repo });
      }
      for (const cat of categories) {
        this.webDb.categories.set(cat.id, { ...cat });
      }

      const existingApps = Array.from(this.webDb.apps.values());
      const incomingIds = new Set(apps.map(a => a.id));

      for (const app of apps) {
        const existing = this.webDb.apps.get(app.id);
        if (!existing) {
          inserted++;
        } else if (existing.lastUpdated !== app.lastUpdated) {
          updated++;
        }
        this.webDb.apps.set(app.id, { ...app });
        this.webDb.versions.set(app.id, [...(app.versions || [])]);
      }

      // Check removed
      const syncedRepoIds = new Set(repos.map(r => r.id));
      for (const existing of existingApps) {
        if (syncedRepoIds.has(existing.repositoryId) && !incomingIds.has(existing.id)) {
          removed++;
          this.webDb.apps.delete(existing.id);
          this.webDb.versions.delete(existing.id);
        }
      }

      await this.saveWebDbToStorage();
    }

    const duration = Date.now() - startTime;
    this.log(`Sync completed in ${duration}ms. Log: Apps inserted: ${inserted}, Apps updated: ${updated}, Apps removed: ${removed}`);

    return { inserted, updated, removed, duration };
  }

  // ─── APP QUERIES & OPTIMIZED FILTERING ─────────────────────────────────────
  async getApps(filters: {
    repositoryId?: string;
    categoryId?: string;
    license?: string;
    targetSdk?: number;
    minSdk?: number;
    updatedSince?: number;
    developer?: string;
    query?: string;
    limit?: number;
    offset?: number;
    sort?: 'recommended' | 'recently_updated' | 'newly_added' | 'trending' | 'most_downloaded' | 'highest_rated' | 'a_z' | 'z_a' | 'smallest_size' | 'largest_size';
  } = {}): Promise<App[]> {
    await this.init();
    const startTime = Date.now();

    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;

    let appsList: App[] = [];

    if (Platform.OS !== 'web') {
      // ─── Native SQL Fetch with Join ───
      let sql = `SELECT id, packageName, name, developer, source, repositoryId, shortDescription, iconUrl, iconBlurhash, category, categoryId, color, letter, rating, downloads, license, sourceRepo, homepage, issueTracker, website, added, lastUpdated, antiFeatures, permissions, defaultVersion, apkUrl, apkSize, minSdk, targetSdk, hash, hashType, versionCount, compatibility, metadata, isEditorsChoice FROM Apps WHERE 1=1`;
      const params: any[] = [];

      if (filters.repositoryId) {
        sql += ` AND repositoryId = ?`;
        params.push(filters.repositoryId);
      }
      if (filters.categoryId) {
        sql += ` AND categoryId = ?`;
        params.push(filters.categoryId);
      }
      if (filters.license) {
        sql += ` AND license LIKE ?`;
        params.push(`%${filters.license}%`);
      }
      if (filters.targetSdk) {
        sql += ` AND targetSdk = ?`;
        params.push(filters.targetSdk);
      }
      if (filters.minSdk) {
        sql += ` AND minSdk >= ?`;
        params.push(filters.minSdk);
      }
      if (filters.updatedSince) {
        sql += ` AND lastUpdated >= ?`;
        params.push(filters.updatedSince);
      }
      if (filters.developer) {
        sql += ` AND developer = ?`;
        params.push(filters.developer);
      }
      if (filters.query) {
        const q = `%${filters.query.trim().toLowerCase()}%`;
        sql += ` AND (LOWER(name) LIKE ? OR LOWER(developer) LIKE ? OR LOWER(packageName) LIKE ? OR LOWER(description) LIKE ?)`;
        params.push(q, q, q, q);
      }

      // Sort logic
      if (filters.sort) {
        switch (filters.sort) {
          case 'recently_updated':
            sql += ` ORDER BY lastUpdated DESC`;
            break;
          case 'newly_added':
            sql += ` ORDER BY added DESC`;
            break;
          case 'trending':
            sql += ` ORDER BY downloads DESC, lastUpdated DESC`;
            break;
          case 'most_downloaded':
            sql += ` ORDER BY downloads DESC`;
            break;
          case 'highest_rated':
            sql += ` ORDER BY rating DESC`;
            break;
          case 'a_z':
            sql += ` ORDER BY name ASC`;
            break;
          case 'z_a':
            sql += ` ORDER BY name DESC`;
            break;
          default:
            sql += ` ORDER BY rating DESC, lastUpdated DESC`; // recommended
        }
      }

      sql += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const rows = await this.db.getAllAsync(sql, params);
      for (const row of rows as any[]) {
        const app = await this.reconstructAppFromRow(row);
        if (app) appsList.push(app);
      }
    } else {
      // ─── Web Simulation Fetch ───
      let list = Array.from(this.webDb.apps.values()).map(a => ({
        ...a,
        description: '',
        screenshotUrls: undefined
      }));

      if (filters.repositoryId) {
        list = list.filter(a => a.repositoryId === filters.repositoryId);
      }
      if (filters.categoryId) {
        list = list.filter(a => a.categoryId === filters.categoryId);
      }
      if (filters.license) {
        list = list.filter(a => a.license?.toLowerCase().includes(filters.license!.toLowerCase()));
      }
      if (filters.developer) {
        list = list.filter(a => a.developer === filters.developer);
      }
      if (filters.query) {
        const q = filters.query.trim().toLowerCase();
        list = list.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.developer.toLowerCase().includes(q) ||
          a.packageName.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
        );
      }

      // Sorting simulation
      if (filters.sort) {
        switch (filters.sort) {
          case 'recently_updated':
            list.sort((a, b) => b.lastUpdated - a.lastUpdated);
            break;
          case 'newly_added':
            list.sort((a, b) => b.added - a.added);
            break;
          case 'trending':
            list.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0) || b.lastUpdated - a.lastUpdated);
            break;
          case 'most_downloaded':
            list.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
            break;
          case 'highest_rated':
            list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
            break;
          case 'a_z':
            list.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'z_a':
            list.sort((a, b) => b.name.localeCompare(a.name));
            break;
          default:
            list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.lastUpdated - a.lastUpdated);
        }
      }

      appsList = list.slice(offset, offset + limit);
    }

    const duration = Date.now() - startTime;
    this.log(`getApps queried in ${duration}ms (Params: ${JSON.stringify(filters)}, Results: ${appsList.length})`);
    return appsList;
  }

  async getAppById(id: string): Promise<App | null> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync('SELECT * FROM Apps WHERE id = ?', [id]);
      if (rows.length === 0) return null;
      return this.reconstructAppFromRow(rows[0]);
    } else {
      return this.webDb.apps.get(id) || null;
    }
  }

  async getAppByPackage(packageName: string): Promise<App | null> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync('SELECT * FROM Apps WHERE packageName = ? LIMIT 1', [packageName]);
      if (rows.length === 0) return null;
      return this.reconstructAppFromRow(rows[0]);
    } else {
      const found = Array.from(this.webDb.apps.values()).find(a => a.packageName === packageName);
      return found || null;
    }
  }

  // Map database row into type-safe App object with versions, screenshots, etc.
  private async reconstructAppFromRow(row: any): Promise<App | null> {
    if (!row) return null;

    // Fetch versions
    const verRows = await this.db.getAllAsync(
      'SELECT * FROM Versions WHERE appId = ? ORDER BY versionCode DESC',
      [row.id]
    );

    const versions: VersionInfo[] = verRows.map((v: any) => ({
      versionName: v.versionName,
      versionCode: v.versionCode,
      added: v.added,
      sizeBytes: v.sizeBytes || undefined,
      apkUrl: v.apkUrl || undefined,
      changelog: v.changelog || undefined,
      signingKeyId: v.signingKeyId || undefined,
      minSdk: v.minSdk || undefined,
      targetSdk: v.targetSdk || undefined,
      permissions: v.permissions ? JSON.parse(v.permissions) : undefined,
      nativeCode: v.nativeCode ? JSON.parse(v.nativeCode) : undefined,
      fileName: v.fileName || undefined,
    }));

    // Fetch screenshots
    const scRows = await this.db.getAllAsync('SELECT url, blurhash FROM Screenshots WHERE appId = ?', [row.id]);
    const screenshotUrls = scRows.map((s: any) => s.url);
    const screenshotBlurhashes = scRows.map((s: any) => s.blurhash);

    const currentVersion: VersionInfo = versions[0] || {
      versionName: '1.0.0',
      versionCode: 1,
      added: row.added || Date.now(),
    };

    return {
      id: row.id,
      packageName: row.packageName,
      name: row.name,
      developer: row.developer,
      source: row.source,
      repositoryId: row.repositoryId,
      description: row.description,
      shortDescription: row.shortDescription || undefined,
      iconUrl: row.iconUrl || undefined,
      iconBlurhash: row.iconBlurhash || undefined,
      category: row.category || undefined,
      categoryId: row.categoryId || undefined,
      color: row.color || undefined,
      letter: row.letter || undefined,
      rating: row.rating || undefined,
      downloads: row.downloads || undefined,
      license: row.license || undefined,
      sourceRepo: row.sourceRepo || undefined,
      homepage: row.homepage || undefined,
      issueTracker: row.issueTracker || undefined,
      website: row.website || undefined,
      added: row.added,
      lastUpdated: row.lastUpdated,
      antiFeatures: row.antiFeatures ? JSON.parse(row.antiFeatures) : undefined,
      permissions: row.permissions ? JSON.parse(row.permissions) : undefined,
      cachedAt: row.cachedAt,
      etag: row.etag || undefined,
      currentVersion,
      versions,
      screenshotUrls,
      screenshotBlurhashes,
    };
  }

  // ─── CATEGORY & REPOSITORY QUERIES ─────────────────────────────────────────
  async getCategories(): Promise<Category[]> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync('SELECT * FROM Categories ORDER BY appCount DESC, name ASC');
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        icon: r.icon || undefined,
        color: r.color,
        appCount: r.appCount,
      }));
    } else {
      return Array.from(this.webDb.categories.values()).sort((a, b) => b.appCount - a.appCount || a.name.localeCompare(b.name));
    }
  }

  async getRepositories(): Promise<Repository[]> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync('SELECT * FROM Repositories ORDER BY priority ASC');
      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        type: r.type as any,
        url: r.url,
        enabled: r.enabled === 1,
        priority: r.priority,
        lastSyncAt: r.lastSyncAt || undefined,
        lastSyncError: r.lastSyncError || undefined,
        metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      }));
    } else {
      return Array.from(this.webDb.repositories.values()).sort((a, b) => a.priority - b.priority);
    }
  }

  async saveRepository(repo: Repository): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO Repositories (id, name, type, url, enabled, priority, lastSyncAt, lastSyncError, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          repo.id,
          repo.name,
          repo.type,
          repo.url,
          repo.enabled ? 1 : 0,
          repo.priority,
          repo.lastSyncAt || null,
          repo.lastSyncError || null,
          repo.metadata ? JSON.stringify(repo.metadata) : null,
        ]
      );
    } else {
      this.webDb.repositories.set(repo.id, { ...repo });
      await this.saveWebDbToStorage();
    }
  }

  async updateRepositoryStatus(id: string, updates: Partial<Repository>): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      let setClause = '';
      const params: any[] = [];
      const entries = Object.entries(updates);
      for (let i = 0; i < entries.length; i++) {
        const [k, v] = entries[i];
        if (k === 'enabled') {
          setClause += `enabled = ?`;
          params.push(v ? 1 : 0);
        } else if (k === 'lastSyncAt') {
          setClause += `lastSyncAt = ?`;
          params.push(v);
        } else if (k === 'lastSyncError') {
          setClause += `lastSyncError = ?`;
          params.push(v);
        } else if (k === 'priority') {
          setClause += `priority = ?`;
          params.push(v);
        } else if (k === 'metadata') {
          setClause += `metadata = ?`;
          params.push(JSON.stringify(v));
        } else if (k === 'name') {
          setClause += `name = ?`;
          params.push(v);
        } else if (k === 'url') {
          setClause += `url = ?`;
          params.push(v);
        }
        if (i < entries.length - 1) setClause += ', ';
      }

      if (setClause) {
        params.push(id);
        await this.db.runAsync(`UPDATE Repositories SET ${setClause} WHERE id = ?`, params);
      }
    } else {
      const repo = this.webDb.repositories.get(id);
      if (repo) {
        this.webDb.repositories.set(id, { ...repo, ...updates });
        await this.saveWebDbToStorage();
      }
    }
  }

  async removeRepository(id: string): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync('DELETE FROM Repositories WHERE id = ?', [id]);
    } else {
      this.webDb.repositories.delete(id);
      // Delete cascade simulation
      for (const [appId, app] of this.webDb.apps.entries()) {
        if (app.repositoryId === id) {
          this.webDb.apps.delete(appId);
          this.webDb.versions.delete(appId);
        }
      }
      await this.saveWebDbToStorage();
    }
  }

  // ─── FAVORITES (BASKET) ────────────────────────────────────────────────────
  async getFavorites(): Promise<string[]> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync('SELECT appId FROM Favorites ORDER BY addedAt DESC');
      return rows.map((r: any) => r.appId);
    } else {
      return Array.from(this.webDb.favorites.values()).reverse();
    }
  }

  async addFavorite(appId: string): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO Favorites (appId, addedAt) VALUES (?, ?)',
        [appId, Date.now()]
      );
    } else {
      this.webDb.favorites.add(appId);
      await this.saveWebDbToStorage();
    }
  }

  async removeFavorite(appId: string): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync('DELETE FROM Favorites WHERE appId = ?', [appId]);
    } else {
      this.webDb.favorites.delete(appId);
      await this.saveWebDbToStorage();
    }
  }

  // ─── SEARCH HISTORY ────────────────────────────────────────────────────────
  async getSearchHistory(limit = 10): Promise<string[]> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync(
        'SELECT term FROM SearchHistory ORDER BY timestamp DESC LIMIT ?',
        [limit]
      );
      return rows.map((r: any) => r.term);
    } else {
      return this.webDb.searchHistory.slice(0, limit).map(h => h.term);
    }
  }

  async addSearchHistory(term: string): Promise<void> {
    await this.init();
    const trimmed = term.trim();
    if (!trimmed) return;

    if (Platform.OS !== 'web') {
      await this.db.runAsync(
        'INSERT OR REPLACE INTO SearchHistory (term, timestamp) VALUES (?, ?)',
        [trimmed, Date.now()]
      );
    } else {
      this.webDb.searchHistory = [
        { term: trimmed, timestamp: Date.now() },
        ...this.webDb.searchHistory.filter(h => h.term !== trimmed),
      ].slice(0, 50);
      await this.saveWebDbToStorage();
    }
  }

  async removeSearchHistory(term: string): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync('DELETE FROM SearchHistory WHERE term = ?', [term]);
    } else {
      this.webDb.searchHistory = this.webDb.searchHistory.filter(h => h.term !== term);
      await this.saveWebDbToStorage();
    }
  }

  async clearSearchHistory(): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync('DELETE FROM SearchHistory');
    } else {
      this.webDb.searchHistory = [];
      await this.saveWebDbToStorage();
    }
  }

  // ─── DOWNLOADS ENGINE STATE ────────────────────────────────────────────────
  async getDownloads(): Promise<DownloadTask[]> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync('SELECT * FROM Downloads ORDER BY queuedAt DESC');
      return rows.map((r: any) => ({
        id: r.id,
        appId: r.appId,
        packageName: r.packageName,
        name: r.name,
        developer: r.developer,
        versionName: r.versionName,
        versionCode: r.versionCode,
        apkUrl: r.apkUrl,
        fileUri: r.fileUri,
        totalBytes: r.totalBytes,
        downloadedBytes: r.downloadedBytes,
        speedBps: r.speedBps,
        status: r.status as any,
        error: r.error || undefined,
        queuedAt: r.queuedAt,
        startedAt: r.startedAt || undefined,
        completedAt: r.completedAt || undefined,
        batchId: r.batchId || undefined,
        repositoryId: r.repositoryId,
        iconUrl: r.iconUrl || undefined,
      }));
    } else {
      return Array.from(this.webDb.downloads.values()).reverse();
    }
  }

  async saveDownload(task: DownloadTask): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync(
        `INSERT OR REPLACE INTO Downloads (
          id, appId, packageName, name, developer, versionName, versionCode, apkUrl, fileUri,
          totalBytes, downloadedBytes, speedBps, status, error, queuedAt, startedAt, completedAt, batchId, repositoryId, iconUrl
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.appId,
          task.packageName,
          task.name,
          task.developer,
          task.versionName,
          task.versionCode,
          task.apkUrl,
          task.fileUri,
          task.totalBytes,
          task.downloadedBytes,
          task.speedBps,
          task.status,
          task.error || null,
          task.queuedAt,
          task.startedAt || null,
          task.completedAt || null,
          task.batchId || null,
          task.repositoryId,
          task.iconUrl || null,
        ]
      );
    } else {
      this.webDb.downloads.set(task.id, { ...task });
      await this.saveWebDbToStorage();
    }
  }

  async deleteDownload(id: string): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.runAsync('DELETE FROM Downloads WHERE id = ?', [id]);
    } else {
      this.webDb.downloads.delete(id);
      await this.saveWebDbToStorage();
    }
  }

  // ─── INSTALLED APPS TRACKING ───────────────────────────────────────────────
  async getInstalledApps(): Promise<any[]> {
    await this.init();
    if (Platform.OS !== 'web') {
      const rows = await this.db.getAllAsync('SELECT * FROM InstalledApps ORDER BY installedAt DESC');
      return rows;
    } else {
      return [];
    }
  }

  // ─── ROBUST MIGRATION ──────────────────────────────────────────────────────
  async isMigrated(): Promise<boolean> {
    try {
      const val = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
      return val === 'true';
    } catch {
      return false;
    }
  }

  async markAsMigrated(): Promise<void> {
    try {
      await AsyncStorage.setItem(MIGRATION_FLAG_KEY, 'true');
    } catch {}
  }

  async clearDatabase(): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      await this.db.execAsync('DELETE FROM Apps;');
      await this.db.execAsync('DELETE FROM Versions;');
      await this.db.execAsync('DELETE FROM Screenshots;');
      await this.db.execAsync('DELETE FROM Categories;');
      await this.db.execAsync('DELETE FROM Repositories;');
      await this.db.execAsync('DELETE FROM Favorites;');
      await this.db.execAsync('DELETE FROM SearchHistory;');
    } else {
      this.webDb.apps.clear();
      this.webDb.versions.clear();
      this.webDb.categories.clear();
      this.webDb.repositories.clear();
      this.webDb.favorites.clear();
      this.webDb.searchHistory = [];
      await this.saveWebDbToStorage();
    }
    await AsyncStorage.removeItem(MIGRATION_FLAG_KEY);
    this.log('Database cleared completely.');
  }

  async getDatabaseSize(): Promise<number> {
    // Estimating SQLite size or returning mocked stats based on apps length
    await this.init();
    if (Platform.OS !== 'web') {
      try {
        const rows = await this.db.getAllAsync('PRAGMA page_count;');
        const pages = rows[0]?.page_count || 0;
        const sizeRows = await this.db.getAllAsync('PRAGMA page_size;');
        const pageSize = sizeRows[0]?.page_size || 4096;
        return pages * pageSize;
      } catch {
        return 0;
      }
    } else {
      return JSON.stringify(this.webDb).length;
    }
  }

  // ─── APP SIGNATURES & TRUST ───────────────────────────────────────────────
  async getAppSignature(packageName: string): Promise<any | null> {
    await this.init();
    if (Platform.OS !== 'web') {
      try {
        const rows = await this.db.getAllAsync('SELECT * FROM AppSignatures WHERE packageName = ?', [packageName]);
        return rows[0] || null;
      } catch (e) {
        console.error('[SQLiteService] getAppSignature failed:', e);
        return null;
      }
    } else {
      return this.webDb.signatures.get(packageName) || null;
    }
  }

  async saveAppSignature(sig: {
    packageName: string;
    certificateFingerprint: string;
    installedAt: number;
    lastVerifiedAt: number;
    repositorySource: string;
  }): Promise<void> {
    await this.init();
    if (Platform.OS !== 'web') {
      try {
        await this.db.runAsync(
          `INSERT OR REPLACE INTO AppSignatures (packageName, certificateFingerprint, installedAt, lastVerifiedAt, repositorySource)
           VALUES (?, ?, ?, ?, ?)`,
          [
            sig.packageName,
            sig.certificateFingerprint,
            sig.installedAt,
            sig.lastVerifiedAt,
            sig.repositorySource,
          ]
        );
      } catch (e) {
        console.error('[SQLiteService] saveAppSignature failed:', e);
      }
    } else {
      this.webDb.signatures.set(sig.packageName, { ...sig });
      await this.saveWebDbToStorage();
    }
  }

  async getAllAppSignatures(): Promise<any[]> {
    await this.init();
    if (Platform.OS !== 'web') {
      try {
        const rows = await this.db.getAllAsync('SELECT * FROM AppSignatures');
        return rows;
      } catch (e) {
        console.error('[SQLiteService] getAllAppSignatures failed:', e);
        return [];
      }
    } else {
      return Array.from(this.webDb.signatures.values());
    }
  }
}

export const sqliteService = new SQLiteService();
