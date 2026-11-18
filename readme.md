# Zap-Shift Server 🚚

A powerful and secure backend API for **Zap-Shift**, a parcel delivery management system. It handles user authentication, parcel management, rider assignments, payment processing, parcel tracking, and delivery operations.

## 🚀 Features

- **User Management:** Create, retrieve, and manage user accounts and roles.
- **Authentication & Authorization:** Firebase Admin SDK-based token verification.
- **Parcel Management:** Create, update, retrieve, and manage parcel information.
- **Rider Management:** Manage rider applications, approval status, and availability.
- **Delivery Assignment:** Assign parcels to available riders.
- **Payment Integration:** Secure online payments using Stripe Checkout.
- **Payment History:** Store and retrieve payment transactions.
- **Parcel Tracking:** Generate tracking IDs and maintain parcel delivery logs.
- **Dashboard Statistics:** Provide delivery and payment statistics.
- **Database:** Store application data using MongoDB.

## 🛠️ Technologies Used

- Node.js
- Express.js
- MongoDB
- Firebase Admin SDK
- Stripe
- JavaScript
- dotenv
- CORS

## 📦 Dependencies

| Package | Purpose |
|---|---|
| Express.js | Backend framework |
| MongoDB | Database |
| Firebase Admin | Authentication verification |
| Stripe | Payment processing |
| dotenv | Environment variable management |
| CORS | Cross-origin resource sharing |
| Nodemon | Development server |

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Navigate to the project directory

```bash
cd zap-shift-server
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```env
PORT=3000
MONGODB_URI=your_mongodb_connection_string
STRIPE_SECRET=your_stripe_secret_key
FB_SERVICE_KEY=your_base64_encoded_firebase_service_account
SITE_DOMAIN=your_frontend_url
```

**Important:** Never share your secret keys or upload your `.env` file to GitHub.

### 5. Start the development server

```bash
npm run dev
```

The server will run at:

```text
http://localhost:3000
```

## 🌐 API Overview

The backend provides RESTful APIs for the following modules:

| Module | Description |
|---|---|
| Users | User registration, retrieval, and role management |
| Riders | Rider registration, approval, and management |
| Parcels | Parcel creation and management |
| Payments | Stripe checkout and payment history |
| Tracking | Parcel tracking and delivery logs |
| Dashboard | Delivery and payment statistics |

## 🔐 Security

- Firebase token verification for protected routes.
- Role-based access control.
- Environment variables for sensitive credentials.
- Stripe payment verification.
- CORS configuration for frontend access.

## 🚀 Deployment

The backend is configured for deployment on **Vercel**.

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Configure the required environment variables.
4. Deploy the project.

## 👨‍💻 Author

**Murad Hasan**

- GitHub: [Your GitHub Profile](https://github.com/dev-muradhasan)

---

⭐ If you find this project useful, consider giving it a star!