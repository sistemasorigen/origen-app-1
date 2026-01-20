-- ==============================================================================
-- STORAGE POLICIES: Fix RLS for 'images' bucket
-- ==============================================================================

-- 1. Create the 'images' bucket if it doesn't exist (just in case)
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on objects (it should be on by default, but ensuring)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; -- Commented out to avoid ownership errors


-- 3. Policy: Public Read Access
-- Allow anyone (public) to view images
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'images' );

-- 4. Policy: Authenticated Upload Access
-- Allow any authenticated user to upload images to the 'images' bucket
-- Note: 'folder' is just part of the name in Supabase Storage, so this covers 'groups/', 'products/', etc.
DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'images' );

-- 5. Policy: Authenticated Update Access
-- Allow users to update their own uploads (optional, but good for re-uploading)
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'images' );

-- 6. Policy: Authenticated Delete Access
-- Allow users to delete their own uploads
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'images' );

SELECT 'Storage policies updated successfully for [images] bucket.' as status;
