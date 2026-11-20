-- ABOUTME: Lets signed-in people call admin_set_item_nsfw, which itself refuses anyone who isn't an admin.
-- ABOUTME: Matches the explicit grants on the other admin functions.

grant execute on function public.admin_set_item_nsfw(text, boolean) to authenticated;
