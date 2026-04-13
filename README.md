# 🚀 Nexus – ML-Powered Professional Recommendation System

A full-stack machine learning application that recommends high-value professional connections using ranking models and diversity optimization.

---

## 🌐 Live Demo

* **Frontend:** https://your-frontend.vercel.app
* **Backend API:** https://linkedin-recommendation-1.onrender.com/docs

---

## 🧠 Overview

Nexus is a LinkedIn-style recommendation engine that suggests relevant and diverse professional connections based on:

* Skills similarity
* Career goals alignment
* Industry and experience matching
* Machine learning ranking (LambdaRank)
* Diversity optimization (MMR – Maximal Marginal Relevance)

---

## ⚙️ Tech Stack

### 🔹 Backend

* FastAPI
* LightGBM (LambdaRank)
* Scikit-learn
* Pandas / NumPy

### 🔹 Frontend

* React (Vite)
* CSS (custom UI components)

### 🔹 Deployment

* Backend: Render
* Frontend: Vercel

---

## 🏗️ System Architecture

1. User searches a profile
2. Backend loads candidate profiles
3. ML model ranks candidates using LambdaRank
4. MMR algorithm ensures diverse recommendations
5. Top results returned via API
6. Frontend displays ranked connections

---

## 📊 Features

* 🔍 Smart profile search (name, role, industry, company)
* 🤖 ML-based recommendation engine
* ⚖️ Diversity control slider (MMR)
* 📈 Match score visualization
* ⚡ Optimized backend (fast inference with filtered candidates)
* 🌐 Fully deployed full-stack system

---

## 🚀 API Endpoints

### Health Check

```
GET /
```

### Search Profiles

```
GET /profiles?q=engineer&limit=20
```

### Get Profile Details

```
GET /profile/{profile_id}
```

### Get Recommendations

```
POST /recommend
```

**Request Body:**

```json
{
  "profile_id": "P_00001",
  "top_n": 10,
  "diversity": 0.3
}
```

---

## ⚡ Performance Optimization

* Candidate filtering (industry + location)
* Reduced search space (~50K → ~2K profiles)
* Batch prediction using LightGBM
* Efficient feature computation

---

## 📂 Project Structure

```
project/
│
├── backend/
│   ├── main.py
│   ├── recommender.py
│   ├── models/
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── App.jsx
│   └── package.json
│
└── README.md
```

---

## 🧪 Run Locally

### Backend

```
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```
cd frontend
npm install
npm run dev
```

---

## 📌 Key Concepts

* **LambdaRank:** Learning-to-rank algorithm for scoring candidates
* **MMR (Maximal Marginal Relevance):** Balances relevance and diversity
* **TF-IDF:** Text similarity for skills and goals
* **Cosine Similarity:** Used for feature comparison

---

## 📈 Future Improvements

* Vector search (FAISS) for faster retrieval
* Redis caching for repeated queries
* Explainable AI (why this recommendation?)
* Real-time user interaction tracking

---

## 👨‍💻 Author

Built as a full-stack ML system demonstrating real-world recommendation architecture.

---

## ⭐ If you like this project

Give it a star ⭐ and share!