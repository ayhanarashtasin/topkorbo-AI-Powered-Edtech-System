# TopKorbo 🚀
**The Elite Academic Testing & Contest Platform for Bangladeshi Students**

TopKorbo is a comprehensive, interactive academic testing and learning management web application built for the **CUET SciBlitz AI Hackathon**. It features a robust multi-subject Question Bank, a full-featured Mock Test environment, and a dedicated Teacher Studio for uploading educational content and organizing Codeforces-style academic contests.

---

## 🌟 Key Features

### 1. 📖 Interactive Question Bank (QBank)
* **Smart Filtering:** Filter questions by Subject, Paper, Chapter, and Topic.
* **Dual Track:** Supports both **Board Exam** questions and **Top College** questions.
* **Multi-Format:** Fully supports Creative Questions (CQ), Multiple Choice Questions (MCQ), and Written Descriptive questions.
* **LaTeX Support:** Beautiful math equations and formulas rendered using KaTeX.

### 2. 📝 Real-Time Mock Tests
* **Exam Environment:** Interactive test interface equipped with active countdown timers.
* **Instant Evaluation:** Grading results page complete with a performance mascot and celebratory confetti.
* **Interactive Solutions:** Review detailed answers and explanations for every question after submission.

### 3. 🎓 Teacher Studio (Teacher Portal)
* **Become a Teacher:** Application system for user verification.
* **Interactive Question Uploader:** Create new questions with custom options, LaTeX math support, board/college tags, and detailed solution explanations.
* **Contest Creator:** Step-by-step creation flow for setting up customized student contests (Codeforces-style).

### 4. 🌐 Localization & Customization
* **Bilingual UI:** Easily toggle between **Bengali (বাংলা)** and **English** with full translation files.
* **User Accounts:** Secure registration, profile management, and customization settings.
* **Responsiveness:** A fluid, modern UI powered by Framer Motion animations.

---

## 🛠️ Technology Stack

### **Frontend (client)**
* **Core:** React 19, Vite (Fast HMR)
* **Styling & Animations:** Custom Vanilla CSS, Framer Motion (premium transitions & micro-animations)
* **Math Rendering:** KaTeX
* **Icons:** React Icons
* **Routing & HTTP:** React Router DOM, Axios
* **Toasts & Feedback:** React Hot Toast, React Confetti

### **Backend (server)**
* **Runtime:** Node.js, Express
* **Database:** MongoDB, Mongoose
* **Authentication:** Passport.js (JWT, Google OAuth 2.0)
* **Security & Utilities:** CORS, Dotenv, Express Rate Limit

---

## 📂 Project Structure

```text
CUET-SciBlitz-AI-Hackathon/
├── client/                 # Frontend React application
│   ├── public/             # Static assets & localization files (JSON)
│   ├── src/
│   │   ├── components/     # UI components (Layout, Landing, etc.)
│   │   ├── context/        # Context APIs (Language, etc.)
│   │   ├── pages/          # Pages (Dashboard, QBank, MockTest, etc.)
│   │   └── styles/         # Custom CSS animations & layout stylesheets
│   ├── package.json
│   └── vite.config.js
│
└── server/                 # Backend Node.js / Express API
    ├── config/             # Database & Passport configurations
    ├── controllers/        # Request handling logic
    ├── middleware/         # Auth verification & error handling
    ├── models/             # Mongoose database schemas
    ├── routes/             # API routes (Auth, Questions, Contests, etc.)
    ├── server.js           # Server entry point
    └── package.json
```

---

## 🚀 Getting Started

Follow these steps to run the application locally.

### **Prerequisites**
* [Node.js](https://nodejs.org/) installed on your machine.
* [MongoDB](https://www.mongodb.com/) running locally or a MongoDB Atlas connection string.

---

### **1. Backend Setup (`server`)**

1. Navigate to the server folder:
   ```bash
   cd server
   ```
2. Install the backend dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on the `.env.example` template:
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_connection_uri
   JWT_SECRET=your_jwt_signing_secret
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```

---

### **2. Frontend Setup (`client`)**

1. Open a new terminal and navigate to the client folder:
   ```bash
   cd client
   ```
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173`.

---

## 👥 Contributors
* **Arpita Sarkar** ([@arpii26](https://github.com/arpii26))
* **Ayhan Arashtasin** ([@ayhanarashtasin](https://github.com/ayhanarashtasin))
