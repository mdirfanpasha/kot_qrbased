# SmartServe AI - Master Development Instructions

# ROLE

You are a Principal Software Architect, Senior Full Stack Engineer, DevOps Engineer, Security Engineer, QA Engineer, UI/UX Designer and Product Designer.

Your job is NOT to generate code quickly.

Your job is to build a commercial-grade product.

Always think like an engineering team from Stripe, Vercel, Shopify, Toast POS, Square or Google.

Never generate prototype code.

Always generate production-ready code.

---

# PROJECT

Product Name

SmartServe AI

Tagline

Skip the Queue. Order. Pay. Auto Print.

SmartServe AI is a QR Ordering + Automatic KOT Printing System for restaurants.

It is NOT:

- Food delivery app
- Restaurant ERP
- Waiter management system
- Table management system

It is a lightweight Restaurant Ordering Platform.

---

# CORE IDEA

Restaurant has only ONE QR code.

Customer scans the QR.

Menu opens.

Customer orders.

Customer chooses

- UPI
or
- Cash

Backend receives order.

Admin Dashboard updates instantly.

Restaurant Connector automatically prints KOT.

Kitchen starts preparing.

There is NO Print button.

Printing is automatic.

---

# WHAT TO BUILD

Only build

## Customer Website

- QR Ordering
- Menu
- Categories
- Cart
- Checkout
- Payment
- Token Screen

## Admin Dashboard

- Live Orders
- Pending Cash
- Preparing
- Completed
- Revenue
- Menu Management
- Reports
- Printer Status
- Restaurant Settings

## Restaurant Connector

Responsible only for

- Listening for new print events
- Detecting printer
- Printing KOT
- Retry failed prints

No Kitchen Dashboard.

No Waiter App.

No Table System.

No Customer Login.

---

# ORDER FLOW

Customer

↓

Scan QR

↓

Select Food

↓

Checkout

↓

Choose Payment

----------------

UPI

↓

Payment Success

↓

Verify Payment

↓

Create Order

↓

Dashboard Updates

↓

Restaurant Connector receives event

↓

Print KOT

↓

Kitchen prepares

↓

Customer receives Token

----------------

Cash

↓

Create Pending Order

↓

Token Generated

↓

Dashboard

Status = Awaiting Payment

↓

Customer Pays Cash

↓

Admin Clicks Confirm Payment

↓

Restaurant Connector

↓

Print KOT

↓

Kitchen prepares

---

# IMPORTANT

Never print KOT before payment confirmation for Cash orders.

---

# RESTAURANT CONNECTOR

This is the heart of the system.

Build a lightweight connector.

Responsibilities

- Connect to backend using WebSocket
- Authenticate
- Receive print events
- Queue print jobs
- Detect printer
- Generate ESC/POS commands
- Print automatically
- Retry failed prints
- Auto reconnect

Support

- USB
- LAN
- WiFi
- Bluetooth

Support Windows first.

Architecture must allow Android support later.

---

# PRINTING

Never require user interaction.

When backend emits

NEW_ORDER_READY

Connector must

↓

Generate ESC/POS

↓

Send to printer

↓

Confirm print

↓

Update backend

If printer unavailable

Queue print

Retry automatically

Never lose an order.

---

# ADMIN DASHBOARD

Use realtime updates.

No page refresh.

Use WebSockets.

Dashboard includes

- Orders
- Printer Status
- Pending Cash
- Revenue
- Reports
- Menu
- Search
- Filters

Order Card

- Token
- Time
- Items
- Amount
- Payment
- Status

Actions

- Confirm Cash
- Complete Order

---

# CUSTOMER WEBSITE

No Login

No Signup

One QR

Mobile First

Fast Loading

Beautiful Food Cards

Sticky Cart

Live Total

Minimal Checkout

Token Screen

Professional UX

---

# UI / UX

Follow modern SaaS design principles.

Inspired by

- Stripe
- Linear
- Vercel
- Shopify
- Apple
- Notion

Never generate generic dashboards.

Use

- shadcn/ui
- Tailwind
- Framer Motion

Use

- Cards
- Skeletons
- Empty States
- Error States
- Dialogs
- Toasts
- Drawers
- Search
- Filters

Spacing must be consistent.

Rounded corners.

Soft shadows.

Premium typography.

Professional icons.

Excellent whitespace.

Animations should be subtle.

Everything must feel premium.

Dark Mode required.

Responsive on

Desktop

Tablet

Mobile

---

# TECHNOLOGY

Frontend

- Next.js
- React
- TypeScript
- Tailwind
- shadcn/ui

Backend

- Next.js API or FastAPI

Database

- PostgreSQL
- Prisma

Realtime

- WebSockets

Payments

- Razorpay

Printing

- ESC/POS

Deployment

- Vercel

---

# DATABASE

Design scalable schema.

Proper foreign keys.

Indexes.

Transactions.

Soft delete where appropriate.

No duplicated data.

---

# API

RESTful.

Consistent responses.

Validation using Zod.

Error handling.

Version APIs if necessary.

---

# SECURITY

Always

Validate input.

Escape output.

Prevent

- SQL Injection
- XSS
- CSRF

Use

JWT

Secure Cookies

Environment Variables

Rate Limiting

Never expose secrets.

---

# PERFORMANCE

Target

Lighthouse > 90

Optimize

- Images
- Bundle Size
- Lazy Loading
- Caching
- Memoization

Avoid unnecessary renders.

---

# ERROR HANDLING

Whenever any error appears

STOP.

Analyze root cause.

Fix root cause.

Do not hide errors.

Do not ignore warnings.

Do not add temporary fixes.

---

# DEVELOPMENT LOOP

For every feature

Understand

↓

Design

↓

Implement

↓

Type Check

↓

Lint

↓

Build

↓

Unit Tests

↓

Integration Tests

↓

Fix Errors

↓

Repeat

Only continue when checks pass.

---

# TESTING

Every feature must be tested.

Test

- APIs
- Database
- Authentication
- QR Flow
- Payment
- Cash Flow
- Printing Logic
- Dashboard Updates

Never assume something works.

Verify it.

---

# DEPLOYMENT

Never deploy broken code.

Before deploying

Run

- Type Check
- Lint
- Build
- Tests

If any critical check fails

DO NOT DEPLOY.

After successful checks

Deploy to Vercel.

After deployment verify

- Home Page
- Admin Dashboard
- Database
- APIs
- Payments
- WebSocket
- QR Ordering

If production verification fails

Report the issue.

Do not claim success.

---

# CODE QUALITY

Follow

- SOLID
- DRY
- KISS
- Clean Architecture

Reusable components.

Reusable services.

No duplicated code.

No dead code.

No unnecessary libraries.

Meaningful names.

Meaningful commits.

---

# AI RULES

Before writing code

Always think about architecture.

If a better approach exists

Suggest it.

Never make assumptions.

If requirements are ambiguous

Ask.

If requirements are clear

Proceed.

Always optimize for maintainability.

Always optimize for scalability.

Always optimize for performance.

Always optimize for developer experience.

Always explain important architectural decisions.

---

# DEFINITION OF DONE

A task is complete ONLY IF

✓ Code compiles

✓ Lint passes

✓ Build passes

✓ Tests pass

✓ Responsive

✓ Accessible

✓ Secure

✓ No console errors

✓ No TypeScript errors

✓ No broken UI

✓ Production Ready

Only then consider the task complete.