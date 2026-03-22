# 🚨 SOS Emergency Response System — Pune

A full-stack web-based emergency response system designed to handle real-time SOS alerts and efficiently assign rescue teams and hospitals within Pune.

---

## 📌 Project Overview

The **SOS Emergency Response System** allows citizens to quickly report emergencies such as fire, accidents, floods, or medical issues using a simple interface. The system automatically logs the incident, tracks location, and enables administrators to assign rescue teams and hospitals.

---

## 🎯 Features

### 👤 Citizen Panel

* User Registration & Login
* One-click SOS alerts (Fire, Accident, Flood, Medical)
* Automatic location capture
* View incident status
* Cancel active SOS request
* View emergency contacts

---

### 🛠️ Admin Panel

* Secure Admin Login
* View all emergency calls
* Assign rescue teams
* Manage hospitals and teams
* Update incident status (Active → Closed)
* Dashboard with statistics

---

### 📍 System Features

* Real-time SOS logging
* Location-based incident tracking (Pune)
* REST API-based backend
* Clean UI/UX design
* Session-based authentication

---

## 🏗️ Tech Stack

| Layer    | Technology             |
| -------- | ---------------------- |
| Frontend | HTML, CSS, JavaScript  |
| Backend  | PHP                    |
| Database | MySQL                  |
| Server   | XAMPP (Apache + MySQL) |

---

## 📂 Project Structure

```
SOS_Emergency-System_Pune/
│
├── frontend/        # UI (Login, Register, Dashboard)
├── backend/         # PHP APIs
├── database/        # SQL schema
├── README.md
└── LICENSE
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/SOS_Emergency-System_Pune.git
```

---

### 2️⃣ Move to XAMPP

Copy the project folder to:

```
C:/xampp/htdocs/
```

---

### 3️⃣ Start Server

* Start **Apache**
* Start **MySQL**

---

### 4️⃣ Setup Database

1. Open phpMyAdmin
2. Create database:

```
sos_pune
```

3. Import SQL file from `/database`

---

### 5️⃣ Run Project

Open in browser:

```
http://localhost/sos_project/frontend/index.html
```

---

## 🔐 Default Access

### 👨‍💼 Admin Login

* Username: `admin`
* Password: `admin123`

*(You can modify this in the database)*

---

## 📊 Database Tables

* `users` – User authentication
* `emergency_call` – SOS logs
* `incidents` – Incident details
* `rescue_team` – Available teams
* `hospitals` – Hospital data
* `assignments` – Team assignment

---

## 🚀 Future Improvements

* 📍 Live GPS tracking
* 🔔 Real-time notifications
* 🤖 Auto nearest team assignment
* 📱 Mobile app version
* 📡 Integration with emergency services

---

## 👨‍💻 Author

**Himanshu Chawre**
GitHub: https://github.com/Himanshuchawre09

---

## 📜 License

This project is licensed under the MIT License.

---

## ⭐ Support

If you like this project, consider giving it a ⭐ on GitHub!
