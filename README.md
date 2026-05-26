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
    API <-->|Generates Embeddings & Chat| OpenAI["OpenAI API"]
```

### 2. Crawling & Indexing Flow
```mermaid
sequenceDiagram
    participant Dashboard
    participant API as FastAPI Backend
    participant Crawler as Background Task (Crawler)
    participant OpenAI
    participant DB as MongoDB Vector Search
    
    Dashboard->>API: POST /crawl (Seed URL)
    API->>DB: Create Crawl Job Status
    API-->>Dashboard: Return Job ID
    API-)Crawler: Trigger Async Crawl Task
    
    loop For each page in domain
        Crawler->>Crawler: Scrape HTML & Extract Text
        Crawler->>Crawler: Chunk text (512 tokens)
        loop For each chunk
            Crawler->>OpenAI: Create Embedding (text-embedding-3-small)
            OpenAI-->>Crawler: Return 1536-dim vector
            Crawler->>DB: Store chunk + vector + URL
        end
    end
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
    DB-->>API: Top 5 Relevant Chunks
    
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
Create a `.env` file in the root directory (or export them):
```bash
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
OPENAI_API_KEY=sk-your-openai-api-key
FIRECRAWL_API_KEY=fc-your-firecrawl-api-key
JWT_SECRET=your-super-secret-jwt-key
ALLOWED_ORIGINS=*
VITE_API_BASE_URL=http://localhost:8000
```

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
