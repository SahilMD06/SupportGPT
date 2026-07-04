# SupportGPT — Multi-Agent AI Customer Support Platform

<div align="center">

![SupportGPT Banner](https://img.shields.io/badge/SupportGPT-Multi--Agent%20AI-6471f1?style=for-the-badge&logo=robot)
![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

**Production-ready Multi-Agent AI Customer Support Platform with RAG, streaming responses, and real-time analytics.**

</div>

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🤖 **Multi-Agent Routing** | 5 specialized agents: Billing, Technical, Product, Complaint, FAQ |
| 🧠 **Intent Classification** | Gemini 2.5 Flash detects single & multi-intent queries |
| 📚 **RAG Pipeline** | FAISS + Sentence Transformers for semantic retrieval |
| 🌊 **Streaming Responses** | Real-time SSE token streaming |
| 🔐 **JWT Authentication** | Secure register/login with bcrypt password hashing |
| 📊 **Analytics Dashboard** | Charts for agent usage, intent distribution, daily chats |
| 🛡️ **Admin Panel** | PDF uploads, embedding rebuilds, user management |
| 💾 **Conversation History** | Persistent MongoDB storage with session management |
| 🎨 **Premium Dark UI** | Next.js 15 + Tailwind + Framer Motion |
| 🐳 **Docker Ready** | Full docker-compose for local & production |

---

## 🏗️ Architecture

```
Customer Query
      │
      ▼
┌─────────────┐
│  Next.js UI │  ← Streaming SSE responses
└──────┬──────┘
       │ REST / SSE
       ▼
┌─────────────────────────────────────────┐
│              FastAPI Backend            │
│                                         │
│  ┌─────────────┐   ┌────────────────┐  │
│  │ JWT Auth    │   │ Rate Limiting  │  │
│  └─────────────┘   └────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │     Intent Classifier            │  │
│  │   (Gemini 2.5 Flash)            │  │
│  └──────────────┬───────────────────┘  │
│                 │ intents[]             │
│  ┌──────────────▼───────────────────┐  │
│  │        Agent Router              │  │
│  └──┬───┬───┬───┬───────────────────┘  │
│     │   │   │   │                      │
│  Billing Tech Product Complaint FAQ    │
│     │   │   │   │                      │
│  ┌──▼───▼───▼───▼───────────────────┐  │
│  │     RAG Pipeline                 │  │
│  │  FAISS → Embeddings → Context   │  │
│  └──────────────┬────────────────── ┘  │
│                 │                      │
│  ┌──────────────▼───────────────────┐  │
│  │  Gemini 2.5 Flash Response       │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
       │
       ▼
  MongoDB Atlas  (conversations, analytics)
  FAISS Index    (vector embeddings)
```

---

## 📁 Project Structure

```
SupportGPT/
├── frontend/                    # Next.js 15 App
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/
│   │   │   │   ├── login/page.tsx
│   │   │   │   └── register/page.tsx
│   │   │   ├── chat/page.tsx    # Main chat interface
│   │   │   ├── analytics/page.tsx
│   │   │   ├── admin/page.tsx
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   └── layout/AppLayout.tsx  # Sidebar + nav
│   │   ├── lib/
│   │   │   ├── api.ts           # Axios client
│   │   │   └── store.ts         # Zustand state
│   │   └── styles/globals.css
│   ├── package.json
│   └── .env.example
│
├── backend/                     # FastAPI
│   ├── main.py                  # App entry point
│   ├── agents/
│   │   └── agent_router.py      # Multi-agent system
│   ├── rag/
│   │   ├── vector_store.py      # FAISS operations
│   │   └── pdf_processor.py     # PDF → chunks pipeline
│   ├── api/
│   │   ├── auth.py
│   │   ├── chat.py              # Chat + streaming
│   │   ├── knowledge.py
│   │   ├── history.py
│   │   ├── analytics.py
│   │   └── admin.py
│   ├── models/schemas.py        # Pydantic models
│   ├── services/database.py     # MongoDB connection
│   ├── utils/
│   │   ├── auth.py              # JWT utilities
│   │   └── config.py            # Settings
│   ├── requirements.txt
│   └── .env.example
│
├── knowledge_base/              # PDF storage
│   └── sample_docs/
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Python 3.11+
- MongoDB Atlas account (free tier works)
- Google AI Studio API key (Gemini)

### 1. Clone & Setup

```bash
git clone <your-repo-url>
cd SupportGPT
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)

# Run backend
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local: NEXT_PUBLIC_API_URL=http://localhost:8000

# Run frontend
npm run dev
```

### 4. Open the App

- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs
- **API Health:** http://localhost:8000/health

---

## 🐳 Docker Deployment (Local)

```bash
# From project root
cd docker

# Copy and configure environment
cp ../backend/.env.example ../backend/.env
# Edit ../backend/.env

# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | ✅ | JWT signing secret (min 32 chars) |
| `MONGODB_URL` | ✅ | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | ✅ | Database name (default: `supportgpt`) |
| `GOOGLE_API_KEY` | ✅ | Google Gemini API key |
| `GEMINI_MODEL` | ⚙️ | Model name (default: `gemini-2.0-flash`) |
| `ALLOWED_ORIGINS` | ⚙️ | CORS origins JSON array |
| `FAISS_INDEX_PATH` | ⚙️ | FAISS index directory (default: `./faiss_index`) |
| `KNOWLEDGE_BASE_PATH` | ⚙️ | PDF storage directory (default: `./knowledge_base`) |
| `EMBEDDING_MODEL` | ⚙️ | Sentence Transformers model (default: `all-MiniLM-L6-v2`) |
| `CHUNK_SIZE` | ⚙️ | Text chunk size (default: `500`) |
| `CHUNK_OVERLAP` | ⚙️ | Chunk overlap tokens (default: `50`) |
| `TOP_K_RESULTS` | ⚙️ | RAG retrieval results (default: `5`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | ⚙️ | JWT expiry (default: `1440` = 24h) |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |

---

## ☁️ Production Deployment

### Backend → Render

1. Push code to GitHub
2. Create new **Web Service** on [Render](https://render.com)
3. Connect your repository, set root to `backend/`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add all environment variables from `.env`
7. Add a **Persistent Disk** mounted at `/app/faiss_index` for the vector index

### Frontend → Vercel

1. Import project on [Vercel](https://vercel.com)
2. Set root directory to `frontend/`
3. Add environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render backend URL
4. Deploy

### Database → MongoDB Atlas

1. Create cluster at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create database user with read/write permissions
3. Whitelist `0.0.0.0/0` (or Render's IPs) in Network Access
4. Copy the connection string to `MONGODB_URL`

---

## 📊 API Reference

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | ❌ | Register new user |
| `/auth/login` | POST | ❌ | Login & get JWT |
| `/auth/me` | GET | ✅ | Get current user |
| `/chat` | POST | ✅ | Send message (non-streaming) |
| `/chat/stream` | POST | ✅ | Send message (SSE streaming) |
| `/history` | GET | ✅ | List conversation sessions |
| `/history/{session_id}` | GET | ✅ | Get conversation messages |
| `/history/{session_id}` | DELETE | ✅ | Delete conversation |
| `/analytics` | GET | ✅ | Platform analytics |
| `/knowledge/upload` | POST | 🛡️ Admin | Upload PDF |
| `/knowledge/documents` | GET | ✅ | List documents |
| `/knowledge/documents/{id}` | DELETE | 🛡️ Admin | Delete document |
| `/admin/stats` | GET | 🛡️ Admin | Admin statistics |
| `/admin/users` | GET | 🛡️ Admin | List users |
| `/admin/rebuild-embeddings` | POST | 🛡️ Admin | Rebuild FAISS index |

---

## 🤖 Multi-Agent System

### Agent Routing Logic

```
Query: "I paid but can't access premium"
          │
          ▼
   Intent Classifier
          │
          ▼
   ["billing", "technical"]
          │
    ┌─────┴─────┐
    ▼           ▼
 Billing    Technical
  Agent      Agent
    │           │
    └─────┬─────┘
          ▼
    Synthesis LLM
          │
          ▼
   Unified Response
```

### Agents & Specializations

| Agent | Triggers | Handles |
|-------|----------|---------|
| 💳 **Billing** | payment, invoice, refund, subscription, charge | Payment issues, refunds, billing history |
| 🔧 **Technical** | login, bug, error, crash, install | Technical troubleshooting, debugging |
| 📦 **Product** | feature, pricing, comparison, plan | Feature explanations, pricing info |
| 🎯 **Complaint** | terrible, unacceptable, escalate, angry | Escalations, dissatisfied customers |
| ❓ **FAQ** | how, what, general, policy | General questions, how-tos |

---

## 📚 RAG Pipeline

```
PDF Upload
    ↓
Text Extraction (PyMuPDF)
    ↓
Text Cleaning & Normalization
    ↓
Chunking (LangChain RecursiveCharacterTextSplitter)
  chunk_size=500, overlap=50
    ↓
Embedding Generation (all-MiniLM-L6-v2)
  384-dimensional vectors
    ↓
FAISS IndexFlatIP Storage
  (cosine similarity via inner product)
    ↓
Query-time Semantic Search (top-5)
    ↓
Context Injection into Gemini Prompt
    ↓
Grounded Response
```

---

## 🔐 Security

- **JWT Authentication** — HS256 signed tokens, 24h expiry
- **Password Hashing** — bcrypt via passlib
- **Rate Limiting** — 60 requests/minute via SlowAPI
- **CORS** — Configurable allowed origins
- **Input Validation** — Pydantic models on all endpoints
- **Admin Routes** — Role-based access control

---

## 🧩 Tech Stack

**Frontend**
- Next.js 15 (App Router) + React 19
- TypeScript + Tailwind CSS
- Framer Motion (animations)
- Zustand (state management)
- Recharts (analytics charts)
- React Markdown (message rendering)

**Backend**
- FastAPI + Uvicorn
- Python 3.11+
- Motor (async MongoDB driver)
- LangChain + LangGraph
- Google Gemini 2.5 Flash

**AI & RAG**
- Sentence Transformers `all-MiniLM-L6-v2`
- FAISS (vector similarity search)
- PyMuPDF (PDF extraction)
- LangChain text splitters

**Infrastructure**
- MongoDB Atlas (database)
- Render (backend hosting)
- Vercel (frontend hosting)
- Docker + docker-compose

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built with ❤️ using Next.js, FastAPI, and Google Gemini
</div>
