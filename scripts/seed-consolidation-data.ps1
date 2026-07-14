param()

$baseUrl = "http://vtc:8074"
$headers = @{ Authorization = "Bearer test"; "Content-Type" = "application/json" }
$now = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss")
$today = (Get-Date).ToString("yyyyMMdd")
$branchId = 183
$customerCode = "CUST-OSA-888"
$paymentTerms = 12
$salesmanId = 1041

Write-Host "=== Seeding 10 Sales Orders + Invoices for Consolidation ===" -ForegroundColor Cyan
Write-Host ""

function CreateOrderAndInvoice {
    param(
        [string]$poNo,
        [array]$products   # Each: @{ product_id, product_name, qty, unit_price }
    )

    $soSeq = Get-Random -Minimum 1000 -Maximum 9999
    $orderNo = "SO-$today-$soSeq"

    $totalAmt = 0.0
    foreach ($p in $products) {
        $totalAmt += $p.qty * $p.unit_price
    }
    $vatAmt = [math]::Round($totalAmt * 0.12, 2)
    $netAmt = $totalAmt + $vatAmt

    Write-Host "Creating $orderNo ($poNo) - Total PHP $totalAmt" -ForegroundColor Yellow

    $soPayload = @{
        order_no         = $orderNo
        po_no            = $poNo
        customer_code    = $customerCode
        order_status     = "For Invoicing"
        branch_id        = $branchId
        total_amount     = $totalAmt
        discount_amount  = 0
        net_amount       = $totalAmt
        payment_terms    = $paymentTerms
        salesman_id      = $salesmanId
        order_date       = $now
        created_date     = $now
        created_by       = 24
        for_invoicing_at = $now
        remarks          = "Seed data for consolidation testing"
    }
    $soBody = $soPayload | ConvertTo-Json

    try {
        $soRes = Invoke-RestMethod -Uri "$baseUrl/items/sales_order" -Method Post -Headers $headers -Body $soBody
        $orderId = $soRes.data.order_id
        Write-Host "  -> SO created: order_id=$orderId" -ForegroundColor Green
    } catch {
        Write-Host "  -> FAILED SO: $_" -ForegroundColor Red
        return
    }

    foreach ($p in $products) {
        $lineTotal = $p.qty * $p.unit_price
        $detailPayload = @{
            order_id           = $orderId
            product_id         = $p.product_id
            ordered_quantity   = $p.qty
            unit_price         = $p.unit_price
            allocated_quantity = 0
            served_quantity    = $p.qty
            allocated_amount   = 0
            net_amount         = $lineTotal
            gross_amount       = $lineTotal
            discount_amount    = 0
            created_date       = $now
        }
        $detailBody = $detailPayload | ConvertTo-Json

        try {
            $null = Invoke-RestMethod -Uri "$baseUrl/items/sales_order_details" -Method Post -Headers $headers -Body $detailBody
            $info = $p.product_name + " x" + $p.qty + " at PHP " + $p.unit_price + " = PHP " + $lineTotal
            Write-Host "  -> Detail: $info" -ForegroundColor Gray
        } catch {
            Write-Host "  -> FAILED detail for $($p.product_name): $_" -ForegroundColor Red
        }
    }

    $invSeq = Get-Random -Minimum 1000 -Maximum 9999
    $invoiceNo = "INV-$today-$invSeq"

    $invPayload = @{
        invoice_no         = $invoiceNo
        order_id           = [string]$orderId
        customer_code      = $customerCode
        invoice_date       = $now
        created_date       = $now
        due_date           = (Get-Date).AddDays(15).ToString("yyyy-MM-ddTHH:mm:ss")
        total_amount       = $totalAmt
        gross_amount       = $totalAmt
        discount_amount    = 0
        vat_amount         = $vatAmt
        net_amount         = $netAmt
        branch_id          = $branchId
        salesman_id        = $salesmanId
        payment_terms      = $paymentTerms
        transaction_status = "Paid"
        isDispatched       = $null
        remarks            = "Seed invoice for consolidation testing"
    }
    $invBody = $invPayload | ConvertTo-Json -Depth 5

    try {
        $invRes = Invoke-RestMethod -Uri "$baseUrl/items/sales_invoice" -Method Post -Headers $headers -Body $invBody
        $invoiceId = $invRes.data.invoice_id
        Write-Host "  -> Invoice created: $invoiceNo (id=$invoiceId)" -ForegroundColor Green
    } catch {
        Write-Host "  -> FAILED Invoice: $_" -ForegroundColor Red
        return
    }

    foreach ($p in $products) {
        $lineTotal = $p.qty * $p.unit_price
        $invDetailPayload = @{
            invoice_no      = $invoiceId
            order_id        = [string]$orderId
            product_id      = $p.product_id
            quantity        = $p.qty
            unit_price      = $p.unit_price
            unit            = 1
            discount_amount = 0
            gross_amount    = $lineTotal
            total_amount    = $lineTotal
            created_date    = $now
        }
        $invDetailBody = $invDetailPayload | ConvertTo-Json

        try {
            $null = Invoke-RestMethod -Uri "$baseUrl/items/sales_invoice_details" -Method Post -Headers $headers -Body $invDetailBody
            $info = $p.product_name + " x" + $p.qty + " at PHP " + $p.unit_price + " = PHP " + $lineTotal
            Write-Host "  -> Inv Detail: $info" -ForegroundColor Gray
        } catch {
            Write-Host "  -> FAILED inv detail for $($p.product_name): $_" -ForegroundColor Red
        }
    }

    Write-Host ""
    return @{
        orderId   = $orderId
        orderNo   = $orderNo
        poNo      = $poNo
        invoiceId = $invoiceId
        invoiceNo = $invoiceNo
        totalAmt  = $totalAmt
    }
}

# ---- Seed 10 Orders ----
$results = @()

$r = CreateOrderAndInvoice -poNo "PO-TEST-1001" -products @(
    @{ product_id = 25532; product_name = "Canton Noodles 300g Pack"; qty = 500; unit_price = 35.00 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1006" -products @(
    @{ product_id = 25533; product_name = "Canton Noodles 300g Box (18 Packs)"; qty = 20; unit_price = 630.00 },
    @{ product_id = 25542; product_name = "Bihon 454g Pack"; qty = 150; unit_price = 35.00 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1007" -products @(
    @{ product_id = 25543; product_name = "Bihon 454g Mother Bag (20 Packs)"; qty = 12; unit_price = 700.00 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1008" -products @(
    @{ product_id = 25565; product_name = "Palm Oil 1L SWAK"; qty = 250; unit_price = 75.60 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1009" -products @(
    @{ product_id = 25563; product_name = "Palm Oil 500ml SWAK"; qty = 180; unit_price = 37.85 },
    @{ product_id = 25532; product_name = "Canton Noodles 300g Pack"; qty = 300; unit_price = 35.00 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1010" -products @(
    @{ product_id = 25532; product_name = "Canton Noodles 300g Pack"; qty = 400; unit_price = 35.00 },
    @{ product_id = 25542; product_name = "Bihon 454g Pack"; qty = 400; unit_price = 35.00 },
    @{ product_id = 25565; product_name = "Palm Oil 1L SWAK"; qty = 100; unit_price = 75.60 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1002" -products @(
    @{ product_id = 25533; product_name = "Canton Noodles 300g Box (18 Packs)"; qty = 10; unit_price = 630.00 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1003" -products @(
    @{ product_id = 25542; product_name = "Bihon 454g Pack"; qty = 300; unit_price = 35.00 },
    @{ product_id = 25543; product_name = "Bihon 454g Mother Bag (20 Packs)"; qty = 5; unit_price = 700.00 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1004" -products @(
    @{ product_id = 25565; product_name = "Palm Oil 1L SWAK"; qty = 200; unit_price = 75.60 },
    @{ product_id = 25563; product_name = "Palm Oil 500ml SWAK"; qty = 100; unit_price = 37.85 }
)
if ($r) { $results += $r }

$r = CreateOrderAndInvoice -poNo "PO-TEST-1005" -products @(
    @{ product_id = 25532; product_name = "Canton Noodles 300g Pack"; qty = 1000; unit_price = 35.00 },
    @{ product_id = 25542; product_name = "Bihon 454g Pack"; qty = 200; unit_price = 35.00 }
)
if ($r) { $results += $r }

Write-Host "=== Complete ===" -ForegroundColor Cyan
Write-Host "Created $($results.Count) records:" -ForegroundColor Cyan
foreach ($c in $results) {
    $line = $c.orderNo + " / " + $c.poNo + " -> " + $c.invoiceNo + "  (PHP " + $c.totalAmt + ")"
    Write-Host "  $line" -ForegroundColor White
}
Write-Host ""
Write-Host "Open /mm/consolidation/creation, select Main branch, the 10 invoices appear as candidates." -ForegroundColor Cyan
