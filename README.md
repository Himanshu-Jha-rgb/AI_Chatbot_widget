# AI Chatbot Widget SaaS

A multi-tenant SaaS platform where clients can sign up, crawl their websites, and embed an AI-powered chat widget.

## Architecture Overview

### 1. System Architecture
```mermaid
graph TD
    Client["Tenant (Client)"] -->|Logs in & manages settings| Dashboard["React Dashboard"]
    Dashboard <-->|JWT Auth| API["FastAPI Backend"]
    
    EndUser["End User"] -->|Browses Client's Website| Widget["React Chat Widget"]
    Widget <-->|API Key Auth| API
    
    API <-->|Stores Tenants, Jobs, Chunks| MongoDB[("MongoDB Atlas")]
    API <-->|Crawls websites| Firecrawl["Firecrawl API"]
    API <-->|Generates Embeddings & Chat| OpenAI["OpenAI API"]
```

### 2. Firecrawl Crawling & Indexing Flow
Firecrawl handles site crawling and markdown extraction. The backend splits each page into parent sections by markdown headings, embeds token-based child chunks from those sections, and stores the indexed content in MongoDB.

```mermaid
sequenceDiagram
    participant Dashboard
    participant API as FastAPI Backend
    participant Crawler as Background Task (Crawler)
    participant Firecrawl
    participant OpenAI
    participant DB as MongoDB Vector Search
    
    Dashboard->>API: POST /dashboard/crawl (Seed URL)
    API->>DB: Create Crawl Job Status
    API-->>Dashboard: Return Job ID
    API-)Crawler: Trigger Async Crawl Task
    Crawler->>DB: Mark Crawl Job as Running
    Crawler->>Firecrawl: Start crawl job
    Firecrawl-->>Crawler: Return Firecrawl Job ID
    
    loop Until crawl completes
        Crawler->>Firecrawl: Poll crawl status
        Firecrawl-->>Crawler: Status and crawled pages
    end
    
    loop For each page in domain
        Crawler->>DB: Store page content
        Crawler->>Crawler: Split markdown into parent sections by headings/title
        loop For each chunk batch
            Crawler->>OpenAI: Create token-based child chunk embeddings (text-embedding-3-small)
            OpenAI-->>Crawler: Return 1536-dim vectors
            Crawler->>DB: Store parent sections + child chunks + vectors + URLs
        end
    end
    Crawler->>DB: Remove older indexed versions for refreshed URLs
    Crawler->>DB: Mark Crawl Job as Done
```

### 3. Chat Request Flow
```mermaid
sequenceDiagram
    participant Widget
    participant API as FastAPI Backend
    participant DB as MongoDB Vector Search
    participant OpenAI
    
    Widget->>API: POST /chat {query, session_id, url}
    API->>OpenAI: Embed user query
    OpenAI-->>API: Query Vector
    
    API->>DB: $vectorSearch (Query Vector, tenant_id)
    DB-->>API: Top relevant child chunks with capped parent/window context
    API->>DB: Load conversation history
    
    API->>OpenAI: ChatCompletion with Context (GPT-4o)
    OpenAI-->>API: Final Answer
    
    API->>DB: Save to conversation history
    API-->>Widget: Answer + Sources
```

## Prerequisites
- Docker & Docker Compose
- MongoDB Atlas cluster
- OpenAI API Key
- Firecrawl API Key

## 1. Setup Environment
Use `backend/.env.example` as the template:

```bash
cp backend/.env.example .env
```

For Docker Compose, keep the copied `.env` in the project root. For manual backend development, you can also copy it to `backend/.env` because the backend loads `.env` from its working directory.

Update the values:
```bash
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
FIRECRAWL_API_KEY=fc-your-firecrawl-api-key-here
JWT_SECRET=your-super-secret-jwt-key
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
VITE_API_BASE_URL=http://localhost:8000
```

`VITE_API_BASE_URL` is used when building the dashboard so browser requests and generated widget snippets point to the backend.

## 2. MongoDB Atlas Vector Search Setup
1. Open MongoDB Atlas and navigate to your cluster.
2. Go to the "Atlas Search" tab and click "Create Search Index".
3. Select "JSON Editor".
4. Database: `chatbot_db`, Collection: `chunks`
5. Index Name: `vector_index`
6. Paste the JSON from `mongodb_index.json`:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "embedding",
      "numDimensions": 1536,
      "similarity": "cosine"
    },
    {
      "type": "filter",
      "path": "tenant_id"
    },
    {
      "type": "filter",
      "path": "url"
    }
  ]
}
```
7. Click "Next" and "Create Search Index".

The backend also creates regular MongoDB lookup indexes on startup for parent-child retrieval:
- `parents`: `tenant_id`, `parent_id`
- `chunks`: `tenant_id`, `parent_id`, `child_index`
- `pages`: `tenant_id`, `url`

## 3. Run the Platform

### Option A: Using Docker (Recommended)
Start the services using Docker Compose:
```bash
docker-compose up --build
```
This will:
- Build the widget bundle
- Start the FastAPI backend on `http://localhost:8000`
- Start the React Dashboard on `http://localhost:3000`

For deployed environments, set `VITE_API_BASE_URL` before building the dashboard so its API calls and generated widget snippet point at your backend URL.

### Option B: Without Docker (Manual Setup)
If you prefer running the services locally without Docker, you will need three separate terminal windows.

**Terminal 1: Build the Widget**
```bash
cd widget
npm install
npm run build
```

**Terminal 2: Start the Backend**
```bash
cd backend
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*(Note: If using `uv`, you can run `uv pip install -r requirements.txt` instead of regular pip).*

**Terminal 3: Start the Dashboard**
```bash
cd dashboard
npm install
export VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

## 4. Usage
1. Open the Dashboard at `http://localhost:3000`.
2. Register a new tenant.
3. Go to Settings to copy your widget script tag.
4. Go to Crawl Jobs and start a crawl of your website (e.g., `https://example.com`).
5. Add the copied script tag to your site's HTML file.
6. Interact with the chat widget!
