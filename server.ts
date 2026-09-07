import express from "express"
import path from "path"
import { createApp } from "./server/app"

async function startServer() {
  const app = createApp()
  const PORT = 3000

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite")
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(process.cwd(), "dist")
    app.use(express.static(distPath))
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"))
    })
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Chatmodz server running on http://0.0.0.0:${PORT}`)
  })
}

// Only start the standalone server if not running inside a Vercel serverless environment
if (!process.env.VERCEL) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error)
  })
}

export { createApp }
export default createApp
