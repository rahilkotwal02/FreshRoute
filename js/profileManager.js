// Profile Management System
class ProfileManager {
    constructor() {
        this.currentProfile = null;
        this.profileStats = {
            mealPlans: 0,
            orders: 0,
            bmi: null,
            calorieGoal: null
        };
        this.init();
    }

    async init() {
        // Check authentication
        if (!authManager || !authManager.getCurrentUser()) {
            console.error('User not authenticated');
            return;
        }

        await this.loadUserProfile();
        this.setupFormHandlers();
        this.setupFileUpload();
        await this.loadProfileStats();
    }

    // Load user profile from database
    async loadUserProfile() {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            this.currentProfile = data || {
                id: userId,
                email: authManager.getCurrentUser().email,
                full_name: '',
                age: null,
                height_cm: null,
                weight_kg: null,
                gender: '',
                activity_level: '',
                fitness_goals: [],
                health_conditions: [],
                dietary_restrictions: [],
                allergies: [],
                profile_picture_url: null,
                phone: '',
                date_of_birth: null,
                emergency_contact: ''
            };

            this.populateProfile();

        } catch (error) {
            console.error('Error loading profile:', error);
            this.showMessage('Failed to load profile. Please try again.', 'error');
        }
    }

    // Populate form fields with profile data
    populateProfile() {
        // Basic Information
        document.getElementById('fullName').value = this.currentProfile.full_name || '';
        document.getElementById('phone').value = this.currentProfile.phone || '';
        document.getElementById('dateOfBirth').value = this.currentProfile.date_of_birth || '';
        document.getElementById('gender').value = this.currentProfile.gender || '';
        document.getElementById('emergencyContact').value = this.currentProfile.emergency_contact || '';

        // Health & Fitness
        document.getElementById('height').value = this.currentProfile.height_cm || '';
        document.getElementById('weight').value = this.currentProfile.weight_kg || '';
        document.getElementById('activityLevel').value = this.currentProfile.activity_level || '';

        // Health Conditions
        document.getElementById('healthConditions').value = 
            Array.isArray(this.currentProfile.health_conditions) 
                ? this.currentProfile.health_conditions.join(', ') 
                : (this.currentProfile.health_conditions || '');

        // Fitness Goals
        const fitnessGoals = this.currentProfile.fitness_goals || [];
        document.querySelectorAll('#healthFitnessForm input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = fitnessGoals.includes(checkbox.value);
        });

        // Dietary Restrictions
        const dietaryRestrictions = this.currentProfile.dietary_restrictions || [];
        document.querySelectorAll('#dietaryForm input[type="checkbox"][value]:not([value*="_"])').forEach(checkbox => {
            checkbox.checked = dietaryRestrictions.includes(checkbox.value);
        });

        // Allergies
        const allergies = this.currentProfile.allergies || [];
        document.querySelectorAll('#dietaryForm input[type="checkbox"]').forEach(checkbox => {
            const allergyList = ['nuts', 'shellfish', 'eggs', 'soy', 'fish', 'wheat', 'lactose'];
            if (allergyList.includes(checkbox.value)) {
                checkbox.checked = allergies.includes(checkbox.value);
            }
        });

        // Profile Picture
        this.updateProfilePicture();
        this.calculateBMIAndCalories();
    }

    // Update profile picture display
    updateProfilePicture() {
        const profilePicture = document.getElementById('profilePicture');
        const profileImage = document.getElementById('profileImage');
        const profileInitial = document.getElementById('profileInitial');
        const removePictureBtn = document.getElementById('removePictureBtn');

        if (this.currentProfile.profile_picture_url) {
            profileImage.src = this.currentProfile.profile_picture_url;
            profileImage.classList.remove('hidden');
            profileInitial.classList.add('hidden');
            removePictureBtn.style.display = 'inline-block';
        } else {
            profileImage.classList.add('hidden');
            profileInitial.classList.remove('hidden');
            const name = this.currentProfile.full_name || this.currentProfile.email || '?';
            profileInitial.textContent = name.charAt(0).toUpperCase();
            removePictureBtn.style.display = 'none';
        }
    }

    // Setup form handlers
    setupFormHandlers() {
        // Basic Info Form
        document.getElementById('basicInfoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveBasicInfo();
        });

        // Health & Fitness Form
        document.getElementById('healthFitnessForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveHealthFitness();
        });

        // Dietary Form
        document.getElementById('dietaryForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveDietaryInfo();
        });

        // Auto-calculate BMI when height or weight changes
        document.getElementById('height').addEventListener('input', () => this.calculateBMIAndCalories());
        document.getElementById('weight').addEventListener('input', () => this.calculateBMIAndCalories());
        document.getElementById('activityLevel').addEventListener('change', () => this.calculateBMIAndCalories());
        document.getElementById('dateOfBirth').addEventListener('change', () => this.calculateBMIAndCalories());
        document.getElementById('gender').addEventListener('change', () => this.calculateBMIAndCalories());
    }

    // Setup file upload
    setupFileUpload() {
        const fileInput = document.getElementById('pictureInput');
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.uploadProfilePicture(file);
            }
        });
    }

    // Save basic information
    async saveBasicInfo() {
        try {
            const formData = {
                full_name: document.getElementById('fullName').value.trim(),
                phone: document.getElementById('phone').value.trim(),
                date_of_birth: document.getElementById('dateOfBirth').value || null,
                gender: document.getElementById('gender').value,
                emergency_contact: document.getElementById('emergencyContact').value.trim()
            };

            await this.updateProfile(formData);
            this.showMessage('✅ Basic information saved successfully!', 'success');
            this.calculateBMIAndCalories();

        } catch (error) {
            console.error('Error saving basic info:', error);
            this.showMessage('Failed to save basic information. Please try again.', 'error');
        }
    }

    // Save health and fitness information
    async saveHealthFitness() {
        try {
            const fitnessGoals = Array.from(document.querySelectorAll('#healthFitnessForm input[type="checkbox"]:checked'))
                .map(cb => cb.value);

            const formData = {
                height_cm: document.getElementById('height').value ? parseInt(document.getElementById('height').value) : null,
                weight_kg: document.getElementById('weight').value ? parseFloat(document.getElementById('weight').value) : null,
                activity_level: document.getElementById('activityLevel').value,
                fitness_goals: fitnessGoals
            };

            await this.updateProfile(formData);
            this.showMessage('✅ Health and fitness information saved successfully!', 'success');
            this.calculateBMIAndCalories();

        } catch (error) {
            console.error('Error saving health/fitness info:', error);
            this.showMessage('Failed to save health information. Please try again.', 'error');
        }
    }

    // Save dietary information
    async saveDietaryInfo() {
        try {
            const dietaryRestrictions = Array.from(document.querySelectorAll('#dietaryForm input[type="checkbox"]:checked'))
                .map(cb => cb.value)
                .filter(value => !['nuts', 'shellfish', 'eggs', 'soy', 'fish', 'wheat', 'lactose'].includes(value));

            const allergies = Array.from(document.querySelectorAll('#dietaryForm input[type="checkbox"]:checked'))
                .map(cb => cb.value)
                .filter(value => ['nuts', 'shellfish', 'eggs', 'soy', 'fish', 'wheat', 'lactose'].includes(value));

            const healthConditions = document.getElementById('healthConditions').value
                .split(',')
                .map(condition => condition.trim())
                .filter(condition => condition.length > 0);

            const formData = {
                dietary_restrictions: dietaryRestrictions,
                allergies: allergies,
                health_conditions: healthConditions
            };

            await this.updateProfile(formData);
            this.showMessage('✅ Dietary information saved successfully!', 'success');

        } catch (error) {
            console.error('Error saving dietary info:', error);
            this.showMessage('Failed to save dietary information. Please try again.', 'error');
        }
    }

    // Update profile in database
    async updateProfile(updates) {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            // Check if user profile exists
            const { data: existingData } = await supabase
                .from('users')
                .select('id')
                .eq('id', userId)
                .single();

            let result;
            if (existingData) {
                // Update existing profile
                result = await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', userId)
                    .select()
                    .single();
            } else {
                // Insert new profile
                result = await supabase
                    .from('users')
                    .insert([{
                        id: userId,
                        email: authManager.getCurrentUser().email,
                        ...updates
                    }])
                    .select()
                    .single();
            }

            if (result.error) {
                throw result.error;
            }

            // Update current profile
            this.currentProfile = { ...this.currentProfile, ...updates };
            
            return result.data;

        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
    }

    // Upload profile picture
    async uploadProfilePicture(file) {
        try {
            // Validate file
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                throw new Error('File size must be less than 5MB');
            }

            if (!file.type.startsWith('image/')) {
                throw new Error('Please select an image file');
            }

            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;
            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}/profile.${fileExt}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('profile-pictures')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: true
                });

            if (error) {
                throw error;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('profile-pictures')
                .getPublicUrl(fileName);

            // Update profile with new picture URL
            await this.updateProfile({ profile_picture_url: publicUrl });
            this.updateProfilePicture();
            
            this.showMessage('✅ Profile picture uploaded successfully!', 'success');

        } catch (error) {
            console.error('Error uploading profile picture:', error);
            this.showMessage(`Failed to upload picture: ${error.message}`, 'error');
        }
    }

    // Remove profile picture
    async removeProfilePicture() {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            // Remove from storage
            if (this.currentProfile.profile_picture_url) {
                const fileName = `${userId}/profile.jpg`; // Adjust extension as needed
                await supabase.storage
                    .from('profile-pictures')
                    .remove([fileName]);
            }

            // Update profile
            await this.updateProfile({ profile_picture_url: null });
            this.updateProfilePicture();
            
            this.showMessage('✅ Profile picture removed successfully!', 'success');

        } catch (error) {
            console.error('Error removing profile picture:', error);
            this.showMessage('Failed to remove picture. Please try again.', 'error');
        }
    }

    // Calculate BMI and calorie goals
    calculateBMIAndCalories() {
        const height = parseFloat(document.getElementById('height').value);
        const weight = parseFloat(document.getElementById('weight').value);
        const activityLevel = document.getElementById('activityLevel').value;
        const gender = document.getElementById('gender').value;
        const dateOfBirth = document.getElementById('dateOfBirth').value;

        // Calculate BMI
        let bmi = null;
        if (height && weight) {
            const heightInMeters = height / 100;
            bmi = weight / (heightInMeters * heightInMeters);
            this.profileStats.bmi = bmi;
        }

        // Calculate age from date of birth
        let age = null;
        if (dateOfBirth) {
            const today = new Date();
            const birthDate = new Date(dateOfBirth);
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        // Calculate calorie goal using Harris-Benedict equation
        let calorieGoal = null;
        if (height && weight && age && gender && activityLevel) {
            let bmr;
            if (gender === 'male') {
                bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
            } else if (gender === 'female') {
                bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
            }

            if (bmr) {
                const activityMultipliers = {
                    'sedentary': 1.2,
                    'lightly_active': 1.375,
                    'moderately_active': 1.55,
                    'very_active': 1.725,
                    'extremely_active': 1.9
                };
                
                calorieGoal = Math.round(bmr * (activityMultipliers[activityLevel] || 1.2));
                this.profileStats.calorieGoal = calorieGoal;
            }
        }

        // Update display
        document.getElementById('bmiValue').textContent = 
            bmi ? bmi.toFixed(1) : '-';
        document.getElementById('calorieGoal').textContent = 
            calorieGoal ? calorieGoal : '-';
    }

    // Load profile statistics
    async loadProfileStats() {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            // Get meal plans count
            const { count: mealPlansCount } = await supabase
                .from('meal_plans')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            // Get orders count
            const { count: ordersCount } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', userId);

            this.profileStats.mealPlans = mealPlansCount || 0;
            this.profileStats.orders = ordersCount || 0;

            // Update display
            document.getElementById('mealPlansCount').textContent = this.profileStats.mealPlans;
            document.getElementById('ordersCount').textContent = this.profileStats.orders;

        } catch (error) {
            console.error('Error loading profile stats:', error);
        }
    }

    // Export profile data
    async exportProfile() {
        try {
            const exportData = {
                profile: this.currentProfile,
                stats: this.profileStats,
                exportedAt: new Date().toISOString()
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `meal-planner-profile-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            window.URL.revokeObjectURL(url);

            this.showMessage('✅ Profile data exported successfully!', 'success');

        } catch (error) {
            console.error('Error exporting profile:', error);
            this.showMessage('Failed to export profile data.', 'error');
        }
    }

    // Show delete confirmation
    showDeleteConfirmation() {
        document.getElementById('deleteModal').classList.remove('hidden');
    }

    // Close delete modal
    closeDeleteModal() {
        document.getElementById('deleteModal').classList.add('hidden');
    }

    // Delete account
    async deleteAccount() {
        try {
            if (!confirm('Type "DELETE" to confirm account deletion:')) {
                return;
            }

            const confirmation = prompt('Type "DELETE" to confirm:');
            if (confirmation !== 'DELETE') {
                this.showMessage('Account deletion cancelled.', 'info');
                return;
            }

            const supabase = authManager.getSupabase();
            
            // Delete user account (this will cascade delete all related data)
            const { error } = await supabase.auth.admin.deleteUser(
                authManager.getCurrentUser().id
            );

            if (error) {
                throw error;
            }

            // Sign out and redirect
            await authManager.signOut();
            
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showMessage('Failed to delete account. Please contact support.', 'error');
        }
    }

    // Utility functions
    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        messageDiv.innerHTML = `${icon} ${message}`;
        
        messagesContainer.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Initialize profile manager
let profileManager;

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (authManager && authManager.getCurrentUser()) {
            profileManager = new ProfileManager();
        }
    }, 200);
});
