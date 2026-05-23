import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://etsmugtnjwzrpnofsrtf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0c211Z3Ruand6cnBub2ZzcnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5OTM1NTMsImV4cCI6MjA4MjU2OTU1M30.6Q9UYvJB6Qx0E--0Wgry4_QnZrZdLSmVTHK6MKf6wG4";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
