-- Foto categoria per pagina Prenota (admin tab Menu → Categorie).
-- Separato da menu_homepage_config.category_images (thumbnail homepage QR).
ALTER TABLE menu_categories ADD COLUMN IF NOT EXISTS image_url text;
