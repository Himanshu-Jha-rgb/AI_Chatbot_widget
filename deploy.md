# Deployment Guide — Single-Platform (Render)

Everything runs from one service on Render: FastAPI backend + dashboard + widget.

## Prerequisites
1. Push your code to a GitHub repository.
2. Have your MongoDB Atlas connection string and OpenAI API key ready.

---

## Deploy on Render

1. Go to [Render.com](https://render.com) and sign up via GitHub.

2. Click **New +** → **Web Service** → select your `AI_Chatbot_widget` repo.

3. Fill in:
   - **Name**: `chatbot-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**:
     ```bash
     cd ../widget && npm install && npm run build && cd ../dashboard && npm install && npm run build && cd ../backend && uv sync --frozen && uv cache prune --ci
     ```
   - **Start Command**:
     ```
     uv run uvicorn main:app --host 0.0.0.0 --port $PORT
     ```

4. Add environment variables:
   - `MONGODB_URI` — your Atlas connection string
   - `OPENAI_API_KEY` — your OpenAI key
   - `JWT_SECRET` — run `python3 -c "import secrets; print(secrets.token_urlsafe(48))"` and paste the output
   - `ADMIN_USERNAME` — e.g. `admin`
   - `ADMIN_PASSWORD` — a strong password
   - `ALLOWED_ORIGINS` — `*` (or your domain if you have one)
   - `COOKIE_SECURE` — `True`
   - `COOKIE_SAMESITE` — `none`

5. Select **Free** instance, click **Create Web Service**.

---

## URLs after deployment

| What | URL |
|---|---|
| Dashboard | `https://chatbot-backend-xyz.onrender.com/dashboard/` |
| Widget script | `https://chatbot-backend-xyz.onrender.com/static/widget.js` |
| API docs | `https://chatbot-backend-xyz.onrender.com/docs` |

---

## Rebuilding the Dashboard

After making changes to the dashboard code, push to GitHub. Render auto-deploys and rebuilds both the frontend and backend together.
