# API Documentation

Base URL: `https://your-app.onrender.com/api/v1`

## Authentication

All protected endpoints require JWT token in header:
```
Authorization: Bearer <token>
```

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "phoneNumber": "+9779800000000",
  "password": "password123",
  "name": "John Doe",
  "role": "RETAILER",
  "businessName": "My Shop",
  "address": "Surkhet"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "phoneNumber": "+9779800000000",
  "password": "password123"
}
```

## Orders

### Create Order (Retailer only)
```http
POST /orders
Authorization: Bearer <token>

{
  "vendorId": "uuid",
  "items": [
    {
      "productId": "uuid",
      "quantity": 10
    }
  ],
  "notes": "Deliver by Friday"
}
```

### List Orders
```http
GET /orders?page=1&limit=20&status=PENDING
Authorization: Bearer <token>
```

### Update Order Status (Vendor/Admin)
```http
PATCH /orders/:id/status
Authorization: Bearer <token>

{
  "status": "CONFIRMED"
}
```

## Products

### Create Product (Vendor only)
```http
POST /products
Authorization: Bearer <token>

{
  "name": "Rice 1kg",
  "sku": "RICE-1KG",
  "unit": "kg",
  "price": 80,
  "stock": 1000,
  "description": "Premium rice"
}
```

### List Products
```http
GET /products?vendorId=uuid&search=rice&page=1&limit=50
Authorization: Bearer <token>
```

## Credit

### Record Payment (Vendor/Admin)
```http
POST /credit/payment
Authorization: Bearer <token>

{
  "orderId": "uuid",
  "amount": 5000,
  "referenceNumber": "PAY123"
}
```

### Get Credit History
```http
GET /credit/history?vendorId=uuid&page=1&limit=50
Authorization: Bearer <token>
```

### Get Credit Score
```http
GET /credit/score/:retailerId
Authorization: Bearer <token>
```

## Response Format

Success:
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

Error:
```json
{
  "success": false,
  "message": "Error message"
}
```

Paginated:
```json
{
  "success": true,
  "message": "Success",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
