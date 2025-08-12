// Authentication module for Supabase integration
class AuthManager {
    constructor() {
        this.supabase = null;
        this.currentUser = null;
        this.init();
    }

    // Initialize Supabase client
    init() {
        try {
            if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.anonKey) {
                this.supabase = window.supabase.createClient(
                    window.SUPABASE_CONFIG.url,
                    window.SUPABASE_CONFIG.anonKey
                );
                console.log('Supabase client initialized');
                this.checkAuthState();
            } else {
                console.error('Supabase configuration not found. Please check config.js');
                this.showMessage('Configuration error. Please contact support.', 'error');
            }
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            this.showMessage('Authentication service unavailable.', 'error');
        }
    }

    // Check current authentication state
    async checkAuthState() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.error('Error getting session:', error);
                this.handleNoAuth();
                return;
            }

            if (session) {
                this.currentUser = session.user;
                console.log('User authenticated:', this.currentUser);
                this.handleAuthSuccess();
            } else {
                console.log('No active session');
                this.handleNoAuth();
            }

            // Listen for auth changes
            this.supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('Auth state changed:', event, session);
                if (event === 'SIGNED_IN' && session) {
                    this.currentUser = session.user;
                    this.handleAuthSuccess();
                } else if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.handleSignOut();
                }
            });
        } catch (error) {
            console.error('Error checking auth state:', error);
            this.handleNoAuth();
        }
    }

    // Handle successful authentication
    handleAuthSuccess() {
        const currentPage = window.location.pathname.split('/').pop();
        
        // Update user email display if on authenticated pages
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement && this.currentUser) {
            userEmailElement.textContent = this.currentUser.email;
        }

        // Redirect from login page to user preferences
        if (currentPage === 'index.html' || currentPage === '') {
            console.log('Redirecting to user.html');
            window.location.href = 'user.html';
        }
    }

    // Handle no authentication
    handleNoAuth() {
        const currentPage = window.location.pathname.split('/').pop();
        const protectedPages = ['user.html', 'meal-planner.html', 'grocery-list.html', 'profile.html', 'appointments.html'];
        
        if (protectedPages.includes(currentPage)) {
            console.log('Redirecting to login page');
            window.location.href = 'index.html';
        }
    }

    // Handle sign out
    handleSignOut() {
        window.location.href = 'index.html';
    }

    // Sign up new user
    async signUp(email, password) {
        try {
            this.showLoading(true);
            console.log('Attempting to sign up user:', email);

            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            console.log('Sign up result:', data);

            // Insert user profile if user was created
            if (data.user && !data.session) {
                // Email confirmation required
                this.showMessage('Please check your email and click the confirmation link to complete registration.', 'success');
            } else if (data.user && data.session) {
                // User created and logged in
                await this.createUserProfile(data.user);
                this.showMessage('Account created successfully!', 'success');
            }

            return { success: true, data };
        } catch (error) {
            console.error('Sign up error:', error);
            this.showMessage(this.getErrorMessage(error), 'error');
            return { success: false, error };
        } finally {
            this.showLoading(false);
        }
    }

    // Sign in existing user
    async signIn(email, password) {
        try {
            this.showLoading(true);
            console.log('Attempting to sign in user:', email);

            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                throw error;
            }

            console.log('Sign in result:', data);
            this.showMessage('Login successful!', 'success');
            return { success: true, data };
        } catch (error) {
            console.error('Sign in error:', error);
            this.showMessage(this.getErrorMessage(error), 'error');
            return { success: false, error };
        } finally {
            this.showLoading(false);
        }
    }

    // Sign out user
    async signOut() {
        try {
            this.showLoading(true);
            const { error } = await this.supabase.auth.signOut();
            if (error) {
                throw error;
            }
            this.showMessage('Logged out successfully!', 'success');
            return { success: true };
        } catch (error) {
            console.error('Sign out error:', error);
            this.showMessage('Error signing out. Please try again.', 'error');
            return { success: false, error };
        } finally {
            this.showLoading(false);
        }
    }

    // Create user profile in database
    async createUserProfile(user) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .insert([{
                    id: user.id,
                    email: user.email,
                    created_at: new Date().toISOString()
                }]);

            if (error) {
                console.error('Error creating user profile:', error);
                // Don't throw error here as auth is still successful
            }

            return data;
        } catch (error) {
            console.error('Error creating user profile:', error);
        }
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Get Supabase client
    getSupabase() {
        return this.supabase;
    }

    // Utility functions
    getErrorMessage(error) {
        const errorMessages = {
            'Invalid login credentials': 'Invalid email or password. Please try again.',
            'User already registered': 'An account with this email already exists.',
            'Password should be at least 6 characters': 'Password must be at least 6 characters long.',
            'Invalid email': 'Please enter a valid email address.',
            'Email not confirmed': 'Please check your email and click the confirmation link.',
            'Too many requests': 'Too many login attempts. Please wait a moment and try again.'
        };
        return errorMessages[error.message] || error.message || 'An unexpected error occurred.';
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.toggle('hidden', !show);
        }
    }

    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        // Clear previous messages
        messagesContainer.innerHTML = '';

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
        messageDiv.innerHTML = `${icon} ${message}`;
        
        messagesContainer.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Initialize auth manager
let authManager;

// DOM ready handler
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing auth manager');
    authManager = new AuthManager();

    // Form handlers for login page
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const showSignupLink = document.getElementById('showSignup');
    const showLoginLink = document.getElementById('showLogin');
    const logoutBtn = document.getElementById('logoutBtn');

    // Login form handler
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            if (!email || !password) {
                authManager.showMessage('Please enter both email and password.', 'error');
                return;
            }

            await authManager.signIn(email, password);
        });
    }

    // Signup form handler
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signupEmail').value.trim();
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = document.getElementById('confirmPassword')?.value;

            if (!email || !password) {
                authManager.showMessage('Please enter both email and password.', 'error');
                return;
            }

            if (password.length < 6) {
                authManager.showMessage('Password must be at least 6 characters long.', 'error');
                return;
            }

            if (confirmPassword && password !== confirmPassword) {
                authManager.showMessage('Passwords do not match.', 'error');
                return;
            }

            await authManager.signUp(email, password);
        });
    }

    // Toggle between login and signup forms
    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('signup-form').classList.remove('hidden');
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-form').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
        });
    }

    // Logout button handler
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await authManager.signOut();
        });
    }
});
