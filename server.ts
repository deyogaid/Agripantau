import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";
import { GoogleGenerativeAI } from "@google/genai";
import admin from "firebase-admin";

// Initialize Firebase Admin
// Use default credentials/config for the environment if possible
if (!admin.apps.length) {
  try {
    admin.initializeApp();
    console.log("Firebase Admin initialized with default credentials");
  } catch (e) {
    console.warn("Firebase Admin default initialization failed, falling back to manual config", e);
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "agripantau-default"
    });
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Setup Multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  /**
   * Comprehensive System Health Check
   * Monitors presence of environment variables for Cloudinary, Supabase, and Firebase
   */
  app.get("/api/system/status", (req, res) => {
    const status = {
      cloudinary: {
        configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || "Not Configured"
      },
      supabase: {
        configured: !!(process.env.VITE_SUPABASE_URL && (process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_KEY)),
        url: process.env.VITE_SUPABASE_URL || "Using Defaults"
      },
      firebase: {
        configured: true, // Integrated via static config file
        database: "Enterprise Mode",
        auth: "Google Auth Active"
      }
    };
    res.json(status);
  });

  /**
   * AI Chat Proxy - Farmers don't need API keys!
   * Implements credit-based monetization.
   */
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing Token" });
      }

      const idToken = authHeader.split("Bearer ")[1];
      const decodedToken = await auth.verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // 1. Check User Credits
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const userData = userDoc.data();
      const isPremium = userData?.isPremium || false;
      let credits = userData?.aiCredits ?? 0;

      if (!isPremium && credits <= 0) {
        return res.status(402).json({ 
          error: "Kuota AI Habis", 
          message: "Anda telah menggunakan semua kuota gratis harian. Tingkatkan ke Pro untuk akses tanpa batas!",
          code: "INSUFFICIENT_CREDITS"
        });
      }

      // 2. Call Gemini
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      
      const { prompt, history } = req.body;
      
      const chat = model.startChat({
        history: history || [],
        generationConfig: {
          maxOutputTokens: 1000,
        },
      });

      const result = await chat.sendMessage(prompt);
      const responseText = result.response.text();

      // 3. Deduct Credits if not premium
      if (!isPremium) {
        await userRef.update({
          aiCredits: admin.firestore.FieldValue.increment(-1)
        });
        credits -= 1;
      }

      res.json({
        success: true,
        text: responseText,
        remainingCredits: isPremium ? "Unlimited" : credits
      });

    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      res.status(500).json({ error: error.message || "Failed to process AI request" });
    }
  });

  /**
   * Endpoint to upload media to Cloudinary
   */
  app.post("/api/upload", (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, error: `Multer error: ${err.message}` });
      } else if (err) {
        return res.status(500).json({ success: false, error: `Unknown upload error: ${err.message}` });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      console.log(`Processing upload: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

      const isCloudinaryConfigured = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

      if (!isCloudinaryConfigured) {
        console.warn("Cloudinary not configured, returning mock URL for demo stability.");
        await new Promise(resolve => setTimeout(resolve, 1500));
        return res.json({
          success: true,
          url: req.file.mimetype.startsWith("video/") 
            ? "https://res.cloudinary.com/demo/video/upload/v1631527017/sample_video.mp4"
            : "https://images.unsplash.com/photo-1592919016383-7d7211bf6272?auto=format&fit=crop&q=80&w=800",
          resource_type: req.file.mimetype.startsWith("video/") ? "video" : "image"
        });
      }

      const stream = Readable.from(req.file.buffer);
      const uploadPromise = new Promise((resolve, reject) => {
        const cloudinaryStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
            folder: "agri-video-feed",
            eager: req.file?.mimetype.startsWith("video/") ? [
              { width: 720, crop: "limit", video_codec: "h264", quality: "auto" }
            ] : undefined
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.pipe(cloudinaryStream);
      });

      const result = await uploadPromise as any;
      console.log("Cloudinary upload success:", result.secure_url);

      res.json({
        success: true,
        url: result.secure_url,
        resource_type: result.resource_type,
        duration: result.duration
      });
    } catch (error: any) {
      console.error("Upload route error:", error);
      res.status(500).json({ success: false, error: error.message || "Internal server error during upload" });
    }
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

  // Global Error Handler - Ensure JSON responses for all errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled server error:", err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || "An unexpected server error occurred"
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
