import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  /**
   * Endpoint to "process" product listings before they are saved.
   * This represents the backend processing logic requested.
   */
  app.post("/api/process-product", (req, res) => {
    const { commodity, description, price } = req.body;
    
    // Logic simulation: Enhance description or check price validity
    let processedDescription = description;
    const warnings = [];

    if (description && description.length < 10) {
      processedDescription += "\n\n(Catatan: Deskripsi singkat, disarankan tambah info kesegaran)";
    }

    if (price < 1000) {
      warnings.push("Harga terdeteksi sangat rendah. Pastikan satuan benar (per kg).");
    }

    res.json({
      success: true,
      processedData: {
        ...req.body,
        description: processedDescription,
        processedAt: new Date().toISOString()
      },
      warnings
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
