-- Add title and image_url columns to tierlist_items table
-- This allows displaying tierlists without fetching data from external API for every item

ALTER TABLE tierlist_items 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Update RLS policies just in case (though existing ones usually cover standard CRUD)
-- Ensure authenticated users can insert/update their own items with these new columns
