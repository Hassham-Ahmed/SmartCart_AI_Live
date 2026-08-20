-- =============================================================
-- SmartCart AI - Database Migration Schema
-- Creates all tables used by the Flask backend and seeds
-- 10 product categories with 10 products each (100 total).
--
-- Usage:
--   mysql -u root -p < smartcart_schema.sql
--   (or import via phpMyAdmin / Laragon's HeidiSQL)
-- =============================================================

CREATE DATABASE IF NOT EXISTS smartcart_ai
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE smartcart_ai;

-- -------------------------------------------------------------
-- USERS
-- -------------------------------------------------------------
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS wishlist;
DROP TABLE IF EXISTS shopping_cart;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS contact_messages;
DROP TABLE IF EXISTS subscribers;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(150)  NOT NULL,
    email           VARCHAR(150)  NOT NULL UNIQUE,
    password        VARCHAR(255)  NOT NULL,
    phone           VARCHAR(30),
    city            VARCHAR(100),
    address         VARCHAR(255),
    profile_image   VARCHAR(255),
    role            ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    status          ENUM('Active', 'Blocked') NOT NULL DEFAULT 'Active',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- PRODUCTS
-- -------------------------------------------------------------
CREATE TABLE products (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(200)   NOT NULL,
    brand           VARCHAR(100),
    category        VARCHAR(100)   NOT NULL,
    price           DECIMAL(12,2)  NOT NULL,
    stock           INT            NOT NULL DEFAULT 0,
    image           VARCHAR(500),
    description     TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_category (category)
);

-- -------------------------------------------------------------
-- SHOPPING CART
-- -------------------------------------------------------------
CREATE TABLE shopping_cart (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    product_id      INT NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- ORDERS
-- -------------------------------------------------------------
CREATE TABLE orders (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    total_amount        DECIMAL(12,2) NOT NULL,
    status              VARCHAR(50) NOT NULL DEFAULT 'Pending',
    payment_method      VARCHAR(100),
    shipping_address    VARCHAR(255),
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- WISHLIST
-- -------------------------------------------------------------
CREATE TABLE wishlist (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    product_id      INT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- REVIEWS
-- -------------------------------------------------------------
CREATE TABLE reviews (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    product_id      INT NOT NULL,
    rating          TINYINT NOT NULL,
    review          TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- -------------------------------------------------------------
-- CONTACT MESSAGES
-- -------------------------------------------------------------
CREATE TABLE contact_messages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    subject         VARCHAR(200),
    message         TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- NEWSLETTER SUBSCRIBERS
-- -------------------------------------------------------------
CREATE TABLE subscribers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(150) NOT NULL UNIQUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- SEED DATA: default admin account
-- -------------------------------------------------------------
INSERT INTO users (full_name, email, password, phone, city, role, status) VALUES
('Admin User', 'admin@smartcart.ai', 'admin123', '03000000000', 'Karachi', 'admin', 'Active');

-- -------------------------------------------------------------
-- SEED DATA: 10 categories x 10 products = 100 products
-- Categories: Laptops, Mobile Phones, Smart Watches,
-- Headphones & Earbuds, Cameras, Tablets, TVs & Monitors,
-- Printers, Keyboards & Mice, Speakers
-- -------------------------------------------------------------
INSERT INTO products (name, brand, category, price, stock, image, description) VALUES
('HP Pavilion 15', 'HP', 'Laptops', 110600, 8, 'https://picsum.photos/seed/smartcart1/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('Dell XPS 13', 'Dell', 'Laptops', 177600, 36, 'https://picsum.photos/seed/smartcart2/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('Lenovo ThinkPad X1 Carbon', 'Lenovo', 'Laptops', 156400, 22, 'https://picsum.photos/seed/smartcart3/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('Asus ROG Zephyrus G14', 'Asus', 'Laptops', 106900, 74, 'https://picsum.photos/seed/smartcart4/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('Acer Aspire 7', 'Acer', 'Laptops', 100600, 80, 'https://picsum.photos/seed/smartcart5/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('MSI Modern 14', 'MSI', 'Laptops', 237800, 9, 'https://picsum.photos/seed/smartcart6/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('Apple MacBook Air M2', 'Apple', 'Laptops', 77200, 16, 'https://picsum.photos/seed/smartcart7/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('Samsung Galaxy Book3', 'Samsung', 'Laptops', 154500, 34, 'https://picsum.photos/seed/smartcart8/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('Lenovo IdeaPad Slim 5', 'Lenovo', 'Laptops', 271900, 8, 'https://picsum.photos/seed/smartcart9/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('HP Envy x360', 'HP', 'Laptops', 294800, 30, 'https://picsum.photos/seed/smartcart10/500/500', 'Powerful performance for work, study, and entertainment with a sleek, portable design.'),
('iPhone 15 Pro', 'Apple', 'Mobile Phones', 378600, 33, 'https://picsum.photos/seed/smartcart11/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('Samsung Galaxy S23 Ultra', 'Samsung', 'Mobile Phones', 402900, 80, 'https://picsum.photos/seed/smartcart12/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('OnePlus 11 5G', 'OnePlus', 'Mobile Phones', 262800, 5, 'https://picsum.photos/seed/smartcart13/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('Xiaomi Redmi Note 12', 'Xiaomi', 'Mobile Phones', 165700, 59, 'https://picsum.photos/seed/smartcart14/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('Samsung Galaxy A54', 'Samsung', 'Mobile Phones', 313700, 40, 'https://picsum.photos/seed/smartcart15/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('iPhone 14', 'Apple', 'Mobile Phones', 162300, 32, 'https://picsum.photos/seed/smartcart16/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('OnePlus Nord CE 3', 'OnePlus', 'Mobile Phones', 310700, 18, 'https://picsum.photos/seed/smartcart17/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('Xiaomi 13 Pro', 'Xiaomi', 'Mobile Phones', 110900, 53, 'https://picsum.photos/seed/smartcart18/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('iPhone SE (2023)', 'Apple', 'Mobile Phones', 114200, 50, 'https://picsum.photos/seed/smartcart19/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('Samsung Galaxy Z Flip5', 'Samsung', 'Mobile Phones', 316700, 38, 'https://picsum.photos/seed/smartcart20/500/500', 'Feature-packed smartphone with a stunning display, fast processor, and excellent camera.'),
('Apple Watch Series 9', 'Apple', 'Smart Watches', 20800, 63, 'https://picsum.photos/seed/smartcart21/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Samsung Galaxy Watch 6', 'Samsung', 'Smart Watches', 121800, 20, 'https://picsum.photos/seed/smartcart22/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Huawei Watch GT 4', 'Huawei', 'Smart Watches', 89500, 15, 'https://picsum.photos/seed/smartcart23/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Amazfit GTR 4', 'Amazfit', 'Smart Watches', 125000, 42, 'https://picsum.photos/seed/smartcart24/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Apple Watch SE', 'Apple', 'Smart Watches', 86000, 78, 'https://picsum.photos/seed/smartcart25/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Samsung Galaxy Watch 5 Pro', 'Samsung', 'Smart Watches', 51300, 13, 'https://picsum.photos/seed/smartcart26/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Fitbit Versa 4', 'Fitbit', 'Smart Watches', 21300, 34, 'https://picsum.photos/seed/smartcart27/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Garmin Venu 3', 'Garmin', 'Smart Watches', 71200, 15, 'https://picsum.photos/seed/smartcart28/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Huawei Watch Fit 3', 'Huawei', 'Smart Watches', 59600, 17, 'https://picsum.photos/seed/smartcart29/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Amazfit Bip 5', 'Amazfit', 'Smart Watches', 89800, 40, 'https://picsum.photos/seed/smartcart30/500/500', 'Track your fitness, notifications, and health metrics right from your wrist.'),
('Apple AirPods Pro 2', 'Apple', 'Headphones & Earbuds', 51400, 51, 'https://picsum.photos/seed/smartcart31/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Samsung Galaxy Buds2 Pro', 'Samsung', 'Headphones & Earbuds', 21600, 52, 'https://picsum.photos/seed/smartcart32/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Sony WH-1000XM5', 'Sony', 'Headphones & Earbuds', 41300, 31, 'https://picsum.photos/seed/smartcart33/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('JBL Tune 760NC', 'JBL', 'Headphones & Earbuds', 73600, 39, 'https://picsum.photos/seed/smartcart34/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Logitech Zone Wireless', 'Logitech', 'Headphones & Earbuds', 76800, 14, 'https://picsum.photos/seed/smartcart35/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Apple AirPods Max', 'Apple', 'Headphones & Earbuds', 67300, 26, 'https://picsum.photos/seed/smartcart36/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Sony WF-1000XM5', 'Sony', 'Headphones & Earbuds', 59600, 36, 'https://picsum.photos/seed/smartcart37/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Bose QuietComfort Earbuds', 'Bose', 'Headphones & Earbuds', 21700, 64, 'https://picsum.photos/seed/smartcart38/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('JBL Live Pro 2', 'JBL', 'Headphones & Earbuds', 43800, 39, 'https://picsum.photos/seed/smartcart39/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Logitech G435 Gaming Headset', 'Logitech', 'Headphones & Earbuds', 70500, 76, 'https://picsum.photos/seed/smartcart40/500/500', 'Immersive sound quality with noise cancellation for music and calls on the go.'),
('Canon EOS R10', 'Canon', 'Cameras', 107900, 46, 'https://picsum.photos/seed/smartcart41/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Nikon Z50', 'Nikon', 'Cameras', 363200, 12, 'https://picsum.photos/seed/smartcart42/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Sony Alpha a6400', 'Sony', 'Cameras', 111800, 9, 'https://picsum.photos/seed/smartcart43/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Fujifilm X-T30 II', 'Fujifilm', 'Cameras', 347700, 45, 'https://picsum.photos/seed/smartcart44/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('GoPro HERO12 Black', 'GoPro', 'Cameras', 182300, 39, 'https://picsum.photos/seed/smartcart45/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Canon PowerShot G7 X', 'Canon', 'Cameras', 45100, 32, 'https://picsum.photos/seed/smartcart46/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Sony ZV-1', 'Sony', 'Cameras', 250300, 45, 'https://picsum.photos/seed/smartcart47/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Nikon D3500', 'Nikon', 'Cameras', 105000, 68, 'https://picsum.photos/seed/smartcart48/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Fujifilm Instax Mini 12', 'Fujifilm', 'Cameras', 180000, 63, 'https://picsum.photos/seed/smartcart49/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('GoPro HERO11 Mini', 'GoPro', 'Cameras', 76500, 38, 'https://picsum.photos/seed/smartcart50/500/500', 'Capture stunning photos and videos with professional-grade image quality.'),
('Apple iPad 10th Gen', 'Apple', 'Tablets', 97100, 36, 'https://picsum.photos/seed/smartcart51/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Samsung Galaxy Tab S9', 'Samsung', 'Tablets', 269900, 73, 'https://picsum.photos/seed/smartcart52/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Lenovo Tab P11', 'Lenovo', 'Tablets', 147600, 79, 'https://picsum.photos/seed/smartcart53/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Xiaomi Pad 6', 'Xiaomi', 'Tablets', 215400, 79, 'https://picsum.photos/seed/smartcart54/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Apple iPad Air 5', 'Apple', 'Tablets', 203500, 51, 'https://picsum.photos/seed/smartcart55/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Samsung Galaxy Tab A9', 'Samsung', 'Tablets', 129800, 22, 'https://picsum.photos/seed/smartcart56/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Huawei MatePad 11', 'Huawei', 'Tablets', 248700, 68, 'https://picsum.photos/seed/smartcart57/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Lenovo Tab M10 Plus', 'Lenovo', 'Tablets', 77200, 11, 'https://picsum.photos/seed/smartcart58/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Apple iPad Pro 11-inch', 'Apple', 'Tablets', 84900, 24, 'https://picsum.photos/seed/smartcart59/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Samsung Galaxy Tab S6 Lite', 'Samsung', 'Tablets', 105500, 59, 'https://picsum.photos/seed/smartcart60/500/500', 'Lightweight and versatile tablet perfect for browsing, streaming, and productivity.'),
('Samsung 55-inch Crystal UHD 4K TV', 'Samsung', 'TVs & Monitors', 272200, 13, 'https://picsum.photos/seed/smartcart61/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('LG 43-inch Smart TV', 'LG', 'TVs & Monitors', 185600, 53, 'https://picsum.photos/seed/smartcart62/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('Sony Bravia 50-inch 4K TV', 'Sony', 'TVs & Monitors', 272000, 64, 'https://picsum.photos/seed/smartcart63/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('TCL 32-inch HD LED TV', 'TCL', 'TVs & Monitors', 244700, 37, 'https://picsum.photos/seed/smartcart64/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('Dell 27-inch UltraSharp Monitor', 'Dell', 'TVs & Monitors', 254600, 6, 'https://picsum.photos/seed/smartcart65/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('Samsung 24-inch Curved Monitor', 'Samsung', 'TVs & Monitors', 306600, 19, 'https://picsum.photos/seed/smartcart66/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('LG UltraGear 27-inch Gaming Monitor', 'LG', 'TVs & Monitors', 307200, 73, 'https://picsum.photos/seed/smartcart67/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('Asus TUF Gaming 24-inch Monitor', 'Asus', 'TVs & Monitors', 335500, 39, 'https://picsum.photos/seed/smartcart68/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('Sony 65-inch OLED TV', 'Sony', 'TVs & Monitors', 342800, 48, 'https://picsum.photos/seed/smartcart69/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('TCL 55-inch QLED TV', 'TCL', 'TVs & Monitors', 73600, 42, 'https://picsum.photos/seed/smartcart70/500/500', 'Crisp, vibrant display for an immersive viewing and gaming experience.'),
('HP DeskJet 2775 All-in-One Printer', 'HP', 'Printers', 53500, 25, 'https://picsum.photos/seed/smartcart71/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Canon PIXMA G3020 Ink Tank Printer', 'Canon', 'Printers', 55400, 5, 'https://picsum.photos/seed/smartcart72/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Epson EcoTank L3250', 'Epson', 'Printers', 35900, 69, 'https://picsum.photos/seed/smartcart73/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Brother HL-L2350DW Laser Printer', 'Brother', 'Printers', 27200, 69, 'https://picsum.photos/seed/smartcart74/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('HP LaserJet Pro M15w', 'HP', 'Printers', 19800, 43, 'https://picsum.photos/seed/smartcart75/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Canon imageCLASS MF3010', 'Canon', 'Printers', 60900, 30, 'https://picsum.photos/seed/smartcart76/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Epson L120 Ink Tank Printer', 'Epson', 'Printers', 24600, 52, 'https://picsum.photos/seed/smartcart77/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Brother DCP-T510W', 'Brother', 'Printers', 25500, 74, 'https://picsum.photos/seed/smartcart78/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('HP OfficeJet Pro 8022e', 'HP', 'Printers', 63300, 5, 'https://picsum.photos/seed/smartcart79/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Canon SELPHY CP1500 Photo Printer', 'Canon', 'Printers', 42100, 67, 'https://picsum.photos/seed/smartcart80/500/500', 'Reliable printing, scanning, and copying for home and office use.'),
('Logitech MX Master 3S Mouse', 'Logitech', 'Keyboards & Mice', 2900, 19, 'https://picsum.photos/seed/smartcart81/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('HP Wireless Keyboard & Mouse Combo', 'HP', 'Keyboards & Mice', 20500, 44, 'https://picsum.photos/seed/smartcart82/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Dell KM3322W Wireless Combo', 'Dell', 'Keyboards & Mice', 14200, 12, 'https://picsum.photos/seed/smartcart83/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Asus ROG Strix Scope Keyboard', 'Asus', 'Keyboards & Mice', 14300, 77, 'https://picsum.photos/seed/smartcart84/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Logitech G213 Prodigy Gaming Keyboard', 'Logitech', 'Keyboards & Mice', 6000, 15, 'https://picsum.photos/seed/smartcart85/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Razer DeathAdder V3 Mouse', 'Razer', 'Keyboards & Mice', 26800, 13, 'https://picsum.photos/seed/smartcart86/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Logitech K380 Multi-Device Keyboard', 'Logitech', 'Keyboards & Mice', 29200, 21, 'https://picsum.photos/seed/smartcart87/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Dell Pro Wireless Mouse', 'Dell', 'Keyboards & Mice', 8500, 65, 'https://picsum.photos/seed/smartcart88/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Asus ROG Chakram Gaming Mouse', 'Asus', 'Keyboards & Mice', 30100, 26, 'https://picsum.photos/seed/smartcart89/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('Logitech MK270 Wireless Combo', 'Logitech', 'Keyboards & Mice', 15500, 72, 'https://picsum.photos/seed/smartcart90/500/500', 'Ergonomic and responsive accessories to boost your productivity and gaming performance.'),
('JBL Flip 6 Portable Speaker', 'JBL', 'Speakers', 68100, 59, 'https://picsum.photos/seed/smartcart91/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('Bose SoundLink Flex', 'Bose', 'Speakers', 27600, 74, 'https://picsum.photos/seed/smartcart92/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('Sony SRS-XB13', 'Sony', 'Speakers', 83300, 30, 'https://picsum.photos/seed/smartcart93/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('Logitech Z407 Bluetooth Speakers', 'Logitech', 'Speakers', 79000, 44, 'https://picsum.photos/seed/smartcart94/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('JBL Charge 5', 'JBL', 'Speakers', 46800, 52, 'https://picsum.photos/seed/smartcart95/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('Bose Home Speaker 500', 'Bose', 'Speakers', 50800, 71, 'https://picsum.photos/seed/smartcart96/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('Sony SRS-XG300', 'Sony', 'Speakers', 52200, 20, 'https://picsum.photos/seed/smartcart97/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('Anker Soundcore Motion+', 'Anker', 'Speakers', 31300, 33, 'https://picsum.photos/seed/smartcart98/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('JBL PartyBox 110', 'JBL', 'Speakers', 12500, 48, 'https://picsum.photos/seed/smartcart99/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.'),
('Marshall Emberton II', 'Marshall', 'Speakers', 8100, 80, 'https://picsum.photos/seed/smartcart100/500/500', 'Rich, room-filling sound with deep bass in a compact, portable design.');