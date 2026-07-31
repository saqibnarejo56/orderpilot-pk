# OrderPilot PK

OrderPilot PK is a multi-tenant seller operations platform designed for small online businesses that currently manage products, orders, customers, inventory, and payments through Instagram, WhatsApp, and spreadsheets.

Each seller gets a private store workspace and can access only their own business data.

## Current Status

The core Seller Application is functional.

### Completed Modules

- Seller authentication
- Protected seller dashboard
- Product management
- Order management
- Customer management
- Inventory management
- Payment and outstanding-balance tracking
- Inventory-aware order processing
- Seller-specific data security
- Supabase database migrations

## Features

### Seller Authentication

- Secure signup and login
- Supabase Authentication
- Protected dashboard routes
- Seller session verification
- Seller-specific store connection
- Secure logout

### Dashboard

- Live data from Supabase
- Total orders
- Pending orders
- Collected revenue
- Available products
- Recent order activity
- Navigation to Products, Orders, and Customers

### Product Management

- Create products
- Edit products
- Product image upload
- Image preview and replacement
- SKU management
- Categories
- Selling price
- Cost price
- Stock quantity
- Low-stock threshold
- Product status
- Inventory value calculation
- Seller-specific product isolation

### Order Management

- Create customer orders
- Add multiple products to one order
- Manage quantities
- Customer contact information
- Delivery address and city
- Delivery charges
- Discounts
- Payment-method tracking
- Partial and full payments
- Outstanding-balance calculation
- Order-status management
- Payment-status management
- Cancellation and return handling
- Refund tracking
- Order detail and management pages

### Inventory-Aware Processing

- Pending orders do not deduct stock
- Confirmed orders deduct stock automatically
- Moving an order back to Pending restores stock
- Cancelled and returned orders restore stock where applicable
- Product details are locked after stock reservation
- Database rules prevent invalid stock changes

### Customer Management

- Customers are automatically created from orders
- Customer phone numbers are normalized
- Existing orders are connected to customer records
- Customer directory
- Customer profile details
- Total customer orders
- Repeat-customer tracking
- Total order value
- Collected amount
- Outstanding balance
- Complete customer order history
- Direct navigation from customers to their orders

### Inventory Management

- Live inventory overview
- Total stock-unit calculation
- Inventory value calculation using product cost price
- Low-stock and out-of-stock monitoring
- Manual stock increases and decreases
- Mandatory adjustment reasons
- Optional adjustment notes
- Projected stock preview before saving
- Negative-stock protection
- Automatic opening-balance records
- Automatic stock reservation from confirmed orders
- Automatic stock restoration from pending, cancelled, and returned orders
- Immutable inventory movement history
- Product-specific inventory history pages
- Order references connected to stock movements
- Seller-specific inventory access through Row Level Security

### Security

- Multi-tenant store architecture
- Supabase Row Level Security
- Seller-specific data access
- Store ownership verification
- Protected product records
- Protected order records
- Protected customer information
- Server-side authenticated data loading
- Database functions, triggers, and constraints
- Environment variables excluded from Git

## Application Routes

### Authentication

```text
/signup
/login
/auth/callback
```

### Dashboard

```text
/dashboard
```

### Products

```text
/dashboard/products
/dashboard/products/new
/dashboard/products/[id]
```

### Orders

```text
/dashboard/orders
/dashboard/orders/new
/dashboard/orders/[id]
```

### Customers

```text
/dashboard/customers
/dashboard/customers/[id]
```
### Inventory

```text
/dashboard/inventory
/dashboard/inventory/[id]
```
## Tech Stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Supabase Authentication
- Supabase PostgreSQL
- Supabase Storage
- Supabase Row Level Security
- PostgreSQL functions and triggers
- Git and GitHub

## Database Migrations

Database changes are stored in:

```text
supabase/migrations
```

The Customers Module migration includes:

- Customers table
- Phone-number normalization
- Automatic customer creation from orders
- Existing-order customer backfill
- Order-to-customer linking
- Database indexes
- Row Level Security policies

Current migration:

```text
supabase/migrations/20260731032700_create_customers_module.sql
```
The Inventory Module migration includes:

- Inventory movement ledger
- Opening-stock balance records
- Automatic order stock reservation
- Automatic stock release and restoration
- Manual stock-adjustment RPC
- Negative-stock protection
- Product-level inventory audit history
- Database indexes
- Seller-specific Row Level Security
- Immutable inventory records

Inventory Module migration:

```text
supabase/migrations/20260801011600_create_inventory_module.sql
```
## Environment Variables

Create a `.env.local` file in the project root using `.env.example`.

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Never commit real environment-variable values or secret keys to GitHub.

## Local Setup

Clone the repository:

```bash
git clone https://github.com/saqibnarejo56/orderpilot-pk.git
```

Open the project:

```bash
cd orderpilot-pk
```

Install dependencies:

```bash
npm install
```

Add Supabase credentials to `.env.local`.

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Production Build

Run:

```bash
npm run build
```

The current application successfully passes the Next.js production build and TypeScript validation.

For production-mode local testing:

```bash
npm run start
```

## Roadmap

### Seller Application

- [x] Seller authentication
- [x] Protected dashboard
- [x] Live dashboard data
- [x] Product management
- [x] Product image management
- [x] Stock and low-stock management
- [x] Order creation
- [x] Multi-product orders
- [x] Order-status workflow
- [x] Payment tracking
- [x] Outstanding-balance tracking
- [x] Automatic stock deduction
- [x] Automatic stock restoration
- [x] Refund tracking
- [x] Customer directory
- [x] Automatic customer creation
- [x] Customer order history
- [x] Customer financial summaries
- [x] Seller-specific Row Level Security
- [x] Inventory history
- [x] Manual stock adjustments
- [ ] Returns management
- [ ] Store settings
- [ ] Product variants
- [ ] Seller notifications

### Automation

- [ ] New-order notifications
- [ ] Customer order confirmation
- [ ] Order-status notifications
- [ ] Low-stock alerts
- [ ] Payment confirmation and receipts
- [ ] Daily seller summary
- [ ] n8n workflow integration

### Public Marketplace

- [ ] Public marketplace homepage
- [ ] Seller storefronts
- [ ] Public product pages
- [ ] Product search and filters
- [ ] Category browsing
- [ ] Customer checkout
- [ ] Customer order tracking
- [ ] Public orders connected to seller dashboards

### Platform Management

- [ ] Private admin portal
- [ ] Seller approval and suspension
- [ ] Subscription plans
- [ ] Platform analytics
- [ ] Beta seller onboarding
- [ ] Production deployment

## Platform Structure

```text
Public Marketplace
→ Customers browse stores and products

Seller Application
→ Sellers manage products, orders, customers, and inventory

Private Admin Portal
→ Platform owner manages sellers, subscriptions, and platform activity
```

## Purpose

OrderPilot PK aims to replace fragmented order management through WhatsApp chats, Instagram messages, handwritten records, and spreadsheets with one structured seller operations system.

## Author

**Saqib Narejo**
