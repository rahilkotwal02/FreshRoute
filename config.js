// Supabase Configuration - Safe to commit (public-facing keys)
const SUPABASE_CONFIG = {
    url: 'https://yidrhwjbvusxoiqiaoii.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZHJod2pidnVzeG9pcWlhb2lpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NjkxMTQsImV4cCI6MjA3MDU0NTExNH0.Sy7Jt2jX8-8Z6HzUhAxThOcGh0kO0HlZb5R4HRjSuw0'
};

// Export Supabase configuration
window.SUPABASE_CONFIG = SUPABASE_CONFIG;

console.log('Configuration loaded - Supabase ready');
