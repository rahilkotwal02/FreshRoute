// Appointment management system with video consultation and payment processing
class AppointmentManager {
    constructor() {
        this.nutritionists = [];
        this.filteredNutritionists = [];
        this.selectedNutritionist = null;
        this.selectedDateTime = null;
        this.userAppointments = [];
        this.currentTab = 'upcoming';
        
        // Stripe configuration (replace with your publishable key)
        this.stripe = window.Stripe ? window.Stripe('pk_test_your_stripe_publishable_key_here') : null;
        
        // Video call configuration
        this.videoCall = {
            localStream: null,
            remoteStream: null,
            peerConnection: null,
            isCallActive: false
        };
        
        this.init();
    }

    async init() {
        // Check authentication
        if (!authManager || !authManager.getCurrentUser()) {
            console.error('User not authenticated');
            return;
        }

        await this.loadNutritionists();
        this.setupEventListeners();
        this.setMinDate();
    }

    // Setup event listeners
    setupEventListeners() {
        // Appointment type change
        document.getElementById('appointmentType')?.addEventListener('change', (e) => {
            this.updateDurationAndPrice();
        });

        // Date change
        document.getElementById('appointmentDate')?.addEventListener('change', (e) => {
            this.loadAvailableTimeSlots(e.target.value);
        });

        // Booking form submit
        document.getElementById('appointmentBookingForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processPayment();
        });
    }

    // Set minimum date to today
    setMinDate() {
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('appointmentDate');
        if (dateInput) {
            dateInput.min = today;
        }
    }

    // Load nutritionists from database
    async loadNutritionists() {
        try {
            const supabase = authManager.getSupabase();
            
            const { data, error } = await supabase
                .from('nutritionists')
                .select('*')
                .eq('is_active', true)
                .eq('is_verified', true)
                .order('rating', { ascending: false });

            if (error) throw error;

            this.nutritionists = data || [];
            this.filteredNutritionists = [...this.nutritionists];
            this.displayNutritionists();

        } catch (error) {
            console.error('Error loading nutritionists:', error);
            this.showMessage('Failed to load nutritionists. Please refresh the page.', 'error');
        }
    }

    // Display nutritionists
    displayNutritionists() {
        const container = document.getElementById('nutritionistsList');
        if (!container) return;

        if (this.filteredNutritionists.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>No nutritionists found</h3>
                    <p>Try adjusting your search filters</p>
                </div>
            `;
            return;
        }

        let html = '';
        this.filteredNutritionists.forEach(nutritionist => {
            html += this.renderNutritionistCard(nutritionist);
        });

        container.innerHTML = html;
    }

    // Render individual nutritionist card
    renderNutritionistCard(nutritionist) {
        const specializations = nutritionist.specializations.slice(0, 3);
        const languages = nutritionist.languages.join(', ');
        
        return `
            <div class="nutritionist-card">
                <div class="nutritionist-avatar">
                    <img src="${nutritionist.profile_picture_url || 'https://via.placeholder.com/120x120?text=' + nutritionist.full_name.charAt(0)}" 
                         alt="${nutritionist.full_name}" class="avatar-img">
                </div>
                
                <div class="nutritionist-info">
                    <h3 class="nutritionist-name">${nutritionist.full_name}</h3>
                    
                    <div class="nutritionist-rating">
                        ${this.renderStarRating(nutritionist.rating)}
                        <span class="rating-text">${nutritionist.rating} (${nutritionist.total_reviews} reviews)</span>
                    </div>
                    
                    <div class="nutritionist-specializations">
                        ${specializations.map(spec => `<span class="spec-tag">${spec}</span>`).join('')}
                    </div>
                    
                    <div class="nutritionist-details">
                        <div class="detail-item">
                            <span class="detail-icon">🎓</span>
                            <span>${nutritionist.experience_years} years experience</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-icon">🌍</span>
                            <span>${languages}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-icon">💰</span>
                            <span>$${nutritionist.hourly_rate}/hour</span>
                        </div>
                    </div>
                    
                    <div class="nutritionist-bio">
                        <p>${nutritionist.bio}</p>
                    </div>
                    
                    <div class="nutritionist-actions">
                        <button onclick="appointmentManager.bookAppointment('${nutritionist.id}')" class="btn-primary">
                            📅 Book Appointment
                        </button>
                        <button onclick="appointmentManager.viewNutritionistProfile('${nutritionist.id}')" class="btn-secondary">
                            👤 View Profile
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Render star rating
    renderStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 !== 0;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '<span class="star filled">★</span>';
        }
        if (hasHalfStar) {
            stars += '<span class="star half">☆</span>';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '<span class="star empty">☆</span>';
        }
        
        return `<div class="star-rating">${stars}</div>`;
    }

    // Search nutritionists with filters
    searchNutritionists() {
        const specialization = document.getElementById('specializationFilter').value;
        const minRating = parseFloat(document.getElementById('ratingFilter').value) || 0;
        const priceRange = document.getElementById('priceFilter').value;

        this.filteredNutritionists = this.nutritionists.filter(nutritionist => {
            // Specialization filter
            if (specialization && !nutritionist.specializations.includes(specialization)) {
                return false;
            }

            // Rating filter
            if (nutritionist.rating < minRating) {
                return false;
            }

            // Price filter
            if (priceRange) {
                const rate = nutritionist.hourly_rate;
                switch (priceRange) {
                    case '0-50':
                        if (rate > 50) return false;
                        break;
                    case '50-75':
                        if (rate <= 50 || rate > 75) return false;
                        break;
                    case '75-100':
                        if (rate <= 75 || rate > 100) return false;
                        break;
                    case '100+':
                        if (rate <= 100) return false;
                        break;
                }
            }

            return true;
        });

        this.displayNutritionists();
        this.showMessage(`Found ${this.filteredNutritionists.length} nutritionist(s)`, 'info');
    }

    // Book appointment with nutritionist
    bookAppointment(nutritionistId) {
        this.selectedNutritionist = this.nutritionists.find(n => n.id === nutritionistId);
        if (!this.selectedNutritionist) return;

        this.populateBookingModal();
        document.getElementById('bookingModal').classList.remove('hidden');
    }

    // Populate booking modal with nutritionist data
    populateBookingModal() {
        if (!this.selectedNutritionist) return;

        document.getElementById('modalNutritionistName').textContent = this.selectedNutritionist.full_name;
        document.getElementById('modalNutritionistAvatar').src = 
            this.selectedNutritionist.profile_picture_url || 
            'https://via.placeholder.com/120x120?text=' + this.selectedNutritionist.full_name.charAt(0);
        
        // Specializations
        const specsContainer = document.getElementById('modalNutritionistSpecializations');
        specsContainer.innerHTML = this.selectedNutritionist.specializations
            .map(spec => `<span class="spec-tag">${spec}</span>`).join('');
        
        // Rating
        document.getElementById('modalNutritionistRating').innerHTML = 
            this.renderStarRating(this.selectedNutritionist.rating) + 
            ` <span class="rating-text">${this.selectedNutritionist.rating} (${this.selectedNutritionist.total_reviews} reviews)</span>`;
        
        // Rate
        document.getElementById('modalNutritionistRate').innerHTML = 
            `<span class="rate-label">Rate:</span> <span class="rate-value">$${this.selectedNutritionist.hourly_rate}/hour</span>`;
    }

    // Update duration and price based on appointment type
    updateDurationAndPrice() {
        const appointmentType = document.getElementById('appointmentType').value;
        
        const durations = {
            'consultation': 60,
            'follow_up': 30,
            'meal_review': 30,
            'weight_management': 45
        };

        const duration = durations[appointmentType] || 30;
        const price = (this.selectedNutritionist.hourly_rate * duration / 60).toFixed(2);

        document.getElementById('summaryDuration').textContent = `${duration} minutes`;
        document.getElementById('summaryPrice').textContent = `$${price}`;
    }

    // Load available time slots for selected date
    async loadAvailableTimeSlots(selectedDate) {
        try {
            const container = document.getElementById('timeSlots');
            container.innerHTML = '<div class="loading">Loading available slots...</div>';

            // Generate time slots (this would normally come from the nutritionist's schedule)
            const timeSlots = this.generateTimeSlots(selectedDate);
            
            if (timeSlots.length === 0) {
                container.innerHTML = '<p class="no-slots">No available slots for this date</p>';
                return;
            }

            let html = '';
            timeSlots.forEach(slot => {
                html += `
                    <button type="button" 
                            class="time-slot" 
                            onclick="appointmentManager.selectTimeSlot('${slot.datetime}', '${slot.display}')">
                        ${slot.display}
                    </button>
                `;
            });

            container.innerHTML = html;

        } catch (error) {
            console.error('Error loading time slots:', error);
            document.getElementById('timeSlots').innerHTML = 
                '<p class="error">Error loading time slots</p>';
        }
    }

    // Generate available time slots (simplified version)
    generateTimeSlots(selectedDate) {
        const slots = [];
        const date = new Date(selectedDate);
        const today = new Date();
        
        // Don't allow booking in the past
        if (date < today.setHours(0, 0, 0, 0)) {
            return slots;
        }

        // Generate slots from 9 AM to 5 PM
        for (let hour = 9; hour <= 17; hour++) {
            for (let minute = 0; minute < 60; minute += 30) {
                const slotTime = new Date(date);
                slotTime.setHours(hour, minute, 0, 0);
                
                // Don't show past slots for today
                if (slotTime > new Date()) {
                    const timeString = slotTime.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    });
                    
                    slots.push({
                        datetime: slotTime.toISOString(),
                        display: timeString
                    });
                }
            }
        }

        return slots;
    }

    // Select time slot
    selectTimeSlot(datetime, displayTime) {
        // Remove previous selection
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });

        // Add selection to clicked slot
        event.target.classList.add('selected');

        this.selectedDateTime = datetime;
        
        // Update summary
        const selectedDate = document.getElementById('appointmentDate').value;
        const formattedDate = new Date(selectedDate).toLocaleDateString();
        document.getElementById('summaryDateTime').textContent = `${formattedDate} at ${displayTime}`;
    }

    // Process payment using Stripe
    async processPayment() {
        if (!this.validateBookingForm()) {
            return;
        }

        try {
            this.showLoading(true);

            // Create appointment data
            const appointmentData = this.getAppointmentData();
            
            // For now, we'll simulate successful payment
            // In production, you would integrate with Stripe Payment Intents
            const paymentSuccess = await this.simulatePayment(appointmentData);
            
            if (paymentSuccess) {
                // Save appointment to database
                await this.saveAppointment(appointmentData);
                
                this.showMessage('🎉 Appointment booked successfully!', 'success');
                this.closeBookingModal();
                
                // Optionally redirect or refresh
                setTimeout(() => {
                    this.showMyAppointments();
                }, 1500);
            }

        } catch (error) {
            console.error('Error processing payment:', error);
            this.showMessage('Payment failed. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Validate booking form
    validateBookingForm() {
        const appointmentType = document.getElementById('appointmentType').value;
        const consultationMode = document.getElementById('consultationMode').value;
        const appointmentDate = document.getElementById('appointmentDate').value;

        if (!appointmentType) {
            this.showMessage('Please select an appointment type.', 'error');
            return false;
        }

        if (!consultationMode) {
            this.showMessage('Please select a consultation mode.', 'error');
            return false;
        }

        if (!appointmentDate) {
            this.showMessage('Please select a date.', 'error');
            return false;
        }

        if (!this.selectedDateTime) {
            this.showMessage('Please select a time slot.', 'error');
            return false;
        }

        return true;
    }

    // Get appointment data from form
    getAppointmentData() {
        const appointmentType = document.getElementById('appointmentType').value;
        const consultationMode = document.getElementById('consultationMode').value;
        const userNotes = document.getElementById('userNotes').value;

        const durations = {
            'consultation': 60,
            'follow_up': 30,
            'meal_review': 30,
            'weight_management': 45
        };

        const duration = durations[appointmentType];
        const price = (this.selectedNutritionist.hourly_rate * duration / 60).toFixed(2);

        return {
            user_id: authManager.getCurrentUser().id,
            nutritionist_id: this.selectedNutritionist.id,
            appointment_type: appointmentType,
            consultation_mode: consultationMode,
            scheduled_at: this.selectedDateTime,
            duration_minutes: duration,
            user_notes: userNotes,
            price: parseFloat(price),
            status: 'scheduled',
            payment_status: 'paid'
        };
    }

    // Simulate payment (replace with actual Stripe integration)
    async simulatePayment(appointmentData) {
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // For demo purposes, always return success
        // In production, implement actual Stripe Payment Intents here
        return true;
    }

    // Save appointment to database
    async saveAppointment(appointmentData) {
        try {
            const supabase = authManager.getSupabase();

            const { data, error } = await supabase
                .from('appointments')
                .insert([appointmentData])
                .select()
                .single();

            if (error) throw error;

            console.log('Appointment saved:', data);
            return data;

        } catch (error) {
            console.error('Error saving appointment:', error);
            throw error;
        }
    }

    // Show my appointments
    async showMyAppointments() {
        document.getElementById('nutritionistsList').classList.add('hidden');
        document.getElementById('myAppointmentsSection').classList.remove('hidden');
        
        await this.loadUserAppointments();
    }

    // Hide my appointments
    hideMyAppointments() {
        document.getElementById('myAppointmentsSection').classList.add('hidden');
        document.getElementById('nutritionistsList').classList.remove('hidden');
    }

    // Load user appointments
    async loadUserAppointments() {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { data, error } = await supabase
                .from('appointments')
                .select(`
                    *,
                    nutritionists (
                        full_name,
                        profile_picture_url,
                        specializations
                    )
                `)
                .eq('user_id', userId)
                .order('scheduled_at', { ascending: false });

            if (error) throw error;

            this.userAppointments = data || [];
            this.displayUserAppointments();

        } catch (error) {
            console.error('Error loading appointments:', error);
            this.showMessage('Failed to load appointments.', 'error');
        }
    }

    // Display user appointments
    displayUserAppointments() {
        const container = document.getElementById('appointmentsList');
        if (!container) return;

        const now = new Date();
        let filteredAppointments = [];

        switch (this.currentTab) {
            case 'upcoming':
                filteredAppointments = this.userAppointments.filter(apt => 
                    new Date(apt.scheduled_at) > now && 
                    apt.status !== 'cancelled'
                );
                break;
            case 'past':
                filteredAppointments = this.userAppointments.filter(apt => 
                    new Date(apt.scheduled_at) <= now || 
                    apt.status === 'completed'
                );
                break;
            case 'cancelled':
                filteredAppointments = this.userAppointments.filter(apt => 
                    apt.status === 'cancelled'
                );
                break;
        }

        if (filteredAppointments.length === 0) {
            container.innerHTML = `
                <div class="no-appointments">
                    <h3>No ${this.currentTab} appointments</h3>
                    <p>Book your first appointment with a nutritionist!</p>
                </div>
            `;
            return;
        }

        let html = '';
        filteredAppointments.forEach(appointment => {
            html += this.renderAppointmentCard(appointment);
        });

        container.innerHTML = html;
    }

    // Render appointment card
    renderAppointmentCard(appointment) {
        const scheduledDate = new Date(appointment.scheduled_at);
        const nutritionist = appointment.nutritionists;
        const isUpcoming = scheduledDate > new Date() && appointment.status !== 'cancelled';

        return `
            <div class="appointment-card ${appointment.status}">
                <div class="appointment-header">
                    <div class="appointment-nutritionist">
                        <img src="${nutritionist.profile_picture_url || 'https://via.placeholder.com/60x60?text=' + nutritionist.full_name.charAt(0)}" 
                             alt="${nutritionist.full_name}" class="nutritionist-avatar-small">
                        <div class="nutritionist-info-small">
                            <h4>${nutritionist.full_name}</h4>
                            <div class="specializations-small">
                                ${nutritionist.specializations.slice(0, 2).map(spec => 
                                    `<span class="spec-tag-small">${spec}</span>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="appointment-status">
                        <span class="status-badge ${appointment.status}">${appointment.status.replace('_', ' ')}</span>
                    </div>
                </div>

                <div class="appointment-details">
                    <div class="detail-row">
                        <span class="detail-icon">📅</span>
                        <span>${scheduledDate.toLocaleDateString()} at ${scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-icon">⏱️</span>
                        <span>${appointment.duration_minutes} minutes</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-icon">💬</span>
                        <span>${appointment.consultation_mode} consultation</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-icon">💰</span>
                        <span>$${appointment.price}</span>
                    </div>
                </div>

                <div class="appointment-actions">
                    ${isUpcoming ? `
                        ${appointment.consultation_mode === 'video' ? 
                            `<button onclick="appointmentManager.joinVideoCall('${appointment.id}')" class="btn-success">
                                🎥 Join Call
                            </button>` : ''}
                        <button onclick="appointmentManager.rescheduleAppointment('${appointment.id}')" class="btn-info">
                            📅 Reschedule
                        </button>
                        <button onclick="appointmentManager.cancelAppointment('${appointment.id}')" class="btn-danger">
                            ❌ Cancel
                        </button>
                    ` : ''}
                    ${appointment.status === 'completed' ? `
                        <button onclick="appointmentManager.leaveReview('${appointment.id}')" class="btn-primary">
                            ⭐ Leave Review
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Show appointment tab
    showAppointmentTab(tab) {
        this.currentTab = tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.displayUserAppointments();
    }

    // Join video call
    async joinVideoCall(appointmentId) {
        try {
            // In a real implementation, you would:
            // 1. Generate/get meeting room URL
            // 2. Initialize video call SDK (Whereby, Twilio, etc.)
            // 3. Connect to the meeting room
            
            this.showMessage('🎥 Connecting to video call...', 'info');
            
            // For demo purposes, show video call modal
            document.getElementById('videoCallModal').classList.remove('hidden');
            this.initializeVideoCall(appointmentId);
            
        } catch (error) {
            console.error('Error joining video call:', error);
            this.showMessage('Failed to join video call. Please try again.', 'error');
        }
    }

    // Initialize video call (simplified demo version)
    initializeVideoCall(appointmentId) {
        // This is a simplified version for demonstration
        // In production, you would integrate with a video SDK like:
        // - Whereby Embedded
        // - Twilio Video
        // - Agora
        // - Daily.co
        
        const container = document.getElementById('videoCallContainer');
        container.innerHTML = `
            <div class="video-demo">
                <div class="demo-video remote">
                    <h3>👨‍⚕️ Dr. Sarah Johnson</h3>
                    <p>Video call simulation</p>
                    <div class="video-placeholder">📹</div>
                </div>
                <div class="demo-video local">
                    <h4>You</h4>
                    <div class="video-placeholder">📹</div>
                </div>
                <div class="call-status">
                    <p>✅ Connected • Duration: <span id="callTimer">00:00</span></p>
                </div>
            </div>
        `;

        // Start call timer
        this.startCallTimer();
        
        this.videoCall.isCallActive = true;
    }

    // Start call timer
    startCallTimer() {
        let seconds = 0;
        const timer = setInterval(() => {
            if (!this.videoCall.isCallActive) {
                clearInterval(timer);
                return;
            }
            
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            const timerElement = document.getElementById('callTimer');
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    // End video call
    endCall() {
        this.videoCall.isCallActive = false;
        document.getElementById('videoCallModal').classList.add('hidden');
        this.showMessage('📞 Call ended', 'info');
    }

    // Close booking modal
    closeBookingModal() {
        document.getElementById('bookingModal').classList.add('hidden');
        this.selectedNutritionist = null;
        this.selectedDateTime = null;
        
        // Reset form
        document.getElementById('appointmentBookingForm').reset();
        document.getElementById('timeSlots').innerHTML = '<p class="select-date-first">Please select a date first</p>';
    }

    // Cancel appointment
    async cancelAppointment(appointmentId) {
        if (!confirm('Are you sure you want to cancel this appointment?')) {
            return;
        }

        try {
            const supabase = authManager.getSupabase();

            const { error } = await supabase
                .from('appointments')
                .update({ 
                    status: 'cancelled',
                    updated_at: new Date().toISOString()
                })
                .eq('id', appointmentId);

            if (error) throw error;

            this.showMessage('✅ Appointment cancelled successfully', 'success');
            await this.loadUserAppointments();

        } catch (error) {
            console.error('Error cancelling appointment:', error);
            this.showMessage('Failed to cancel appointment. Please try again.', 'error');
        }
    }

    // Utility functions
    showLoading(show) {
        // You can implement a global loading state here
        if (show) {
            this.showMessage('⏳ Processing...', 'info');
        }
    }

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

// Initialize appointment manager
let appointmentManager;

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (authManager && authManager.getCurrentUser()) {
            appointmentManager = new AppointmentManager();
        }
    }, 300);
});
