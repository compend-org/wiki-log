-- ABOUTME: Local development data for a fresh database: users, reviews, lists and social activity.
-- ABOUTME: Runs on `supabase db reset`. Every account signs in with the password "password".

-- ============ Users ============

-- Signing up creates each profile, through the on_auth_user_created trigger
with seed_users as (
  select username, gen_random_uuid() as id
  from unnest(array[
    'demo', 'margot', 'tomasz', 'ines_v', 'Big Dennis', 'quiet_otter', 'hollis',
    'priya', 'yuki', 'oskar', 'delphine', 'ThisUsernameIsThirtyCharsLong!'
  ]) as username
),
created_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000',
    id,
    'authenticated',
    'authenticated',
    lower(regexp_replace(username, '[^a-zA-Z0-9]', '', 'g')) || '@example.com',
    extensions.crypt('password', extensions.gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('username', username),
    '', '', '', ''
  from seed_users
  returning id, email
)
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from created_users;

update public.profiles p
set bio = v.bio, created_at = now() - v.joined::interval
from (values
  ('demo', 'The account to sign in with. Has a little of everything.', '90 days'),
  ('margot', 'Reviewing the physical world, one object at a time.', '80 days'),
  ('tomasz', 'Mostly here for the rope chapters.', '75 days'),
  ('ines_v', null, '70 days'),
  ('Big Dennis', 'I have opinions about pizza and concrete.', '66 days'),
  ('quiet_otter', 'please do not perceive me', '60 days'),
  ('hollis', null, '54 days'),
  ('priya', 'If it bubbles, it counts.', '50 days'),
  ('yuki', 'Looking at the moon, mostly.', '40 days'),
  ('oskar', 'Lost at chess to a nine year old. Ask me about it.', '33 days'),
  ('delphine', null, '20 days'),
  ('ThisUsernameIsThirtyCharsLong!', 'Here to find out what breaks when a profile goes all the way up to the three hundred character limit for a bio, which is a good thing to know about before anyone real does it. So this one keeps going for a while, past the point where anyone would want to read it, and stops just about here, right.', '6 days')
) as v(username, bio, joined)
where p.username = v.username;

-- ============ Items ============

insert into public.items (id, title, description, image_url, image_non_free, image_page_url, page_url)
values
  ('Q503', 'Banana', 'Tropical, edible, staple fruit', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/de/Bananavarieties.jpg/330px-Bananavarieties.jpg', false, 'https://commons.wikimedia.org/wiki/File:Bananavarieties.jpg', 'https://en.wikipedia.org/wiki/Banana'),
  ('Q7186137', 'Cardoon', 'Species of flowering plant', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Cynara_cardunculus_flavescens_%2814684164583%29.jpg/330px-Cynara_cardunculus_flavescens_%2814684164583%29.jpg', false, 'https://commons.wikimedia.org/wiki/File:Cynara_cardunculus_flavescens_%2814684164583%29.jpg', 'https://en.wikipedia.org/wiki/Cardoon'),
  ('Q22657', 'Concrete', 'Composite construction material', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b4/Bloczek_betonowy.jpg/330px-Bloczek_betonowy.jpg', false, 'https://commons.wikimedia.org/wiki/File:Bloczek_betonowy.jpg', 'https://en.wikipedia.org/wiki/Concrete'),
  ('Q23501', 'Tomato', 'Edible berry', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/89/Tomato_je.jpg/330px-Tomato_je.jpg', false, 'https://commons.wikimedia.org/wiki/File:Tomato_je.jpg', 'https://en.wikipedia.org/wiki/Tomato'),
  ('Q1578', 'Cigarette', 'Small roll of tobacco made to be smoked', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/bb/Cigarette_DS.jpg/330px-Cigarette_DS.jpg', false, 'https://commons.wikimedia.org/wiki/File:Cigarette_DS.jpg', 'https://en.wikipedia.org/wiki/Cigarette'),
  ('Q83363', 'Jeans', 'Pants/trousers made from denim or dungaree cloth', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Jeans.jpg/330px-Jeans.jpg', false, 'https://commons.wikimedia.org/wiki/File:Jeans.jpg', 'https://en.wikipedia.org/wiki/Jeans'),
  ('Q37828', 'Refrigerator', 'Appliance for cold food storage', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7b/Open_refrigerator_with_food_at_night.jpg/330px-Open_refrigerator_with_food_at_night.jpg', false, 'https://commons.wikimedia.org/wiki/File:Open_refrigerator_with_food_at_night.jpg', 'https://en.wikipedia.org/wiki/Refrigerator'),
  ('Q405', 'Moon', 'Natural satellite orbiting Earth', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/FullMoon2010.jpg/330px-FullMoon2010.jpg', false, 'https://commons.wikimedia.org/wiki/File:FullMoon2010.jpg', 'https://en.wikipedia.org/wiki/Moon'),
  ('Q39231', 'Mount Fuji', 'Volcano in Japan', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/View_of_Mount_Fuji_from_%C5%8Cwakudani_20211202.jpg/330px-View_of_Mount_Fuji_from_%C5%8Cwakudani_20211202.jpg', false, 'https://commons.wikimedia.org/wiki/File:View_of_Mount_Fuji_from_%C5%8Cwakudani_20211202.jpg', 'https://en.wikipedia.org/wiki/Mount_Fuji'),
  ('Q243', 'Eiffel Tower', 'Tower in Paris, France', 'https://thumb.wikimedia.org/wikipedia/en/thumb/b/ba/Eiffel_Tower_logo.svg/330px-Eiffel_Tower_logo.svg.png', true, 'https://en.wikipedia.org/wiki/File:Eiffel_Tower_logo.svg', 'https://en.wikipedia.org/wiki/Eiffel_Tower'),
  ('Q214371', 'The Great Gatsby', '1925 novel by F. Scott Fitzgerald', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7a/The_Great_Gatsby_Cover_1925_Retouched.jpg/330px-The_Great_Gatsby_Cover_1925_Retouched.jpg', false, 'https://commons.wikimedia.org/wiki/File:The_Great_Gatsby_Cover_1925_Retouched.jpg', 'https://en.wikipedia.org/wiki/The_Great_Gatsby'),
  ('Q174596', 'Moby-Dick', '1851 novel by Herman Melville', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/36/Moby-Dick_FE_title_page.jpg/330px-Moby-Dick_FE_title_page.jpg', false, 'https://commons.wikimedia.org/wiki/File:Moby-Dick_FE_title_page.jpg', 'https://en.wikipedia.org/wiki/Moby-Dick'),
  ('Q155653', 'Spirited Away', '2001 film by Hayao Miyazaki', 'https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png', true, 'https://en.wikipedia.org/wiki/File:Spirited_Away_Japanese_poster.png', 'https://en.wikipedia.org/wiki/Spirited_Away'),
  ('Q47703', 'The Godfather', '1972 film by Francis Ford Coppola', 'https://upload.wikimedia.org/wikipedia/en/1/1c/Godfather_ver1.jpg', true, 'https://en.wikipedia.org/wiki/File:Godfather_ver1.jpg', 'https://en.wikipedia.org/wiki/The_Godfather'),
  ('Q184843', 'Blade Runner', '1982 film by Ridley Scott', 'https://upload.wikimedia.org/wikipedia/en/9/9f/Blade_Runner_%281982_poster%29.png', true, 'https://en.wikipedia.org/wiki/File:Blade_Runner_%281982_poster%29.png', 'https://en.wikipedia.org/wiki/Blade_Runner'),
  ('Q173643', 'Abbey Road', '1969 studio album by the Beatles', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a4/The_Beatles_Abbey_Road_album_cover.jpg/330px-The_Beatles_Abbey_Road_album_cover.jpg', false, 'https://commons.wikimedia.org/wiki/File:The_Beatles_Abbey_Road_album_cover.jpg', 'https://en.wikipedia.org/wiki/Abbey_Road'),
  ('Q283221', 'Kind of Blue', '1959 studio album by Miles Davis', 'https://upload.wikimedia.org/wikipedia/en/1/10/Miles_Davis_-_Kind_of_Blue_album_cover.jpg', true, 'https://en.wikipedia.org/wiki/File:Miles_Davis_-_Kind_of_Blue_album_cover.jpg', 'https://en.wikipedia.org/wiki/Kind_of_Blue'),
  ('Q188626', 'Sonic Youth', 'American rock band (1981–2011)', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e1/Sonicyouth2011lineup.png/330px-Sonicyouth2011lineup.png', false, 'https://commons.wikimedia.org/wiki/File:Sonicyouth2011lineup.png', 'https://en.wikipedia.org/wiki/Sonic_Youth'),
  ('Q718', 'Chess', 'Traditional board game for two players', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6f/ChessSet.jpg/330px-ChessSet.jpg', false, 'https://commons.wikimedia.org/wiki/File:ChessSet.jpg', 'https://en.wikipedia.org/wiki/Chess'),
  ('Q71910', 'Tetris', 'Puzzle video game', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/31/Tetris_logo_2019.svg/330px-Tetris_logo_2019.svg.png', false, 'https://commons.wikimedia.org/wiki/File:Tetris_logo_2019.svg', 'https://en.wikipedia.org/wiki/Tetris'),
  ('Q213911', 'The Legend of Zelda: Ocarina of Time', '1998 video game', 'https://thumb.wikimedia.org/wikipedia/en/thumb/5/57/The_Legend_of_Zelda_Ocarina_of_Time.jpg/330px-The_Legend_of_Zelda_Ocarina_of_Time.jpg', true, 'https://en.wikipedia.org/wiki/File:The_Legend_of_Zelda_Ocarina_of_Time.jpg', 'https://en.wikipedia.org/wiki/The_Legend_of_Zelda%3A_Ocarina_of_Time'),
  ('Q40152', 'Octopus', 'Soft-bodied eight-limbed order of molluscs', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/57/Octopus2.jpg/330px-Octopus2.jpg', false, 'https://commons.wikimedia.org/wiki/File:Octopus2.jpg', 'https://en.wikipedia.org/wiki/Octopus'),
  ('Q131538', 'Capybara', 'Largest species of rodents', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/7/71/Capybaracropped.jpg/330px-Capybaracropped.jpg', false, 'https://commons.wikimedia.org/wiki/File:Capybaracropped.jpg', 'https://en.wikipedia.org/wiki/Capybara'),
  ('Q5194', 'Tardigrade', 'Phylum of microscopic animals', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/20/SEM_image_of_Milnesium_tardigradum_in_active_state_-_journal.pone.0045682.g001-2_%28white_background%29.png/330px-SEM_image_of_Milnesium_tardigradum_in_active_state_-_journal.pone.0045682.g001-2_%28white_background%29.png', false, 'https://commons.wikimedia.org/wiki/File:SEM_image_of_Milnesium_tardigradum_in_active_state_-_journal.pone.0045682.g001-2_%28white_background%29.png', 'https://en.wikipedia.org/wiki/Tardigrade'),
  ('Q30034', 'Western honey bee', 'Species of honey bee', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4d/Apis_mellifera_Western_honey_bee.jpg/330px-Apis_mellifera_Western_honey_bee.jpg', false, 'https://commons.wikimedia.org/wiki/File:Apis_mellifera_Western_honey_bee.jpg', 'https://en.wikipedia.org/wiki/Western_honey_bee'),
  ('Q12004', 'Oak', 'Tree or shrub in the genus Quercus', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/af/Quercus_robur.jpg/330px-Quercus_robur.jpg', false, 'https://commons.wikimedia.org/wiki/File:Quercus_robur.jpg', 'https://en.wikipedia.org/wiki/Oak'),
  ('Q3360560', 'Sourdough', 'Type of fermented bread', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3d/Sourdough_bread_loaf.jpg/330px-Sourdough_bread_loaf.jpg', false, 'https://commons.wikimedia.org/wiki/File:Sourdough_bread_loaf.jpg', 'https://en.wikipedia.org/wiki/Sourdough'),
  ('Q234646', 'Ramen', 'Japanese noodle dish', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c3/Shoyu_Ramen%EF%BC%88Tokyo_Ramen%EF%BC%89_-_01.jpg/330px-Shoyu_Ramen%EF%BC%88Tokyo_Ramen%EF%BC%89_-_01.jpg', false, 'https://commons.wikimedia.org/wiki/File:Shoyu_Ramen%EF%BC%88Tokyo_Ramen%EF%BC%89_-_01.jpg', 'https://en.wikipedia.org/wiki/Ramen'),
  ('Q207832', 'Croissant', 'Crescent-shaped viennoiserie pastry', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2a/Croissant-Petr_Kratochvil.jpg/330px-Croissant-Petr_Kratochvil.jpg', false, 'https://commons.wikimedia.org/wiki/File:Croissant-Petr_Kratochvil.jpg', 'https://en.wikipedia.org/wiki/Croissant'),
  ('Q180289', 'Espresso', 'Type of strong coffee', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a5/Tazzina_di_caff%C3%A8_a_Ventimiglia.jpg/330px-Tazzina_di_caff%C3%A8_a_Ventimiglia.jpg', false, 'https://commons.wikimedia.org/wiki/File:Tazzina_di_caff%C3%A8_a_Ventimiglia.jpg', 'https://en.wikipedia.org/wiki/Espresso'),
  ('Q141898', 'Kimchi', 'Korean side dish of fermented vegetables', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f8/Various_kimchi.jpg/330px-Various_kimchi.jpg', false, 'https://commons.wikimedia.org/wiki/File:Various_kimchi.jpg', 'https://en.wikipedia.org/wiki/Kimchi'),
  ('Q177', 'Pizza', 'Italian dish', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/91/Pizza-3007395.jpg/330px-Pizza-3007395.jpg', false, 'https://commons.wikimedia.org/wiki/File:Pizza-3007395.jpg', 'https://en.wikipedia.org/wiki/Pizza'),
  ('Q46383', 'Sushi', 'Japanese dish with vinegared rice', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/60/Sushi_platter.jpg/330px-Sushi_platter.jpg', false, 'https://commons.wikimedia.org/wiki/File:Sushi_platter.jpg', 'https://en.wikipedia.org/wiki/Sushi'),
  ('Q11442', 'Bicycle', 'Pedal-driven two-wheel vehicle', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/41/Left_side_of_Flying_Pigeon.jpg/330px-Left_side_of_Flying_Pigeon.jpg', false, 'https://commons.wikimedia.org/wiki/File:Left_side_of_Flying_Pigeon.jpg', 'https://en.wikipedia.org/wiki/Bicycle'),
  ('Q39715', 'Lighthouse', 'Structure designed to emit light to aid navigation', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Aerial_photograph_60D_2012_05_13_8760_DxO_retusche.jpg/330px-Aerial_photograph_60D_2012_05_13_8760_DxO_retusche.jpg', false, 'https://commons.wikimedia.org/wiki/File:Aerial_photograph_60D_2012_05_13_8760_DxO_retusche.jpg', 'https://en.wikipedia.org/wiki/Lighthouse'),
  ('Q46335', 'Typewriter', 'Mechanical device for typing characters', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b7/MEK_II-371.jpg/330px-MEK_II-371.jpg', false, 'https://commons.wikimedia.org/wiki/File:MEK_II-371.jpg', 'https://en.wikipedia.org/wiki/Typewriter'),
  ('Q47043', 'Rubik''s Cube', '3D combination puzzle', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/6/61/Rubiks_cube_solved.jpg/330px-Rubiks_cube_solved.jpg', false, 'https://commons.wikimedia.org/wiki/File:Rubiks_cube_solved.jpg', 'https://en.wikipedia.org/wiki/Rubik''s_Cube'),
  ('Q8353', 'Paper clip', 'Metal device to hold papers together', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Wanzijia.jpg/330px-Wanzijia.jpg', false, 'https://commons.wikimedia.org/wiki/File:Wanzijia.jpg', 'https://en.wikipedia.org/wiki/Paper_clip'),
  ('Q39671', 'Stonehenge', 'Prehistoric monument in England', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3c/Stonehenge2007_07_30.jpg/330px-Stonehenge2007_07_30.jpg', false, 'https://commons.wikimedia.org/wiki/File:Stonehenge2007_07_30.jpg', 'https://en.wikipedia.org/wiki/Stonehenge'),
  ('Q641', 'Venice', 'City in Veneto, Italy', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Venezia_aerial_view.jpg/330px-Venezia_aerial_view.jpg', false, 'https://commons.wikimedia.org/wiki/File:Venezia_aerial_view.jpg', 'https://en.wikipedia.org/wiki/Venice'),
  ('Q51', 'Antarctica', 'Earth''s southernmost continent', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f2/Antarctica_%28orthographic_projection%29.svg/330px-Antarctica_%28orthographic_projection%29.svg.png', false, 'https://commons.wikimedia.org/wiki/File:Antarctica_%28orthographic_projection%29.svg', 'https://en.wikipedia.org/wiki/Antarctica'),
  ('Q40609', 'Aurora', 'Atmospheric effect caused by the solar wind', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/d/d3/Aurora_borealis_over_Eielson_Air_Force_Base%2C_Alaska.jpg/330px-Aurora_borealis_over_Eielson_Air_Force_Base%2C_Alaska.jpg', false, 'https://commons.wikimedia.org/wiki/File:Aurora_borealis_over_Eielson_Air_Force_Base%2C_Alaska.jpg', 'https://en.wikipedia.org/wiki/Aurora'),
  ('Q8072', 'Volcano', 'Rupture in a planet''s crust where material escapes', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Augustine_volcano_Jan_24_2006_-_Cyrus_Read.jpg/330px-Augustine_volcano_Jan_24_2006_-_Cyrus_Read.jpg', false, 'https://commons.wikimedia.org/wiki/File:Augustine_volcano_Jan_24_2006_-_Cyrus_Read.jpg', 'https://en.wikipedia.org/wiki/Volcano'),
  ('Q11982', 'Photosynthesis', 'Biological process to convert light into chemical energy', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/55/Photosynthesis_en.svg/330px-Photosynthesis_en.svg.png', false, 'https://commons.wikimedia.org/wiki/File:Photosynthesis_en.svg', 'https://en.wikipedia.org/wiki/Photosynthesis'),
  ('Q589', 'Black hole', 'Compact astronomical body', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4f/Black_hole_-_Messier_87_crop_max_res.jpg/330px-Black_hole_-_Messier_87_crop_max_res.jpg', false, 'https://commons.wikimedia.org/wiki/File:Black_hole_-_Messier_87_crop_max_res.jpg', 'https://en.wikipedia.org/wiki/Black_hole'),
  ('Q193', 'Saturn', 'Sixth planet from the Sun', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/4/43/Saturn_global_view_from_Cassini%2C_rings_open_Better_Colour.png/330px-Saturn_global_view_from_Cassini%2C_rings_open_Better_Colour.png', false, 'https://commons.wikimedia.org/wiki/File:Saturn_global_view_from_Cassini%2C_rings_open_Better_Colour.png', 'https://en.wikipedia.org/wiki/Saturn'),
  ('Q52', 'Wikipedia', 'Free online crowdsourced encyclopedia', 'https://thumb.wikimedia.org/wikipedia/en/thumb/8/80/Wikipedia-logo-v2.svg/330px-Wikipedia-logo-v2.svg.png', true, 'https://en.wikipedia.org/wiki/File:Wikipedia-logo-v2.svg', 'https://en.wikipedia.org/wiki/Wikipedia'),
  ('Q20034', 'Lasagna', 'Flat pasta and stacked pasta dishes', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/Lasagne_-_stonesoup.jpg/330px-Lasagne_-_stonesoup.jpg', false, 'https://commons.wikimedia.org/wiki/File:Lasagne_-_stonesoup.jpg', 'https://en.wikipedia.org/wiki/Lasagna');

-- ============ Reviews ============

insert into public.logs (user_id, item_id, rating, review, logged_at)
select p.id, i.id, v.rating, v.review, now() - v.age::interval
from (values
  ('margot', 'Capybara', 5.0, 'Sits in a hot spring with an orange on its head and asks nothing of anyone. I would like to be reviewed this kindly.', '2 hours'),
  ('tomasz', 'Capybara', 4.5, 'Half a star off because it has never once returned my calls.', '5 hours'),
  ('ines_v', 'Capybara', 5.0, 'The only rodent with the emotional intelligence of a good therapist.', '9 hours'),
  ('Big Dennis', 'Concrete', 1.5, 'Stubbed my toe on some. Would not recommend.', '3 hours'),
  ('hollis', 'Concrete', 2.0, 'Everything is built on it and nobody has ever said thank you. I also will not be saying thank you.', '7 hours'),
  ('quiet_otter', 'Concrete', 1.0, 'Grey. Hard. Smells like a parking garage in the rain.', '14 hours'),
  ('priya', 'Ramen', 4.5, 'Ate this at midnight standing at a counter in the rain and briefly understood everything.', '4 hours'),
  ('yuki', 'Moon', 4.0, 'Solid, reliable, shows up most nights. Loses points for the phases, pick a shape.', '6 hours'),
  ('oskar', 'Tardigrade', 5.0, 'Survived the vacuum of space and looks like a tiny disappointed sofa. Perfect organism, no notes.', '11 hours'),
  ('delphine', 'Croissant', 4.5, 'Got flakes in my keyboard, my hair and somehow my passport. Worth it.', '18 hours'),
  ('demo', 'Espresso', 4.0, 'Over in nine seconds and then my hands shook until lunch. Exactly what I asked for.', '1 hour'),
  ('demo', 'The Godfather', 5.0, 'Took three hours to explain why you should never go to a christening with your family. Still the best movie about management.', '3 days'),
  ('demo', 'Paper clip', 3.5, 'Has held my whole career together, also opened a SIM tray once. Criminally underrated.', '6 days'),
  ('demo', 'Lasagna', 4.5, E'Made it from scratch for the first time. It took all of Sunday.\n\nThe kitchen is still not okay. The lasagna was incredible.', '12 days'),
  ('margot', 'Moby-Dick', 3.0, 'There is a very good 200 page novel in here hiding behind 400 pages about rope.', '2 days'),
  ('tomasz', 'Moby-Dick', 5.0, 'The rope chapters are the best part and I will not be taking questions.', '4 days'),
  ('ines_v', 'Spirited Away', 5.0, 'Watched it at nine and it scared me. Watched it at thirty and it made me call my mother.', '5 days'),
  ('Big Dennis', 'Pizza', 5.0, 'I have had bad pizza. It was still pizza.', '1 day'),
  ('hollis', 'Blade Runner', 4.0, 'Beautiful, damp and slow. Same as me in November.', '8 days'),
  ('quiet_otter', 'Octopus', 5.0, 'Three hearts, nine brains, and it still only wants to be left alone in a jar. Relatable.', '10 days'),
  ('priya', 'Kimchi', 4.5, 'My fridge will never smell normal again and I have made peace with that.', '3 days'),
  ('yuki', 'Mount Fuji', 4.0, 'Better from far away, as is true of most things and all of my relatives.', '15 days'),
  ('oskar', 'Chess', 3.5, 'Lost to a nine year old in a park. She was gracious about it. I am not over it.', '7 days'),
  ('delphine', 'Venice', 3.5, 'Gorgeous. Slowly sinking. Sixteen euros for a coffee. A city with a clear sense of its own ending.', '20 days'),
  ('margot', 'Sourdough', 2.5, 'I have kept the starter alive for four years out of guilt. It is the longest relationship I have had.', '25 days'),
  ('tomasz', 'Typewriter', 4.0, 'Bought one to feel like a writer. I now feel like a person with a sore finger and a very heavy object.', '30 days'),
  ('ines_v', 'Kind of Blue', 5.0, 'Put it on to do the dishes and ended up sitting on the kitchen floor.', '35 days'),
  ('Big Dennis', 'Tetris', 4.5, 'See the long piece coming in my dreams. It never arrives there either.', '40 days'),
  ('hollis', 'Lighthouse', 4.0, 'One job, done for centuries, while being struck by waves. Aspirational.', '13 days'),
  ('quiet_otter', 'Refrigerator', 3.0, 'Stood in front of this for ten minutes last night hoping it had changed. It had not.', '2 days'),
  ('priya', 'Black hole', null, 'Not rating this. It might be looking back.', '16 days'),
  ('yuki', 'Abbey Road', 4.5, 'Side two is a perfect thing. Side one has Maxwell on it.', '22 days'),
  ('oskar', 'Western honey bee', 5.0, 'Dances to give directions. I can barely do it with my phone.', '28 days'),
  ('delphine', 'Stonehenge', 2.5, 'Smaller than you think, further than you think, and the car park has better views of the sheep.', '45 days'),
  ('demo', 'Sonic Youth', 4.5, 'Sounds like a fridge falling down the stairs in the most beautiful way.', '18 days'),
  ('ThisUsernameIsThirtyCharsLong!', 'Saturn', 5.0, 'Reviewing this mainly to see whether my name breaks your layout, but also the rings are nice.', '8 hours'),
  ('ThisUsernameIsThirtyCharsLong!', 'Wikipedia', 4.5, E'I came here to look up the boiling point of water, and three hours later I know more than anyone should about the medieval trade in stockfish, the history of the Hanseatic League, why a town in Germany has a statue of a donkey on a pole, and which of the moons of Jupiter would be the least unpleasant to live on.\n\nI still do not know the boiling point of water. I closed the tab to go to bed and opened it again from bed. I have started donating, not because of the banners, but because I think it might be the last nice thing we have. It has never once tried to sell me a mattress.\n\nFive stars minus a half for the talk pages, which I have read, and which I would like to unread.', '4 days'),
  -- A second entry for an item the same person has already logged
  ('demo', 'The Godfather', 5.0, 'Rewatched it. Still went to the christening.', '5 hours'),
  ('margot', 'Eiffel Tower', null, '', '6 days'),
  ('oskar', 'Rubik''s Cube', 4.0, '', '9 days')
) as v(username, title, rating, review, age)
join public.profiles p on p.username = v.username
join public.items i on i.title = v.title;

-- Entries with no text, spread across everyone and everything
insert into public.logs (user_id, item_id, rating, logged_at)
select
  p.id,
  i.id,
  case when abs(hashtext(p.username || i.id)) % 6 = 0 then null
       else 2 + (abs(hashtext(i.id || p.username)) % 7) * 0.5 end,
  now() - interval '2 days'
    - (abs(hashtext(p.username || i.title)) % 1400) * interval '1 hour'
from public.profiles p
cross join public.items i
where abs(hashtext(p.username || ':' || i.id)) % 5 = 0;

-- ============ Likes ============

-- Up to 8 likes on a review, and one on every fourth entry without text
insert into public.likes (user_id, log_id, created_at)
select
  liker.id,
  l.id,
  least(
    now() - interval '5 minutes',
    l.logged_at + (abs(hashtext(liker.username || l.item_id)) % 72) * interval '1 hour'
  )
from public.logs l
cross join lateral (
  select p.id, p.username
  from public.profiles p
  where p.id <> l.user_id
  order by hashtext(p.username || l.item_id || l.review)
  limit case
    when l.review <> '' then 1 + abs(hashtext(l.review)) % 8
    when abs(hashtext(l.user_id::text || l.item_id)) % 4 = 0 then 1
    else 0
  end
) liker;

-- ============ Comments ============

insert into public.comments (log_id, user_id, body, created_at)
select l.id, p.id, v.body, now() - v.age::interval
from (values
  ('margot', 'Capybara', 'tomasz', 'The orange is doing a lot of the work here.', '90 minutes'),
  ('margot', 'Capybara', 'oskar', 'Saw one at a zoo in Osaka. It looked at me and I apologised.', '60 minutes'),
  ('Big Dennis', 'Concrete', 'hollis', 'Toes should simply be stronger.', '2 hours'),
  ('Big Dennis', 'Concrete', 'quiet_otter', 'First honest review of this material I have read.', '40 minutes'),
  ('priya', 'Ramen', 'yuki', 'Which counter? This matters to me a great deal.', '3 hours'),
  ('demo', 'Espresso', 'delphine', 'Nine seconds is a personal best, I hope you stretched.', '30 minutes'),
  ('demo', 'The Godfather', 'margot', 'Best movie about management is such a good description.', '2 days'),
  ('demo', 'The Godfather', 'ines_v', 'I would have watched this review for three hours too.', '1 day'),
  ('demo', 'Paper clip', 'oskar', 'They once traded one all the way up to a house.', '5 days'),
  ('demo', 'Lasagna', 'priya', 'Recipe or it did not happen.', '11 days'),
  ('tomasz', 'Moby-Dick', 'margot', 'I would like to take one question. Why.', '3 days'),
  ('ines_v', 'Spirited Away', 'hollis', 'Going to go call my mother now, thanks.', '4 days'),
  ('quiet_otter', 'Octopus', 'demo', 'Nine brains and still none of them want to go to the party.', '9 days'),
  ('oskar', 'Chess', 'Big Dennis', 'She will remember you too. Not fondly.', '6 days'),
  ('ThisUsernameIsThirtyCharsLong!', 'Saturn', 'demo', 'Good news on the layout, you are still fine.', '6 hours')
) as v(owner, title, commenter, body, age)
join public.profiles o on o.username = v.owner
join public.items i on i.title = v.title
join public.logs l on l.user_id = o.id and l.item_id = i.id and l.review <> ''
  and l.logged_at = (
    select min(x.logged_at) from public.logs x
    where x.user_id = o.id and x.item_id = i.id and x.review <> ''
  )
join public.profiles p on p.username = v.commenter;

insert into public.comments (log_id, user_id, parent_id, body, created_at)
select c.log_id, p.id, c.id, v.body, now() - v.age::interval
from (values
  ('The orange is doing a lot of the work here.', 'margot', 'It really is. Without the orange it is merely a large wet guinea pig.', '70 minutes'),
  ('Which counter? This matters to me a great deal.', 'priya', 'Cannot say. It may have been a dream. There was a cat involved.', '2 hours'),
  ('Best movie about management is such a good description.', 'demo', 'Sonny would have been a terrible team lead.', '1 day'),
  ('Best movie about management is such a good description.', 'tomasz', 'Fredo was just in the wrong role.', '20 hours'),
  ('I would like to take one question. Why.', 'tomasz', 'Because of the rope.', '2 days'),
  ('They once traded one all the way up to a house.', 'demo', 'Next time I am keeping the paper clip.', '4 days')
) as v(parent_body, replier, body, age)
join public.comments c on c.body = v.parent_body
join public.profiles p on p.username = v.replier;

insert into public.comment_likes (user_id, comment_id)
select p.id, c.id
from public.comments c
cross join public.profiles p
where p.id <> c.user_id
  and abs(hashtext(p.username || c.body)) % 4 = 0;

-- ============ Lists ============

insert into public.lists (user_id, title, description, ranked, created_at)
select p.id, v.title, v.description, v.ranked, now() - v.age::interval
from (values
  ('margot', 'Food I''ve eaten', null, false, '6 hours'),
  ('demo', 'Things I''d save from a fire', 'In order. The cat can look after itself.', true, '1 day'),
  ('tomasz', 'Everything I looked up during one very long meeting', 'It was a 35 item meeting.', false, '2 days'),
  ('ines_v', 'Animals with better lives than mine', null, false, '3 days'),
  ('yuki', 'Best breakfasts, ranked', 'Controversial at number one, I know.', true, '4 days'),
  ('hollis', 'Things my grandmother insisted were good for you, ranked by how wrong she was', 'She lived to 97, so who knows.', true, '9 days'),
  ('oskar', 'Objects of quiet dignity', null, false, '12 days'),
  ('priya', 'Fermented', 'If it bubbles, it counts.', false, '16 days'),
  ('quiet_otter', 'Places I have been told are nice', 'Have not checked.', false, '21 days'),
  ('delphine', 'Space', null, false, '26 days'),
  ('Big Dennis', 'Stuff to look into at some point', 'Empty for now, working on it.', false, '32 days'),
  ('demo', 'One perfect thing', null, false, '38 days')
) as v(username, title, description, ranked, age)
join public.profiles p on p.username = v.username;

insert into public.list_items (list_id, item_id, position)
select l.id, i.id, t.position
from (values
  ('Food I''ve eaten', array['Sushi']),
  ('Things I''d save from a fire', array['Typewriter', 'Kind of Blue', 'Moby-Dick', 'Bicycle', 'Rubik''s Cube']),
  ('Animals with better lives than mine', array['Capybara', 'Octopus', 'Tardigrade', 'Western honey bee']),
  ('Best breakfasts, ranked', array['Kimchi', 'Croissant', 'Espresso', 'Banana', 'Sourdough', 'Tomato']),
  ('Things my grandmother insisted were good for you, ranked by how wrong she was', array['Cigarette', 'Espresso', 'Tomato', 'Banana']),
  ('Objects of quiet dignity', array['Paper clip', 'Lighthouse', 'Refrigerator', 'Oak', 'Concrete', 'Typewriter', 'Bicycle']),
  ('Fermented', array['Kimchi', 'Sourdough']),
  ('Places I have been told are nice', array['Venice', 'Mount Fuji', 'Stonehenge', 'Antarctica', 'Eiffel Tower']),
  ('Space', array['Moon', 'Saturn', 'Black hole', 'Aurora']),
  ('One perfect thing', array['Lasagna'])
) as v(list_title, titles)
cross join lateral unnest(v.titles) with ordinality as t(item_title, position)
join public.lists l on l.title = v.list_title
join public.items i on i.title = t.item_title;

-- The long list, for the "+N more" preview
insert into public.list_items (list_id, item_id, position)
select l.id, picked.id, picked.position
from public.lists l
cross join lateral (
  select i.id, row_number() over (order by hashtext(i.title))::integer as position
  from public.items i
  order by hashtext(i.title)
  limit 35
) picked
where l.title = 'Everything I looked up during one very long meeting';

insert into public.list_likes (user_id, list_id, created_at)
select
  p.id,
  l.id,
  least(
    now() - interval '10 minutes',
    l.created_at + (abs(hashtext(p.username || l.title)) % 48) * interval '1 hour'
  )
from public.lists l
cross join public.profiles p
where p.id <> l.user_id
  and abs(hashtext(p.username || ':' || l.title)) % 2 = 0;

insert into public.list_comments (list_id, user_id, body, created_at)
select l.id, p.id, v.body, now() - v.age::interval
from (values
  ('Food I''ve eaten', 'tomasz', 'Looking forward to the sequel.', '3 hours'),
  ('Things I''d save from a fire', 'margot', 'Saving the Rubik''s Cube over the cat is a bold position.', '20 hours'),
  ('Things I''d save from a fire', 'oskar', 'A typewriter is very heavy to run with.', '12 hours'),
  ('Everything I looked up during one very long meeting', 'hollis', 'You went from concrete to Saturn in one meeting? Respect.', '1 day'),
  ('Best breakfasts, ranked', 'priya', 'Finally, someone gets it.', '3 days'),
  ('Things my grandmother insisted were good for you, ranked by how wrong she was', 'delphine', 'Mine said the same about cigarettes, and also about driving fast.', '8 days')
) as v(list_title, commenter, body, age)
join public.lists l on l.title = v.list_title
join public.profiles p on p.username = v.commenter;

insert into public.list_comments (list_id, user_id, parent_id, body, created_at)
select c.list_id, p.id, c.id, v.body, now() - v.age::interval
from (values
  ('Saving the Rubik''s Cube over the cat is a bold position.', 'demo', 'The cat has never once been solved.', '18 hours'),
  ('You went from concrete to Saturn in one meeting? Respect.', 'tomasz', 'It was about the quarterly roadmap.', '20 hours')
) as v(parent_body, replier, body, age)
join public.list_comments c on c.body = v.parent_body
join public.profiles p on p.username = v.replier;

-- ============ Follows and favourites ============

insert into public.follows (follower_id, following_id, created_at)
select
  a.id,
  b.id,
  now() - interval '1 day' - (abs(hashtext(a.username || b.username)) % 900) * interval '1 hour'
from public.profiles a
cross join public.profiles b
where a.id <> b.id
  and (
    a.username = 'demo' and b.username in ('margot', 'tomasz', 'ines_v', 'Big Dennis', 'quiet_otter', 'oskar')
    or abs(hashtext(a.username || '>' || b.username)) % 3 = 0
  );

insert into public.favourites (user_id, position, item_id)
select p.id, t.position::smallint, i.id
from (values
  ('demo', array['The Godfather', 'Lasagna', 'Sonic Youth', 'Paper clip', 'Espresso']),
  ('margot', array['Capybara', 'Moby-Dick', 'Sourdough']),
  ('tomasz', array['Moby-Dick', 'Typewriter', 'Chess', 'Moon']),
  ('ines_v', array['Spirited Away', 'Kind of Blue', 'Capybara', 'Aurora', 'Venice']),
  ('Big Dennis', array['Pizza']),
  ('quiet_otter', array['Octopus', 'Refrigerator']),
  ('priya', array['Ramen', 'Kimchi', 'Black hole']),
  ('oskar', array['Tardigrade', 'Western honey bee', 'Chess', 'Rubik''s Cube', 'Bicycle'])
) as v(username, titles)
cross join lateral unnest(v.titles) with ordinality as t(item_title, position)
join public.profiles p on p.username = v.username
join public.items i on i.title = t.item_title;

-- ============ Notifications ============

-- The triggers above stamp every notification with the moment of seeding, so
-- spread them over the past month and leave only the last three days unread
with ordered as (
  select id, row_number() over (order by hashtext(id::text)) as n
  from public.notifications
)
update public.notifications n
set
  created_at = now() - o.n * interval '20 minutes',
  read = o.n * interval '20 minutes' > interval '3 days'
from ordered o
where n.id = o.id;
