
-- 1. Fix user_badges: remove public INSERT, restrict to service_role only
DROP POLICY IF EXISTS "Users can insert own badges" ON public.user_badges;
CREATE POLICY "Service role can insert badges" ON public.user_badges
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 2. Fix referrals: remove public INSERT, restrict to service_role only
DROP POLICY IF EXISTS "Users can insert referrals" ON public.referrals;
CREATE POLICY "Service role can insert referrals" ON public.referrals
  FOR INSERT TO public
  WITH CHECK (auth.role() = 'service_role');

-- 3. Fix user_stats SELECT: restrict to own rows + create leaderboard function
DROP POLICY IF EXISTS "Anyone can view leaderboard data" ON public.user_stats;
CREATE POLICY "Users can view own stats" ON public.user_stats
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 4. Fix user_stats UPDATE: restrict to service_role only
DROP POLICY IF EXISTS "Users can update own stats" ON public.user_stats;
CREATE POLICY "Service role can update stats" ON public.user_stats
  FOR UPDATE TO public
  USING (auth.role() = 'service_role');

-- 5. Create leaderboard function (security definer) so leaderboard still works
CREATE OR REPLACE FUNCTION public.get_leaderboard(limit_count integer DEFAULT 10)
RETURNS TABLE(user_id uuid, current_streak integer, longest_streak integer, uploads_used integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT us.user_id, us.current_streak, us.longest_streak, us.uploads_used
  FROM public.user_stats us
  ORDER BY us.current_streak DESC, us.longest_streak DESC
  LIMIT limit_count;
$$;
