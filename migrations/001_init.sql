-- JKTL Business — initial schema (Phase 2)
-- Run with: node scripts/migrate.mjs
--
-- Conventions:
--   * UUID primary keys (gen_random_uuid())
--   * All money stored as BIGINT kobo (1 Naira = 100 kobo) — never float
--   * Every tenant-owned table carries organization_id with ON DELETE CASCADE
--   * created_at timestamps on everything

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Identity & tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff')),
  title TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);

-- DB-backed sessions: the cookie holds only this row's id.
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  business_type TEXT NOT NULL DEFAULT 'general',
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  subdomain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Core business data
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  gender TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  price_kobo BIGINT NOT NULL DEFAULT 0 CHECK (price_kobo >= 0),
  duration_min INTEGER NOT NULL DEFAULT 0 CHECK (duration_min >= 0),
  description TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_services_org ON services(organization_id);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  cost_kobo BIGINT NOT NULL DEFAULT 0 CHECK (cost_kobo >= 0),
  price_kobo BIGINT NOT NULL DEFAULT 0 CHECK (price_kobo >= 0),
  stock_qty INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  staff_id TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')) DEFAULT 'pending',
  notes TEXT NOT NULL DEFAULT '',
  price_kobo BIGINT NOT NULL DEFAULT 0 CHECK (price_kobo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bookings_org ON bookings(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_org_starts ON bookings(organization_id, starts_at);

CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  subtotal_kobo BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_kobo >= 0),
  discount_kobo BIGINT NOT NULL DEFAULT 0 CHECK (discount_kobo >= 0),
  total_kobo BIGINT NOT NULL DEFAULT 0 CHECK (total_kobo >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'pos', 'other')) DEFAULT 'cash',
  payment_status TEXT NOT NULL CHECK (payment_status IN ('paid', 'pending', 'partial')) DEFAULT 'paid',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sales_org ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_org_created ON sales(organization_id, created_at);

-- ref_id points into services.id or products.id depending on `kind`; no FK
-- since it's conditional on which table, matching the mock layer's shape.
CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'product')),
  ref_id UUID,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_kobo BIGINT NOT NULL CHECK (unit_price_kobo >= 0),
  total_kobo BIGINT NOT NULL CHECK (total_kobo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_org ON sale_items(organization_id);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('rent', 'electricity', 'staff', 'supplies', 'transportation', 'marketing', 'other')) DEFAULT 'other',
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'pos', 'other')) DEFAULT 'cash',
  date TIMESTAMPTZ NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org_date ON expenses(organization_id, date);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'paid', 'overdue')) DEFAULT 'draft',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal_kobo BIGINT NOT NULL DEFAULT 0 CHECK (subtotal_kobo >= 0),
  discount_kobo BIGINT NOT NULL DEFAULT 0 CHECK (discount_kobo >= 0),
  total_kobo BIGINT NOT NULL DEFAULT 0 CHECK (total_kobo >= 0),
  notes TEXT NOT NULL DEFAULT '',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_kobo BIGINT NOT NULL CHECK (unit_price_kobo >= 0),
  total_kobo BIGINT NOT NULL CHECK (total_kobo >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_org ON invoice_items(organization_id);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('addition', 'deduction', 'sale', 'adjustment')),
  quantity INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_org ON inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);

CREATE TABLE IF NOT EXISTS infrastructure_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL DEFAULT 'Business Starter',
  price_kobo_per_year BIGINT NOT NULL DEFAULT 5000000,
  renewal_date DATE NOT NULL,
  storage_used_gb NUMERIC(6, 2) NOT NULL DEFAULT 0,
  storage_limit_gb NUMERIC(6, 2) NOT NULL DEFAULT 2,
  database_status TEXT NOT NULL DEFAULT 'active',
  hosting_status TEXT NOT NULL DEFAULT 'active',
  ssl_status TEXT NOT NULL DEFAULT 'active',
  domain TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
