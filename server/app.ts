import express from "express"
import cors from "cors"
import crypto from "node:crypto"
import chatmodzRouter, { mediaStorage } from "./chatmodz"

export function createApp() {
  const app = express()

  // Enable CORS
  app.use(cors())

  // Middleware to preserve original URL on serverless platforms (e.g. Vercel rewrites)
  app.use((req, _res, next) => {
    const rawForwarded = req.headers["x-matched-path"] || req.headers["x-forwarded-uri"]
    if (rawForwarded && typeof rawForwarded === "string" && rawForwarded.startsWith("/api") && req.url !== rawForwarded) {
      req.url = rawForwarded
    }
    next()
  })

  // Raw body capture for HMAC verification & JSON parsing
  app.use(
    express.json({
      limit: "50mb",
      verify: (req: any, _res, buf) => {
        req.rawBody = buf
      },
    }),
  )
  app.use(express.urlencoded({ extended: true, limit: "50mb" }))

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "chatmodz" })
  })

  // Media upload handler (supporting /api/chat/upload and /api/chatmodz/media/upload)
  const handleMediaUpload = (req: express.Request, res: express.Response) => {
    try {
      const fileId = `media_${Date.now()}_${crypto.randomBytes(6).toString("hex")}.jpg`
      const contentType = req.headers["content-type"] || "image/jpeg"

      // Store in mediaStorage
      mediaStorage.set(fileId, {
        buffer: Buffer.from([]),
        mimeType: contentType,
        filename: fileId,
        size: 0,
      })

      const publicUrl = `/api/uploads/${fileId}`
      res.json({
        url: publicUrl,
        type: contentType.includes("video") ? "video" : contentType.includes("audio") ? "audio" : "image",
        filename: fileId,
      })
    } catch (error) {
      res.status(500).json({ error: "Upload failed" })
    }
  }

  app.post("/api/chat/upload", handleMediaUpload)
  app.post("/api/chatmodz/media/upload", handleMediaUpload)

  // Media serving handler (for /api/uploads/:file and /api/chatmodz/media/:file)
  const handleMediaServe = (req: express.Request, res: express.Response) => {
    const filename = String(req.params.file || "")
    const item = mediaStorage.get(filename)
    if (item && item.buffer.length > 0) {
      res.setHeader("Content-Type", item.mimeType)
      return res.send(item.buffer)
    }

    // Return a sleek SVG avatar placeholder if media file not found
    const initials = filename.slice(0, 2).toUpperCase()
    res.setHeader("Content-Type", "image/svg+xml")
    res.send(`
      <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#2d3748" rx="20"/>
        <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="64" font-weight="600">${initials}</text>
      </svg>
    `.trim())
  }

  app.get("/api/uploads/:file", handleMediaServe)
  app.get("/api/chatmodz/media/:file", handleMediaServe)

  // Mount Chatmodz API router
  app.use("/api/chatmodz", chatmodzRouter)

  return app
}

export default createApp
