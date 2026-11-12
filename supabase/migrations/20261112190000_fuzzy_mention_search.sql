-- ABOUTME: Finds people to @-mention the way fzf finds files: exact, then prefix, then substring,
-- ABOUTME: then the typed letters in order with gaps, then near misses for typos. Up to 20 people.

-- `term` is what the person typed, unescaped. Every match is case-insensitive.
-- Ranked, best first:
--   0. the whole username ("dan" → "Dan")
--   1. the start of the username ("dan" → "Daniel")
--   2. the start of a later word ("dan" → "big.dan", "jo dane")
--   3. anywhere else, earlier first ("dan" → "jordan")
--   4. its letters in order with gaps, tighter first ("dnl" → "Daniel")
--   5. a near miss for terms of 3 or more letters ("danial" → "Daniel",
--      "jonh" → "john"), by trigram word similarity of at least 0.4.
--      pg_trgm's default threshold of 0.6 misses most one-letter typos in
--      short names. The similarity is compared directly, as a function can't
--      set pg_trgm's threshold without superuser, and the in-order match
--      already scans every profile.
-- Ties go to the shorter username, then alphabetical. Never the viewer,
-- banned people, nor anyone blocked either way.
create or replace function public.mentionable_people(term text)
returns table (id uuid, username text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select lower(btrim(term)) as t
  ),
  letters as (
    select c, i
    from q, unnest(string_to_array(q.t, null)) with ordinality as s(c, i)
  ),
  patterns as (
    select
      q.t,
      -- "dnl" → '%d%n%l%', with LIKE's wildcards and escape escaped
      '%' || (
        select string_agg(
          replace(replace(replace(c, '\', '\\'), '%', '\%'), '_', '\_'),
          '%' order by i
        )
        from letters
      ) || '%' as in_order,
      -- "dnl" → 'd.*?n.*?l', the shortest stretch holding the letters in order
      (
        select string_agg(regexp_replace(c, '([^[:alnum:]])', '\\\1', 'g'), '.*?' order by i)
        from letters
      ) as span_re
    from q
    where q.t <> ''
  ),
  candidates as (
    select
      p.id,
      p.username,
      p.avatar_path,
      lower(p.username) as u,
      pt.t,
      pt.span_re,
      strpos(lower(p.username), pt.t) as pos,
      extensions.word_similarity(pt.t, p.username) as sim
    from public.profiles p, patterns pt
    where (
        p.username ilike pt.in_order
        or (
          char_length(pt.t) >= 3
          and extensions.word_similarity(pt.t, p.username) >= 0.4
        )
      )
      and p.id <> auth.uid()
      and p.banned_at is null
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocked_id = auth.uid() and b.blocker_id = p.id)
      )
  ),
  ranked as (
    select
      c.*,
      case
        when c.u = c.t then 0
        when c.pos = 1 then 1
        when c.pos > 1
          and substr(c.u, c.pos - 1, 1) in (' ', '.', '_', '-', '''', '’')
          then 2
        when c.pos > 1 then 3
        when substring(c.u from c.span_re) is not null then 4
        else 5
      end as tier
    from candidates c
  )
  select r.id, r.username, r.avatar_path
  from ranked r
  order by
    r.tier,
    case
      when r.tier in (2, 3) then r.pos
      when r.tier = 4 then char_length(substring(r.u from r.span_re))
      else 0
    end,
    r.sim desc,
    char_length(r.username),
    r.u
  limit 20;
$$;
