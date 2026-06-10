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
    API <-->|Embeddings / Chat / Query Rewriting| OpenAI["OpenAI API"]
```

### 2. Chat Flow
```mermaid
sequenceDiagram
    participant User as Website Visitor
    participant Widget as Chat Widget
    participant API as FastAPI Backend
    participant Rewriter as gpt-4o-mini<br/>(Query Rewriter)
    participant Vector as Vector Search
    participant BM25 as BM25 Full-Text
    participant GPT as gpt-4o

    User->>Widget: Types a question
    Widget->>API: POST /chat { query, session_id, api_key }
    
    API->>Rewriter: Rewrite & classify query
    Note over Rewriter: Returns (search_query, needs_search)
    
    alt Is greeting / small talk
        Rewriter-->>API: ("hi", needs_search=False)
        API->>GPT: Conversational prompt (no context)
        GPT-->>API: "Hello! How can I help?"
    
    else Is searchable query
        Rewriter-->>API: ("schoollog attendance features", needs_search=True)
        
        par Vector Search (semantic)
            API->>Vector: Embed query + $vectorSearch
            Vector-->>API: Top 3 unique parents
        and BM25 Search (keyword)
            API->>BM25: $search on text + section_title
            BM25-->>API: Top 2 unique parents
        end
        
        API->>API: Merge & dedup (3 vector + 2 BM25)
        API->>API: Expand child chunks to parent sections
        
        alt Relevant content found
            API->>GPT: RAG prompt with context
            GPT-->>API: Answer with citations
        else No relevant content
            API-->>Widget: "I don't have information about that"
        end
    end
    
    API->>MongoDB: Save to conversation history
    API-->>Widget: { answer, sources, message_id }
    Widget-->>User: Display answer + like/dislike buttons
```

### 3. Crawling & Indexing Flow
```mermaid
sequenceDiagram
    participant Dashboard as React Dashboard
    participant API as FastAPI Backend
    participant Crawler as Background Task
    participant Firecrawl
    participant OpenAI
    participant DB as MongoDB Atlas
    
    Dashboard->>API: POST /crawl (Seed URL)
    API->>DB: Create crawl job
    API-->>Dashboard: Return Job ID
    API-)Crawler: Trigger async crawl
    
    Crawler->>Firecrawl: Start crawl
    Firecrawl-->>Crawler: Pages as markdown
    
    loop For each page
        Crawler->>Crawler: MarkdownHeaderTextSplitter<br/>(split by #/##/###/####)
        Crawler->>Crawler: Strip heading lines from body
        
        loop For each parent section
            Crawler->>Crawler: RecursiveCharacterTextSplitter<br/>(500 tokens, 80 overlap)
            Crawler->>Crawler: Prepend section_title to search_text
        end
        
        loop For each batch of chunks
            Crawler->>OpenAI: Embed search_text<br/>(text-embedding-3-small)
            OpenAI-->>Crawler: 1536-dim vectors
            Crawler->>DB: Store parents + chunks + embeddings
        end
    end
    
    Crawler->>DB: Mark job as done
    Crawler->>API: Auto-generate suggested questions
    Note over API: GPT-4o-mini generates 6 questions<br/>from indexed content
```

### 4. Hybrid Search Merge Strategy
```mermaid
flowchart TD
    Q[User Query] --> RW[gpt-4o-mini<br/>Rewrite & Classify]
    RW --> C{needs_search?}
    
    C -->|No - Greeting| GP["Conversational prompt<br/>No search, no context"]
    C -->|Yes - Searchable| VE["$vectorSearch<br/>9 candidates fetched"]
    C -->|Yes - Searchable| BE["$search / BM25<br/>6 candidates fetched"]
    
    VE --> VG[Top 3 unique parents<br/>by parent_id]
    BE --> BG[Top 2 unique parents<br/>by parent_id]
    
    VG --> Merge{Merge & Dedup}
    BG --> Merge
    
    Merge -->|3 vector + 2 BM25| PA[Parent Context Assembly]
    
    PA -->|≤1600 tokens| FS[Full parent section]
    PA -->|>1600 tokens| CW[Child + 1 neighbor each side]
    
    FS --> CTX[Context Text]
    CW --> CTX
    
    CTX --> SP["System Prompt:<br/>'Answer only from context'"]
    SP --> LLM[gpt-4o]
    LLM --> ANS[Final Answer + Sources + message_id]
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

## 2. MongoDB Atlas Indexes

### Vector Search Index (`vector_index`)
Navigate to **Atlas Search** → **Create Search Index** → **Vector Search**.

- Database: `chatbot_db`, Collection: `chunks`
- Index Name: `vector_index`

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
    }
  ]
}
```

### Full-Text Search Index (`default`)
Navigate to **Atlas Search** → **Create Search Index** → **Atlas Search**.

- Database: `chatbot_db`, Collection: `chunks`
- Index Name: `default`

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "text": { "type": "string" },
      "section_title": { "type": "string" },
      "tenant_id": { "type": "string" }
    }
  }
}
```

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
7. Visit **Knowledge Gaps** in the dashboard to see unanswered questions and add FAQ answers to resolve them.

## 5. Testing the Widget Locally

Before deploying to a client's site, you can test the widget on a simulated website using the local dev servers.

### Quick Start

**Terminal 1 — Start the backend:**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 — Start the widget dev server:**
```bash
cd widget
npm run dev
```

**Terminal 3 — Open the test page:**
```bash
# macOS
open test-embed.html

# Linux
xdg-open test-embed.html

# Windows
start test-embed.html
```

The test page (`test-embed.html`) simulates a real client website with:
- The widget loaded via a `<script>` tag (same production embed flow)
- CSS variables (`--primary`, `--accent`) to test automatic theme inheritance
- A **Toggle Dark Mode** button to verify dark/light mode detection
- Sample content cards explaining what to test

### What to Test
- Click the chat bubble to open the widget — verify the glassmorphism animation
- Send a message — verify the animated typing indicator (3 bouncing dots)
- Check that the widget picks up the page's `--primary` (#6366F1) as its accent color
- Toggle dark mode — verify the widget adapts its palette automatically
- Test on narrow viewports — the widget should stay fixed at bottom-right

### Testing with a Built Widget (Production Simulation)

To test the production IIFE build instead of the Vite dev server:
```bash
cd widget
npm run build
```
Then serve the `dist/` folder and update the `<script>` src in `test-embed.html` to point to the built file:
```html
<script
  src="http://localhost:8080/widget.js"
  data-api-key="sk_live_..."
  data-api-base-url="http://localhost:8000"
></script>
```

## Extra Knowledge Sources

Beyond website crawling, the platform supports **four types** of knowledge sources. All sources feed into the same unified vector + BM25 search index per tenant.

### Source Types

| Type | Input Method | Indexing Trigger |
|------|-------------|-----------------|
| **Website** | Seed URL → Firecrawl crawls pages | Automatic (during crawl) |
| **PDF** | File upload (`.pdf`) | Automatic (on upload) |
| **FAQ** | Manual Q&A pairs via dashboard | Explicit ("Index" button) |
| **Text Document** | Free-form text / markdown via dashboard | Explicit ("Index" button) |

### Ingestion Pipeline (Common to All Sources)

All source types pass through the same pipeline in `backend/services/ingestion.py`:

```mermaid
flowchart LR
    A[Raw Content] --> B[MarkdownHeaderTextSplitter<br/>Split by #/##/###/####]
    B --> C[Parent Sections]
    C --> D[RecursiveCharacterTextSplitter<br/>500 tokens, 80 overlap]
    D --> E[Child Chunks]
    E --> F[Prepend section_title<br/>to search_text]
    F --> G[OpenAI text-embedding-3-small<br/>Batch of 100]
    G --> H[(MongoDB Atlas<br/>chunks collection)]
```

1. **Section Splitting** — Content is split by markdown headings (H1–H4) into parent sections using `MarkdownHeaderTextSplitter`. Sections under 8 tokens of body text are filtered. Unstructured content becomes a single parent.
2. **Chunk Splitting** — Each parent is split into child chunks of ~500 tokens with 80-token overlap via `RecursiveCharacterTextSplitter`. Tiny chunks (< 40 tokens) are merged into neighbors.
3. **Heading Prefix** — The section title is prepended to each child chunk's `search_text` field (used for embedding only), improving semantic retrieval. The clean `text` is served as LLM context.
4. **Embedding** — Chunks are embedded in batches of 100 via OpenAI `text-embedding-3-small` (1536 dimensions), with 3 retries and exponential backoff.
5. **Storage** — Each source produces three document types in MongoDB:
   - `pages` — One document per page/document with full raw content
   - `parents` — One document per markdown section
   - `chunks` — Child chunks with embeddings (the searchable unit)

### Source Lifecycle

#### Website Crawls
- Submitted via `POST /dashboard/crawl` with a seed URL.
- Background task calls Firecrawl API (up to 200 pages), ingests each page as markdown.
- Old chunks for re-crawled URLs are automatically cleaned up (dedup by `crawl_id`).
- After crawl completes, suggested questions are auto-generated from indexed content.

#### PDF Uploads
- Uploaded via `POST /dashboard/sources/pdf/upload`.
- Text is extracted page-by-page via PyMuPDF (`fitz`), formatted as `## Page N` markdown.
- A `sources` record is created with `status: "indexing"`, updated to `"ready"` on completion.

#### FAQs
1. Create a FAQ source container via `POST /dashboard/sources` (type: `faq`).
2. Add Q&A pairs via `POST /dashboard/sources/{source_id}/faqs`. Raw pairs stored in the `faqs` collection.
3. Click **"Index"** to trigger background ingestion — formats each as `Q: ...\nA: ...` and runs the pipeline.
4. Can re-index to pick up new or updated FAQs (clears existing indexed data first).
5. After indexing, suggested questions are auto-generated from indexed content.
6. **Knowledge Gap Resolution** — FAQs can also be created directly from the Knowledge Gaps page, which auto-indexes them and marks the gap as resolved.

#### Text Documents
1. Create a text document source container via `POST /dashboard/sources` (type: `text`).
2. Add documents (title + body) via `POST /dashboard/sources/{source_id}/docs`.
3. Click **"Index"** to trigger background ingestion — same pattern as FAQs.
4. After indexing, suggested questions are auto-generated from indexed content.

### Search-Time Behavior

- All indexed sources within a tenant are searched **together** as a single pool — there is no filtering by source type or source ID at query time.
- The hybrid search (3 vector + 2 BM25) retrieves the most relevant chunks regardless of which source type they came from.
- Sources can be deleted from the dashboard, which removes all associated chunks, parents, and pages.

## Crawl History

The dashboard provides a complete crawl history with timestamps for every crawl job.

### Features
- **Full history table** showing: Seed URL, Status, Pages Found, Chunks Created, Started At, Finished At
- **Real-time status** for the currently running job (polls every 5 seconds)
- **Color-coded status badges**: green for done, red for failed, yellow for running
- **Timestamps** for when each crawl started and finished

### API Endpoint
```
GET /dashboard/crawl/history
Authorization: Bearer <jwt_token>
```

Returns an array of crawl job objects sorted by `started_at` descending.

## Like/Dislike Feedback

Each AI response includes thumbs-up/thumbs-down buttons for visitor feedback. This data is stored for analytics.

### How It Works
1. Every chat response includes a unique `message_id`
2. Visitor clicks thumbs-up or thumbs-down on any bot message
3. Feedback is stored in the `message_feedback` collection
4. Dashboard shows feedback analytics (total likes, dislikes, like ratio)

### API Endpoint
```
POST /feedback
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "message_id": "uuid",
  "session_id": "uuid",
  "rating": "like" | "dislike"
}
```

### Analytics Endpoint
```
GET /dashboard/analytics/feedback
Authorization: Bearer <jwt_token>
```

Returns:
```json
{
  "total": 150,
  "likes": 120,
  "dislikes": 30,
  "like_ratio": 80.0
}
```

## Suggested Questions (Empty Chat)

When a visitor opens the chat widget with no messages yet, suggested questions appear as clickable chips. There are two sources for these questions:

### Manual Questions (Dashboard)
- Tenant manually adds questions via the Settings page
- Stored in `tenant.suggested_questions_manual`
- **Takes priority** — if manual questions exist, they are shown instead of auto-generated ones

### Auto-Generated Questions (LLM)
- Generated automatically after crawl or FAQ/text-doc indexing completes
- Stored in `tenant.suggested_questions_auto`
- Uses GPT-4o-mini to analyze indexed content and generate 6 relevant questions
- Runs as a background task (never blocks the main flow)

### Widget Behavior
```
if manual questions exist:
    show manual questions
else:
    show auto-generated questions
else:
    show "Ask me anything about this site!"
```

### Dashboard UI (Settings Page)
- View auto-generated questions (grayed out, read-only)
- Add/edit/remove manual questions
- Save changes via `PUT /tenants/suggested-questions`

## Knowledge Improvement (Knowledge Gaps)

When the chatbot cannot answer a question — either because it's classified as out-of-scope or no relevant content was found in the knowledge base — the backend logs the query as a **knowledge gap**. Gaps are clustered by vector similarity so that different phrasings of the same question (e.g., *"hostel fees for class 10"* and *"hostel charges class 10"*) are grouped together, showing the tenant the most-impactful gaps first.

### Flow

```mermaid
sequenceDiagram
    participant Visitor as Website Visitor
    participant Widget as Chat Widget
    participant API as FastAPI Backend
    participant GapTracker as Knowledge Gap Logger
    participant Embedder as text-embedding-3-small
    participant DB as MongoDB

    Visitor->>Widget: Types "hostel fees for class 10"
    Widget->>API: POST /chat { query }
    
    alt No relevant content found
        API->>API: Returns "I don't have that information"
        API->>Embedder: Embed the query
        API->>GapTracker: Log as "no_context" gap
        GapTracker->>DB: Check similar gaps (cosine > 0.85)
        alt Similar gap exists
            GapTracker->>DB: Increment count on existing gap
        else New gap
            GapTracker->>DB: Insert gap with embedding + count: 1
        end
    end

    Note over Dashboard: Tenant reviews gaps later
    Dashboard->>API: GET /dashboard/knowledge/gaps
    API->>DB: Query gaps, find similar FAQs via embedding
    API-->>Dashboard: Gaps sorted by count (desc) + similar FAQs
    
    Dashboard->>Dashboard: Tenant writes answer
    Dashboard->>API: POST /dashboard/knowledge/{gap_id}/resolve
    Note over API: Creates FAQ + indexes it into vector search
    API-->>Dashboard: Gap marked as resolved

    Note over Next visitor: Same question → now answered
    NextVisitor->>Widget: "hostel fees for class 10"
    Widget->>API: POST /chat
    API->>DB: Vector search finds the new FAQ
    API-->>Widget: Returns answer with sources
```

### Features

- **Automatic logging** — Every unanswered query (out-of-scope or no-context) is logged with an embedding for similarity matching.
- **Similarity de-duplication** — If the same question is asked again (or a similar one), the count is incremented rather than creating duplicates. Threshold: cosine similarity > 0.85.
- **Similar FAQ suggestions** — When viewing a gap, the dashboard shows existing FAQs that are semantically close (cosine > 0.8), so tenants can see if the answer already exists or adapt an existing one.
- **One-click resolve** — Tenants can write an answer and select a FAQ source directly from the Knowledge Gaps page. The backend creates the FAQ pair, indexes it into the vector search pipeline, and marks the gap as resolved.
- **Stats & prioritization** — Dashboard shows total gaps, unresolved count, resolved count, and the most-asked unanswered questions, sorted by frequency.

### Dashboard Page

Navigate to **Knowledge Gaps** in the sidebar:
- **KPIs** at the top: unresolved, resolved, total, and top-gap frequency
- **Most-asked list**: top 5 unanswered questions ranked by count
- **Full gap list**: each gap shows query text, times asked, last-seen timestamp, and similar FAQs
- **Resolve form**: inline expandable form to create and index a FAQ answer immediately
- **Filter tabs**: Unresolved / Resolved / All

### API Endpoints

```
GET  /dashboard/knowledge/gaps                     # List gaps (filter: status=open|resolved|all)
GET  /dashboard/knowledge/gaps/stats               # Aggregate stats + top gaps
POST /dashboard/knowledge/gaps/{gap_id}/resolve    # Resolve (action: create_faq | dismiss)
POST /dashboard/knowledge/gaps/cluster              # Re-cluster gaps by similarity
```

All endpoints require JWT authentication (`Authorization: Bearer <token>`).

## Lead Generation (Enquiry Form)

When a website visitor asks about pricing, demo, purchasing, or wants to be contacted, GPT-4o detects the intent and appends `[ENQUIRY_FORM]` to its response. The backend strips the marker and returns `show_enquiry_form: true`. The widget renders an inline form (Name, Email, Phone).

### Flow

```
Visitor: "How much does this cost?"
  → GPT-4o detects lead intent, appends [ENQUIRY_FORM]
  → Backend strips marker, returns show_enquiry_form: true
  → Widget shows answer + inline form
  → Visitor fills form → POST /leads → saved to MongoDB
  → gpt-4o-mini summarizes conversation context into 1-2 sentences
  → Dashboard "Leads" page lists all submissions
```

### Key Details
- **Intent detection**: Done by GPT-4o in the system prompt, not keyword matching. Works across greeting, RAG, and no-results paths.
- **Conversation summarization**: On form submit, `gpt-4o-mini` summarizes the last 3 turns of conversation into a concise description of what the lead was interested in. Raw context is also preserved (`raw_context` field).
- **No LLM call for irrelevant queries**: "Who is Virat Kohli?" gets classified as `OUT_OF_SCOPE` by the query rewriter and returns immediately — no GPT-4o call, no token waste.
- **Dashboard**: New "Leads" nav item with a table showing Name, Email, Phone, Date, and the summarized message.

### Guardrails

Two layers prevent the chatbot from answering irrelevant questions:

1. **Pre-search (gpt-4o-mini)**: The query rewriter classifies input as `GREETING`, `OUT_OF_SCOPE`, or searchable. Out-of-scope queries return immediately with "I'm here to answer questions about {domain}."
2. **Hardened system prompt**: The RAG prompt instructs GPT — "If the context does not contain information relevant to the user's question, say you don't have that information."

## Rate Limiting & Abuse Protection

Three layers of rate limiting protect the chat endpoint:

| Layer | Scope | Limit | Mechanism | Purpose |
|-------|-------|-------|-----------|---------|
| **Per-IP** | Client IP address | 20 req/min | slowapi (`@limiter.limit`) | Catches individual bad actors bypassing session ID |
| **Per-tenant** | API key / tenant ID | 100 req/min | In-memory sliding window (`deque`) | All real users + attackers combined. Protects costs. |
| **Per-session** | `chat_session_id` cookie | 20 req/min | In-memory sliding window (`deque`) | Stops a single abusive user |
| **Max query length** | All requests | 500 chars | Rejected with 400 | Prevents token waste on huge inputs |

The per-IP and per-session limits catch individual bad actors. The per-tenant limit is the critical defense — since the API key is visible in the widget's script tag, a distributed attack using the same key from many IPs would bypass per-IP limits but is still blocked by the per-tenant sliding window.

In-memory counters reset on server restart. For production at scale, replace with Redis-backed rate limiting.

## Key Design Decisions

### Query Rewriting (LLM-based)
User questions are rewritten by **gpt-4o-mini** before vector search. A conversational question like *"what is schoollog and what it does"* is transformed into **"schoollog school management software features overview"** — aligning better with the declarative website content in the vector store. The same LLM call also classifies whether the input is a greeting (skip search) or a searchable query.

### Hybrid Search (Vector + BM25)
- **3 guaranteed slots** from vector search (semantic matching via `$vectorSearch`)
- **2 guaranteed slots** from BM25 full-text search (keyword matching via `$search`)
- Results are deduplicated by `parent_id`
- If BM25 doesn't fill its 2 slots, remaining slots are filled from vector results
- Both searches run in parallel via `asyncio.gather`

### Heading Prefix in Embeddings
Section titles (e.g., *"Bus Tracking"*) are prepended to child chunk text before embedding (stored as `search_text`). The body text alone (*"Track school buses in real-time"*) misses the most descriptive keywords. The prefix is only used for embedding — the clean `text` field is served to GPT as context.

### No Score Threshold
Vector similarity scores are not filtered — the top results are always taken. Query rewriting and hybrid search provide enough precision. Score thresholds were causing false negatives (returning nothing for valid queries).

### Empty Context Guard
If search returns zero results for a non-greeting query, the system returns *"I don't have information about that on this site"* immediately — without calling GPT-4o — preventing hallucination.

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Python 3.12+, FastAPI, Uvicorn |
| Database | MongoDB Atlas (Motor async driver) |
| Embeddings | OpenAI `text-embedding-3-small` |
| Chat LLM | OpenAI `gpt-4o` |
| Query Rewriting | OpenAI `gpt-4o-mini` |
| Suggested Questions | OpenAI `gpt-4o-mini` |
| Crawling | Firecrawl API |
| Auth | JWT (python-jose) + API keys (bcrypt) |
| Frontend (Dashboard) | React 18, Vite |
| Frontend (Widget) | React 18, Vite (embedded as script tag) |
| Chunking | LangChain (MarkdownHeaderTextSplitter + RecursiveCharacterTextSplitter) |
| Token Counting | tiktoken (`cl100k_base`) |
| Rate Limiting | slowapi |
| Containerization | Docker Compose |

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/chat` | API Key | Chat with the widget (returns `message_id`) |
| POST | `/feedback` | API Key | Submit like/dislike feedback for a message |
| GET | `/widget/config` | API Key | Get widget config (theme + suggested questions) |
| POST | `/tenants/register` | None | Register a new tenant |
| POST | `/tenants/login` | None | Login |
| GET | `/tenants/me` | JWT | Get tenant info + suggested questions |
| GET | `/tenants/stats` | JWT | Tenant stats |
| POST | `/tenants/rotate-key` | JWT | Rotate API key |
| PUT | `/tenants/suggested-questions` | JWT | Save manual suggested questions |
| GET | `/dashboard/analytics/feedback` | JWT | Get feedback analytics |
| POST | `/crawl` | API Key | Start a crawl job |
| GET | `/crawl/{job_id}` | API Key | Check crawl status |
| DELETE | `/index` | API Key | Delete indexed data |
| POST | `/dashboard/crawl` | JWT | Start a crawl (dashboard) |
| GET | `/dashboard/crawl/{job_id}` | JWT | Check crawl status (dashboard) |
| GET | `/dashboard/crawl/history` | JWT | Get crawl history with timestamps |
| DELETE | `/dashboard/index` | JWT | Delete indexed data (dashboard) |
| GET | `/dashboard/sources` | JWT | List all knowledge sources |
| POST | `/dashboard/sources` | JWT | Create a source container |
| GET | `/dashboard/sources/{source_id}` | JWT | Get source details + chunk count |
| DELETE | `/dashboard/sources/{source_id}` | JWT | Delete source + indexed data |
| POST | `/dashboard/sources/pdf/upload` | JWT | Upload and index a PDF |
| GET | `/dashboard/sources/{source_id}/faqs` | JWT | List FAQs in a source |
| POST | `/dashboard/sources/{source_id}/faqs` | JWT | Add a FAQ pair |
| PUT | `/dashboard/sources/{source_id}/faqs/{faq_id}` | JWT | Update a FAQ |
| DELETE | `/dashboard/sources/{source_id}/faqs/{faq_id}` | JWT | Delete a FAQ + its chunks |
| POST | `/dashboard/sources/{source_id}/faqs/index` | JWT | Index all FAQs for search |
| GET | `/dashboard/sources/{source_id}/docs` | JWT | List text documents in a source |
| POST | `/dashboard/sources/{source_id}/docs` | JWT | Create a text document |
| PUT | `/dashboard/sources/{source_id}/docs/{doc_id}` | JWT | Update a text document |
| DELETE | `/dashboard/sources/{source_id}/docs/{doc_id}` | JWT | Delete a text document + its chunks |
| POST | `/dashboard/sources/{source_id}/docs/index` | JWT | Index all text documents for search |
| GET | `/dashboard/knowledge/gaps` | JWT | List knowledge gaps (filter by status) |
| GET | `/dashboard/knowledge/gaps/stats` | JWT | Get gap stats + top unanswered questions |
| POST | `/dashboard/knowledge/gaps/{gap_id}/resolve` | JWT | Resolve a gap (create FAQ or dismiss) |
| POST | `/dashboard/knowledge/gaps/cluster` | JWT | Re-cluster open gaps by vector similarity |

## Database Collections

| Collection | Purpose |
|---|---|
| `tenants` | Tenant accounts, API keys, suggested questions config |
| `pages` | Raw crawled page content |
| `parents` | Parent sections from markdown heading splits |
| `chunks` | Child chunks with embeddings (searchable unit) |
| `sources` | Knowledge source metadata |
| `crawl_jobs` | Crawl job status and history |
| `conversations` | Chat conversation history |
| `visitors` | Visitor tracking (IP, page views, messages) |
| `faqs` | FAQ Q&A pairs |
| `documents` | Text document content |
| `leads` | Enquiry form submissions |
| `message_feedback` | Like/dislike feedback on AI responses |
| `knowledge_gaps` | Unanswered queries with embeddings for similarity clustering |
