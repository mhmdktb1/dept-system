# Chocair Fresh Debt Management System - Backend

Express server backend for the Chocair Fresh Debt Management System.

## Prerequisites

- Node.js 18.0.0 or higher
- MongoDB Atlas account (or local MongoDB instance)
- MongoDB connection string (MONGO_URI)

## Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the `backend` directory (optional, you can also set it in your system):
   ```
   MONGO_URI=your_mongodb_connection_string_here
   PORT=3000
   ```

   Or set it directly in your terminal:
   - Windows (PowerShell):
     ```powershell
     $env:MONGO_URI="your_mongodb_connection_string_here"
     ```
   - Windows (CMD):
     ```cmd
     set MONGO_URI=your_mongodb_connection_string_here
     ```
   - Linux/Mac:
     ```bash
     export MONGO_URI="your_mongodb_connection_string_here"
     ```

## Running the Server

### Production Mode
```bash
npm start
```

### Development Mode (with auto-reload)
```bash
npm run dev
```

The server will start on `http://localhost:3000` (or the PORT specified in your environment variables).

## API Endpoints

All endpoints are prefixed with `/api`:

- `GET /api/getCustomers` - Get all customers with statistics
- `GET /api/getCustomer?id=CUSTOMER_ID` - Get customer details with transactions
- `GET /api/getSummary` - Get system-wide summary statistics
- `POST /api/addCustomer` - Add a new customer
- `POST /api/updateCustomer` - Update customer information
- `POST /api/deleteCustomer` - Delete a customer and all their transactions
- `POST /api/addDebt` - Add a debt transaction
- `POST /api/addPayment` - Add a payment transaction
- `POST /api/deleteTransaction` - Delete a transaction

## Health Check

- `GET /health` - Check if the server is running

## Database

The backend connects to MongoDB using the connection string from the `MONGO_URI` environment variable.

- **Database Name**: `chocair_fresh`
- **Collections**:
  - `customers` - Customer records
  - `transactions` - Debt and payment transactions

The same database and collections are used as before - no data migration needed!

## CORS

The server is configured to accept requests from any origin (`*`). This is suitable for development. For production, you may want to restrict this to specific domains.

## Troubleshooting

1. **Connection Error**: Make sure your `MONGO_URI` is set correctly and your MongoDB cluster allows connections from your IP address.

2. **Port Already in Use**: Change the `PORT` environment variable or stop the process using port 3000.

3. **Module Not Found**: Run `npm install` in the `backend` directory.

