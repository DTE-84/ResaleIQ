-- Create the inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL,
    condition TEXT NOT NULL,
    color TEXT,
    size TEXT,
    purchase_price NUMERIC(10, 2) DEFAULT 0,
    title TEXT NOT NULL,
    suggested_price NUMERIC(10, 2) DEFAULT 0,
    actual_sale_price NUMERIC(10, 2) DEFAULT 0,
    profit_score INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    image_url TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON public.inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Create Policies
-- 1. Users can view their own inventory
CREATE POLICY "Users can view their own inventory"
ON public.inventory
FOR SELECT
USING (auth.uid() = user_id);

-- 2. Users can insert their own inventory
CREATE POLICY "Users can insert their own inventory"
ON public.inventory
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own inventory
CREATE POLICY "Users can update their own inventory"
ON public.inventory
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Users can delete their own inventory
CREATE POLICY "Users can delete their own inventory"
ON public.inventory
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at ON public.inventory;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
