-- Fix leads that have URN strings stored as linkedin_member_id
-- These are base64 LinkedIn URNs (ACo..., ACw..., ACr..., AEM..., ACoA..., etc.)
-- that are not usable as provider_id for outreach actions.
-- Run this once in Supabase SQL editor.

-- 1. Clear linkedin_member_id where it contains a URN string (not a numeric ID)
--    URNs: start with AC or AE and are ≥20 chars, OR start with urn:
UPDATE leads
SET linkedin_member_id = NULL
WHERE linkedin_member_id IS NOT NULL
  AND (
    linkedin_member_id ~ '^urn:'
    OR (
      (linkedin_member_id LIKE 'AC%' OR linkedin_member_id LIKE 'AE%')
      AND length(linkedin_member_id) >= 20
    )
  );

-- 2. Clear profile_url where it's a /in/member/{URN} fallback URL
--    These were built from URN strings and are not real LinkedIn profile URLs.
--    Real /in/member/ URLs use numeric IDs like /in/member/76351639
UPDATE leads
SET profile_url = NULL
WHERE profile_url LIKE '%/in/member/AC%'
   OR profile_url LIKE '%/in/member/AE%'
   OR profile_url LIKE '%/in/member/urn:%';

-- 3. Delete garbage leads captured from LinkedIn UI elements
--    These have overlay paths or "Show all" / "Contact info" as names
DELETE FROM leads
WHERE profile_url LIKE '%/overlay/%'
   OR profile_url LIKE '%/detail/%'
   OR profile_url LIKE '%/recent-activity/%'
   OR full_name IN ('Show all', 'Contact info', 'LinkedIn Member')
      AND (profile_url IS NULL OR profile_url = '');

-- Summary: check how many rows were affected
SELECT
  COUNT(*) FILTER (WHERE linkedin_member_id IS NULL) AS leads_without_member_id,
  COUNT(*) FILTER (WHERE profile_url IS NULL OR profile_url = '') AS leads_without_profile_url,
  COUNT(*) AS total_leads
FROM leads;
