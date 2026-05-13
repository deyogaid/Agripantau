import { supabase } from '../lib/supabase';

/**
 * VercelBridge handles the synchronization between this prototype 
 * and the main Vercel/v0 deployment.
 */
export const VercelBridge = {
  /**
   * Syncs a local report to the Vercel Backend API
   */
  async syncToMainBranch(payload: any) {
    const vercelUrl = import.meta.env.VITE_VERCEL_API_URL;
    if (!vercelUrl) {
      console.warn("Vercel API URL not configured. Sync skipped.");
      return { success: false, reason: "URL_MISSING" };
    }

    try {
      const response = await fetch(`${vercelUrl}/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Source': 'AI-Studio-Prototype',
          'X-Vercel-Project-Id': import.meta.env.VITE_VERCEL_PROJECT_ID || '',
          'X-Vercel-User-Id': import.meta.env.VITE_VERCEL_USER_ID || ''
        },
        body: JSON.stringify({
          ...payload,
          vercelContext: {
            projectId: import.meta.env.VITE_VERCEL_PROJECT_ID,
            userId: import.meta.env.VITE_VERCEL_USER_ID
          }
        })
      });
      
      if (!response.ok) throw new Error(`Sync failed: ${response.statusText}`);
      
      return { success: true, data: await response.json() };
    } catch (err) {
      console.error("Vercel Bridge Error:", err);
      return { success: false, reason: "NETWORK_ERROR", error: err };
    }
  },

  /**
   * Triggers a new deployment on Vercel using the Deploy Hook
   */
  async triggerDeploy() {
    const deployHook = import.meta.env.VITE_VERCEL_DEPLOY_HOOK;
    if (!deployHook) return { success: false, reason: "HOOK_MISSING" };

    try {
      const response = await fetch(deployHook, { method: 'POST' });
      if (!response.ok) throw new Error("Deployment trigger failed");
      
      return { success: true, data: await response.json() };
    } catch (err) {
      console.error("Deploy Trigger Error:", err);
      return { success: false, reason: "FETCH_ERROR", error: err };
    }
  },

  /**
   * Checks the health of the Vercel connection
   */
  async checkConnection() {
    const vercelUrl = import.meta.env.VITE_VERCEL_API_URL;
    if (!vercelUrl) return 'NOT_CONFIGURED';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`${vercelUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      return res.ok ? 'CONNECTED' : 'SERVER_ERROR';
    } catch (e) {
      return 'UNREACHABLE';
    }
  }
};
