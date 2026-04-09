# 🔗 SyncUp — Find Common Free Time Instantly

## Web Link
[Click here](https://syncup-mu.vercel.app/)

## 👥 Team Members
- Vaishnavi  
- Michael Dias  
- Taniska Rout  

---

## 📖 Project Overview

**SyncUp** is a web application designed to simplify scheduling among friends, teams, or groups. It automatically analyzes users' calendars to find **common free time slots**, eliminating the need for manual coordination.

---

## ❗ Problem Statement

In today’s fast-paced world, finding a common free time is difficult because people:

- Manually ask availability in chats  
- Scroll through calendars individually  
- Miss scheduling conflicts  

This process is:
- ⏳ Time-consuming  
- 🤯 Confusing  
- ❌ Inefficient  

---

## 💡 Proposed Solution

SyncUp solves this by:

- Connecting users’ **Google Calendars**
- Automatically analyzing availability  
- Finding **overlapping free time slots**
- Displaying them in a clear, visual format  

---

## 🚀 Key Features

### 👤 User Features
- Google Login (OAuth 2.0)
- Automatic calendar sync  
- Create or join groups via unique link  
- Select date range & duration  
- Instantly view common free slots  

---

### 📅 Calendar Features
- Reads busy slots from Google Calendar  
- Detects overlapping free time  
- Supports multiple users  
- Real-time updates  

---

### 🎨 Interface Features
- Clean & responsive UI  
- Weekly / daily views  
- Color-coded time slots  
- Mobile-friendly design  

---

## ⚙️ How It Works

1. User logs in via Google OAuth  
2. App fetches calendar data using Google Calendar API  
3. Users join a group via shared link  
4. Backend compares all schedules  
5. Algorithm detects overlapping free time  
6. Results displayed visually  

---

## 🏗️ System Architecture
User
↓
Frontend (HTML, CSS, JavaScript)
↓
Backend (Node.js / Express)
↓
Google Calendar API
↓
Database (User & Group Data)

---

## 🛠️ Tech Stack

### 🌐 Frontend
- HTML5  
- CSS3  
- JavaScript  
- Bootstrap / Tailwind CSS  

### ⚙️ Backend
- Node.js  
- Express.js  

### 🔐 Authentication
- Google OAuth 2.0  

### 📅 API
- Google Calendar API  

### 🗄️ Database
- MongoDB / Firebase  

---

## 🧠 Algorithms Used

- Time Interval Comparison  
- Overlapping Slot Detection  
- Availability Intersection  


---

## ✅ Advantages

- Saves time ⏱️  
- Eliminates manual coordination ❌  
- Real-time sync 🔄  
- Easy group scheduling 👥  
- Works across devices 📱💻  

---

## 📂 Project Structure
SyncUp/
│
├── SyncUp_backend/
│   ├── config/
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── ...
│
├── SyncUp_frontend/
│   ├── src/
│   ├── public/
│   └── ...
│
└── README.md

---

## ⚡ Setup Instructions

### 🔧 Backend

```bash
cd SyncUp_backend
npm install
npm start
```
## 🎨 Frontend

```bash
cd SyncUp_frontend
npm install
  npm run dev
  ```

## 🤝 Contribution

This project was developed as a collaborative effort.

- Vaishnavi  
- Michael Dias  
- Taniska Rout  

Contributions and improvements are welcome!

---

## ⭐ Acknowledgements

- Google Calendar API  
- OAuth 2.0 Authentication  
- Open-source community  

---

## 👩‍💻 Authors

- **Taniska Rout** ([@TanzzR](https://github.com/TanzzR))  
- **Vaishnavi**  
- **Michael Dias**([@EmdyMC](https://github.com/EmdyMC))