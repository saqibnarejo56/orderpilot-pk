# OrderPilot PK

OrderPilot PK is a multi-tenant SaaS platform designed for Instagram and WhatsApp sellers to manage products, inventory, customers, and orders from one centralized dashboard.

## Current Status

The Product Management module is complete and functional. The Orders module is currently under development.

## Features

- Secure seller signup and login
- Supabase Authentication
- Protected dashboard routes
- Seller-specific store profiles
- Product creation, editing, and deletion
- SKU, category, pricing, and stock management
- Low-stock alerts
- Product status management
- Product image upload and preview
- Image replacement and removal
- Automatic image cleanup after replacement or product deletion
- Seller-specific data isolation using Supabase Row Level Security

## Tech Stack

- Next.js
- React
- TypeScript
- Tailwind CSS
- Supabase Authentication
- Supabase PostgreSQL
- Supabase Storage
- Supabase Row Level Security
- Git and GitHub

## Environment Variables

Create a `.env.local` file in the project root using `.env.example`.

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never commit real environment variable values to GitHub.

## Local Setup

1. Clone the repository:

   `git clone https://github.com/saqibnarejo56/orderpilot-pk.git`

2. Open the project folder:

   `cd orderpilot-pk`

3. Install dependencies:

   `npm install`

4. Create `.env.local` and add your Supabase credentials.

5. Start the development server:

   `npm run dev`

6. Open:

   `http://localhost:3000`

## Production Build

Run:

`npm run build`

The current project passes the Next.js production build and TypeScript validation.

## Roadmap

- [x] Seller authentication
- [x] Store profile connection
- [x] Product catalogue
- [x] Product CRUD operations
- [x] Stock and low-stock management
- [x] Product image management
- [x] Supabase Storage cleanup
- [x] Seller-specific Row Level Security
- [ ] Customer management
- [ ] Order creation
- [ ] Multi-product orders
- [ ] Order status workflow
- [ ] Automatic stock deduction
- [ ] COD and payment tracking
- [ ] Returns management
- [ ] Dashboard analytics
- [ ] Production deployment

## Purpose

OrderPilot PK aims to help small online sellers replace manual order tracking through WhatsApp chats, Instagram messages, and spreadsheets with a structured business management system.

## Author

**Saqib Narejo**
