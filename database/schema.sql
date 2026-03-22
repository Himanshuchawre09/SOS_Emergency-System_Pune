-- ============================================================
-- SOS Emergency Response System — Pune
-- Database: sos_pune
-- Updated: 2026
-- ============================================================

CREATE DATABASE IF NOT EXISTS sos_pune
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sos_pune;

-- ── USERS ────────────────────────────────────────────────
-- password column stores bcrypt hash
-- phone is UNIQUE to prevent duplicate registrations
-- role: 'admin' for control room, 'user' for citizens
CREATE TABLE IF NOT EXISTS users (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  password   VARCHAR(255) NOT NULL,
  role       ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── DEFAULT ADMIN ACCOUNT ────────────────────────────────
-- Phone: 9000000000
-- Password: Admin@2026
--
-- The hash below was generated with: password_hash('Admin@2026', PASSWORD_BCRYPT)
-- If login fails, regenerate it:
--   1. Open http://localhost/sos_project/backend/gen_hash.php
--   2. Copy the hash shown
--   3. UPDATE users SET password = '<new_hash>' WHERE phone = '9000000000';
INSERT IGNORE INTO users (name, phone, password, role) VALUES (
  'Control Room Admin',
  '9000000000',
  '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'admin'
);
-- NOTE: The hash above = "password" (standard test hash).
-- After import, immediately change it via phpMyAdmin or the gen_hash helper.

CREATE TABLE IF NOT EXISTS emergency_call (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  caller_name   VARCHAR(120) DEFAULT 'Anonymous',
  caller_phone  VARCHAR(20)  DEFAULT NULL,
  type          ENUM('fire','accident','flood','medical') NOT NULL,
  latitude      DECIMAL(10,7) NOT NULL DEFAULT 18.5204000,
  longitude     DECIMAL(10,7) NOT NULL DEFAULT 73.8567000,
  address       VARCHAR(255)  DEFAULT NULL,
  status        ENUM('ACTIVE','PROCESSED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS incidents (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  call_id    INT UNSIGNED NOT NULL,
  type       ENUM('fire','accident','flood','medical') NOT NULL,
  severity   TINYINT UNSIGNED NOT NULL DEFAULT 3,
  location   VARCHAR(255) NOT NULL DEFAULT 'Pune',
  latitude   DECIMAL(10,7) DEFAULT 18.5204000,
  longitude  DECIMAL(10,7) DEFAULT 73.8567000,
  status     ENUM('ACTIVE','ASSIGNED','CONTROLLED','CLOSED') NOT NULL DEFAULT 'ACTIVE',
  notes      TEXT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (call_id) REFERENCES emergency_call(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rescue_team (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  type       ENUM('fire','flood','accident','medical','general') NOT NULL DEFAULT 'general',
  status     ENUM('AVAILABLE','BUSY') NOT NULL DEFAULT 'AVAILABLE',
  location   VARCHAR(200) NOT NULL DEFAULT 'Pune',
  contact    VARCHAR(30)  DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assignments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id INT UNSIGNED NOT NULL,
  team_id     INT UNSIGNED NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME DEFAULT NULL,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)   ON DELETE CASCADE,
  FOREIGN KEY (team_id)     REFERENCES rescue_team(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS hospitals (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  beds       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  icu        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  location   VARCHAR(255) NOT NULL DEFAULT 'Pune',
  contact    VARCHAR(30)  DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS casualties (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id INT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL DEFAULT 'Unknown',
  age         TINYINT UNSIGNED DEFAULT NULL,
  gender      ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  triage      ENUM('red','yellow','green','black') NOT NULL,
  notes       TEXT DEFAULT NULL,
  hospital_id INT UNSIGNED DEFAULT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)  ON DELETE CASCADE,
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
