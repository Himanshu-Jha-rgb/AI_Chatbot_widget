# Deployment Guide: Render (Backend) & Vercel (Frontend)

This guide walks you through deploying the AI Chatbot Widget project for free using Render for your FastAPI backend and Vercel for your React frontends (Dashboard and Widget).

## Prerequisites
1. Your code must be pushed to a GitHub repository.
2. You must have your MongoDB Atlas connection string (`mongodb+srv://...`) ready.
3. You must have your OpenAI API key ready.

---

## 1. Deploy the Backend on Render
Render is a cloud platform that makes it easy to host Python applications for free.

### Steps:
1. Go to [Render.com](https://render.com) and create an account using your GitHub.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your `AI_Chatbot_widget` repository.
4. Fill in the deployment details:
   - **Name**: `chatbot-backend` (or similar)
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Scroll down to **Environment Variables** and click **Add Environment Variable**. Add the following:

   **Required:**
   - `MONGODB_URI`: Your MongoDB Atlas connection string.
   - `OPENAI_API_KEY`: Your OpenAI API Key.
   - `ADMIN_USERNAME`: `admin` (or your preferred admin username).
   - `ADMIN_PASSWORD`: `admin123` (or your preferred admin password).

   **JWT_SECRET** — Generate a strong, random string (do NOT use a guessable value). You can run this in your terminal to generate one:
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
   Paste the output as the value.

   **ALLOWED_ORIGINS** — Set this to your future Vercel Dashboard URL (e.g., `https://chatbot-dashboard-xyz.vercel.app`). If you run into CORS issues during initial setup, you can temporarily set it to `*`.

   **COOKIE_SECURE** — Set to `True`. Local dev uses HTTP, but Render uses HTTPS. This ensures session cookies work properly over the secure connection.

   **COOKIE_SAMESITE** — Set to `none`. The widget sends cookies while embedded on third-party domains, so SameSite must be `none`.

   **ENFORCE_DOMAIN** — Leave as `False` for now. Set to `True` later if you want to prevent unauthorized websites from stealing your tenants' API keys.

   > ⚠️ **Important:** Do NOT add `VITE_API_BASE_URL` to your Render backend. Any variable starting with `VITE_` belongs exclusively to your frontend apps (Dashboard and Widget). That goes into Vercel, not Render.
6. Select the **Free** instance type at the bottom.
7. Click **Create Web Service**.

> **Important**: Once the deployment finishes, copy your new backend URL from the top left of the Render dashboard (it will look like `https://chatbot-backend-xyz.onrender.com`). You will need this for the frontend!

---

## 2. Deploy the Dashboard on Vercel
Vercel is optimized for React/Vite applications and provides blazing fast free hosting.

### Steps:
1. Go to [Vercel.com](https://vercel.com) and log in with GitHub.
2. Click **Add New Project**.
3. Import your `AI_Chatbot_widget` repository.
4. In the **Configure Project** section:
   - **Project Name**: `chatbot-dashboard`
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select the `dashboard` folder.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Open the **Environment Variables** dropdown and add:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://chatbot-backend-xyz.onrender.com` *(Your Render backend URL — **not** `http://localhost:8000`)*
6. Click **Deploy**.

Once finished, Vercel will give you a live URL where your tenant and admin dashboards are accessible!

---

## 3. Deploy the Widget on Vercel
Your tenants will embed the widget via a `<script>` tag. This script needs to be hosted on a CDN, which Vercel will handle for you.

### Steps:
1. Go back to your Vercel dashboard and click **Add New Project** again.
2. Import the exact same `AI_Chatbot_widget` repository.
3. In the **Configure Project** section:
   - **Project Name**: `chatbot-widget-script`
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click `Edit` and select the `widget` folder.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Open the **Environment Variables** dropdown and add:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://chatbot-backend-xyz.onrender.com` *(Same as above, your Render URL)*
5. Click **Deploy**.

### How Tenants Will Use It
Once Vercel finishes deploying the widget, you will get a URL like `https://chatbot-widget-script.vercel.app`.

Your tenants can now embed the chatbot into their own websites by pasting this snippet into their HTML:
```html
<script 
  src="https://chatbot-widget-script.vercel.app/widget.js" 
  data-api-key="sk_live_YOUR_TENANTS_API_KEY"
  defer>
</script>
```

You're completely done! Your full SaaS application is now live on the internet.
