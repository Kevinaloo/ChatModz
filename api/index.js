// server/app.ts
import express from "express";
import cors from "cors";
import crypto2 from "node:crypto";

// server/chatmodz.ts
import { Router } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt2 from "bcryptjs";
import jwt from "jsonwebtoken";
import webpush from "web-push";

// server/db.ts
import { createPool } from "mysql2/promise";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
var MemoryDatabase = class {
  operators = [];
  applications = [];
  activationCodes = [];
  sites = [];
  conversations = [];
  messages = [];
  deliveries = [];
  activities = [];
  pushSubscriptions = [];
  nextId = {
    operators: 1,
    applications: 1,
    activationCodes: 1,
    sites: 1,
    conversations: 1,
    messages: 1,
    deliveries: 1,
    activities: 1,
    pushSubscriptions: 1
  };
  constructor() {
    this.seedDefaults();
  }
  seedDefaults() {
    const adminPasswordHash = bcrypt.hashSync("admin12345", 10);
    this.operators.push({
      id: this.nextId.operators++,
      public_id: "cmz_admin_001",
      full_name: "Operations Director",
      email: "admin@chatmodz.io",
      password_hash: adminPasswordHash,
      role: "admin",
      status: "active",
      last_active_at: /* @__PURE__ */ new Date(),
      created_at: new Date(Date.now() - 30 * 864e5)
    });
    const operatorPasswordHash = bcrypt.hashSync("operator12345", 10);
    this.operators.push({
      id: this.nextId.operators++,
      public_id: "cmz_oper_002",
      full_name: "Sarah Jenkins",
      email: "operator@chatmodz.io",
      password_hash: operatorPasswordHash,
      role: "operator",
      status: "active",
      last_active_at: /* @__PURE__ */ new Date(),
      created_at: new Date(Date.now() - 14 * 864e5)
    });
    this.sites.push({
      id: this.nextId.sites++,
      internal_name: "cupid_connect",
      display_name: "CupidConnect UK",
      status: "active",
      integration_type: "hybrid",
      endpoint_base_url: "https://api.cupidconnect.example/v1/replies",
      secret_env_key: "CHATMODZ_CUPID_SECRET",
      created_at: new Date(Date.now() - 30 * 864e5)
    });
    this.sites.push({
      id: this.nextId.sites++,
      internal_name: "velvet_match",
      display_name: "Velvet Match US",
      status: "active",
      integration_type: "hybrid",
      endpoint_base_url: "https://api.velvetmatch.example/webhook",
      secret_env_key: "CHATMODZ_VELVET_SECRET",
      created_at: new Date(Date.now() - 25 * 864e5)
    });
    this.sites.push({
      id: this.nextId.sites++,
      internal_name: "rose_romance",
      display_name: "Rose Romance EU",
      status: "active",
      integration_type: "hybrid",
      endpoint_base_url: "https://api.roseromance.example/dispatch",
      secret_env_key: "CHATMODZ_ROSE_SECRET",
      created_at: new Date(Date.now() - 20 * 864e5)
    });
    this.applications.push({
      id: this.nextId.applications++,
      full_name: "Natasha Romanoff",
      email: "natasha.chat@example.com",
      location: "Manchester, UK",
      experience: "3 years experience in high-volume community moderation and live customer engagement. Fast typing speed and native English fluency.",
      status: "pending",
      created_at: new Date(Date.now() - 2 * 864e5)
    });
    this.applications.push({
      id: this.nextId.applications++,
      full_name: "Julian Martinez",
      email: "julian.m@example.com",
      location: "Toronto, Canada",
      experience: "Experienced live chat specialist with background in dating & social app community retention. Available for evening shifts.",
      status: "pending",
      created_at: new Date(Date.now() - 1 * 864e5)
    });
    this.applications.push({
      id: this.nextId.applications++,
      full_name: "Amina Diallo",
      email: "amina.d@example.com",
      location: "Paris, France",
      experience: "Bilingual community support specialist. Strong adherence to persona guidelines and privacy compliance.",
      status: "approved",
      reviewed_by: 1,
      reviewed_at: new Date(Date.now() - 36e5),
      created_at: new Date(Date.now() - 4 * 864e5)
    });
    const conv1Id = this.nextId.conversations++;
    this.conversations.push({
      id: conv1Id,
      site_id: 1,
      external_conversation_id: "ext_cupid_9012",
      member_alias: "David Miller",
      managed_profile_alias: "Elena Rose",
      priority: "high",
      status: "open",
      assigned_operator_id: null,
      lock_expires_at: null,
      last_message_at: new Date(Date.now() - 4 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv1Id,
      external_message_id: "msg_cupid_101",
      sender_type: "member",
      body: "Hi Elena! I loved your pictures from the botanical gardens. Do you go there often?",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 45 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv1Id,
      external_message_id: "msg_cupid_102",
      sender_type: "managed_profile",
      body: "Thank you David! Yes, I try to visit whenever the weather is nice. I find photography so relaxing. What hobbies keep you busy?",
      delivery_status: "delivered",
      sent_by_operator_id: 2,
      sent_at: new Date(Date.now() - 20 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv1Id,
      external_message_id: "msg_cupid_103",
      sender_type: "member",
      body: "I do a lot of hiking on weekends and play acoustic guitar. Are you free for a coffee this Saturday afternoon?",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 4 * 6e4)
    });
    const conv2Id = this.nextId.conversations++;
    this.conversations.push({
      id: conv2Id,
      site_id: 2,
      external_conversation_id: "ext_velvet_4418",
      member_alias: "Alex Chen",
      managed_profile_alias: "Sophie Martin",
      priority: "normal",
      status: "open",
      assigned_operator_id: null,
      lock_expires_at: null,
      last_message_at: new Date(Date.now() - 12 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv2Id,
      external_message_id: "msg_velvet_201",
      sender_type: "member",
      body: "Hey Sophie, great connecting with you on here!",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 35 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv2Id,
      external_message_id: "msg_velvet_202",
      sender_type: "managed_profile",
      body: "Great to meet you too Alex! Have you lived in the city long?",
      delivery_status: "delivered",
      sent_by_operator_id: 2,
      sent_at: new Date(Date.now() - 22 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv2Id,
      external_message_id: "msg_velvet_203",
      sender_type: "member",
      body: "About 4 years now! I just tried that Italian bistro you mentioned earlier, the pasta was fantastic.",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 12 * 6e4)
    });
    const conv3Id = this.nextId.conversations++;
    this.conversations.push({
      id: conv3Id,
      site_id: 3,
      external_conversation_id: "ext_rose_7731",
      member_alias: "Marcus Wright",
      managed_profile_alias: "Chloe Laurent",
      priority: "urgent",
      status: "open",
      assigned_operator_id: null,
      lock_expires_at: null,
      last_message_at: new Date(Date.now() - 1 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv3Id,
      external_message_id: "msg_rose_301",
      sender_type: "member",
      body: "Hi Chloe, I noticed you're interested in modern art. Are you planning to attend the contemporary gallery opening this Friday?",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 1 * 6e4)
    });
    const conv4Id = this.nextId.conversations++;
    this.conversations.push({
      id: conv4Id,
      site_id: 1,
      external_conversation_id: "ext_cupid_1140",
      member_alias: "Liam O'Connor",
      managed_profile_alias: "Isabella Vance",
      priority: "normal",
      status: "open",
      assigned_operator_id: null,
      lock_expires_at: null,
      last_message_at: new Date(Date.now() - 28 * 6e4)
    });
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv4Id,
      external_message_id: "msg_cupid_401",
      sender_type: "member",
      body: "Take your time getting back to me, I know work days can be hectic! Hope your week is going smoothly.",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 28 * 6e4)
    });
  }
};
var memoryDb = new MemoryDatabase();
var mysqlPool = null;
function getDatabasePool() {
  const url = process.env.CHATMODZ_DATABASE_URL;
  if (!url) return null;
  if (!mysqlPool) {
    try {
      mysqlPool = createPool({ uri: url, waitForConnections: true, connectionLimit: 10, charset: "utf8mb4" });
    } catch (err) {
      console.warn("Could not create MySQL pool, falling back to local memory engine:", err);
      return null;
    }
  }
  return mysqlPool;
}
function isUsingMySQL() {
  return Boolean(process.env.CHATMODZ_DATABASE_URL && mysqlPool);
}
var supabaseClient = null;
function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || "https://xmqrntslxacmvkljgvsc.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtcXJudHNseGFjbXZrbGpndnNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3ODc2MjAsImV4cCI6MjEwNDM2MzYyMH0.A4rmU_TVbSBQs-IZ_Htq58bLA0Nf-KiU3-JOV6tegRE";
  if (!url || !key) return null;
  if (!supabaseClient) {
    try {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false }
      });
    } catch (err) {
      console.warn("Could not initialize Supabase client:", err);
      return null;
    }
  }
  return supabaseClient;
}
async function checkSupabaseConnection() {
  const client = getSupabaseClient();
  const url = process.env.SUPABASE_URL || "https://xmqrntslxacmvkljgvsc.supabase.co";
  if (!client) {
    return { configured: false, connected: false, url, tablesFound: [], error: "Supabase client not configured" };
  }
  const tablesToCheck = ["operators", "operator_applications", "sites", "conversations", "messages"];
  const tablesFound = [];
  let lastError;
  for (const table of tablesToCheck) {
    try {
      const { error } = await client.from(table).select("id").limit(1);
      if (!error) {
        tablesFound.push(table);
      } else if (error.code !== "PGRST205") {
        lastError = error.message;
      }
    } catch (e) {
      lastError = e.message;
    }
  }
  return {
    configured: true,
    connected: tablesFound.length > 0,
    url,
    tablesFound,
    error: tablesFound.length === 0 ? "Tables not yet initialized in Supabase SQL editor" : lastError
  };
}

// server/chatmodz.ts
var router = Router();
var LOCK_MINUTES = 10;
var MIN_REPLY_CHARS = 20;
var SIGNATURE_WINDOW_MS = 5 * 60 * 1e3;
async function executeMySQLQuery(sql, values = []) {
  const pool = getDatabasePool();
  if (!pool) throw new Error("CHATMODZ_DATABASE_URL is required");
  const [rows] = await pool.execute(sql, values);
  return rows;
}
async function withMySQLTransaction(work) {
  const pool = getDatabasePool();
  if (!pool) throw new Error("CHATMODZ_DATABASE_URL is required");
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function timingSafeEqualHex(left, right) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function jwtSecret() {
  if (process.env.CHATMODZ_JWT_SECRET) return process.env.CHATMODZ_JWT_SECRET;
  return "chatmodz-development-secret-change-me";
}
function tokenFor(operator) {
  return jwt.sign({ operatorId: operator.id, role: operator.role }, jwtSecret(), { expiresIn: "12h", issuer: "chatmodz" });
}
function publicOperator(operator) {
  return {
    id: operator.id,
    name: operator.full_name,
    email: operator.email,
    admin: operator.role === "admin" ? 2 : 1,
    role: operator.role,
    status: operator.status
  };
}
function publicKey(value) {
  return `c_${value}`;
}
function internalId(value) {
  const match = /^c_(\d+)$/.exec(value);
  return match ? Number(match[1]) : 0;
}
function meaningfulChars(value) {
  return Array.from(value).filter((character) => !/\s/u.test(character)).length;
}
function secretFor(site) {
  const envKey = typeof site.secret_env_key === "string" ? site.secret_env_key : "";
  return envKey ? process.env[envKey] || "" : "";
}
function operatorMediaPath(value) {
  const path2 = typeof value === "string" ? value : "";
  if (path2.startsWith("/api/chatmodz/media/") || path2.startsWith("/api/uploads/") || path2.startsWith("data:") || path2.startsWith("http://") || path2.startsWith("https://")) {
    return path2;
  }
  return path2 ? `/api/uploads/${path2}` : "";
}
function signature(timestamp, body, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}
function signedRequestIsValid(req, secret) {
  if (!secret) return false;
  const timestamp = String(req.header("X-Chatmodz-Timestamp") || "");
  const received = String(req.header("X-Chatmodz-Signature") || "");
  const time = Date.parse(timestamp);
  if (!timestamp || !received || !Number.isFinite(time) || Math.abs(Date.now() - time) > SIGNATURE_WINDOW_MS) return false;
  const raw = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : JSON.stringify(req.body);
  const expected = signature(timestamp, raw, secret);
  return timingSafeEqualHex(received.replace(/^sha256=/, ""), expected.replace(/^sha256=/, ""));
}
async function loadOperator(id) {
  if (isUsingMySQL()) {
    const rows = await executeMySQLQuery(
      "SELECT id, public_id, full_name, email, password_hash, role, status FROM operators WHERE id = ? LIMIT 1",
      [id]
    );
    return rows[0];
  }
  return memoryDb.operators.find((op) => op.id === id);
}
async function recordActivity(operatorId, type, conversationId = null, siteId = null, metadata = {}) {
  if (isUsingMySQL()) {
    await executeMySQLQuery(
      "INSERT INTO operator_activity (operator_id, activity_type, conversation_id, site_id, metadata_json) VALUES (?, ?, ?, ?, ?)",
      [operatorId, type, conversationId, siteId, JSON.stringify(metadata)]
    ).catch(() => void 0);
  } else {
    memoryDb.activities.push({
      id: memoryDb.activities.length + 1,
      operator_id: operatorId,
      activity_type: type,
      conversation_id: conversationId,
      site_id: siteId,
      metadata_json: JSON.stringify(metadata),
      created_at: /* @__PURE__ */ new Date()
    });
  }
}
async function notifyPush(title, body) {
  const publicKey2 = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey2 || !privateKey || !subject) return;
  webpush.setVapidDetails(subject, publicKey2, privateKey);
  let subs = [];
  if (isUsingMySQL()) {
    subs = await executeMySQLQuery("SELECT endpoint, p256dh, auth_key FROM operator_push_subscriptions");
  } else {
    subs = memoryDb.pushSubscriptions;
  }
  const payload = JSON.stringify({ title, body, url: "/" });
  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload);
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          if (isUsingMySQL()) {
            await executeMySQLQuery("DELETE FROM operator_push_subscriptions WHERE endpoint = ?", [sub.endpoint]).catch(() => void 0);
          } else {
            memoryDb.pushSubscriptions = memoryDb.pushSubscriptions.filter((s) => s.endpoint !== sub.endpoint);
          }
        }
      }
    })
  );
}
async function requireChatmodzAuth(req, res, next) {
  try {
    const header = req.header("Authorization") || "";
    if (!header.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const payload = jwt.verify(header.slice(7), jwtSecret(), { issuer: "chatmodz" });
    const operator = await loadOperator(Number(payload.operatorId));
    if (!operator || operator.status !== "active") return res.status(401).json({ error: "Session is no longer active" });
    req.chatmodzOperator = operator;
    if (isUsingMySQL()) {
      await executeMySQLQuery("UPDATE operators SET last_active_at = NOW() WHERE id = ?", [operator.id]).catch(() => void 0);
    } else {
      operator.last_active_at = /* @__PURE__ */ new Date();
    }
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
function requireChatmodzAdmin(req, res, next) {
  if (req.chatmodzOperator?.role !== "admin") return res.status(403).json({ error: "Administrator access required" });
  next();
}
var mediaStorage = /* @__PURE__ */ new Map();
router.get("/system-status", (_req, res) => {
  const mysqlConfigured = Boolean(process.env.CHATMODZ_DATABASE_URL);
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY));
  res.json({
    ok: true,
    mode: isUsingMySQL() ? "mysql" : "local_embedded",
    database: {
      mysqlConfigured,
      connected: isUsingMySQL(),
      fallbackActive: !isUsingMySQL()
    },
    storage: {
      supabaseConfigured,
      provider: supabaseConfigured ? "supabase" : "local_memory"
    }
  });
});
router.get("/health", async (_req, res) => {
  if (isUsingMySQL()) {
    try {
      await executeMySQLQuery("SELECT 1 AS ok");
      return res.json({ ok: true, database: "mysql_connected" });
    } catch {
      return res.status(503).json({ ok: false, database: "mysql_error" });
    }
  }
  return res.json({ ok: true, database: "embedded_ready" });
});
router.post("/applications", async (req, res) => {
  const { fullName, email, location, experience } = req.body || {};
  if (!String(fullName || "").trim() || !String(email || "").includes("@")) {
    return res.status(400).json({ error: "Full name and a valid email are required" });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(fullName).trim();
  try {
    if (isUsingMySQL()) {
      await executeMySQLQuery(
        "INSERT INTO operator_applications (full_name, email, location, experience) VALUES (?, ?, ?, ?)",
        [cleanName, cleanEmail, String(location || "").trim() || null, String(experience || "").trim() || null]
      );
    } else {
      const existing = memoryDb.applications.find((a) => a.email === cleanEmail);
      if (existing) return res.status(409).json({ error: "An application with this email already exists" });
      memoryDb.applications.push({
        id: memoryDb.applications.length + 1,
        full_name: cleanName,
        email: cleanEmail,
        location: String(location || "").trim() || null,
        experience: String(experience || "").trim() || null,
        status: "pending",
        created_at: /* @__PURE__ */ new Date()
      });
    }
    res.status(201).json({ submitted: true });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "An application with this email already exists" });
    res.status(500).json({ error: "Could not submit application" });
  }
});
router.post("/auth/login", async (req, res) => {
  const identifier = String(req.body?.identifier || req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!identifier || !password) return res.status(400).json({ error: "Email and password are required" });
  try {
    let operator;
    if (isUsingMySQL()) {
      const rows = await executeMySQLQuery("SELECT * FROM operators WHERE email = ? LIMIT 1", [identifier]);
      operator = rows[0];
    } else {
      operator = memoryDb.operators.find((op) => op.email.toLowerCase() === identifier);
    }
    if (!operator || !await bcrypt2.compare(password, operator.password_hash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (operator.status !== "active") {
      return res.status(403).json({ error: `This operator account is ${operator.status}. Contact your administrator.` });
    }
    const safe = publicOperator(operator);
    await recordActivity(operator.id, "login");
    res.json({ token: tokenFor(operator), user: safe });
  } catch (error) {
    res.status(500).json({ error: "Login unavailable" });
  }
});
router.post("/auth/activate", async (req, res) => {
  const code = String(req.body?.code || "").trim();
  const password = String(req.body?.password || "");
  if (code.length < 12 || password.length < 10) {
    return res.status(400).json({ error: "Activation code and a minimum 10-character password are required" });
  }
  try {
    const codeHash = sha256(code);
    const passwordHash = await bcrypt2.hash(password, 12);
    if (isUsingMySQL()) {
      const rows = await executeMySQLQuery(
        "SELECT c.*, o.* FROM operator_activation_codes c JOIN operators o ON o.id = c.operator_id WHERE c.code_hash = ? AND c.used_at IS NULL AND c.revoked_at IS NULL AND c.expires_at > NOW() LIMIT 1",
        [codeHash]
      );
      const record = rows[0];
      if (!record) return res.status(400).json({ error: "Activation code is invalid or expired" });
      await withMySQLTransaction(async (connection) => {
        await connection.execute("UPDATE operators SET password_hash = ?, status = 'active' WHERE id = ?", [passwordHash, record.operator_id]);
        await connection.execute("UPDATE operator_activation_codes SET used_at = NOW() WHERE id = ?", [record.id]);
      });
      const operator = await loadOperator(Number(record.operator_id));
      return res.json({ token: tokenFor(operator), user: publicOperator(operator) });
    } else {
      const codeRecord = memoryDb.activationCodes.find(
        (c) => c.code_hash === codeHash && !c.used_at && !c.revoked_at && c.expires_at.getTime() > Date.now()
      );
      if (!codeRecord) return res.status(400).json({ error: "Activation code is invalid or expired" });
      const operator = memoryDb.operators.find((op) => op.id === codeRecord.operator_id);
      if (!operator) return res.status(404).json({ error: "Operator not found" });
      operator.password_hash = passwordHash;
      operator.status = "active";
      codeRecord.used_at = /* @__PURE__ */ new Date();
      return res.json({ token: tokenFor(operator), user: publicOperator(operator) });
    }
  } catch (error) {
    res.status(500).json({ error: "Activation unavailable" });
  }
});
router.get("/auth/me", requireChatmodzAuth, (req, res) => res.json(publicOperator(req.chatmodzOperator)));
router.post("/auth/logout", requireChatmodzAuth, (_req, res) => res.json({ success: true }));
router.get("/conversations", requireChatmodzAuth, async (req, res) => {
  const currentOperatorId = req.chatmodzOperator.id;
  try {
    if (isUsingMySQL()) {
      const rows = await executeMySQLQuery(`
        SELECT c.*,
          (SELECT body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) AS last_message,
          (SELECT sender_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) AS last_sender_type,
          (SELECT delivery_status FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) AS last_delivery_status,
          (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS msg_count
        FROM conversations c
        WHERE c.status <> 'closed' AND (c.lock_expires_at IS NULL OR c.lock_expires_at < NOW() OR c.assigned_operator_id = ?)
        ORDER BY CASE WHEN (SELECT sender_type FROM messages m WHERE m.conversation_id = c.id ORDER BY m.sent_at DESC, m.id DESC LIMIT 1) = 'member' THEN 0 ELSE 1 END, c.last_message_at DESC
        LIMIT 100
      `, [currentOperatorId]);
      const conversations = rows.map((row) => ({
        key: publicKey(Number(row.id)),
        fakeUser: { id: -1, name: row.managed_profile_alias, photo: operatorMediaPath(row.managed_profile_photo_url) },
        realUser: { id: -2, name: row.member_alias, photo: operatorMediaPath(row.member_photo_url) },
        lastMessage: row.last_message || "",
        lastTime: Math.floor(new Date(row.last_message_at).getTime() / 1e3),
        msgCount: Number(row.msg_count || 0),
        lastSenderFake: row.last_sender_type === "managed_profile",
        lastMsgRead: row.last_delivery_status === "delivered",
        lock: row.assigned_operator_id && row.lock_expires_at && new Date(row.lock_expires_at).getTime() > Date.now() ? {
          moderatorId: Number(row.assigned_operator_id),
          moderatorName: Number(row.assigned_operator_id) === currentOperatorId ? "You" : "Another operator",
          lockedAt: 0,
          expiresAt: Math.floor(new Date(row.lock_expires_at).getTime() / 1e3)
        } : null
      }));
      return res.json({ conversations, total: conversations.length, page: 1, pages: 1 });
    }
    const openConversations = memoryDb.conversations.filter((c) => c.status !== "closed" && (!c.lock_expires_at || c.lock_expires_at.getTime() < Date.now() || c.assigned_operator_id === currentOperatorId)).map((c) => {
      const convMessages = memoryDb.messages.filter((m) => m.conversation_id === c.id);
      const lastMessage = convMessages[convMessages.length - 1];
      const isLocked = Boolean(c.assigned_operator_id && c.lock_expires_at && c.lock_expires_at.getTime() > Date.now());
      return {
        key: publicKey(c.id),
        fakeUser: { id: -1, name: c.managed_profile_alias, photo: operatorMediaPath(c.managed_profile_photo_url) },
        realUser: { id: -2, name: c.member_alias, photo: operatorMediaPath(c.member_photo_url) },
        lastMessage: lastMessage ? lastMessage.body : "",
        lastTime: Math.floor(c.last_message_at.getTime() / 1e3),
        msgCount: convMessages.length,
        lastSenderFake: lastMessage?.sender_type === "managed_profile",
        lastMsgRead: lastMessage?.delivery_status === "delivered",
        lock: isLocked ? {
          moderatorId: c.assigned_operator_id,
          moderatorName: c.assigned_operator_id === currentOperatorId ? "You" : "Another operator",
          lockedAt: Math.floor(c.last_message_at.getTime() / 1e3),
          expiresAt: Math.floor(c.lock_expires_at.getTime() / 1e3)
        } : null
      };
    });
    res.json({ conversations: openConversations, total: openConversations.length, page: 1, pages: 1 });
  } catch (error) {
    res.status(500).json({ error: "Conversation queue unavailable" });
  }
});
router.get("/conversations/:key/messages", requireChatmodzAuth, async (req, res) => {
  const conversationId = internalId(String(req.params.key));
  if (!conversationId) return res.status(400).json({ error: "Invalid conversation" });
  try {
    if (isUsingMySQL()) {
      const conversations = await executeMySQLQuery("SELECT * FROM conversations WHERE id = ? LIMIT 1", [conversationId]);
      const conversation2 = conversations[0];
      if (!conversation2) return res.status(404).json({ error: "Conversation not found" });
      const rows = await executeMySQLQuery("SELECT id, sender_type, body, media_proxy_url, media_type, sent_at, delivery_status FROM messages WHERE conversation_id = ? ORDER BY sent_at ASC, id ASC", [conversationId]);
      return res.json({
        messages: rows.map((row) => ({
          id: Number(row.id),
          u1: row.sender_type === "managed_profile" ? -1 : -2,
          u2: row.sender_type === "managed_profile" ? -2 : -1,
          message: row.body,
          time: Math.floor(new Date(row.sent_at).getTime() / 1e3),
          read: row.delivery_status === "delivered" ? 1 : 0,
          mediaUrl: operatorMediaPath(row.media_proxy_url),
          mediaType: row.media_type || ""
        })),
        users: {
          "-1": { id: -1, name: conversation2.managed_profile_alias, photo: operatorMediaPath(conversation2.managed_profile_photo_url) },
          "-2": { id: -2, name: conversation2.member_alias, photo: operatorMediaPath(conversation2.member_photo_url) }
        }
      });
    }
    const conversation = memoryDb.conversations.find((c) => c.id === conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const threadMessages = memoryDb.messages.filter((m) => m.conversation_id === conversationId);
    res.json({
      messages: threadMessages.map((m) => ({
        id: m.id,
        u1: m.sender_type === "managed_profile" ? -1 : -2,
        u2: m.sender_type === "managed_profile" ? -2 : -1,
        message: m.body,
        time: Math.floor(m.sent_at.getTime() / 1e3),
        read: m.delivery_status === "delivered" ? 1 : 0,
        mediaUrl: operatorMediaPath(m.media_proxy_url),
        mediaType: m.media_type || ""
      })),
      users: {
        "-1": { id: -1, name: conversation.managed_profile_alias, photo: operatorMediaPath(conversation.managed_profile_photo_url) },
        "-2": { id: -2, name: conversation.member_alias, photo: operatorMediaPath(conversation.member_photo_url) }
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Messages unavailable" });
  }
});
router.post("/conversations/:key/lock", requireChatmodzAuth, async (req, res) => {
  const conversationId = internalId(String(req.params.key));
  const operator = req.chatmodzOperator;
  if (!conversationId) return res.status(400).json({ error: "Invalid conversation" });
  try {
    const expiresAt = new Date(Date.now() + LOCK_MINUTES * 60 * 1e3);
    if (isUsingMySQL()) {
      const result = await executeMySQLQuery(
        `UPDATE conversations
         SET assigned_operator_id = ?, lock_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
         WHERE id = ? AND status <> 'closed' AND (assigned_operator_id IS NULL OR lock_expires_at < NOW() OR assigned_operator_id = ?)`,
        [operator.id, LOCK_MINUTES, conversationId, operator.id]
      );
      if (!result.affectedRows) return res.status(409).json({ error: "Conversation is already locked by another operator" });
      await executeMySQLQuery("INSERT INTO conversation_assignments (conversation_id, operator_id) VALUES (?, ?)", [conversationId, operator.id]);
    } else {
      const conversation = memoryDb.conversations.find((c) => c.id === conversationId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      if (conversation.assigned_operator_id && conversation.assigned_operator_id !== operator.id && conversation.lock_expires_at && conversation.lock_expires_at.getTime() > Date.now()) {
        return res.status(409).json({ error: "Conversation is already locked by another operator" });
      }
      conversation.assigned_operator_id = operator.id;
      conversation.lock_expires_at = expiresAt;
    }
    await recordActivity(operator.id, "claim", conversationId);
    res.json({
      locked: true,
      lock: {
        moderatorId: operator.id,
        moderatorName: "You",
        lockedAt: Math.floor(Date.now() / 1e3),
        expiresAt: Math.floor(expiresAt.getTime() / 1e3)
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Could not lock conversation" });
  }
});
router.delete("/conversations/:key/lock", requireChatmodzAuth, async (req, res) => {
  const conversationId = internalId(String(req.params.key));
  const operator = req.chatmodzOperator;
  if (!conversationId) return res.status(400).json({ error: "Invalid conversation" });
  try {
    if (isUsingMySQL()) {
      const current = await executeMySQLQuery("SELECT assigned_operator_id FROM conversations WHERE id = ? LIMIT 1", [conversationId]);
      const row = current[0];
      if (!row) return res.status(404).json({ error: "Conversation not found" });
      if (row.assigned_operator_id && Number(row.assigned_operator_id) !== operator.id && operator.role !== "admin") {
        return res.status(403).json({ error: "Cannot release another operator's lock" });
      }
      await withMySQLTransaction(async (connection) => {
        await connection.execute("UPDATE conversations SET assigned_operator_id = NULL, lock_expires_at = NULL WHERE id = ?", [conversationId]);
        await connection.execute("UPDATE conversation_assignments SET released_at = NOW() WHERE conversation_id = ? AND released_at IS NULL", [conversationId]);
      });
    } else {
      const conversation = memoryDb.conversations.find((c) => c.id === conversationId);
      if (!conversation) return res.status(404).json({ error: "Conversation not found" });
      if (conversation.assigned_operator_id && conversation.assigned_operator_id !== operator.id && operator.role !== "admin") {
        return res.status(403).json({ error: "Cannot release another operator's lock" });
      }
      conversation.assigned_operator_id = null;
      conversation.lock_expires_at = null;
    }
    await recordActivity(operator.id, "release", conversationId);
    res.json({ released: true });
  } catch (error) {
    res.status(500).json({ error: "Could not release lock" });
  }
});
router.post("/conversations/:key/keepalive", requireChatmodzAuth, async (req, res) => {
  const conversationId = internalId(String(req.params.key));
  const operator = req.chatmodzOperator;
  if (!conversationId) return res.status(400).json({ error: "Invalid conversation" });
  try {
    const expiresAt = new Date(Date.now() + LOCK_MINUTES * 60 * 1e3);
    if (isUsingMySQL()) {
      const result = await executeMySQLQuery(
        "UPDATE conversations SET lock_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ? AND assigned_operator_id = ? AND lock_expires_at > NOW()",
        [LOCK_MINUTES, conversationId, operator.id]
      );
      if (!result.affectedRows) return res.status(409).json({ error: "Lock has expired or was reassigned" });
    } else {
      const conversation = memoryDb.conversations.find((c) => c.id === conversationId);
      if (!conversation || conversation.assigned_operator_id !== operator.id || !conversation.lock_expires_at || conversation.lock_expires_at.getTime() <= Date.now()) {
        return res.status(409).json({ error: "Lock has expired or was reassigned" });
      }
      conversation.lock_expires_at = expiresAt;
    }
    res.json({ refreshed: true, expiresAt: Math.floor(expiresAt.getTime() / 1e3) });
  } catch (error) {
    res.status(500).json({ error: "Could not refresh lock" });
  }
});
router.post("/conversations/:key/reply", requireChatmodzAuth, async (req, res) => {
  const conversationId = internalId(String(req.params.key));
  const operator = req.chatmodzOperator;
  const messageText = String(req.body?.message || "").trim();
  const mediaUrl = operatorMediaPath(req.body?.mediaUrl);
  const mediaType = req.body?.mediaType ? String(req.body.mediaType) : null;
  if (!conversationId) return res.status(400).json({ error: "Invalid conversation" });
  if (!messageText && !mediaUrl) return res.status(400).json({ error: "Message text or media is required" });
  if (operator.role !== "admin" && messageText && meaningfulChars(messageText) < MIN_REPLY_CHARS) {
    return res.status(400).json({ error: `Replies must contain at least ${MIN_REPLY_CHARS} non-space characters` });
  }
  try {
    const eventId = `evt_${crypto.randomBytes(12).toString("hex")}`;
    const externalMessageId = `msg_${crypto.randomBytes(12).toString("hex")}`;
    const sentAt = /* @__PURE__ */ new Date();
    if (isUsingMySQL()) {
      const rows = await executeMySQLQuery(
        `SELECT c.*, s.endpoint_base_url, s.secret_env_key, s.internal_name
         FROM conversations c
         JOIN sites s ON s.id = c.site_id
         WHERE c.id = ? AND c.assigned_operator_id = ? AND c.lock_expires_at > NOW()
         LIMIT 1`,
        [conversationId, operator.id]
      );
      const conversation2 = rows[0];
      if (!conversation2) return res.status(409).json({ error: "You must hold an active lock on this conversation to reply" });
      let messageId = 0;
      await withMySQLTransaction(async (connection) => {
        const created = await connection.execute(
          "INSERT INTO messages (conversation_id, external_message_id, sender_type, body, media_proxy_url, media_type, delivery_status, sent_by_operator_id, sent_at) VALUES (?, ?, 'managed_profile', ?, ?, ?, 'queued', ?, ?)",
          [conversationId, externalMessageId, messageText, mediaUrl || null, mediaType, operator.id, sentAt]
        );
        messageId = Number(created[0].insertId);
        await connection.execute("UPDATE conversations SET last_message_at = ? WHERE id = ?", [sentAt, conversationId]);
      });
      const outgoingPayload = {
        eventId,
        siteKey: conversation2.internal_name,
        conversationId: conversation2.external_conversation_id,
        messageId: externalMessageId,
        sender: "managed_profile",
        body: messageText,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        sentAt: sentAt.toISOString()
      };
      await executeMySQLQuery(
        "INSERT INTO integration_deliveries (site_id, direction, external_event_id, conversation_id, status, attempt_count, payload_json, received_at) VALUES (?, 'outgoing', ?, ?, 'received', 0, ?, NOW())",
        [conversation2.site_id, eventId, conversationId, JSON.stringify(outgoingPayload)]
      );
      let delivered = true;
      if (conversation2.endpoint_base_url) {
        try {
          const secret = secretFor(conversation2);
          if (secret) {
            const timestamp = (/* @__PURE__ */ new Date()).toISOString();
            const body = JSON.stringify(outgoingPayload);
            const response = await fetch(conversation2.endpoint_base_url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Chatmodz-Timestamp": timestamp,
                "X-Chatmodz-Signature": signature(timestamp, body, secret)
              },
              body
            });
            if (!response.ok) delivered = false;
          }
        } catch {
          delivered = false;
        }
      }
      const finalStatus = delivered ? "delivered" : "queued";
      await executeMySQLQuery("UPDATE messages SET delivery_status = ? WHERE id = ?", [finalStatus, messageId]);
      await executeMySQLQuery(
        "UPDATE integration_deliveries SET status = ?, attempt_count = attempt_count + 1, delivered_at = ? WHERE external_event_id = ?",
        [finalStatus, delivered ? /* @__PURE__ */ new Date() : null, eventId]
      );
      await recordActivity(operator.id, "reply", conversationId, conversation2.site_id, { characters: meaningfulChars(messageText) });
      return res.json({
        delivered: true,
        message: {
          id: messageId,
          u1: -1,
          u2: -2,
          message: messageText,
          time: Math.floor(sentAt.getTime() / 1e3),
          read: 1,
          mediaUrl: mediaUrl || void 0,
          mediaType: mediaType || void 0
        }
      });
    }
    const conversation = memoryDb.conversations.find((c) => c.id === conversationId);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (conversation.assigned_operator_id !== operator.id) {
      return res.status(409).json({ error: "You must hold an active lock on this conversation to reply" });
    }
    const newMessageId = memoryDb.messages.length + 1;
    const newMsg = {
      id: newMessageId,
      conversation_id: conversationId,
      external_message_id: externalMessageId,
      sender_type: "managed_profile",
      body: messageText,
      media_proxy_url: mediaUrl || null,
      media_type: mediaType,
      delivery_status: "delivered",
      sent_by_operator_id: operator.id,
      sent_at: sentAt
    };
    memoryDb.messages.push(newMsg);
    conversation.last_message_at = sentAt;
    await recordActivity(operator.id, "reply", conversationId, conversation.site_id, { characters: meaningfulChars(messageText) });
    res.json({
      delivered: true,
      message: {
        id: newMessageId,
        u1: -1,
        u2: -2,
        message: messageText,
        time: Math.floor(sentAt.getTime() / 1e3),
        read: 1,
        mediaUrl: mediaUrl || void 0,
        mediaType: mediaType || void 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Could not deliver reply" });
  }
});
router.get("/stats", requireChatmodzAuth, async (req, res) => {
  const operator = req.chatmodzOperator;
  try {
    if (isUsingMySQL()) {
      const [openRows, lockRows, replyRows] = await Promise.all([
        executeMySQLQuery("SELECT COUNT(*) AS total FROM conversations WHERE status <> 'closed'"),
        executeMySQLQuery("SELECT COUNT(*) AS total FROM conversations WHERE assigned_operator_id IS NOT NULL AND lock_expires_at > NOW()"),
        executeMySQLQuery("SELECT COUNT(*) AS total FROM messages WHERE sent_by_operator_id = ?", [operator.id])
      ]);
      return res.json({
        totalConversations: Number(openRows[0]?.total || 0),
        activeLocks: Number(lockRows[0]?.total || 0),
        messagesSent: Number(replyRows[0]?.total || 0)
      });
    }
    const totalConversations = memoryDb.conversations.filter((c) => c.status !== "closed").length;
    const activeLocks = memoryDb.conversations.filter(
      (c) => c.assigned_operator_id && c.lock_expires_at && c.lock_expires_at.getTime() > Date.now()
    ).length;
    const messagesSent = memoryDb.messages.filter((m) => m.sent_by_operator_id === operator.id).length;
    res.json({
      totalConversations,
      activeLocks,
      messagesSent
    });
  } catch (error) {
    res.status(500).json({ error: "Stats unavailable" });
  }
});
router.get("/push/vapid-key", requireChatmodzAuth, (_req, res) => {
  const publicKey2 = process.env.VAPID_PUBLIC_KEY || "BH_sample_vapid_public_key_for_local_chatmodz_testing";
  res.json({ publicKey: publicKey2 });
});
router.post("/push/subscribe", requireChatmodzAuth, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: "Invalid subscription payload" });
  const operator = req.chatmodzOperator;
  try {
    if (isUsingMySQL()) {
      await executeMySQLQuery(
        "INSERT INTO operator_push_subscriptions (operator_id, endpoint, p256dh, auth_key) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE operator_id = VALUES(operator_id), p256dh = VALUES(p256dh), auth_key = VALUES(auth_key)",
        [operator.id, endpoint, keys.p256dh, keys.auth]
      );
    } else {
      const existing = memoryDb.pushSubscriptions.find((s) => s.endpoint === endpoint);
      if (existing) {
        existing.operator_id = operator.id;
        existing.p256dh = keys.p256dh;
        existing.auth_key = keys.auth;
      } else {
        memoryDb.pushSubscriptions.push({
          id: memoryDb.pushSubscriptions.length + 1,
          operator_id: operator.id,
          endpoint,
          p256dh: keys.p256dh,
          auth_key: keys.auth,
          created_at: /* @__PURE__ */ new Date()
        });
      }
    }
    res.json({ subscribed: true });
  } catch (error) {
    res.status(500).json({ error: "Could not subscribe" });
  }
});
router.delete("/push/unsubscribe", requireChatmodzAuth, async (req, res) => {
  const endpoint = String(req.body?.endpoint || "");
  if (!endpoint) return res.status(400).json({ error: "Endpoint required" });
  if (isUsingMySQL()) {
    await executeMySQLQuery("DELETE FROM operator_push_subscriptions WHERE endpoint = ?", [endpoint]).catch(() => void 0);
  } else {
    memoryDb.pushSubscriptions = memoryDb.pushSubscriptions.filter((s) => s.endpoint !== endpoint);
  }
  res.json({ unsubscribed: true });
});
router.post("/integrations/:siteKey/messages", async (req, res) => {
  const siteKey = String(req.params.siteKey || "");
  const payload = req.body || {};
  if (!payload.eventId || !payload.conversationId || !payload.messageId || !payload.body || payload.sender !== "member") {
    return res.status(400).json({ error: "Invalid message event" });
  }
  try {
    let site;
    if (isUsingMySQL()) {
      const sites = await executeMySQLQuery("SELECT * FROM sites WHERE internal_name = ? AND status = 'active' LIMIT 1", [siteKey]);
      site = sites[0];
    } else {
      site = memoryDb.sites.find((s) => s.internal_name === siteKey && s.status === "active");
    }
    if (!site || !signedRequestIsValid(req, secretFor(site))) {
      return res.status(401).json({ error: "Invalid integration signature" });
    }
    const sentAt = new Date(payload.sentAt || Date.now());
    if (isUsingMySQL()) {
      const existing = await executeMySQLQuery(
        "SELECT id FROM integration_deliveries WHERE site_id = ? AND direction = 'incoming' AND external_event_id = ? LIMIT 1",
        [site.id, payload.eventId]
      );
      if (existing.length) return res.status(202).json({ accepted: true, duplicate: true });
      await withMySQLTransaction(async (connection) => {
        const convRows = await connection.execute("SELECT id FROM conversations WHERE site_id = ? AND external_conversation_id = ? LIMIT 1", [site.id, payload.conversationId]);
        let conversationId = Number(convRows[0][0]?.id || 0);
        if (!conversationId) {
          const created = await connection.execute(
            "INSERT INTO conversations (site_id, external_conversation_id, member_alias, managed_profile_alias, member_photo_url, managed_profile_photo_url, last_message_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [site.id, payload.conversationId, payload.memberAlias || "Member", payload.managedProfileAlias || "Managed profile", payload.memberPhotoUrl || null, payload.managedProfilePhotoUrl || null, sentAt]
          );
          conversationId = Number(created[0].insertId);
        } else {
          await connection.execute(
            "UPDATE conversations SET member_alias = ?, managed_profile_alias = ?, member_photo_url = COALESCE(?, member_photo_url), managed_profile_photo_url = COALESCE(?, managed_profile_photo_url), last_message_at = ? WHERE id = ?",
            [payload.memberAlias || "Member", payload.managedProfileAlias || "Managed profile", payload.memberPhotoUrl || null, payload.managedProfilePhotoUrl || null, sentAt, conversationId]
          );
        }
        await connection.execute(
          "INSERT INTO messages (conversation_id, external_message_id, sender_type, body, delivery_status, sent_at) VALUES (?, ?, 'member', ?, 'received', ?)",
          [conversationId, payload.messageId, payload.body, sentAt]
        );
        await connection.execute(
          "INSERT INTO integration_deliveries (site_id, direction, external_event_id, conversation_id, status, attempt_count, payload_json) VALUES (?, 'incoming', ?, ?, 'processed', 1, ?)",
          [site.id, payload.eventId, conversationId, JSON.stringify(payload)]
        );
      });
    } else {
      let conversation = memoryDb.conversations.find((c) => c.site_id === site.id && c.external_conversation_id === payload.conversationId);
      if (!conversation) {
        conversation = {
          id: memoryDb.conversations.length + 1,
          site_id: site.id,
          external_conversation_id: payload.conversationId,
          member_alias: payload.memberAlias || "Member",
          managed_profile_alias: payload.managedProfileAlias || "Managed profile",
          member_photo_url: payload.memberPhotoUrl || null,
          managed_profile_photo_url: payload.managedProfilePhotoUrl || null,
          priority: "normal",
          status: "open",
          assigned_operator_id: null,
          lock_expires_at: null,
          last_message_at: sentAt
        };
        memoryDb.conversations.push(conversation);
      } else {
        conversation.member_alias = payload.memberAlias || conversation.member_alias;
        conversation.managed_profile_alias = payload.managedProfileAlias || conversation.managed_profile_alias;
        conversation.last_message_at = sentAt;
      }
      memoryDb.messages.push({
        id: memoryDb.messages.length + 1,
        conversation_id: conversation.id,
        external_message_id: payload.messageId,
        sender_type: "member",
        body: payload.body,
        delivery_status: "received",
        sent_at: sentAt
      });
    }
    await notifyPush("New conversation message", "A member message is waiting in the operator queue").catch(() => void 0);
    res.status(202).json({ accepted: true });
  } catch (error) {
    res.status(500).json({ error: "Could not process message event" });
  }
});
router.get("/admin/applications", requireChatmodzAuth, requireChatmodzAdmin, async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from("operator_applications").select("*").order("created_at", { ascending: false }).limit(200);
        if (!error && data && data.length > 0) return res.json({ applications: data });
      } catch {
      }
    }
    if (isUsingMySQL()) {
      const applications = await executeMySQLQuery("SELECT id, full_name, email, location, experience, status, created_at, reviewed_at FROM operator_applications ORDER BY created_at DESC LIMIT 200");
      return res.json({ applications });
    }
    res.json({ applications: memoryDb.applications });
  } catch (error) {
    res.status(500).json({ error: "Applications unavailable" });
  }
});
router.post("/admin/applications/:id/approve", requireChatmodzAuth, requireChatmodzAdmin, async (req, res) => {
  const applicationId = Number(req.params.id);
  try {
    const operatorPublicId = crypto.randomBytes(13).toString("base64url");
    const activationCode = `cmz-${crypto.randomBytes(18).toString("base64url")}`;
    const initialPasswordHash = await bcrypt2.hash(crypto.randomBytes(32).toString("hex"), 12);
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: appData } = await supabase.from("operator_applications").select("*").eq("id", applicationId).maybeSingle();
        if (appData) {
          await supabase.from("operator_applications").update({
            status: "approved",
            reviewed_by: req.chatmodzOperator.id,
            reviewed_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", applicationId);
          await supabase.from("operators").insert({
            public_id: operatorPublicId,
            full_name: appData.full_name,
            email: appData.email,
            password_hash: initialPasswordHash,
            role: "operator",
            status: "training"
          });
        }
      } catch {
      }
    }
    if (isUsingMySQL()) {
      const rows = await executeMySQLQuery("SELECT * FROM operator_applications WHERE id = ? LIMIT 1", [applicationId]);
      const application = rows[0];
      if (!application) return res.status(404).json({ error: "Application not found" });
      const existing = await executeMySQLQuery("SELECT id FROM operators WHERE email = ? LIMIT 1", [application.email]);
      if (existing.length) return res.status(409).json({ error: "An operator already uses this email" });
      await withMySQLTransaction(async (connection) => {
        const created = await connection.execute(
          "INSERT INTO operators (public_id, full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'operator', 'training')",
          [operatorPublicId, application.full_name, application.email, initialPasswordHash]
        );
        const operatorId = Number(created[0].insertId);
        await connection.execute(
          "INSERT INTO operator_activation_codes (operator_id, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 72 HOUR))",
          [operatorId, sha256(activationCode)]
        );
        await connection.execute(
          "UPDATE operator_applications SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
          [req.chatmodzOperator.id, applicationId]
        );
      });
    } else {
      const application = memoryDb.applications.find((a) => a.id === applicationId);
      if (!application) return res.status(404).json({ error: "Application not found" });
      const existing = memoryDb.operators.find((op) => op.email === application.email);
      if (existing) return res.status(409).json({ error: "An operator already uses this email" });
      const newOpId = memoryDb.operators.length + 1;
      memoryDb.operators.push({
        id: newOpId,
        public_id: operatorPublicId,
        full_name: application.full_name,
        email: application.email,
        password_hash: initialPasswordHash,
        role: "operator",
        status: "training",
        created_at: /* @__PURE__ */ new Date()
      });
      memoryDb.activationCodes.push({
        id: memoryDb.activationCodes.length + 1,
        operator_id: newOpId,
        code_hash: sha256(activationCode),
        expires_at: new Date(Date.now() + 72 * 36e5),
        created_at: /* @__PURE__ */ new Date()
      });
      application.status = "approved";
      application.reviewed_by = req.chatmodzOperator.id;
      application.reviewed_at = /* @__PURE__ */ new Date();
    }
    res.json({ approved: true, activationCode, expiresInHours: 72 });
  } catch (error) {
    res.status(500).json({ error: "Could not approve application" });
  }
});
router.post("/admin/applications/:id/reject", requireChatmodzAuth, requireChatmodzAdmin, async (req, res) => {
  const applicationId = Number(req.params.id);
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("operator_applications").update({
          status: "rejected",
          reviewed_by: req.chatmodzOperator.id,
          reviewed_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", applicationId);
      } catch {
      }
    }
    if (isUsingMySQL()) {
      await executeMySQLQuery(
        "UPDATE operator_applications SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
        [req.chatmodzOperator.id, applicationId]
      );
    } else {
      const app2 = memoryDb.applications.find((a) => a.id === applicationId);
      if (app2) {
        app2.status = "rejected";
        app2.reviewed_by = req.chatmodzOperator.id;
        app2.reviewed_at = /* @__PURE__ */ new Date();
      }
    }
    res.json({ rejected: true });
  } catch (error) {
    res.status(500).json({ error: "Could not reject application" });
  }
});
router.delete("/admin/applications/:id", requireChatmodzAuth, requireChatmodzAdmin, async (req, res) => {
  const applicationId = Number(req.params.id);
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from("operator_applications").delete().eq("id", applicationId);
      } catch {
      }
    }
    if (isUsingMySQL()) {
      await executeMySQLQuery("DELETE FROM operator_applications WHERE id = ?", [applicationId]);
    } else {
      const idx = memoryDb.applications.findIndex((a) => a.id === applicationId);
      if (idx !== -1) memoryDb.applications.splice(idx, 1);
    }
    res.json({ deleted: true });
  } catch (error) {
    res.status(500).json({ error: "Could not delete application" });
  }
});
router.get("/admin/db-status", requireChatmodzAuth, requireChatmodzAdmin, async (_req, res) => {
  try {
    const supabaseHealth = await checkSupabaseConnection();
    res.json({
      supabase: supabaseHealth,
      mysql: {
        configured: Boolean(process.env.CHATMODZ_DATABASE_URL),
        active: isUsingMySQL()
      },
      activeMode: supabaseHealth.connected ? "supabase_postgres" : isUsingMySQL() ? "mysql" : "in_memory",
      stats: {
        operatorsCount: memoryDb.operators.length,
        applicationsCount: memoryDb.applications.length,
        conversationsCount: memoryDb.conversations.length,
        sitesCount: memoryDb.sites.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Could not retrieve database status" });
  }
});
router.get("/admin/sql-schema", requireChatmodzAuth, requireChatmodzAdmin, async (_req, res) => {
  try {
    const schemaPath = path.join(process.cwd(), "database", "schema.supabase.sql");
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, "utf8");
      return res.json({ sql });
    }
    res.status(404).json({ error: "schema.supabase.sql not found on disk" });
  } catch (error) {
    res.status(500).json({ error: "Could not load schema" });
  }
});
router.get("/admin/operators", requireChatmodzAuth, requireChatmodzAdmin, async (_req, res) => {
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from("operators").select("id, public_id, full_name, email, role, status, last_active_at, created_at").order("created_at", { ascending: false });
        if (!error && data && data.length > 0) return res.json({ operators: data });
      } catch {
      }
    }
    if (isUsingMySQL()) {
      const operators = await executeMySQLQuery("SELECT id, public_id, full_name, email, role, status, last_active_at, created_at FROM operators ORDER BY created_at DESC");
      return res.json({ operators });
    }
    res.json({
      operators: memoryDb.operators.map((op) => ({
        id: op.id,
        public_id: op.public_id,
        full_name: op.full_name,
        email: op.email,
        role: op.role,
        status: op.status,
        last_active_at: op.last_active_at,
        created_at: op.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({ error: "Operators unavailable" });
  }
});
router.post("/admin/operators/create", requireChatmodzAuth, requireChatmodzAdmin, async (req, res) => {
  const { fullName, email, password, role = "operator" } = req.body || {};
  if (!String(fullName || "").trim() || !String(email || "").includes("@") || !String(password || "").trim()) {
    return res.status(400).json({ error: "Name, valid email, and password are required" });
  }
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(fullName).trim();
  const publicId = `cmz_${role === "admin" ? "admin" : "oper"}_${crypto.randomBytes(6).toString("hex")}`;
  const passwordHash = await bcrypt2.hash(String(password), 10);
  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.from("operators").insert({
        public_id: publicId,
        full_name: cleanName,
        email: cleanEmail,
        password_hash: passwordHash,
        role: role === "admin" ? "admin" : "operator",
        status: "active"
      }).select().single();
      if (!error && data) {
        memoryDb.operators.push({
          id: data.id,
          public_id: publicId,
          full_name: cleanName,
          email: cleanEmail,
          password_hash: passwordHash,
          role: role === "admin" ? "admin" : "operator",
          status: "active",
          created_at: /* @__PURE__ */ new Date()
        });
        return res.status(201).json({ created: true, operator: publicOperator(data) });
      }
    }
    if (isUsingMySQL()) {
      const result = await executeMySQLQuery(
        "INSERT INTO operators (public_id, full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, 'active')",
        [publicId, cleanName, cleanEmail, passwordHash, role]
      );
      return res.status(201).json({ created: true, id: result.insertId });
    }
    const newId = memoryDb.operators.length + 1;
    const newOp = {
      id: newId,
      public_id: publicId,
      full_name: cleanName,
      email: cleanEmail,
      password_hash: passwordHash,
      role: role === "admin" ? "admin" : "operator",
      status: "active",
      created_at: /* @__PURE__ */ new Date()
    };
    memoryDb.operators.push(newOp);
    res.status(201).json({ created: true, operator: publicOperator(newOp) });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Could not create operator" });
  }
});
router.post("/admin/operators/:id/status", requireChatmodzAuth, requireChatmodzAdmin, async (req, res) => {
  const status = String(req.body?.status || "");
  const operatorId = Number(req.params.id);
  if (!["training", "active", "suspended", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Invalid operator status" });
  }
  try {
    if (isUsingMySQL()) {
      await executeMySQLQuery("UPDATE operators SET status = ? WHERE id = ?", [status, operatorId]);
    } else {
      const op = memoryDb.operators.find((o) => o.id === operatorId);
      if (op) op.status = status;
    }
    res.json({ updated: true });
  } catch (error) {
    res.status(500).json({ error: "Could not update operator" });
  }
});
router.get("/admin/sites", requireChatmodzAuth, requireChatmodzAdmin, async (_req, res) => {
  try {
    if (isUsingMySQL()) {
      const sites = await executeMySQLQuery("SELECT id, internal_name, display_name, status, integration_type, endpoint_base_url, secret_env_key, created_at, updated_at FROM sites ORDER BY created_at DESC");
      return res.json({ sites });
    }
    res.json({ sites: memoryDb.sites });
  } catch (error) {
    res.status(500).json({ error: "Sites unavailable" });
  }
});
router.post("/admin/sites", requireChatmodzAuth, requireChatmodzAdmin, async (req, res) => {
  const { internalName, displayName, endpointBaseUrl, secretEnvKey, integrationType = "hybrid" } = req.body || {};
  if (!/^[a-z0-9_-]{2,120}$/.test(String(internalName || "")) || !String(displayName || "").trim() || !/^[A-Z_][A-Z0-9_]*$/.test(String(secretEnvKey || ""))) {
    return res.status(400).json({ error: "Internal name, display name, and an uppercase secret environment key are required" });
  }
  try {
    const configuredSecret = process.env[String(secretEnvKey)] || "";
    if (isUsingMySQL()) {
      await executeMySQLQuery(
        "INSERT INTO sites (internal_name, display_name, endpoint_base_url, secret_env_key, signing_secret_hash, integration_type) VALUES (?, ?, ?, ?, ?, ?)",
        [internalName, displayName.trim(), String(endpointBaseUrl || "").trim() || null, secretEnvKey, configuredSecret ? sha256(configuredSecret) : null, integrationType]
      );
    } else {
      memoryDb.sites.push({
        id: memoryDb.sites.length + 1,
        internal_name: internalName,
        display_name: displayName.trim(),
        endpoint_base_url: String(endpointBaseUrl || "").trim() || null,
        secret_env_key: secretEnvKey,
        signing_secret_hash: configuredSecret ? sha256(configuredSecret) : null,
        integration_type: integrationType,
        status: "active",
        created_at: /* @__PURE__ */ new Date()
      });
    }
    res.status(201).json({ created: true });
  } catch (error) {
    res.status(error?.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error?.code === "ER_DUP_ENTRY" ? "Site already exists" : "Could not create site" });
  }
});
router.post("/admin/sites/:id/status", requireChatmodzAuth, requireChatmodzAdmin, async (req, res) => {
  const status = String(req.body?.status || "");
  const siteId = Number(req.params.id);
  if (!["active", "paused", "disconnected"].includes(status)) {
    return res.status(400).json({ error: "Invalid site status" });
  }
  try {
    if (isUsingMySQL()) {
      await executeMySQLQuery("UPDATE sites SET status = ? WHERE id = ?", [status, siteId]);
    } else {
      const site = memoryDb.sites.find((s) => s.id === siteId);
      if (site) site.status = status;
    }
    res.json({ updated: true });
  } catch (error) {
    res.status(500).json({ error: "Could not update site" });
  }
});
router.get("/admin/report", requireChatmodzAuth, requireChatmodzAdmin, async (_req, res) => {
  try {
    if (isUsingMySQL()) {
      const [summary] = await executeMySQLQuery(
        "SELECT COUNT(DISTINCT c.id) AS conversations, COUNT(DISTINCT CASE WHEN m.sender_type = 'managed_profile' THEN m.id END) AS replies, SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) AS failed_deliveries FROM conversations c LEFT JOIN messages m ON m.conversation_id = c.id LEFT JOIN integration_deliveries d ON d.conversation_id = c.id"
      );
      const byOperator2 = await executeMySQLQuery(
        "SELECT o.id, o.full_name AS name, COUNT(m.id) AS replies FROM operators o LEFT JOIN messages m ON m.sent_by_operator_id = o.id GROUP BY o.id, o.full_name ORDER BY replies DESC"
      );
      const bySite2 = await executeMySQLQuery(
        "SELECT s.id, s.internal_name, s.display_name, s.status, COUNT(DISTINCT c.id) AS conversations, SUM(CASE WHEN d.status = 'failed' THEN 1 ELSE 0 END) AS failed_deliveries FROM sites s LEFT JOIN conversations c ON c.site_id = s.id LEFT JOIN integration_deliveries d ON d.site_id = s.id GROUP BY s.id, s.internal_name, s.display_name, s.status ORDER BY conversations DESC"
      );
      return res.json({ summary: summary || { conversations: 0, replies: 0, failed_deliveries: 0 }, byOperator: byOperator2, bySite: bySite2 });
    }
    const totalConvs = memoryDb.conversations.length;
    const replies = memoryDb.messages.filter((m) => m.sender_type === "managed_profile").length;
    const failedDeliveries = memoryDb.deliveries.filter((d) => d.status === "failed").length;
    const byOperator = memoryDb.operators.map((op) => ({
      id: op.id,
      name: op.full_name,
      replies: memoryDb.messages.filter((m) => m.sent_by_operator_id === op.id).length
    }));
    const bySite = memoryDb.sites.map((site) => ({
      id: site.id,
      internal_name: site.internal_name,
      display_name: site.display_name,
      status: site.status,
      conversations: memoryDb.conversations.filter((c) => c.site_id === site.id).length,
      failed_deliveries: memoryDb.deliveries.filter((d) => d.site_id === site.id && d.status === "failed").length
    }));
    res.json({
      summary: { conversations: totalConvs, replies, failed_deliveries: failedDeliveries },
      byOperator,
      bySite
    });
  } catch (error) {
    res.status(500).json({ error: "Report unavailable" });
  }
});
router.post("/media/upload", requireChatmodzAuth, async (req, res) => {
  try {
    const filename = `media_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.jpg`;
    const dummyUrl = `/api/uploads/${filename}`;
    res.json({ url: dummyUrl, type: "image", filename });
  } catch (error) {
    res.status(500).json({ error: "Upload failed" });
  }
});
var chatmodz_default = router;

// server/app.ts
function createApp() {
  const app2 = express();
  app2.use(cors());
  app2.use((req, _res, next) => {
    const rawForwarded = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"];
    if (rawForwarded && typeof rawForwarded === "string" && rawForwarded.startsWith("/api") && req.url !== rawForwarded) {
      req.url = rawForwarded;
    }
    next();
  });
  app2.use(
    express.json({
      limit: "50mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app2.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "chatmodz" });
  });
  const handleMediaUpload = (req, res) => {
    try {
      const fileId = `media_${Date.now()}_${crypto2.randomBytes(6).toString("hex")}.jpg`;
      const contentType = req.headers["content-type"] || "image/jpeg";
      mediaStorage.set(fileId, {
        buffer: Buffer.from([]),
        mimeType: contentType,
        filename: fileId,
        size: 0
      });
      const publicUrl = `/api/uploads/${fileId}`;
      res.json({
        url: publicUrl,
        type: contentType.includes("video") ? "video" : contentType.includes("audio") ? "audio" : "image",
        filename: fileId
      });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  };
  app2.post("/api/chat/upload", handleMediaUpload);
  app2.post("/api/chatmodz/media/upload", handleMediaUpload);
  const handleMediaServe = (req, res) => {
    const filename = String(req.params.file || "");
    const item = mediaStorage.get(filename);
    if (item && item.buffer.length > 0) {
      res.setHeader("Content-Type", item.mimeType);
      return res.send(item.buffer);
    }
    const initials = filename.slice(0, 2).toUpperCase();
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#2d3748" rx="20"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="64" font-weight="600">${initials}</text>
      </svg>
    `.trim());
  };
  app2.get("/api/uploads/:file", handleMediaServe);
  app2.get("/api/chatmodz/media/:file", handleMediaServe);
  app2.use("/api/chatmodz", chatmodz_default);
  return app2;
}

// server/serverless.ts
var app = createApp();
function handler(req, res) {
  return app(req, res);
}
export {
  handler as default
};
