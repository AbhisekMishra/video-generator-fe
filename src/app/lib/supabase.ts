import { createClient } from "@supabase/supabase-js";

import { env } from "../utils/env";

const { supabase: { url, anonKey } } = env;

export const supabaseClient = createClient(
    url,
    anonKey,
);