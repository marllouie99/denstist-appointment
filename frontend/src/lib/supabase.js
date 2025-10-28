import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eqourszivgeotowdzzpt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxb3Vyc3ppdmdlb3Rvd2R6enB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDM1MDksImV4cCI6MjA3NDgxOTUwOX0.ifHAaQD2sqigPLT0nnRC7nwqY7XHB6avKJk_asdFL0s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
