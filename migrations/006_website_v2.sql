-- Foundation for the public-website redesign: a hero photo for the
-- business, and a photo per product (so the "mini ecommerce" product
-- catalog can actually look like one). Both are optional — nothing here
-- requires a business to add either.

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT;
