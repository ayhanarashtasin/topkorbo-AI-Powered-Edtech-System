<div align="center">

#  TopKorbo

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

### 1. Question Bank & Guided Practice
- **Structured academic taxonomy:** Questions are organized by Subject, Paper, Chapter, Topic, and source so students can practice exactly what they need.
- **Multiple question sources:** Supports Board Exam questions, college questions, varsity/admission questions, and teacher-created custom questions.
- **Multiple question formats:** Handles MCQ, Written/Descriptive, and Creative Question (CQ) formats, including CQ stems and four-part sub-questions.
- **Rich question content:** Supports images, detailed solutions, solution images, and KaTeX/LaTeX rendering for mathematical expressions.
- **Smart browsing flows:** Separate views for source questions, varsity written questions, admission question cards, and filtered Question Bank practice.
- **Practice attempt tracking:** Saves per-question snapshots, selected answers, written uploads, scores, time spent, skipped/flagged states, and post-practice notes.
- **Performance summaries:** Practice history includes attempt review, subject/chapter/topic breakdowns, accuracy, score trends, and retry-friendly records.

### 2. Mock Tests & Exam Simulation
- **Configurable test generation:** Students can build mock tests from selected subjects, papers, chapters, topics, and question counts.
- **Timed exam mode:** Provides a focused exam screen with countdown, answer selection, submission flow, and final result handling.
- **Automatic MCQ grading:** Calculates correct, wrong, skipped, obtained marks, percentages, and negative-marking aware scores where configured.
- **Written answer evaluation:** Supports handwritten/written answer uploads and AI-assisted evaluation with partial marks and feedback.
- **Attempt persistence:** Stores immutable question snapshots so historical results remain valid even if source questions are edited later.

### 3. Contests & Competitive Learning
- **Codeforces-style contests:** Teachers can create scheduled academic contests with title, timing, questions, registration, and result tracking.
- **Question sourcing options:** Contest creators can add questions manually or select existing questions from the Question Bank.
- **Participant registration:** Students can register for upcoming contests and access contest details before participating.
- **Submission and results:** Stores contest submissions, scores, time taken, correct answers, wrong answers, skipped answers, and leaderboard-ready result data.
- **Creator dashboard:** Teachers can view, update, delete, and manage their own contests.

### 4. Real-Time AI Battle Arena
- **Room-based battles:** Students can create and join battle rooms with shareable room IDs.
- **Multiple battle modes:** Supports duel, squad/custom squad, and raid-style configurations with player limits and team assignment logic.
- **Live round progression:** Tracks current question, round timer, readiness, answers, scores, and player state in real time through Socket.io.
- **Custom game settings:** Battle hosts can configure question time, total questions, question type, team names, and negative marking.
- **Rematch support:** Finished rooms can generate rematch rooms while preserving battle context and team preferences.
- **AI battle coaching:** Includes a Groq-powered coach endpoint for generating feedback and learning guidance after battles.

### 5. AI Tutor & Academic Assistance
- **Groq-powered tutoring:** Uses an OpenAI-compatible Groq LLM backend for explanations, chat, grading, and study assistance.
- **Question explanation:** Generates step-by-step solutions for MCQ, written, and CQ questions with LaTeX-friendly formatting.
- **Mistake analysis:** Can compare a student's uploaded handwritten solution with the reference solution and explain where the answer went wrong.
- **MCQ answer helper:** Provides AI support for answering and explaining MCQ-style problems.
- **AI question extraction:** Extracts structured question data from uploaded or pasted content to speed up question creation.
- **Persistent chat history:** Stores user and assistant messages for general book/page chat and context-specific tutoring sessions.

### 6. Smart Reading Library
- **Teacher book uploads:** Teachers can upload PDF books with title, description, category, group, subject, paper, and chapter metadata.
- **In-app PDF reader:** Students can read books inside the platform with `react-pdf`, chapter navigation, page controls, and streaming-friendly PDF delivery.
- **Reading progress:** Saves last-read position, bookmarks, and user-specific reading state.
- **Highlights and annotations:** Supports persistent highlights, pen annotations, bulk annotation operations, and deletion.
- **AI book understanding:** Generates and stores book knowledge snapshots, topic trees, summaries, key points, definitions, examples, quizzes, and source-linked context.
- **Contextual book chat:** Students can ask AI questions scoped to a page, topic, chapter, node, or entire book with saved conversation history.
- **Knowledge visualization:** Includes a knowledge tree graph for exploring generated book structure and concepts.

### 7. Study Routine Planner
- **Personalized routine generation:** Builds study plans from exam information, weak subjects, target goals, available hours, wake/sleep time, duration, and study days per week.
- **Calendar-based planning:** Uses a calendar view to show daily sessions, rest days, tasks, priorities, and estimated study time.
- **Routine editing and persistence:** Students can save, update, mark segments complete, and continue from stored routines.
- **Session analytics:** Tracks total sessions, completed work, upcoming tasks, subject distribution, and progress summaries.
- **AI routine modification:** Supports AI-assisted changes and next-week routine generation based on the current plan.

### 8. IELTS Preparation Hub
- **Skill-based IELTS sections:** Provides dedicated areas for Listening, Reading, Writing, and Speaking preparation.
- **Practice flows:** Includes student-facing practice pages for each IELTS skill area.
- **Listening set management:** Teachers can upload complete listening sets with all four sections, each containing audio and PDF files.
- **Teacher IELTS studio:** Provides upload screens for Listening, Reading, Writing, and Speaking materials.
- **Secure file validation:** Restricts IELTS uploads to supported PDF and audio formats with file-size limits.

### 9. Live Classes & Mentorship
- **LiveKit video classrooms:** Mentors/teachers can start live sessions and students can join through generated LiveKit access tokens.
- **Separate role experiences:** Includes mentor dashboard/host flow and student session discovery/join flow.
- **Attendance tracking:** Records join/leave activity and class attendance data for live sessions.
- **Mentor discovery:** Students can browse mentors by profile details, guidance interests, university, department, admission achievement, and ratings.
- **Connection workflow:** Students can request mentors, and mentors can accept or reject connection requests.
- **Mentor dashboards:** Mentors can view connected students, recent mock-test performance, subject summaries, and student progress signals.
- **Reviews and ratings:** Students can submit mentor reviews; mentor listings include average rating, review count, and recent anonymous reviews.

### 10. Community Forum
- **Rich post creation:** Users can create text or question posts with rich HTML content, tags, categories, mentions, and up to eight images.
- **Personalized feeds:** Supports latest, trending, most-discussed, following, and category-filtered feeds with cursor pagination.
- **Threaded discussions:** Includes nested comments, comment editing/deletion, replies, and per-comment reactions.
- **Reactions and bookmarks:** Users can react with like/love and save posts to personal bookmarks.
- **User profiles and follows:** Forum profiles include username, bio, avatar, reputation, followers, following, and user post history.
- **Real-time updates:** Socket.io broadcasts new posts, post updates, comments, and notification events.
- **Search and discovery:** Full-text search covers posts, tags, categories, and user-facing forum discovery flows.
- **Moderation system:** Users can report content; moderators/admins can review reports, hide content, warn users, or ban accounts.

### 11. Teacher Studio & Content Management
- **Teacher application flow:** Users can apply to become teachers/tutors with academic, identity, and guidance-related profile details.
- **Question uploader:** Teachers can create MCQ, written, and CQ questions with options, solutions, images, source tags, and chapter/topic metadata.
- **My questions management:** Teachers can view, edit, and delete their own uploaded questions.
- **Contest builder:** Step-by-step contest creation supports manual question entry, Question Bank selection, confirmation, and publishing.
- **Book management:** Teachers can upload, update, publish/unpublish, and delete their own reading-library books.
- **IELTS content tools:** Teachers can upload IELTS preparation resources, including structured listening sets.

### 12. Authentication, Profiles & Platform Foundation
- **Google OAuth login:** Uses Passport.js Google OAuth 2.0 for account creation and login.
- **JWT-protected APIs:** Secures private REST routes and Socket.io connections with signed JWT authentication.
- **Profile completion:** Collects role-specific student, tutor, and teacher profile information after login.
- **Role-based access control:** Separates student, tutor, teacher, moderator, and admin capabilities across APIs and UI flows.
- **Bilingual interface:** Provides Bengali and English language context support for the frontend.
- **Media storage:** Uses Cloudinary for forum images, Firebase Storage for uploaded books, and local disk storage for IELTS uploads.
- **Security-minded backend:** Includes HTML sanitization, upload validation, rate limiting, strong JWT secret enforcement, and centralized error handling.
- **Responsive polished UI:** Uses React 19, Vite, Framer Motion, React Hot Toast, React Icons, and mobile-friendly layouts.

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
