<div align="center">

# TopKorbo

### Academic Testing, Learning, AI, Reading, Mentorship, and Community Platform

TopKorbo is a full-stack learning ecosystem for Bangladeshi students, built for the CUET SciBlitz AI Hackathon. It combines question-bank practice, mock tests, contests, AI tutoring, study planning, IELTS preparation, live classes, mentorship, a PDF reading library, subscriptions, payments, and a real-time community forum.

[Overview](#overview) . [Features](#features) . [Tech Stack](#tech-stack) . [Getting Started](#getting-started) . [Environment Variables](#environment-variables) . [API Overview](#api-overview) . [Deployment](#deployment)

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Realtime-Socket.io-010101?logo=socket.io&logoColor=white)

</div>

---

## Overview

TopKorbo is a monorepo with two independent JavaScript packages:

| Package | Purpose | Stack |
| --- | --- | --- |
| `client/` | Single-page web application | React 19, Vite 8, React Router 7 |
| `server/` | REST API, Socket.io API, file handling, AI, payments | Node.js, Express, MongoDB, Mongoose |

The frontend is route-code-split with `React.lazy`, uses `BrowserRouter`, and stores the auth token in `localStorage.topkorbo_token`. The backend exposes JSON APIs under `/api`, serves `/uploads`, runs Socket.io on the same HTTP server, and can also serve the built React app from `client/dist` in production.

---

## Features

### 1. Authentication, Roles, and Profiles

- Google OAuth 2.0 login through Passport.js.
- JWT-protected REST APIs and Socket.io handshakes.
- Required strong `JWT_SECRET`; the server exits if it is missing or set to a placeholder.
- Profile completion for students, tutors, and teachers.
- Phone-number verification endpoint.
- Teacher application flow for becoming a content creator/teacher.
- Role-aware behavior for students, tutors, teachers, forum moderators, and admins.
- Admin bootstrap through `ADMIN_EMAILS`, which promotes matching users to forum admin on server startup.
- User profile editing, avatar upload, follows, follow-state checks, user post history, and forum profile data.

### 2. Subscription Plans, Limits, and Payments

- Plans are defined centrally in `server/config/plans.js`.
- Free plan: 5 question-bank exams, 5 mock tests, 3 battle rooms, 20 AI actions, and up to 2 opened reading books.
- Pro plan: 150 BDT for 30 days, unlimited question-bank exams, mock tests, battles, AI actions, and reading books.
- Pro+ plan: 250 BDT for 30 days, everything in Pro plus reading tools and reading AI.
- Paid plans lazily expire after 30 days and are treated as free after expiry.
- Usage counters are stored on the user document and enforced server-side.
- Paywall responses use `LIMIT_REACHED` or `UPGRADE_REQUIRED`; the frontend listens for those responses and redirects users to `/pricing`.
- SSLCommerz checkout flow supports payment init, success, failure, cancel, and IPN callbacks.
- Payment success is validated server-side before a plan is granted.
- Settings page includes plan status, usage bars, expiration display, and upgrade/manage links.

### 3. Question Bank and Practice

- Teacher question creation for MCQ, written/descriptive, and creative/CQ-style content.
- Questions support subject, paper, chapter, topic, source, source type, images, solution text, solution images, options, and metadata.
- Dedicated question-bank browsing flows for source questions, board/college questions, admission cards, varsity sources, and varsity written questions.
- Mock-test-oriented topic lookup and question filtering.
- QBank browse endpoint for contest question selection.
- Teacher-owned question management through `GET /api/questions/mine`, `PUT /api/questions/:id`, and `DELETE /api/questions/:id`.
- Practice attempts store immutable question snapshots, answers, selected options, uploads, scoring data, skipped/flagged state, time spent, and notes.
- Practice history supports listing, single-attempt review, aggregate stats, note updates, and soft deletion.

### 4. Mock Tests and Exam Evaluation

- Students can generate mock tests from selected subjects, papers, chapters, topics, and counts.
- Exam page supports timed test flow, answer selection, submission, and results.
- Mock-test attempts are persisted through `/api/mock-tests/attempts`.
- MCQ-style scoring supports correct, wrong, skipped, obtained marks, and percentage-style summaries.
- Written-answer evaluation is available through the AI evaluation endpoints.
- Attempt data uses snapshots so previous results remain stable even if source questions are later edited.

### 5. Contests and Ratings

- Teachers can create contests with title, schedule, questions, and publishing details.
- Contest builder supports manual question entry and selecting existing question-bank questions.
- Students can view upcoming/active contests, register, participate, and submit results.
- Result endpoint supports contest ranking/result display.
- Students have contest rating history through `/api/contests/rating/me`.
- Teachers can view, update, and delete their own contests.

### 6. Real-Time AI Battle Arena

- Authenticated users can create battle rooms, join rooms, start rooms, answer questions, update team names, and create rematches.
- Supports room-based real-time game state through Socket.io.
- Supports duel, squad/custom squad, and raid-style battle configurations in the app flow.
- Battle state includes players, teams, readiness, current question, round timer, answers, scoring, and room lifecycle.
- Room creation consumes the free-plan `battleRooms` quota.
- AI battle coaching is available through `/api/battles/coach` and consumes AI quota.
- The AI opponent helper endpoint `/api/ai/answer-mcq` is intentionally not metered per move because battle room creation already limits the flow.

### 7. AI Tutor and Academic Assistance

- Groq/OpenAI-compatible LLM backend for general chat, question explanations, answer help, extraction, study routines, and written evaluation.
- AI routes include chat, study routine generation, question extraction, MCQ answer assistance, chat history, and book chat.
- Evaluation routes include written answer evaluation, question explanation, and question-specific tutoring chat.
- General AI actions consume the free-plan `aiActions` quota.
- Book chat and reading knowledge features require Pro+.
- Chat history can be listed and cleared for general AI and book-specific AI.

### 8. Smart Reading Library

- Teachers can upload PDF books with title, description, category, group, subject, paper, publish state, and first-chapter metadata.
- Book PDFs are uploaded to Firebase Storage and streamed back through backend chapter PDF endpoints.
- Server supports HTTP range requests for local PDF files and storage-backed PDFs.
- Student reader supports chapter navigation, PDF rendering, reading state, bookmarks, highlights, annotations, chat sidebar, and mind map modal.
- Free plan can open up to 2 distinct books; Pro and Pro+ can open unlimited books.
- Reading tools such as highlights, highlight notes, pen annotations, and bulk annotation actions are gated to Pro+ where enforced by routes.
- Reading AI includes book knowledge snapshots, summaries, topic trees, key points, definitions, examples, quizzes, contextual book chat, and knowledge graph/mind map visualization.
- `ENABLE_KNOWLEDGE_TREE=true` enables extra LLM calls to build the mind map data during book processing.

### 9. Study Routine Planner

- Students can create and save study routines with daily sessions, subjects, priorities, rest days, and time estimates.
- Calendar and day-detail views show planned sessions and progress.
- Routine stats summarize total sessions, completed work, upcoming tasks, subject distribution, and progress.
- Users can toggle segments complete, edit segments, replace routines, delete routines, start sessions, and stop sessions.
- AI-assisted routine modification and next-week generation are available and consume AI quota.

### 10. IELTS Preparation Hub

- Student-facing IELTS areas for Listening, Reading, Writing, and Speaking.
- Teacher studio for uploading IELTS Listening, Reading, Writing, and Speaking materials.
- Listening uploads support structured four-section sets with audio and PDF files.
- Writing upload and writing-set listing are implemented.
- IELTS teacher discovery and appointment routes support teacher profiles, appointment booking, appointment listing, and appointment status updates.
- Upload middleware validates supported file formats and size limits for IELTS content.

### 11. Live Classes

- LiveKit-powered live class sessions for tutors and teachers.
- Mentors can view dashboard data, start sessions, reconnect to active sessions, and end sessions.
- Students can list available sessions and join sessions with generated LiveKit tokens.
- Attendance records track join/leave activity.
- LiveKit webhook endpoint accepts room/session callbacks.
- Live class tokens use a 2-hour TTL.
- Mentors are limited to 4 live sessions per week.
- LiveKit config accepts `LIVEKIT_HOST` or `LIVEKIT_URL`, plus API key and secret.

### 12. Mentorship

- Students can browse mentors and open mentor profiles.
- Mentor profiles include role, academic/university information, guidance interests, achievements, ratings, and reviews.
- Students can request mentor connections.
- Mentors can accept or reject connection requests.
- Student dashboard and mentor dashboard expose connection and progress-oriented data.
- Students can submit mentor reviews.

### 13. Community Forum

- Rich post creation with sanitized HTML, categories, tags, mentions, and up to 8 uploaded images.
- Forum images upload to Cloudinary when configured, otherwise fall back to local `/uploads/forum/...` storage.
- Feed supports latest/trending/discussion/following/category-oriented flows through backend feed logic.
- Post details include comments and discussion thread data.
- Nested comments support create, edit, delete, and replies.
- Reactions are handled through a toggle endpoint.
- Bookmarks are available through post bookmark routes and a dedicated bookmarks page.
- User profiles support username, bio, avatar, reputation, followers, following, warnings, bans, and user post history.
- Search supports forum/global search and category listing.
- Notifications support list, mark-one-read, and mark-all-read.
- Moderation supports reports plus admin report review/actions.
- Socket.io broadcasts community, notification, and realtime events.

### 14. Landing Page and Bilingual UI

- Landing page includes hero, stats, feature grid, analytics preview, question-bank preview, AI section, battle arena/showcase, mentor section, testimonials, and CTA sections.
- Waitlist submission and public stats are available under `/api/landing`.
- Frontend language context supports English and Bangla locale JSON files in `client/public/locales`.

### 15. Security, Uploads, and Reliability

- Centralized auth middleware protects private routes.
- Admin middleware protects moderation/admin actions.
- Plan and quota checks are enforced on the backend, not trusted from the client.
- Dynamic `/api` responses disable cache to avoid empty 304 JSON responses after refresh.
- Express JSON/urlencoded body size limit is `16mb`.
- Raw request body is captured for webhook-style HMAC verification paths.
- Uploaded PDFs use disk-backed temporary storage with a 500 MB limit before Firebase upload.
- Forum image uploads validate and limit image handling through Multer and upload services.
- HTML content is sanitized server-side.
- Global error handler standardizes errors.
- Backend registers SPA fallback after API/uploads routes so browser refresh works for frontend routes.
- Windows MongoDB Atlas SRV DNS handling is adjusted to use stable public resolvers when needed.

---

## Tech Stack

### Frontend (`client/`)

| Category | Technologies |
| --- | --- |
| Core | React 19, React DOM, Vite 8 |
| Routing | React Router DOM 7 |
| HTTP | Fetch, Axios, shared `httpClient` service |
| Realtime | Socket.io Client |
| Live Video | LiveKit React Components, LiveKit Client |
| PDF and Reader | react-pdf, react-d3-tree, custom annotation/highlight layers |
| Calendar and Dates | react-big-calendar, date-fns, moment |
| Math and Markdown | KaTeX, react-markdown, remark-gfm, rehype-katex |
| UI and Feedback | Framer Motion, React Hot Toast, React Icons, React Confetti |
| Testing | Vitest, Testing Library, jsdom |
| Linting | ESLint 10, React Hooks plugin, React Refresh plugin |

### Backend (`server/`)

| Category | Technologies |
| --- | --- |
| Runtime | Node.js, Express 4 |
| Database | MongoDB, Mongoose 8 |
| Auth | Passport, Passport Google OAuth 2.0, JSON Web Token |
| Realtime | Socket.io |
| AI | Groq SDK, OpenAI-compatible API settings, `@xenova/transformers` for embeddings/RAG support |
| PDF and Files | Multer, pdf-parse, Canvas, Firebase Admin Storage |
| Payments | SSLCommerz (`sslcommerz-lts`) |
| Media | Cloudinary with local fallback |
| Security and Utilities | CORS, dotenv, express-rate-limit, sanitize-html, slugify, jose |
| Testing | Jest |

---

## Project Structure

```text
CUET-SciBlitz-AI-Hackathon/
├── README.md
├── vercel.json                    # Frontend Vercel build config from repo root
├── client/
│   ├── package.json
│   ├── public/
│   │   ├── _redirects
│   │   ├── favicon.svg
│   │   ├── icons.svg
│   │   ├── assets/
│   │   └── locales/               # en.json, bn.json
│   └── src/
│       ├── App.jsx                # Browser routes and providers
│       ├── components/            # layout, landing, forum, reader, liveclass, study, settings
│       ├── context/               # LanguageContext, ForumContext
│       ├── hooks/                 # plan, socket, reader, drawing, debounce, chat hooks
│       ├── pages/                 # dashboard, qbank, contests, battle, reader, IELTS, forum, etc.
│       ├── services/              # API service wrappers
│       ├── styles/                # global, animation, forum CSS
│       ├── test/                  # test setup
│       └── utils/                 # date helpers, paywall, question tags
└── server/
    ├── package.json
    ├── server.js                  # Express, routes, Socket.io, uploads, SPA fallback
    ├── config/                    # db, passport, firebase, cloudinary, plans
    ├── controllers/               # request handling by feature
    ├── middleware/                # auth, admin, uploads, plan/AI quota, errors
    ├── models/                    # Mongoose schemas
    ├── routes/                    # REST route modules
    ├── scripts/                   # bootstrapAdmin
    ├── services/                  # AI, RAG, PDF, upload, plan, notifications, sanitization
    ├── socket/                    # Socket.io handlers
    ├── tmp/                       # temporary upload directory at runtime
    └── uploads/                   # local upload fallback, ignored by git
```

`node_modules/`, `client/dist/`, logs, `.env` files, `.puku/`, and `server/uploads/` are ignored by git.

---

## Getting Started

### Prerequisites

- Node.js 18 or newer.
- npm.
- MongoDB locally or a MongoDB Atlas URI.
- Google OAuth credentials for login.
- A strong random JWT secret.
- Optional: Groq API key for AI features.
- Optional: Firebase Admin and Storage bucket for book uploads.
- Optional: LiveKit credentials for live classes.
- Optional: Cloudinary credentials for forum image hosting.
- Optional: SSLCommerz sandbox/live credentials for paid plan checkout.

### 1. Clone the repository

```bash
git clone https://github.com/ayhanarashtasin/CUET-SciBlitz-AI-Hackathon.git
cd CUET-SciBlitz-AI-Hackathon
```

### 2. Install backend dependencies

```bash
cd server
npm install
```

### 3. Configure backend environment

```bash
cp .env.example .env
```

Fill in at least `MONGODB_URI`, `JWT_SECRET`, Google OAuth values, and any optional service keys you need.

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 4. Run the backend

```bash
npm run dev
```

The API runs at `http://localhost:5000` by default.

Health check:

```bash
GET http://localhost:5000/api/health
```

### 5. Install frontend dependencies

Open a second terminal:

```bash
cd client
npm install
```

### 6. Configure frontend environment

Create `client/.env` if you need to override the API URL:

```env
VITE_API_URL=http://localhost:5000/api
```

### 7. Run the frontend

```bash
npm run dev
```

The app runs at `http://localhost:5173` by default.

### Important Notes

- There is no root `package.json` script for running both apps together. Start `server/` and `client/` separately.
- The backend reads `server/.env`; the Vite dev server reads `client/.env` or shell-provided `VITE_*` variables.
- `server/.env.example` includes `VITE_API_URL` for convenience, but that value only affects frontend builds when it is also present in the frontend environment.
- If Firebase variables are missing, book upload functionality will not work correctly because `bookController` imports the Firebase bucket at startup.
- If SSLCommerz variables are missing, payment init returns a gateway-not-configured error.
- If LiveKit variables are missing, live-class endpoints return configuration errors.
- If Cloudinary variables are missing, forum images use local disk fallback under `/uploads/forum`.

---

## Environment Variables

### Backend (`server/.env`)

```env
# Core
MONGODB_URI=mongodb://localhost:27017/topkorbo
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
SERVER_URL=http://localhost:5000
VITE_API_URL=http://localhost:5000/api

# Auth
JWT_SECRET=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# AI tutor / LLM
# Either LLM_API_KEY or GROQ_API_KEY works.
LLM_API_KEY=
GROQ_API_KEY=
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
ENABLE_KNOWLEDGE_TREE=true

# Firebase Storage for reading-library PDF uploads
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_STORAGE_BUCKET=

# Live classes (LiveKit)
# LIVEKIT_HOST or LIVEKIT_URL may be used.
LIVEKIT_HOST=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=

# Community image uploads (Cloudinary optional)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Admin bootstrap
ADMIN_EMAILS=admin@topkorbo.local

# Payments (SSLCommerz)
SSLCZ_STORE_ID=your-sandbox-store-id
SSLCZ_STORE_PASSWORD=your-sandbox-store-password
SSLCZ_IS_LIVE=false
```

### Frontend (`client/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

---

## Frontend Routes

| Route | Page |
| --- | --- |
| `/` | Landing page |
| `/dashboard` | Student dashboard |
| `/contests` | Contest list |
| `/qbank` | Question Bank |
| `/qbank/source-questions` | Board/source questions |
| `/qbank/varsity-written` | Varsity written questions |
| `/setting`, `/settings` | Settings and subscription panel |
| `/teacher` | Teacher application |
| `/upload-question` | Teacher question upload |
| `/mock-test` | Mock test setup |
| `/mock-test/exam` | Mock test exam screen |
| `/study-routine` | Study routine planner |
| `/practice-history` | Practice history and stats |
| `/student/find-mentor` | Mentor discovery |
| `/battle` | Realtime battle arena |
| `/battle-ai` | AI battle flow |
| `/make-contest-question` | Contest question builder start |
| `/make-contest-question/next` | Contest builder step |
| `/make-contest-question/next-two` | Contest builder step |
| `/make-contest-question/choose-qbank` | Choose contest questions from QBank |
| `/make-contest-question/confirm` | Confirm contest questions |
| `/pricing` | Subscription pricing and checkout |
| `/reading-books` | Reading library |
| `/reading-books/upload` | Teacher book upload |
| `/reading-books/:bookId/:chapterId` | PDF reader |
| `/mentor/live-class` | Mentor live class host page |
| `/student/live-class` | Student live class join page |
| `/ielts-prep` | IELTS hub |
| `/ielts-teacher` | IELTS teacher studio |
| `/ielts-teacher/listening/upload` | IELTS listening upload |
| `/ielts-teacher/reading/upload` | IELTS reading upload |
| `/ielts-teacher/writing/upload` | IELTS writing upload |
| `/ielts-teacher/speaking/upload` | IELTS speaking upload |
| `/ielts-prep/listening` | IELTS listening |
| `/ielts-prep/reading` | IELTS reading |
| `/ielts-prep/writing` | IELTS writing |
| `/ielts-prep/speaking` | IELTS speaking |
| `/ielts-prep/listening/practice` | IELTS listening practice |
| `/ielts-prep/reading/practice` | IELTS reading practice |
| `/ielts-prep/writing/practice` | IELTS writing practice |
| `/ielts-prep/speaking/practice` | IELTS speaking practice |
| `/forum` | Forum feed |
| `/forum/compose` | Compose forum post |
| `/forum/post/:id` | Forum post details |
| `/forum/search` | Forum search |
| `/forum/bookmarks` | Forum bookmarks |
| `/forum/u/:id` | Forum user profile |

---

## API Overview

All backend routes are mounted under `/api` unless noted.

| Area | Base Route | Main Capabilities |
| --- | --- | --- |
| Health | `/api/health` | Service health JSON |
| Landing | `/api/landing` | Waitlist signup, public stats |
| Auth | `/api/auth` | Google OAuth, profile completion, phone verification, current user, teacher application |
| Users | `/api/users` | Current forum profile, profile update/avatar, follow/unfollow, follow state, user posts, user lookup |
| Questions | `/api/questions` | Create/update/delete questions, teacher questions, topics, sources, source browsing, varsity/admission browsing, QBank browse, mock-test question fetch |
| Practice | `/api/practice` | Submit attempts, list attempts, stats summary, attempt details, notes, soft delete |
| Mock Tests | `/api/mock-tests` | Create persisted mock-test attempts |
| Contests | `/api/contests` | Create, list own/upcoming, update, delete, register, submit result, contest result, rating history |
| Battles | `/api/battles` | Rooms, joins, team names, start, answers, rematch, AI coach |
| AI | `/api/ai` | Chat, book chat, study routine, question extraction, MCQ answer helper, history, book history |
| Evaluation | `/api/evaluate` | Written answer evaluation, explanations, question chat |
| Study Routine | `/api/study-routine` | Routine CRUD, stats, segment toggle/edit, replace, AI modify, next-week generation, session start/stop |
| Books | `/api/books` | Taxonomy, book list/detail, chapters, PDF stream, upload, update, delete, reading state, annotations, knowledge |
| Highlights | `/api/highlights` | List/create/update/delete highlights and highlight notes |
| Mentorship | `/api/mentor-connections` | Mentor list/profile/reviews, student dashboard, mentor dashboard, requests, request responses |
| Live Classes | `/api/live-class` | Mentor dashboard/start/end, student sessions/join, LiveKit webhook |
| IELTS | `/api/ielts` | Listening upload/list, writing upload/list, teachers, appointments, appointment status |
| Payments | `/api/payments` | SSLCommerz checkout init, success/fail/cancel redirects, IPN |
| Posts | `/api/posts` | Forum feed, create, detail, update, delete, bookmarks |
| Post Comments | `/api/posts/:postId/comments` | Create/list nested comments for a post |
| Comments | `/api/comments` | Edit/delete comments |
| Reactions | `/api/reactions` | Toggle reactions |
| Notifications | `/api/notifications` | List, mark read, mark all read |
| Search | `/api/search` | Search and categories |
| Moderation | `/api/reports`, `/api/admin/reports` | Create reports, admin report list, admin moderation action |
| Uploads | `/uploads` | Static local upload fallback, outside `/api` |

---

## Testing

### Backend

```bash
cd server
npm test
```

Runs Jest with `--forceExit --detectOpenHandles`.

### Frontend

```bash
cd client
npm test
```

Runs Vitest once with Testing Library/jsdom setup.

### Frontend Lint

```bash
cd client
npm run lint
```

---

## Build and Preview

### Frontend build

```bash
cd client
npm run build
```

### Frontend preview

```bash
cd client
npm run preview
```

### Backend serving built frontend

After `client/dist` exists, the Express server serves those static files and falls back to `client/dist/index.html` for non-API, non-upload routes. This keeps frontend routes refresh-safe in production.

---

## Deployment

### Vercel Frontend

The root `vercel.json` is configured for a frontend-only Vercel deployment:

```json
{
  "installCommand": "cd client && npm ci",
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Set `VITE_API_URL` in the Vercel project environment so the frontend points to the deployed backend.

### Backend

Deploy `server/` to a Node-capable host with MongoDB access and the required environment variables. If the backend is also serving the React build, run the frontend build first so `client/dist` exists beside the server.

### Webhooks and Public Callback URLs

- SSLCommerz callbacks use `SERVER_URL` for `/api/payments/success`, `/api/payments/fail`, `/api/payments/cancel`, and `/api/payments/ipn`.
- LiveKit webhooks call `/api/live-class/webhooks`.
- Payment IPN and LiveKit webhooks require a publicly reachable backend URL in deployed or tunnelled development environments.

---

## Data and Storage Notes

- MongoDB stores users, questions, contests, contest results, practice attempts, mock-test attempts, books, book knowledge, book chunks, book pages, reading states, annotations, highlights, posts, comments, reactions, reports, notifications, payments, live sessions, attendance, mentor connections, reviews, IELTS sets, appointments, study routines, study sessions, rating history, and waitlist entries.
- Firebase Storage stores uploaded reading-library PDFs.
- Local `server/uploads/` stores fallback forum images and any local upload files; it is ignored by git.
- Cloudinary is used for forum images only when all three Cloudinary credentials are configured.
- Temporary large book uploads are written under `server/tmp/uploads/books` before being uploaded to Firebase.

---

## Contributors

- **Arpita Sarkar** - [@arpii26](https://github.com/arpii26)
- **Ayhan Arashtasin** - [@ayhanarashtasin](https://github.com/ayhanarashtasin)

---

<div align="center">

Built for the **CUET SciBlitz AI Hackathon**.

</div>
