import { createPool, type Pool, type PoolConnection } from "mysql2/promise"
import crypto from "node:crypto"
import bcrypt from "bcryptjs"

export type Operator = {
  id: number
  public_id: string
  full_name: string
  email: string
  password_hash: string
  role: "operator" | "admin"
  status: "pending" | "training" | "active" | "suspended" | "rejected"
  last_active_at?: Date | string | null
  created_at?: Date | string
  updated_at?: Date | string
}

export type OperatorApplication = {
  id: number
  full_name: string
  email: string
  location?: string | null
  experience?: string | null
  status: "pending" | "approved" | "training" | "active" | "rejected"
  reviewed_by?: number | null
  reviewed_at?: Date | string | null
  created_at?: Date | string
  updated_at?: Date | string
}

export type OperatorActivationCode = {
  id: number
  operator_id: number
  code_hash: string
  expires_at: Date
  used_at?: Date | null
  revoked_at?: Date | null
  created_at?: Date
}

export type Site = {
  id: number
  internal_name: string
  display_name: string
  status: "active" | "paused" | "disconnected"
  integration_type: "inbound" | "outbound" | "hybrid"
  endpoint_base_url?: string | null
  secret_env_key?: string | null
  signing_secret_hash?: string | null
  created_at?: Date | string
  updated_at?: Date | string
}

export type Conversation = {
  id: number
  site_id: number
  external_conversation_id: string
  member_alias: string
  managed_profile_alias: string
  managed_profile_external_id?: string | null
  member_photo_url?: string | null
  managed_profile_photo_url?: string | null
  priority: "normal" | "high" | "urgent"
  status: "open" | "waiting" | "closed"
  assigned_operator_id?: number | null
  lock_expires_at?: Date | null
  last_message_at: Date
  created_at?: Date
  updated_at?: Date
}

export type Message = {
  id: number
  conversation_id: number
  external_message_id?: string | null
  sender_type: "member" | "managed_profile" | "system"
  body: string
  media_proxy_url?: string | null
  media_type?: string | null
  delivery_status: "received" | "queued" | "delivered" | "failed"
  sent_by_operator_id?: number | null
  sent_at: Date
}

export type IntegrationDelivery = {
  id: number
  site_id: number
  direction: "incoming" | "outgoing"
  external_event_id: string
  conversation_id?: number | null
  status: "received" | "processed" | "delivered" | "failed"
  attempt_count: number
  error_message?: string | null
  payload_json?: string | null
  received_at: Date
  delivered_at?: Date | null
}

export type OperatorActivity = {
  id: number
  operator_id: number
  activity_type: "login" | "claim" | "release" | "reply" | "logout" | "training"
  conversation_id?: number | null
  site_id?: number | null
  metadata_json?: string | null
  created_at: Date
}

export type PushSubscription = {
  id: number
  operator_id: number
  endpoint: string
  p256dh: string
  auth_key: string
  created_at?: Date
}

// In-Memory Data Store (Active when CHATMODZ_DATABASE_URL is not set or unavailable)
class MemoryDatabase {
  operators: Operator[] = []
  applications: OperatorApplication[] = []
  activationCodes: OperatorActivationCode[] = []
  sites: Site[] = []
  conversations: Conversation[] = []
  messages: Message[] = []
  deliveries: IntegrationDelivery[] = []
  activities: OperatorActivity[] = []
  pushSubscriptions: PushSubscription[] = []
  
  private nextId = {
    operators: 1,
    applications: 1,
    activationCodes: 1,
    sites: 1,
    conversations: 1,
    messages: 1,
    deliveries: 1,
    activities: 1,
    pushSubscriptions: 1,
  }

  constructor() {
    this.seedDefaults()
  }

  seedDefaults() {
    // 1. Initial Administrator
    const adminPasswordHash = bcrypt.hashSync("admin12345", 10)
    this.operators.push({
      id: this.nextId.operators++,
      public_id: "cmz_admin_001",
      full_name: "Operations Director",
      email: "admin@chatmodz.io",
      password_hash: adminPasswordHash,
      role: "admin",
      status: "active",
      last_active_at: new Date(),
      created_at: new Date(Date.now() - 30 * 86400000),
    })

    // 2. Active Operator
    const operatorPasswordHash = bcrypt.hashSync("operator12345", 10)
    this.operators.push({
      id: this.nextId.operators++,
      public_id: "cmz_oper_002",
      full_name: "Sarah Jenkins",
      email: "operator@chatmodz.io",
      password_hash: operatorPasswordHash,
      role: "operator",
      status: "active",
      last_active_at: new Date(),
      created_at: new Date(Date.now() - 14 * 86400000),
    })

    // 3. Connected Sites
    this.sites.push({
      id: this.nextId.sites++,
      internal_name: "cupid_connect",
      display_name: "CupidConnect UK",
      status: "active",
      integration_type: "hybrid",
      endpoint_base_url: "https://api.cupidconnect.example/v1/replies",
      secret_env_key: "CHATMODZ_CUPID_SECRET",
      created_at: new Date(Date.now() - 30 * 86400000),
    })

    this.sites.push({
      id: this.nextId.sites++,
      internal_name: "velvet_match",
      display_name: "Velvet Match US",
      status: "active",
      integration_type: "hybrid",
      endpoint_base_url: "https://api.velvetmatch.example/webhook",
      secret_env_key: "CHATMODZ_VELVET_SECRET",
      created_at: new Date(Date.now() - 25 * 86400000),
    })

    this.sites.push({
      id: this.nextId.sites++,
      internal_name: "rose_romance",
      display_name: "Rose Romance EU",
      status: "active",
      integration_type: "hybrid",
      endpoint_base_url: "https://api.roseromance.example/dispatch",
      secret_env_key: "CHATMODZ_ROSE_SECRET",
      created_at: new Date(Date.now() - 20 * 86400000),
    })

    // 4. Sample Operator Applications
    this.applications.push({
      id: this.nextId.applications++,
      full_name: "Natasha Romanoff",
      email: "natasha.chat@example.com",
      location: "Manchester, UK",
      experience: "3 years experience in high-volume community moderation and live customer engagement. Fast typing speed and native English fluency.",
      status: "pending",
      created_at: new Date(Date.now() - 2 * 86400000),
    })

    this.applications.push({
      id: this.nextId.applications++,
      full_name: "Julian Martinez",
      email: "julian.m@example.com",
      location: "Toronto, Canada",
      experience: "Experienced live chat specialist with background in dating & social app community retention. Available for evening shifts.",
      status: "pending",
      created_at: new Date(Date.now() - 1 * 86400000),
    })

    this.applications.push({
      id: this.nextId.applications++,
      full_name: "Amina Diallo",
      email: "amina.d@example.com",
      location: "Paris, France",
      experience: "Bilingual community support specialist. Strong adherence to persona guidelines and privacy compliance.",
      status: "approved",
      reviewed_by: 1,
      reviewed_at: new Date(Date.now() - 3600000),
      created_at: new Date(Date.now() - 4 * 86400000),
    })

    // 5. Sample Conversations & Messages
    const conv1Id = this.nextId.conversations++
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
      last_message_at: new Date(Date.now() - 4 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv1Id,
      external_message_id: "msg_cupid_101",
      sender_type: "member",
      body: "Hi Elena! I loved your pictures from the botanical gardens. Do you go there often?",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 45 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv1Id,
      external_message_id: "msg_cupid_102",
      sender_type: "managed_profile",
      body: "Thank you David! Yes, I try to visit whenever the weather is nice. I find photography so relaxing. What hobbies keep you busy?",
      delivery_status: "delivered",
      sent_by_operator_id: 2,
      sent_at: new Date(Date.now() - 20 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv1Id,
      external_message_id: "msg_cupid_103",
      sender_type: "member",
      body: "I do a lot of hiking on weekends and play acoustic guitar. Are you free for a coffee this Saturday afternoon?",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 4 * 60000),
    })

    const conv2Id = this.nextId.conversations++
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
      last_message_at: new Date(Date.now() - 12 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv2Id,
      external_message_id: "msg_velvet_201",
      sender_type: "member",
      body: "Hey Sophie, great connecting with you on here!",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 35 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv2Id,
      external_message_id: "msg_velvet_202",
      sender_type: "managed_profile",
      body: "Great to meet you too Alex! Have you lived in the city long?",
      delivery_status: "delivered",
      sent_by_operator_id: 2,
      sent_at: new Date(Date.now() - 22 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv2Id,
      external_message_id: "msg_velvet_203",
      sender_type: "member",
      body: "About 4 years now! I just tried that Italian bistro you mentioned earlier, the pasta was fantastic.",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 12 * 60000),
    })

    const conv3Id = this.nextId.conversations++
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
      last_message_at: new Date(Date.now() - 1 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv3Id,
      external_message_id: "msg_rose_301",
      sender_type: "member",
      body: "Hi Chloe, I noticed you're interested in modern art. Are you planning to attend the contemporary gallery opening this Friday?",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 1 * 60000),
    })

    const conv4Id = this.nextId.conversations++
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
      last_message_at: new Date(Date.now() - 28 * 60000),
    })
    this.messages.push({
      id: this.nextId.messages++,
      conversation_id: conv4Id,
      external_message_id: "msg_cupid_401",
      sender_type: "member",
      body: "Take your time getting back to me, I know work days can be hectic! Hope your week is going smoothly.",
      delivery_status: "delivered",
      sent_at: new Date(Date.now() - 28 * 60000),
    })
  }
}

export const memoryDb = new MemoryDatabase()

let mysqlPool: Pool | null = null

export function getDatabasePool(): Pool | null {
  const url = process.env.CHATMODZ_DATABASE_URL
  if (!url) return null
  if (!mysqlPool) {
    try {
      mysqlPool = createPool({ uri: url, waitForConnections: true, connectionLimit: 10, charset: "utf8mb4" })
    } catch (err) {
      console.warn("Could not create MySQL pool, falling back to local memory engine:", err)
      return null
    }
  }
  return mysqlPool
}

export function isUsingMySQL(): boolean {
  return Boolean(process.env.CHATMODZ_DATABASE_URL && mysqlPool)
}
