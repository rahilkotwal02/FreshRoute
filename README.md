# 🍽 FRESH ROUTE - Smart Meal Planner & AI-Powered Nutrition Assistant 

A comprehensive, intelligent meal planning application built with HTML, CSS, JavaScript, and powered by Supabase and OpenAI. This full-featured web application combines personalized meal planning, AI-powered recommendations, grocery list management, and nutritionist consultations all in one seamless platform.

*Transform your nutrition journey with AI-driven insights, smart meal recommendations, and professional nutritionist support.*

---

## 🚀 Features

### 🍳 Intelligent Meal Planning
* *Personalized Preferences:* Set dietary restrictions, cuisine preferences, and health goals.
* *AI-Powered Variety:* Uses Edamam API with AI enhancement for diverse meal suggestions.
* *Flexible Planning:* Daily or weekly meal plans with 2-4 meals per day.
* *Nutritional Analysis:* Automatic calorie, protein, carb, and fat calculations.

### 🛒 Smart Grocery Management
* *Auto-Generated Lists:* Intelligent ingredient categorization and duplicate removal.
* *Interactive Shopping:* Check off items as you shop with progress tracking.
* *Multiple Export Formats:* Print, PDF, email, or store-specific formats.
* *Order Preparation:* Ready-to-use shopping lists for major grocery stores.

### 🤖 AI-Powered Features
* *Smart Recommendations:* Personalized nutrition advice based on your meal history.
* *Predictive Analytics:* Goal achievement tracking and success predictions.
* *AI Nutrition Coach:* 24/7 chatbot for nutrition questions and motivation.
* *Consultation Transcription:* Automated note-taking during nutritionist appointments.

### 👨‍⚕ Professional Nutritionist Integration
* *Expert Directory:* Browse certified nutritionists by specialization and rating.
* *Flexible Consultations:* Video calls, audio calls, or text chat options.
* *Appointment Management:* Schedule, reschedule, or cancel appointments.
* *Demo Payment System:* Integrated booking system with simulated payments.

### 👤 Comprehensive User Profiles
* *Health Tracking:* BMI calculation, calorie goals, and fitness metrics.
* *Complete Records:* Medical history, allergies, and dietary restrictions.
* *Progress Analytics:* Track meal plans created, orders prepared, and goals achieved.
* *Data Export:* Full profile data export for records.

---

## 🧰 Tech Stack

### Frontend
* *HTML5* - Semantic structure and accessibility.
* *CSS3* - Modern responsive design with animations.
* *JavaScript (ES6+)* - Dynamic functionality and API interactions.

### Backend & APIs
* *Supabase* - Authentication, database, and real-time updates.
* *PostgreSQL* - Relational database with Row Level Security.
* *OpenAI GPT-4* - AI recommendations and natural language processing (optional).
* *Edamam API* - Recipe database and nutritional information.

### Security & Privacy
* *Row Level Security (RLS)* - Database-level user data protection.
* *Local API Key Storage* - User-controlled OpenAI key management.
* *HIPAA-Compliant Design* - Healthcare data handling best practices.

---

## 💻 Getting Started

### Prerequisites
* Modern web browser (Chrome, Firefox, Safari, Edge)
* [Supabase account](https://supabase.com/) (free tier available)
* [Edamam API credentials](https://developer.edamam.com/) (free tier available)
* [OpenAI API key](https://platform.openai.com/) (optional, for AI features)

### Installation Steps

1.  *Clone the repository:*
    bash
    git clone https://github.com/rahilkotwal02/Freshroute.git
    

2.  *Navigate to the project folder:*
    bash
    cd smart-meal-planner
    

3.  *Set up Supabase:*
    * Create a new Supabase project.
    * Copy your project URL and anon key.
    * Update config.js with your Supabase credentials.

4.  *Configure APIs:*
    * Get Edamam API credentials from [developer.edamam.com](https://developer.edamam.com/).
    * Create a config-local.js file and add the following code:
    
    javascript
    // Local configuration - DO NOT COMMIT
    window.LOCAL_CONFIG = {
        OPENAI_API_KEY: 'your_openai_api_key_here' // Optional
    };
    
    window.EDAMAM_CONFIG = {
        appId: 'your_edamam_app_id',
        appKey: 'your_edamam_app_key',
        baseUrl: '[https://api.edamam.com/search](https://api.edamam.com/search)'
    };
    

5.  *Set up the database:*
    * Run the SQL schema files in your Supabase SQL Editor.
    * Enable Row Level Security policies.
    * Create a storage bucket for profile pictures (optional).

6.  *Launch the application:*
    * Simply open index.html directly in your browser.
    * *No local server required!*

---

## 🔧 Configuration

### Environment Setup
* Copy config-example.js to config-local.js.
* Fill in your API credentials.
* Add config-local.js to your .gitignore file.

### API Key Management
* *Supabase:* Public keys (safe to commit).
* *Edamam:* Private keys (keep in config-local.js).
* *OpenAI:* User-provided keys (stored locally in the browser).

### Database Schema
The application uses these main tables:
* users - User profiles and preferences.
* meal_plans - Generated meal plans.
* grocery_lists - Shopping lists.
* orders - Prepared shopping orders.
* nutritionists - Nutritionist directory.
* appointments - Consultation bookings.
* ai_insights - AI recommendations.

---

## 🎯 Usage Guide

### Creating Your First Meal Plan
1.  Sign up and verify your email.
2.  Set preferences (diet type, calories, restrictions).
3.  Generate a plan (daily or weekly).
4.  View results with nutritional breakdown.
5.  Generate a grocery list automatically.

### Using AI Features
* Enable AI by providing your OpenAI API key (optional).
* Get recommendations based on your meal history.
* Chat with an AI coach for nutrition advice.
* View analytics on the meal-planner page.

### Booking Nutritionist Appointments
* Browse nutritionists by specialization.
* Select a date/time from available slots.
* Demo booking system with simulated payments.
* Join a video call when the appointment starts (demo).

---

## 🔒 Security & Privacy
* User data encryption with Supabase RLS.
* Local API key storage - never transmitted to servers.
* HIPAA-compliant design for health information.
* Demo payment system - no real financial transactions.
* No data sharing - your information stays private.

---

## 🌟 Key Highlights
* ✅ *Zero Backend Code* - Serverless architecture with Supabase.
* ✅ *No Local Server Required* - Open index.html directly in your browser.
* ✅ *Production Ready* - Complete error handling and fallbacks.
* ✅ *Mobile Responsive* - Works on all device sizes.
* ✅ *Privacy First* - User-controlled data and API keys.
* ✅ *AI Enhanced* - Optional OpenAI integration for personalization.
* ✅ *Healthcare Grade* - Built for sensitive health information.

---

## 📁 Project Structure
smart-meal-planner/
├── index.html              # Login/signup page
├── user.html               # Meal preferences setup
├── meal-planner.html       # Generated meal plan viewer
├── grocery-list.html       # Interactive shopping lists
├── appointments.html       # Nutritionist booking system
├── profile.html            # User profile management
├── config.js               # Public configuration (Supabase)
├── config-local.js         # Private API keys (gitignored)
├── css/
│   └── style.css           # Complete application styling
└── js/
├── auth.js             # Authentication management
├── mealPlanner.js      # Meal generation logic
├── displayPlan.js      # Meal plan visualization
├── displayGrocery.js   # Grocery list management
├── orderManager.js     # Shopping list preparation
├── appointmentManager.js # Nutritionist booking system
├── profileManager.js   # User profile functionality
└── aiManager.js        # AI features and OpenAI integration

---

## 🤝 Contributing
Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.