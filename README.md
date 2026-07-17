# SupportGPT — Multi-Agent AI Customer Support Platform

An AI-powered customer support platform built for **NovaTech Solutions** (a fictional consumer electronics and smart home company), featuring six specialized AI agents, Retrieval-Augmented Generation (RAG) over a custom knowledge base, multilingual conversations, sentiment-aware routing, and a full admin dashboard.

---

## Project Overview

SupportGPT replaces the single-bot support model with a **multi-agent architecture**: every customer message is analyzed for intent, language, and sentiment in a single pass, then routed to one or more specialist agents (Billing, Technical, Product, Complaint, Privacy, FAQ). Responses are grounded in the company's actual policy documents through a FAISS-based RAG pipeline, so answers cite real sources instead of hallucinating policy details. When retrieval confidence is low on sensitive topics, the system clearly labels responses as general guidance rather than official policy.

**SupportGPT** is the underlying platform; **NovaTech Solutions** is the customer-facing brand it powers — analogous to how support platforms like Zendesk power a company's branded help experience.

## Features

- **Multi-agent routing** — automatic multi-intent classification across 6 specialist agents, with response synthesis when a query spans multiple domains
- **RAG pipeline** — PDF text extraction, chunking, Sentence Transformer embeddings, FAISS vector search, and source citations on every grounded answer
- **Confidence-aware privacy handling** — privacy/security questions prioritize PrivacyPolicy.pdf retrieval; low-confidence matches trigger a clearly-labeled general-knowledge fallback instead of invented policy
- **Multilingual conversations** — automatic language detection, English-translated retrieval against the English knowledge base, and responses in the customer's language (or a fixed language preference)
- **Sentiment-aware routing** — per-message frustration scoring (1–5); high frustration auto-includes the Complaint agent and an empathy-first response style
- **Real-time streaming** — Server-Sent Events token streaming with live agent/language/source badges
- **Full authentication** — JWT auth with token versioning (logout from all devices), session tracking with device/IP, password change, account deletion, and data export
- **User settings** — profile management, theme (light/dark/system), font scaling, response length, response language, citation and suggestion toggles
- **Admin dashboard** — knowledge base upload/delete/rebuild, user role management, conversation overview, index statistics
- **Analytics** — chats over time, agent/intent distribution, response times, frustration trends, and language distribution
- **Dockerized** — validated docker-compose setup running both services in containers

## System Architecture

```
┌─────────────┐     HTTPS      ┌──────────────────────────────┐
│   Next.js    │ ─────────────▶ │          FastAPI              │
│   Frontend   │ ◀───SSE──────  │                               │
│  (Vercel)    │                │  1. analyze_query()           │
└─────────────┘                │     intents + language +      │
                               │     sentiment (1 Gemini call) │
                               │  2. FAISS retrieval           │
                               │     (English query, priority  │
                               │      boost, confidence score) │
                               │  3. Agent routing + synthesis │
                               │     (Gemini 2.5 Flash)        │
                               └───────┬──────────┬───────────┘
                                       │          │
                              ┌────────▼───┐  ┌───▼──────────┐
                              │  MongoDB    │  │ FAISS index  │
                              │  Atlas      │  │ + Sentence   │
                              │  (users,    │  │ Transformers │
                              │  convos,    │  │ (all-MiniLM- │
                              │  analytics, │  │  L6-v2)      │
                              │  sessions)  │  └──────────────┘
                              └────────────┘
```

## Technology Stack

**Frontend**
- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind CSS · Framer Motion · Recharts · Zustand · Axios
- react-hot-toast · react-markdown · Lucide icons

**Backend**
- FastAPI · Uvicorn · Python 3.11+
- python-jose (JWT) · passlib + bcrypt · SlowAPI (rate limiting)
- Motor (async MongoDB driver) · Pydantic v2

**Database**
- MongoDB Atlas (users, conversations, analytics, sessions, audit_log, knowledge_base collections)

**AI**
- Google Gemini 2.5 Flash (`google-genai` SDK) — agents, intent/language/sentiment analysis, synthesis
- Sentence Transformers `all-MiniLM-L6-v2` — embeddings
- FAISS (CPU) — vector similarity search
- PyMuPDF — PDF text extraction
- Custom dependency-free recursive text splitter

## Folder Structure

```
project-root/
├── frontend/                  # Next.js application
│   └── src/
│       ├── app/               # Routes: auth, chat, analytics, admin, settings
│       ├── components/        # AppLayout and shared components
│       ├── lib/               # api.ts, store.ts, theme.ts, errors.ts
│       └── styles/            # globals.css (design tokens, theming)
├── backend/                   # FastAPI application
│   ├── api/                   # auth, chat, user, knowledge, history, analytics, admin
│   ├── agents/                # agent_router.py (agents, analysis, synthesis)
│   ├── rag/                   # pdf_processor.py, vector_store.py
│   ├── models/                # Pydantic schemas
│   ├── services/              # database.py
│   ├── utils/                 # config.py, auth.py
│   └── main.py
├── knowledge_base/            # NovaTech Solutions PDFs (12 documents)
├── datasets/                  # Sample data files + data dictionary
├── docs/                      # Report, guides, demo script
├── screenshots/               # Application screenshots
├── docker/                    # Dockerfiles + docker-compose.yml
├── README.md
├── LICENSE
├── .env.example
└── .gitignore
```

## Installation Guide

### Prerequisites
- Node.js 20+ · Python 3.11+ · A MongoDB Atlas account (free tier works) · A Google Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### Database Setup
1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Database Access → create a database user
3. Network Access → allow your IP (or `0.0.0.0/0` for development)
4. Copy the connection string into `MONGODB_URL`

### Environment Variables
```bash
# Backend: copy the template and fill in real values
cp .env.example backend/.env

# Frontend: create frontend/.env.local containing:
# NEXT_PUBLIC_API_URL=http://localhost:8000
```
See `.env.example` for every variable with explanations.

### Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps   # required: React 19 / Next 15 peer resolution
```

## Running Locally

```bash
# Terminal 1 — backend
cd backend
venv\Scripts\activate            # (Windows)
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

Open **http://localhost:3000**. First backend start downloads the embedding model (~90MB), which takes a minute.

**Set up the knowledge base (one-time):** register an account, promote it to admin (see User Roles below), then go to Admin → upload the 12 PDFs from `/knowledge_base` → click **Rebuild Vector Index**.

### Running with Docker (alternative)
```bash
cd docker
docker-compose up --build
```
Both services build and run in containers; open http://localhost:3000.

## Building Production Version

```bash
# Frontend
cd frontend && npm run build

# Backend (no build step — verify it boots)
cd backend && uvicorn main:app --port 8000
```

## Deployment Instructions

Full beginner-friendly walkthrough: **[docs/Deployment_Guide.md](docs/Deployment_Guide.md)**

Summary: backend → **Render** (with a persistent disk mounted at `/opt/render/project/src/data` covering both the FAISS index and knowledge base PDFs), frontend → **Vercel** (with `vercel.json` install override), database → **MongoDB Atlas**. After first deploy, re-upload the knowledge base PDFs on the live site and rebuild the index once.

## API Documentation

Interactive OpenAPI docs are auto-generated by FastAPI — run the backend and open **http://localhost:8000/docs**.

| Group | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `POST /auth/login` · `GET /auth/me` |
| Chat | `POST /chat` · `POST /chat/stream` (SSE) |
| History | `GET /history` · `GET /history/{session_id}` · `DELETE /history/{session_id}` |
| User | `GET/PUT /user/profile` · `PUT /user/password` · `GET /user/sessions` · `POST /user/logout` · `POST /user/logout-all` · `DELETE /user/account` · `GET/PUT /user/preferences` · `POST /user/export-data` |
| Knowledge (admin) | `POST /knowledge/upload` · `GET /knowledge/documents` · `DELETE /knowledge/documents/{id}` |
| Analytics | `GET /analytics` |
| Admin | `POST /admin/rebuild-embeddings` · `GET /admin/stats` · `GET /admin/users` · `PATCH /admin/users/{id}/role` · `GET /admin/conversations` |
| Health | `GET /health` |

## User Roles

The system has **two** roles:

| Role | Capabilities |
|---|---|
| `user` | Chat, history, analytics view, own settings/profile |
| `admin` | Everything above + knowledge base management, user role management, conversation overview |

**Creating an admin:** new registrations default to `user`. Promote an account by editing its document in MongoDB Atlas (`users` collection → set `"role": "admin"`), then log out and back in. There are no pre-seeded credentials — create your own accounts. For evaluation, register two accounts (e.g., an admin and a regular user) and promote one as described.

## Knowledge Base Documents

All 12 documents describe **NovaTech Solutions**, the fictional smart-home/electronics company (consistent products, prices, and policies across all files):

`CompanyOverview.pdf` · `FAQ.pdf` · `Products.pdf` · `Pricing.pdf` · `PrivacyPolicy.pdf` · `TermsAndConditions.pdf` · `RefundPolicy.pdf` · `ShippingPolicy.pdf` · `Warranty.pdf` · `InstallationGuide.pdf` · `UserManual.pdf` · `SupportGuide.pdf`

## Dataset Information

This project does **not** train on or integrate external public datasets — the AI pipeline is fully powered by Gemini (zero-shot analysis) + RAG over the knowledge base above. The `/datasets` folder contains **sample data representing this system's own data shapes** (chat analytics records, intent classification examples, conversation exports) for evaluation and documentation purposes, plus a data dictionary. All sample data is fictional.

## Screenshots

See `/screenshots` for application captures (login, chat with agent/source badges, multilingual response, admin dashboard, analytics, settings).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails with ERESOLVE | Use `npm install --legacy-peer-deps` (React 19 peer ranges) |
| Backend `ModuleNotFoundError` | Activate the venv first: `venv\Scripts\activate` |
| Chat returns "Failed to send" | Backend not running, or running outside the venv |
| Gemini 404 / quota errors | Verify `GEMINI_MODEL=gemini-2.5-flash` and your API key at aistudio.google.com |
| Answers not citing documents | Upload PDFs in Admin, then click **Rebuild Vector Index** |
| Wrong/stale answers after deleting a doc | Deletion doesn't purge live FAISS chunks — always Rebuild after deleting |
| Docker build slow/fails | Ensure `.dockerignore` files exist; run `npm install --legacy-peer-deps` locally first so the lock file is in sync |

## Future Enhancements

- Voice-enabled support (speech-to-text/text-to-speech provider integration)
- Email and WhatsApp channels (SendGrid / WhatsApp Business API)
- Automatic ticket creation and live human-agent handoff
- AI-generated conversation summaries and CSAT feedback collection
- Admin pagination for large user/conversation lists
- Incremental FAISS deletion (currently requires full rebuild)

## License

MIT — see [LICENSE](LICENSE).
