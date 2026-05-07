# SecureOps Part 4.6 Stock Deduction on Order Approval

## What Was Implemented

Part 4.6 adds automatic inventory stock deduction when an admin approves an order.

- Inventory Service now exposes `POST /products/internal/deduct-stock`.
- The internal endpoint requires `X-Internal-API-Key`.
- Order Service calls the internal inventory endpoint before marking an order approved.
- Stock is deducted only after approval succeeds.
- If inventory cannot fulfill the order, the order remains pending.
- Already approved orders do not deduct stock again.

No File Service, Reports, RabbitMQ jobs, Audit/Security Center backend, Attack Simulation backend, or frontend redesign was implemented.

## Why Deduct on Approval

Stock is not deducted when a user creates an order because product requests still require admin review.

Stock is not deducted when an order is rejected.

Approval is the moment the request becomes accepted, so stock deduction happens there. This prevents unreviewed user requests from reserving or consuming inventory.

## Service-to-Service Security

Order Service calls Inventory Service inside the Docker network:

```text
http://inventory-service:8000/products/internal/deduct-stock
```

The call includes:

```text
X-Internal-API-Key: <INTERNAL_API_KEY>
```

Inventory Service rejects missing or invalid internal API keys with `401`.

## Expected Behavior

- Creating an order does not change product quantity.
- Rejecting an order does not change product quantity.
- Approving a pending order deducts requested quantities.
- If stock is insufficient, approval fails safely and the order stays pending.
- Approving the same order again returns safely without deducting stock again.
- Stock never becomes negative.
- Multi-item deductions are all-or-nothing.

## PowerShell Test Flow

Start services:

```powershell
docker compose up --build
```

Login as admin and user:

```powershell
$adminLogin = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "admin@secureops.com"; password = "Admin@12345" } | ConvertTo-Json)

$userLogin = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/auth/login" `
  -ContentType "application/json" `
  -Body (@{ email = "user@secureops.com"; password = "User@12345" } | ConvertTo-Json)

$adminToken = $adminLogin.access_token
$userToken = $userLogin.access_token
```

Check product quantity before order:

```powershell
$productsBefore = Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/products" `
  -Headers @{ Authorization = "Bearer $userToken" }

$product = $productsBefore.data | Where-Object { $_.quantity -gt 0 } | Select-Object -First 1
$productId = $product.id
$beforeQuantity = $product.quantity
$beforeQuantity
```

Create an order for quantity `1`:

```powershell
$orderBody = @{
  items = @(
    @{
      product_id = $product.id
      product_name = $product.name
      product_sku = $product.sku
      quantity = 1
    }
  )
} | ConvertTo-Json -Depth 5

$createdOrder = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/orders" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $userToken" } `
  -Body $orderBody

$orderId = $createdOrder.data.id
```

Approve the order:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:8080/orders/$orderId/approve" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Check product quantity decreased by `1`:

```powershell
$productsAfter = Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/products" `
  -Headers @{ Authorization = "Bearer $userToken" }

$afterProduct = $productsAfter.data | Where-Object { $_.id -eq $productId }
$afterProduct.quantity
```

Approve the same order again. Stock should not decrease again:

```powershell
Invoke-RestMethod `
  -Method Patch `
  -Uri "http://localhost:8080/orders/$orderId/approve" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Create an order with quantity greater than available stock:

```powershell
$oversizedOrderBody = @{
  items = @(
    @{
      product_id = $afterProduct.id
      product_name = $afterProduct.name
      product_sku = $afterProduct.sku
      quantity = $afterProduct.quantity + 1000
    }
  )
} | ConvertTo-Json -Depth 5

$oversizedOrder = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8080/orders" `
  -ContentType "application/json" `
  -Headers @{ Authorization = "Bearer $userToken" } `
  -Body $oversizedOrderBody

$oversizedOrderId = $oversizedOrder.data.id
```

Approval should fail and the order should remain pending:

```powershell
try {
  Invoke-RestMethod `
    -Method Patch `
    -Uri "http://localhost:8080/orders/$oversizedOrderId/approve" `
    -Headers @{ Authorization = "Bearer $adminToken" }
} catch {
  $_.ErrorDetails.Message
}

Invoke-RestMethod `
  -Method Get `
  -Uri "http://localhost:8080/orders/$oversizedOrderId" `
  -Headers @{ Authorization = "Bearer $adminToken" }
```

Missing internal API key returns `401`:

```powershell
try {
  Invoke-RestMethod `
    -Method Post `
    -Uri "http://localhost:8080/products/internal/deduct-stock" `
    -ContentType "application/json" `
    -Body (@{ items = @(@{ product_id = $productId; quantity = 1 }) } | ConvertTo-Json -Depth 5)
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Expected: `401`.

## Build Verification

Run:

```powershell
python -m py_compile backend\inventory-service\main.py backend\inventory-service\schemas.py backend\inventory-service\service.py backend\inventory-service\dependencies.py backend\order-service\service.py
docker compose build inventory-service order-service
docker compose up -d inventory-service order-service nginx
```
