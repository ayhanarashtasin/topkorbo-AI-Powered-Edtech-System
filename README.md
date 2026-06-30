<div align="center">

# 🎓 TopKorbo

### The Elite Academic Testing, Learning & Community Platform for Bangladeshi Students

A full-stack learning ecosystem combining a multi-subject Question Bank, real-time Mock Tests, Codeforces-style Contests, an AI Tutor, IELTS preparation, live classes, mentorship, a PDF reading library, and a complete community forum.

Built for the **CUET SciBlitz AI Hackathon**.

[Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Environment Variables](#-environment-variables) · [Project Structure](#-project-structure) · [API Overview](#-api-overview)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socket.io&logoColor=white)

</div>

---

##  Overview

**TopKorbo** is a comprehensive academic platform designed for Bangladeshi students preparing for board exams and university admission tests. It unifies practice, assessment, live learning, AI assistance, and peer community into a single, bilingual (বাংলা / English) web application.

The project is a monorepo with two independent packages:

| Package | Description | Stack |
| --- | --- | --- |
| **`client/`** | Single-page React frontend | React 19 + Vite |
| **`server/`** | REST + WebSocket API | Node.js + Express + MongoDB |

---

##  Features

###  Question Bank & Practice
- **Smart filtering** by Subject, Paper, Chapter, and Topic.
- **Dual track:** Board Exam questions and Top College / Varsity questions.
- **Multi-format:** Creative Questions (CQ), MCQs, and Written/Descriptive questions.
- **LaTeX rendering** with KaTeX for clean math and formulas.
- **Practice history** tracking with attempt review.

###  Mock Tests
- Timed exam environment with live countdown.
- Instant grading with a performance mascot and confetti celebration.
- Interactive solutions and explanations for every question after submission.

###  Contests & AI Battle
- **Contests:** Codeforces-style timed academic contests with leaderboards and results.
- **AI Battle:** Head-to-head, real-time question battles powered by Socket.io.

###  AI Tutor
- Built-in question helper powered by **Groq** (OpenAI-compatible LLM API).
- Context-aware explanations and study assistance.

###  IELTS Preparation
- Dedicated IELTS prep hub with **Listening sets**.
- Teacher tools to upload and manage IELTS listening content.

###  Live Classes
- Real-time video classrooms powered by **LiveKit**.
- Separate mentor (host) and student (participant) experiences.
- Attendance tracking and live session management.

###  Mentorship
- Student ↔ mentor connection system.
- Live class hosting and mentor-led sessions.

###  Reading Library
- In-app **PDF reader** (react-pdf) for uploaded books.
- **Highlights & annotations** with persistent reading state.
- Teacher book upload portal.

###  Study Routine
- Personalized study planner with calendar view (react-big-calendar).
- Track study sessions and stay organized.

###  Community Forum
- Posts, threaded comments, reactions, and bookmarks.
- User profiles, full-text search, and notifications.
- Moderation tools and role-based admin controls.

###  Teacher Studio
- Application & verification flow to become a teacher.
- Interactive question uploader (custom options, LaTeX, board/college tags, solutions).
- Step-by-step contest creation (build from scratch or pick from the Question Bank).

###  Platform
- **Bilingual UI** — toggle between Bengali (বাংলা) and English.
- **Secure auth** — JWT + Google OAuth 2.0 (Passport.js).
- **Image uploads** via Cloudinary with local-disk fallback.
- **Polished UX** — Framer Motion animations and React Hot Toast feedback.

---

## 🛠 Tech Stack

### Frontend (`client/`)
| Category | Technologies |
| --- | --- |
| Core | React 19, Vite 8 |
| Routing & HTTP | React Router DOM 7, Axios |
| Realtime | Socket.io Client, LiveKit Components |
| Math & Markdown | KaTeX, react-markdown, remark-gfm, rehype-katex |
| Media | react-pdf, react-big-calendar |
| Animation & Feedback | Framer Motion, React Hot Toast, React Confetti |
| Icons & Dates | React Icons, date-fns, moment |
| Testing | Vitest, Testing Library |

### Backend (`server/`)
| Category | Technologies |
| --- | --- |
| Runtime | Node.js, Express |
| Database | MongoDB, Mongoose |
| Auth | Passport.js (JWT, Google OAuth 2.0) |
| Realtime | Socket.io |
| Live Video | LiveKit Server SDK |
| AI | Groq SDK (OpenAI-compatible) |
| Media & Uploads | Multer, Cloudinary, Canvas |
| Security & Utils | CORS, Dotenv, Express Rate Limit, sanitize-html, slugify |
| Testing | Jest |

---

##  Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- [MongoDB](https://www.mongodb.com/) running locally or a MongoDB Atlas connection string
- *(Optional)* [Groq API key](https://console.groq.com/keys) for the AI Tutor
- *(Optional)* LiveKit and Cloudinary credentials for live classes and image uploads

### 1. Clone the repository
```bash
git clone https://github.com/ayhanarashtasin/CUET-SciBlitz-AI-Hackathon.git
cd CUET-SciBlitz-AI-Hackathon
```

### 2. Backend setup (`server/`)
```bash
cd server
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev
```
The API runs at **http://localhost:5000** (health check: `GET /api/health`).

### 3. Frontend setup (`client/`)
Open a new terminal:
```bash
cd client
npm install
npm run dev
```
The app runs at **http://localhost:5173**.

>  **Note:** `JWT_SECRET` must be a strong random value — the server refuses to start with a missing or placeholder secret. Generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
> ```

---

##  Environment Variables

Create `server/.env` from `server/.env.example`:

```env
# ===== Core =====
MONGODB_URI=mongodb://localhost:27017/topkorbo
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:5000/api

# ===== Auth =====
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# ===== AI Tutor (Groq — OpenAI-compatible) =====
# Either LLM_API_KEY or GROQ_API_KEY works.
GROQ_API_KEY=
LLM_API_KEY=
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# ===== Live Classes (LiveKit) =====
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# ===== Image Uploads (Cloudinary — optional) =====
# When any of the three are missing, uploads fall back to local disk.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# ===== Admin bootstrap =====
# On startup, users matching these emails are upgraded to forumRole 'admin'.
ADMIN_EMAILS=admin@topkorbo.local
```

---

##  Project Structure

```text
CUET-SciBlitz-AI-Hackathon/
├── client/                      # React frontend (Vite)
│   ├── public/                  # Static assets & i18n JSON files
│   └── src/
│       ├── components/          # forum, landing, layout, liveclass, reader, study
│       ├── context/             # Language & global context providers
│       ├── pages/               # QuestionBank, MockTest, Contests, IELTS, Forum, ...
│       └── styles/              # Custom CSS & animations
│
└── server/                      # Node.js / Express API
    ├── config/                  # db.js, passport.js, cloudinary.js
    ├── controllers/             # Request handling logic (per feature)
    ├── middleware/              # Auth verification & error handling
    ├── models/                  # Mongoose schemas
    ├── routes/                  # REST route definitions
    ├── scripts/                 # bootstrapAdmin & maintenance scripts
    ├── socket/                  # Socket.io realtime handlers
    └── server.js                # Entry point
```

---

## 🔌 API Overview

All routes are mounted under `/api`.

| Area | Base Route | Description |
| --- | --- | --- |
| Landing | `/api/landing` | Public landing-page data |
| Auth | `/api/auth` | Register, login, Google OAuth |
| Users | `/api/users` | Profiles & user management |
| Questions | `/api/questions` | Question Bank CRUD & filtering |
| Contests | `/api/contests` | Contest creation & results |
| AI Battle | `/api/battles` | Real-time question battles |
| Mock Tests | `/api/mock-tests` | Mock test attempts & grading |
| Practice | `/api/practice` | Practice attempts & history |
| AI Tutor | `/api/ai` | LLM-powered question help |
| IELTS | `/api/ielts` | Listening sets & prep content |
| Live Classes | `/api/live-class` | LiveKit sessions & attendance |
| Mentorship | `/api/mentor-connections` | Student ↔ mentor connections |
| Books | `/api/books` | Reading library & uploads |
| Highlights | `/api/highlights` | Annotations & reading state |
| Evaluation | `/api/evaluate` | Answer evaluation |
| Study Routine | `/api/study-routine` | Study planner |
| Forum — Posts | `/api/posts` | Posts & nested comments |
| Forum — Comments | `/api/comments` | Comment management |
| Forum — Reactions | `/api/reactions` | Likes / reactions |
| Notifications | `/api/notifications` | User notifications |
| Search | `/api/search` | Global search |
| Moderation | `/api/...` | Reports & moderation |
| Health | `/api/health` | Service status check |

---

##  Testing

```bash
# Backend (Jest)
cd server && npm test

# Frontend (Vitest)
cd client && npm test
```

---

## 👥 Contributors

- **Arpita Sarkar** — [@arpii26](https://github.com/arpii26)
- **Ayhan Arashtasin** — [@ayhanarashtasin](https://github.com/ayhanarashtasin)

---

<div align="center">

Built with  for the **CUET SciBlitz AI Hackathon**

</div>
