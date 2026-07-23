-- 1. Create the `courses` table (The Course Templates Library)
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    days_data JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup RLS for `courses`
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage their own courses" 
ON public.courses 
FOR ALL USING (auth.uid() = coach_id);

-- 2. Create the `client_courses` table (The Assignment History)
CREATE TABLE IF NOT EXISTS public.client_courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Setup RLS for `client_courses`
ALTER TABLE public.client_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can manage assignments" 
ON public.client_courses 
FOR ALL USING (auth.role() = 'authenticated');

-- 3. Alter `profiles` table to add `current_course_id` (Optional but fast reference)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;
