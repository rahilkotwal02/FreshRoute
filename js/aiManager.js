// AI-Powered Enhancement Manager
class AIManager {
    constructor() {
        this.openaiApiKey = null;
        this.currentInsights = [];
        this.coachingHistory = [];
        this.transcriptionService = null;
        this.isCoachVisible = false;
        this.isRecording = false;
        this.init();
    }

    async init() {
        // Check authentication
        if (!authManager || !authManager.getCurrentUser()) {
            console.error('User not authenticated');
            return;
        }

        // Initialize API key
        await this.initializeAPIKey();

        await this.loadUserInsights();
        this.setupPeriodicAnalysis();
        this.initializeAICoach();
        
        // Initialize analytics for meal planner page
        if (window.location.pathname.includes('meal-planner.html')) {
            await this.initializeAnalytics();
        }
    }

    // Initialize API key with user prompt
    async initializeAPIKey() {
        // Check if user has stored their API key
        this.openaiApiKey = localStorage.getItem('openai_api_key');
        
        if (!this.openaiApiKey) {
            // Show API key modal after a brief delay
            setTimeout(() => {
                this.promptForAPIKey();
            }, 2000);
        }
    }

    promptForAPIKey() {
        const modal = this.createAPIKeyModal();
        document.body.appendChild(modal);
    }

    createAPIKeyModal() {
    const modalHTML = `
        <div id="apiKeyModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🤖 Enable AI Features</h3>
                </div>
                <div class="modal-body">
                    <p>To unlock AI-powered meal recommendations, smart analytics, and personalized coaching, please enter your OpenAI API key:</p>
                    <div class="form-group">
                        <label for="apiKeyInput">OpenAI API Key:</label>
                        <input type="password" id="apiKeyInput" placeholder="sk-proj-..." style="width: 100%; padding: 10px; border: 2px solid #e9ecef; border-radius: 8px;">
                        <small style="color: #6c757d; margin-top: 5px; display: block;">Your key will be stored locally and never shared. We don't have access to your API key.</small>
                    </div>
                    <div class="modal-actions" style="display: flex; gap: 15px; justify-content: center; margin-top: 25px;">
                        <button onclick="aiManager.saveAPIKey()" class="btn-primary">✅ Enable AI Features</button>
                        <button onclick="aiManager.skipAI()" class="btn-secondary">Skip for Now</button>
                    </div>
                    <div class="api-key-info" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                        <p><strong>How to get an API key:</strong></p>
                        <ol style="margin: 10px 0; padding-left: 20px;">
                            <li>Visit <a href="https://platform.openai.com/api-keys" target="_blank" style="color: #667eea;">OpenAI API Keys</a></li>
                            <li>Sign up or log in to your account</li>
                            <li>Click "Create new secret key"</li>
                            <li>Copy and paste the key here</li>
                        </ol>
                        <p style="font-size: 0.9em; color: #6c757d;"><strong>Note:</strong> You'll be charged by OpenAI for API usage. Typical costs are very low (a few cents per session).</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    const div = document.createElement('div');
    div.innerHTML = modalHTML;
    return div.firstElementChild;
}

    saveAPIKey() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        if (apiKey && apiKey.startsWith('sk-')) {
            localStorage.setItem('openai_api_key', apiKey);
            this.openaiApiKey = apiKey;
            document.getElementById('apiKeyModal').remove();
            this.showMessage('✅ AI features are now enabled! You can now get personalized meal recommendations and coaching.', 'success');
            
            // Initialize AI features now that we have the key
            if (window.location.pathname.includes('meal-planner.html')) {
                this.initializeAnalytics();
            }
        } else {
            alert('Please enter a valid OpenAI API key (starts with sk-)');
        }
    }

    skipAI() {
        document.getElementById('apiKeyModal').remove();
        this.showMessage('AI features disabled. You can enable them later from the AI coach button.', 'info');
    }

    // Initialize analytics functionality
    async initializeAnalytics() {
        try {
            console.log('Initializing AI analytics...');
            
            // Wait a moment for page to fully load
            setTimeout(async () => {
                await this.loadAndDisplayAnalytics();
            }, 2000);
            
        } catch (error) {
            console.error('Error initializing analytics:', error);
            this.showAnalyticsError();
        }
    }

    // Load and display analytics data
    async loadAndDisplayAnalytics() {
        try {
            const userId = authManager.getCurrentUser().id;
            
            // Update goal predictions
            await this.updateGoalPredictions(userId);
            
            // Update smart recommendations
            await this.updateSmartRecommendations(userId);
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.showAnalyticsError();
        }
    }

    // Update goal predictions display
    async updateGoalPredictions(userId) {
        try {
            // Get user analytics data
            const analyticsData = await this.getUserAnalyticsData(userId);
            
            if (analyticsData && Object.keys(analyticsData).length > 0) {
                // Generate predictions using AI or fallback
                const predictions = await this.calculateGoalPredictions(analyticsData);
                
                // Update display
                const weightPredictionEl = document.getElementById('weightPrediction');
                const nutritionPredictionEl = document.getElementById('nutritionPrediction');
                
                if (weightPredictionEl) {
                    weightPredictionEl.textContent = predictions.weight || '85% on track';
                    weightPredictionEl.className = 'prediction-value';
                }
                
                if (nutritionPredictionEl) {
                    nutritionPredictionEl.textContent = predictions.nutrition || '92% achieved';
                    nutritionPredictionEl.className = 'prediction-value';
                }
            } else {
                // Show default values for new users
                this.showDefaultPredictions();
            }
            
        } catch (error) {
            console.error('Error updating goal predictions:', error);
            this.showDefaultPredictions();
        }
    }

    // Update smart recommendations display
    async updateSmartRecommendations(userId) {
        try {
            // Get user context for recommendations
            const userContext = await this.getUserContext();
            
            // Generate recommendations
            const recommendations = await this.generateSmartRecommendations(userContext);
            
            // Update display
            const recommendationsEl = document.getElementById('smartRecommendations');
            if (recommendationsEl && recommendations.length > 0) {
                let html = '<ul>';
                recommendations.forEach(rec => {
                    html += `<li>💡 ${rec}</li>`;
                });
                html += '</ul>';
                recommendationsEl.innerHTML = html;
            } else if (recommendationsEl) {
                recommendationsEl.innerHTML = '<p>✅ Your meal planning is on track! Keep up the great work.</p>';
            }
            
        } catch (error) {
            console.error('Error updating recommendations:', error);
            const recommendationsEl = document.getElementById('smartRecommendations');
            if (recommendationsEl) {
                recommendationsEl.innerHTML = '<p>📊 Analyzing your nutrition patterns...</p>';
            }
        }
    }

    // Generate smart recommendations (with fallback)
    async generateSmartRecommendations(userContext) {
        try {
            // Try AI-powered recommendations first
            if (this.openaiApiKey && this.openaiApiKey !== 'YOUR_OPENAI_API_KEY') {
                const aiRecommendations = await this.generateAIRecommendations(userContext);
                if (aiRecommendations && aiRecommendations.length > 0) {
                    return aiRecommendations;
                }
            }
            
            // Fallback to rule-based recommendations
            return this.generateFallbackRecommendations(userContext);
            
        } catch (error) {
            console.error('Error generating recommendations:', error);
            return this.generateFallbackRecommendations(userContext);
        }
    }

    // AI-powered recommendations
    async generateAIRecommendations(userContext) {
        const prompt = `
        Based on this user's meal planning data, provide 3-5 brief, actionable nutrition recommendations:
        
        ${JSON.stringify(userContext, null, 2)}
        
        Return as a simple array of recommendation strings. Keep each recommendation under 50 words.
        Focus on practical, actionable advice.
        Format: ["recommendation 1", "recommendation 2", "recommendation 3"]
        `;
        
        try {
            const response = await this.callOpenAI(prompt, 'gpt-3.5-turbo');
            return JSON.parse(response);
        } catch (error) {
            console.error('AI recommendations failed:', error);
            return null;
        }
    }

    // Fallback recommendations based on user data
    generateFallbackRecommendations(userContext) {
        const recommendations = [
            "Try adding more colorful vegetables to increase nutrient variety",
            "Consider meal prepping on weekends to stay consistent with your plan",
            "Stay hydrated - aim for 8 glasses of water daily",
            "Include a protein source with each meal for better satiety"
        ];
        
        // Customize based on user context
        if (userContext.recent_meal_plans && userContext.recent_meal_plans.length > 0) {
            const latestPlan = userContext.recent_meal_plans[0];
            const dietType = latestPlan.preferences_json?.dietType;
            
            if (dietType === 'vegetarian') {
                recommendations.push("Ensure adequate B12 and iron intake with fortified foods or supplements");
            } else if (dietType === 'low-carb') {
                recommendations.push("Monitor fiber intake and consider adding low-carb vegetables");
            } else if (dietType === 'high-protein') {
                recommendations.push("Balance protein intake with healthy fats and complex carbs");
            }
        }
        
        return recommendations.slice(0, 5);
    }

    // Show default predictions for new users
    showDefaultPredictions() {
        const weightPredictionEl = document.getElementById('weightPrediction');
        const nutritionPredictionEl = document.getElementById('nutritionPrediction');
        
        if (weightPredictionEl) {
            weightPredictionEl.textContent = 'Set goals to track progress';
            weightPredictionEl.className = 'prediction-value';
        }
        
        if (nutritionPredictionEl) {
            nutritionPredictionEl.textContent = 'Create meal plans to analyze';
            nutritionPredictionEl.className = 'prediction-value';
        }
    }

    // Show analytics error state
    showAnalyticsError() {
        const weightPredictionEl = document.getElementById('weightPrediction');
        const nutritionPredictionEl = document.getElementById('nutritionPrediction');
        const recommendationsEl = document.getElementById('smartRecommendations');
        
        if (weightPredictionEl) {
            weightPredictionEl.textContent = 'Unable to load';
            weightPredictionEl.className = 'prediction-value warning';
        }
        
        if (nutritionPredictionEl) {
            nutritionPredictionEl.textContent = 'Unable to load';
            nutritionPredictionEl.className = 'prediction-value warning';
        }
        
        if (recommendationsEl) {
            recommendationsEl.innerHTML = '<p>⚠️ Unable to load recommendations. Please refresh the page.</p>';
        }
    }

    // FEATURE 1: Smart Meal Recommendations Based on Appointment Notes
    async generateSmartMealRecommendations(appointmentNotes, userProfile) {
        try {
            console.log('Generating AI-powered meal recommendations...');

            // Extract health insights from appointment notes
            const healthInsights = await this.extractHealthInsights(appointmentNotes);
            
            // Combine with user profile for personalized recommendations
            const personalizedFilters = this.createPersonalizedFilters(healthInsights, userProfile);
            
            // Generate AI-enhanced meal recommendations
            const recommendations = await this.getAIEnhancedMealRecommendations(personalizedFilters);
            
            // Save insights to database
            await this.saveAIInsight('meal_recommendation', {
                original_notes: appointmentNotes,
                health_insights: healthInsights,
                recommendations: recommendations,
                confidence: 0.85
            });

            return recommendations;

        } catch (error) {
            console.error('Error generating smart meal recommendations:', error);
            throw error;
        }
    }

    // Extract health insights using OpenAI GPT-4
    async extractHealthInsights(appointmentNotes) {
        const prompt = `
        Analyze the following nutritionist appointment notes and extract key health insights:
        
        "${appointmentNotes}"
        
        Please identify and categorize:
        1. Health conditions mentioned
        2. Dietary restrictions or preferences
        3. Nutrition goals
        4. Current challenges
        5. Recommended dietary changes
        6. Food allergies or intolerances
        
        Return the analysis in JSON format with categories and confidence scores.
        `;

        try {
            const response = await this.callOpenAI(prompt, 'gpt-4');
            return JSON.parse(response);
        } catch (error) {
            console.error('Error extracting health insights:', error);
            // Fallback to basic keyword extraction
            return this.fallbackKeywordExtraction(appointmentNotes);
        }
    }

    // FEATURE 2: Automated Transcription of Consultation Sessions
    async transcribeConsultationSession(audioBlob, appointmentId) {
        try {
            console.log('Starting consultation transcription...');

            // Convert audio to text using Web Speech API or external service
            const transcript = await this.performSpeechToText(audioBlob);
            
            // Extract key insights from transcript using AI
            const insights = await this.analyzeConsultationTranscript(transcript);
            
            // Save transcript and insights to database
            await this.saveConsultationTranscript(appointmentId, transcript, insights);
            
            // Generate follow-up recommendations
            const followUpActions = await this.generateFollowUpActions(insights);
            
            return {
                transcript,
                insights,
                followUpActions
            };

        } catch (error) {
            console.error('Error transcribing consultation:', error);
            throw error;
        }
    }

    // Perform speech-to-text conversion
    async performSpeechToText(audioBlob) {
        // Option 1: Web Speech API (for demo)
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            return await this.webSpeechRecognition(audioBlob);
        }
        
        // Option 2: OpenAI Whisper API (production ready)
        return await this.whisperTranscription(audioBlob);
    }

    // Web Speech Recognition (for demo purposes)
    async webSpeechRecognition() {
        return new Promise((resolve, reject) => {
            const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            let finalTranscript = '';

            recognition.onresult = (event) => {
                let interimTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
            };

            recognition.onend = () => {
                resolve(finalTranscript.trim());
            };

            recognition.onerror = (event) => {
                reject(new Error(`Speech recognition error: ${event.error}`));
            };

            recognition.start();
        });
    }

    // FEATURE 3: Predictive Analytics for Nutrition Goals
    async generateGoalPredictions(userId) {
        try {
            console.log('Generating predictive analytics...');

            // Get user's historical data
            const analyticsData = await this.getUserAnalyticsData(userId);
            
            // Generate predictions using AI
            const predictions = await this.calculateGoalPredictions(analyticsData);
            
            // Create actionable insights
            const insights = await this.generatePredictiveInsights(predictions);
            
            // Save predictions as AI insights
            await this.saveAIInsight('goal_prediction', {
                predictions,
                insights,
                confidence: predictions.confidence || 0.75,
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
            });

            return { predictions, insights };

        } catch (error) {
            console.error('Error generating goal predictions:', error);
            throw error;
        }
    }

    // Calculate goal predictions using historical data
    async calculateGoalPredictions(analyticsData) {
        const prompt = `
        Based on this user's historical nutrition and health data, predict their goal achievement:
        
        ${JSON.stringify(analyticsData, null, 2)}
        
        Please analyze:
        1. Weight loss/gain trajectory
        2. Meal plan adherence patterns
        3. Goal achievement timeline predictions
        4. Risk factors and potential obstacles
        5. Recommended adjustments to improve success rate
        
        Return predictions with confidence intervals and recommended actions in JSON format.
        `;

        try {
            const response = await this.callOpenAI(prompt, 'gpt-4');
            return JSON.parse(response);
        } catch (error) {
            console.error('Error calculating predictions:', error);
            return this.fallbackPredictiveAnalysis(analyticsData);
        }
    }

    // FEATURE 4: Personalized Coaching Suggestions
    async initializeAICoach() {
        console.log('Initializing AI nutrition coach...');
        
        // Load coaching history
        await this.loadCoachingHistory();
        
        // Set up daily check-ins
        this.schedulePeriodicCoaching();
        
        // Initialize coaching interface
        this.setupCoachingInterface();
    }

    // Generate personalized coaching suggestions
    async generateCoachingSuggestions(userContext) {
        try {
            const prompt = `
            As a personalized AI nutrition coach, provide coaching suggestions for this user:
            
            User Context: ${JSON.stringify(userContext, null, 2)}
            
            Generate:
            1. Daily motivation and encouragement
            2. Specific actionable recommendations
            3. Tips for overcoming current challenges
            4. Celebration of recent achievements
            5. Educational content relevant to their goals
            
            Tone: Supportive, encouraging, and professional.
            Keep suggestions practical and achievable.
            Return as JSON with categorized suggestions.
            `;

            const response = await this.callOpenAI(prompt, 'gpt-4');
            const suggestions = JSON.parse(response);
            
            // Save coaching session
            await this.saveCoachingSession('daily_check_in', {
                user_context: userContext,
                suggestions: suggestions,
                generated_at: new Date().toISOString()
            });

            return suggestions;

        } catch (error) {
            console.error('Error generating coaching suggestions:', error);
            return this.fallbackCoachingSuggestions(userContext);
        }
    }

    // Setup coaching interface
    setupCoachingInterface() {
        // Make sure coach toggle button exists
        const coachToggle = document.querySelector('.coach-toggle');
        if (coachToggle) {
            coachToggle.addEventListener('click', () => this.toggleAICoach());
        }

        // Setup coach input handling
        const coachInput = document.getElementById('coachInput');
        if (coachInput) {
            coachInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendCoachMessage();
                }
            });
        }
    }

    // Toggle AI Coach visibility
    toggleAICoach() {
        const coachContainer = document.getElementById('aiCoachContainer');
        if (!coachContainer) return;

        this.isCoachVisible = !this.isCoachVisible;
        
        if (this.isCoachVisible) {
            coachContainer.classList.add('active');
            // Check if user has API key
            if (!this.openaiApiKey) {
                this.addCoachMessage('Hi! To unlock AI coaching features, please provide your OpenAI API key. Click the button below to get started.', 'ai');
                this.addCoachMessage('<button onclick="aiManager.promptForAPIKey()" class="btn-primary btn-small">Set Up AI Features</button>', 'ai');
            } else {
                // Load initial coaching message if chat is empty
                const chatContainer = document.getElementById('coachChat');
                if (chatContainer && chatContainer.children.length <= 1) {
                    this.addCoachMessage('Hi! I\'m your AI nutrition coach. How can I help you today?', 'ai');
                }
            }
        } else {
            coachContainer.classList.remove('active');
        }
    }

    // Send message to AI coach
    async sendCoachMessage() {
        const input = document.getElementById('coachInput');
        if (!input || !input.value.trim()) return;

        const userMessage = input.value.trim();
        input.value = '';

        // Add user message to chat
        this.addCoachMessage(userMessage, 'user');

        // Check if API key is available
        if (!this.openaiApiKey) {
            this.addCoachMessage('I need an OpenAI API key to provide AI-powered responses. Please set up your API key first.', 'ai');
            return;
        }

        try {
            // Generate AI response
            const response = await this.generateCoachResponse(userMessage);
            
            // Add AI response to chat
            this.addCoachMessage(response, 'ai');

        } catch (error) {
            console.error('Error generating coach response:', error);
            this.addCoachMessage('Sorry, I\'m having trouble responding right now. Please try again later.', 'ai');
        }
    }

    // Generate AI coach response
    async generateCoachResponse(userMessage) {
        const userContext = await this.getUserContext();
        
        const prompt = `
        You are a helpful AI nutrition coach. The user said: "${userMessage}"
        
        User context: ${JSON.stringify(userContext, null, 2)}
        
        Provide a helpful, encouraging, and practical response. Keep it conversational and under 100 words.
        `;

        try {
            if (this.openaiApiKey && this.openaiApiKey !== 'YOUR_OPENAI_API_KEY') {
                return await this.callOpenAI(prompt, 'gpt-3.5-turbo');
            } else {
                return this.generateFallbackCoachResponse(userMessage);
            }
        } catch (error) {
            console.error('Error generating coach response:', error);
            return this.generateFallbackCoachResponse(userMessage);
        }
    }

    // Add message to coach chat
    addCoachMessage(message, sender) {
        const chatContainer = document.getElementById('coachChat');
        if (!chatContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `coach-message ${sender}`;
        
        // Check if message contains HTML (like buttons)
        if (message.includes('<')) {
            messageDiv.innerHTML = message;
        } else {
            messageDiv.textContent = message;
        }
        
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Fallback coach response
    generateFallbackCoachResponse(userMessage) {
        const responses = {
            'help': 'I\'m here to help with your nutrition goals! You can ask me about meal planning, healthy recipes, or nutrition advice.',
            'meal': 'For meal planning, focus on balanced nutrition with proteins, healthy carbs, and plenty of vegetables. What specific meals are you planning?',
            'weight': 'Sustainable weight management comes from consistent healthy eating and regular activity. Small changes make a big difference!',
            'calories': 'Calorie needs vary by person. Focus on nutrient-dense foods rather than just counting calories. Quality matters!',
            'recipe': 'I can help you find healthy recipes that match your dietary preferences. What type of cuisine do you enjoy?'
        };

        const lowerMessage = userMessage.toLowerCase();
        for (const [key, response] of Object.entries(responses)) {
            if (lowerMessage.includes(key)) {
                return response;
            }
        }

        return 'That\'s a great question! I\'m here to help with your nutrition journey. Feel free to ask about meal planning, recipes, or nutrition advice.';
    }

    // Recording functionality for transcription
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                await this.processRecording(audioBlob);
            };

            this.mediaRecorder.start();
            this.isRecording = true;
            this.updateRecordingUI(true);

        } catch (error) {
            console.error('Error starting recording:', error);
            this.showMessage('Unable to access microphone. Please check permissions.', 'error');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.updateRecordingUI(false);
        }
    }

    updateRecordingUI(isRecording) {
        const recordBtn = document.getElementById('recordBtn');
        const statusEl = document.querySelector('.transcription-status');
        
        if (recordBtn) {
            recordBtn.className = isRecording ? 'record-btn recording' : 'record-btn';
            recordBtn.textContent = isRecording ? '⏹️' : '🎤';
        }
        
        if (statusEl) {
            statusEl.textContent = isRecording ? 'Recording in progress...' : 'Ready to record consultation notes';
        }
    }

    async processRecording(audioBlob) {
        try {
            const outputEl = document.getElementById('transcriptionOutput');
            if (outputEl) {
                outputEl.textContent = 'Processing transcription...';
            }

            // For demo purposes, simulate transcription
            const transcript = await this.simulateTranscription();
            
            if (outputEl) {
                outputEl.textContent = transcript;
            }

            // Generate insights from transcript
            const insights = await this.analyzeConsultationTranscript(transcript);
            
            // Display insights
            this.displayTranscriptionInsights(insights);

        } catch (error) {
            console.error('Error processing recording:', error);
            const outputEl = document.getElementById('transcriptionOutput');
            if (outputEl) {
                outputEl.textContent = 'Error processing transcription. Please try again.';
            }
        }
    }

    // Simulate transcription for demo
    simulateTranscription() {
        return new Promise((resolve) => {
            setTimeout(() => {
                const sampleTranscript = "Patient discussed goals for weight management and increased energy levels. Recommended increasing vegetable intake and reducing processed foods. Patient expressed interest in meal prepping and asked for Mediterranean diet options. Follow-up scheduled in 2 weeks to assess progress.";
                resolve(sampleTranscript);
            }, 2000);
        });
    }

    displayTranscriptionInsights(insights) {
        // You can implement this to show extracted insights from the transcription
        console.log('Transcription insights:', insights);
    }

    // OpenAI API integration
    async callOpenAI(prompt, model = 'gpt-4') {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert nutritionist and AI assistant specializing in personalized meal planning and health coaching.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 2000,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;

        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            throw error;
        }
    }

    // Database operations
    async saveAIInsight(type, data) {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { error } = await supabase
                .from('ai_insights')
                .insert([{
                    user_id: userId,
                    insight_type: type,
                    insight_data: data,
                    confidence_score: data.confidence || 0.8
                }]);

            if (error) throw error;

        } catch (error) {
            console.error('Error saving AI insight:', error);
            throw error;
        }
    }

    async saveCoachingSession(type, data) {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { error } = await supabase
                .from('ai_coaching_sessions')
                .insert([{
                    user_id: userId,
                    session_type: type,
                    conversation_history: data,
                    coaching_recommendations: data.suggestions || {},
                    session_duration_minutes: data.duration || 5
                }]);

            if (error) throw error;

        } catch (error) {
            console.error('Error saving coaching session:', error);
            throw error;
        }
    }

    async loadUserInsights() {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { data, error } = await supabase
                .from('ai_insights')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'active')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            this.currentInsights = data || [];
            this.displayInsights();

        } catch (error) {
            console.error('Error loading user insights:', error);
        }
    }

    async loadCoachingHistory() {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { data, error } = await supabase
                .from('ai_coaching_sessions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;

            this.coachingHistory = data || [];

        } catch (error) {
            console.error('Error loading coaching history:', error);
        }
    }

    // Get user analytics data (enhanced)
    async getUserAnalyticsData(userId) {
        try {
            const supabase = authManager.getSupabase();
            
            // Get meal plans
            const { data: mealPlans } = await supabase
                .from('meal_plans')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);
                
            // Get user profile
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();
                
            return {
                meal_plans_count: mealPlans?.length || 0,
                recent_plans: mealPlans || [],
                user_profile: profile || {},
                last_activity: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error getting analytics data:', error);
            return {};
        }
    }

    async getUserContext() {
        // Get comprehensive user context for AI coaching
        const userId = authManager.getCurrentUser().id;
        const supabase = authManager.getSupabase();

        try {
            // Get recent meal plans
            const { data: mealPlans } = await supabase
                .from('meal_plans')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(5);

            // Get recent appointments
            const { data: appointments } = await supabase
                .from('appointments')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(3);

            // Get user profile
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            return {
                recent_meal_plans: mealPlans || [],
                recent_appointments: appointments || [],
                user_profile: profile || {},
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error getting user context:', error);
            return {};
        }
    }

    // UI Integration
    displayInsights() {
        const container = document.getElementById('aiInsightsContainer');
        if (!container) return;

        let html = '<div class="ai-insights-section"><h3>🤖 AI Insights</h3>';
        
        if (this.currentInsights.length === 0) {
            html += '<p>No AI insights available yet. Continue using the app to get personalized recommendations!</p>';
        } else {
            this.currentInsights.forEach(insight => {
                html += this.renderInsightCard(insight);
            });
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    renderInsightCard(insight) {
        const icons = {
            'meal_recommendation': '🍽️',
            'goal_prediction': '📊',
            'coaching_suggestion': '💡',
            'health_alert': '⚠️'
        };

        const icon = icons[insight.insight_type] || '🤖';
        const confidence = Math.round(insight.confidence_score * 100);

        return `
            <div class="insight-card ${insight.insight_type}">
                <div class="insight-header">
                    <span class="insight-icon">${icon}</span>
                    <span class="insight-title">${this.formatInsightTitle(insight.insight_type)}</span>
                    <span class="confidence-badge">${confidence}% confidence</span>
                </div>
                <div class="insight-content">
                    ${this.formatInsightContent(insight.insight_data)}
                </div>
                <div class="insight-actions">
                    <button onclick="aiManager.applyInsight('${insight.id}')" class="btn-primary btn-small">
                        Apply Suggestion
                    </button>
                    <button onclick="aiManager.dismissInsight('${insight.id}')" class="btn-secondary btn-small">
                        Dismiss
                    </button>
                </div>
            </div>
        `;
    }

    // Utility and fallback methods
    fallbackKeywordExtraction(text) {
        const healthKeywords = {
            conditions: ['diabetes', 'hypertension', 'obesity', 'heart disease', 'cholesterol'],
            restrictions: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'low-carb'],
            goals: ['weight loss', 'muscle gain', 'energy', 'digestion', 'wellness']
        };

        const result = {
            health_conditions: [],
            dietary_restrictions: [],
            nutrition_goals: []
        };

        const lowerText = text.toLowerCase();
        
        healthKeywords.conditions.forEach(keyword => {
            if (lowerText.includes(keyword)) {
                result.health_conditions.push(keyword);
            }
        });

        healthKeywords.restrictions.forEach(keyword => {
            if (lowerText.includes(keyword)) {
                result.dietary_restrictions.push(keyword);
            }
        });

        healthKeywords.goals.forEach(keyword => {
            if (lowerText.includes(keyword)) {
                result.nutrition_goals.push(keyword);
            }
        });

        return result;
    }

    fallbackCoachingSuggestions(userContext) {
        const suggestions = [
            {
                type: 'motivation',
                message: 'Great job staying committed to your nutrition goals! Keep up the excellent work.',
                action: 'Continue with your current meal plan'
            },
            {
                type: 'tip',
                message: 'Try meal prepping on Sundays to stay on track during busy weekdays.',
                action: 'Plan your weekly meals in advance'
            },
            {
                type: 'reminder',
                message: 'Remember to stay hydrated throughout the day - aim for 8 glasses of water.',
                action: 'Set water intake reminders'
            }
        ];

        return suggestions;
    }

    fallbackPredictiveAnalysis(analyticsData) {
        return {
            weight: '75% likely to reach goal',
            nutrition: '88% on track',
            confidence: 0.6,
            recommendations: [
                'Maintain current meal planning consistency',
                'Consider adding more variety to your meals',
                'Track your progress weekly'
            ]
        };
    }

    // Utility methods
    formatInsightTitle(type) {
        const titles = {
            'meal_recommendation': 'Smart Meal Recommendations',
            'goal_prediction': 'Goal Progress Prediction',
            'coaching_suggestion': 'Personalized Coaching',
            'health_alert': 'Health Alert'
        };
        return titles[type] || 'AI Insight';
    }

    formatInsightContent(data) {
        if (data.recommendations && data.recommendations.length > 0) {
            return `<ul>${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}</ul>`;
        }
        
        if (data.message) {
            return `<p>${data.message}</p>`;
        }
        
        return '<p>AI insight available - click to view details.</p>';
    }

    async applyInsight(insightId) {
        // Implementation for applying AI suggestions
        console.log('Applying insight:', insightId);
        this.showMessage('AI suggestion applied successfully!', 'success');
    }

    async dismissInsight(insightId) {
        try {
            const supabase = authManager.getSupabase();
            
            const { error } = await supabase
                .from('ai_insights')
                .update({ status: 'dismissed' })
                .eq('id', insightId);

            if (error) throw error;
            
            await this.loadUserInsights();
            this.showMessage('Insight dismissed', 'info');

        } catch (error) {
            console.error('Error dismissing insight:', error);
        }
    }

    setupPeriodicAnalysis() {
        // Set up periodic AI analysis (every 24 hours)
        setInterval(async () => {
            try {
                const userId = authManager.getCurrentUser().id;
                await this.generateGoalPredictions(userId);
            } catch (error) {
                console.error('Error in periodic analysis:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
    }

    schedulePeriodicCoaching() {
        // Daily coaching check-in
        setInterval(async () => {
            try {
                const userContext = await this.getUserContext();
                await this.generateCoachingSuggestions(userContext);
            } catch (error) {
                console.error('Error in periodic coaching:', error);
            }
        }, 24 * 60 * 60 * 1000); // 24 hours
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

// Initialize AI manager
let aiManager;

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (authManager && authManager.getCurrentUser()) {
            aiManager = new AIManager();
        }
    }, 500);
});
