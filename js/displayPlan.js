// Display and manage meal plans
class MealPlanDisplayManager {
    constructor() {
        this.currentPlan = null;
        this.currentDayView = 0;
        this.init();
    }

    async init() {
        // Check authentication
        if (!authManager || !authManager.getCurrentUser()) {
            console.error('User not authenticated');
            return;
        }

        await this.loadLatestMealPlan();
    }

    // Load the latest meal plan for the user
    async loadLatestMealPlan() {
        try {
            this.showLoading(true);
            
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { data, error } = await supabase
                .from('meal_plans')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No meal plans found
                    this.displayNoPlans();
                    return;
                }
                throw error;
            }

            this.currentPlan = data;
            this.displayMealPlan(data);

        } catch (error) {
            console.error('Error loading meal plan:', error);
            this.showMessage('Failed to load meal plan. Please try again.', 'error');
            this.displayError();
        } finally {
            this.showLoading(false);
        }
    }

    // Display the meal plan
    displayMealPlan(plan) {
        this.displayPlanStats(plan);
        
        const planData = plan.plan_json;
        
        if (planData.totalDays > 1) {
            this.createDaySelector(planData.days.length);
        }
        
        this.displayDay(planData.days[this.currentDayView] || planData.days[0]);
    }

    // Display plan statistics
    displayPlanStats(plan) {
        const statsContainer = document.getElementById('planStats');
        if (!statsContainer) return;

        const planData = plan.plan_json;
        let totalCalories = 0;
        let totalMeals = 0;
        let totalIngredients = 0;

        planData.days.forEach(day => {
            Object.values(day.meals).forEach(meal => {
                if (meal) {
                    totalCalories += meal.calories || 0;
                    totalMeals++;
                    totalIngredients += meal.ingredients ? meal.ingredients.length : 0;
                }
            });
        });

        const avgCaloriesPerDay = Math.round(totalCalories / planData.days.length);
        const planType = plan.preferences_json.planType;
        const dietType = plan.preferences_json.dietType;

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${planData.days.length}</div>
                <div class="stat-label">${planData.days.length === 1 ? 'Day' : 'Days'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalMeals}</div>
                <div class="stat-label">Total Meals</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${avgCaloriesPerDay}</div>
                <div class="stat-label">Avg Calories/Day</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${plan.preferences_json.mealsPerDay}</div>
                <div class="stat-label">Meals/Day</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${dietType.charAt(0).toUpperCase() + dietType.slice(1)}</div>
                <div class="stat-label">Diet Type</div>
            </div>
        `;
    }

    // Create day selector for weekly plans
    createDaySelector(daysCount) {
        const container = document.getElementById('daySelector');
        if (!container) return;

        container.innerHTML = '<div class="day-selector"></div>';
        const selector = container.querySelector('.day-selector');
        
        for (let i = 0; i < daysCount; i++) {
            const btn = document.createElement('button');
            btn.textContent = `Day ${i + 1}`;
            btn.className = `day-btn ${i === this.currentDayView ? 'active' : ''}`;
            btn.onclick = () => this.switchDay(i);
            selector.appendChild(btn);
        }
    }

    // Switch to a different day
    switchDay(dayIndex) {
        this.currentDayView = dayIndex;
        
        // Update button states
        const buttons = document.querySelectorAll('.day-btn');
        buttons.forEach((btn, index) => {
            btn.classList.toggle('active', index === dayIndex);
        });
        
        // Display the selected day
        if (this.currentPlan && this.currentPlan.plan_json.days[dayIndex]) {
            this.displayDay(this.currentPlan.plan_json.days[dayIndex]);
        }
    }

    // Display a single day's meals
    displayDay(dayPlan) {
        const content = document.getElementById('mealPlanContent');
        if (!content) return;

        const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
        const mealIcons = {
            breakfast: '🌅',
            lunch: '☀️',
            dinner: '🌙',
            snack: '🍎'
        };

        let html = `
            <div class="day-header">
                <h3>📅 ${dayPlan.date}</h3>
            </div>
            <div class="meal-grid">
        `;
        
        mealTypes.forEach(mealType => {
            const meal = dayPlan.meals[mealType];
            if (meal) {
                html += this.renderMealCard(meal, mealType, mealIcons[mealType]);
            }
        });
        
        html += '</div>';
        content.innerHTML = html;
    }

    // Render individual meal card
    renderMealCard(meal, mealType, icon) {
        const nutrients = meal.nutrients || {};
        const macros = this.calculateMacroPercentages(meal.calories, nutrients);

        return `
            <div class="meal-card">
                <h3 class="meal-title">
                    <span class="meal-icon">${icon}</span>
                    ${mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                </h3>
                
                <div class="recipe-card">
                    ${meal.image && meal.image !== 'https://via.placeholder.com/300x200?text=Recipe' ? 
                        `<img src="${meal.image}" alt="${meal.label}" class="recipe-image" onerror="this.style.display='none'">` 
                        : ''}
                    
                    <h4 class="recipe-title">${meal.label}</h4>
                    
                    <div class="recipe-info">
                        <span class="info-tag">🔥 ${meal.calories} cal</span>
                        <span class="info-tag">⏱️ ${meal.cookTime || 30} min</span>
                        <span class="info-tag">🍽️ ${meal.servings || 1} serving${meal.servings > 1 ? 's' : ''}</span>
                    </div>

                    ${this.renderNutritionInfo(nutrients, macros)}
                    
                    <div class="ingredients">
                        <h5>📝 Ingredients (${meal.ingredients.length} items):</h5>
                        <ul class="ingredients-list">
                            ${meal.ingredients.slice(0, 8).map(ingredient => 
                                `<li>${ingredient}</li>`
                            ).join('')}
                            ${meal.ingredients.length > 8 ? 
                                `<li class="more-ingredients">
                                    <em>...and ${meal.ingredients.length - 8} more ingredients</em>
                                </li>` : ''}
                        </ul>
                    </div>

                    ${this.renderDietLabels(meal)}
                    
                    <div class="recipe-actions">
                        ${meal.url && meal.url !== '#' ? 
                            `<a href="${meal.url}" target="_blank" class="recipe-link">
                                📖 View Full Recipe <span>↗</span>
                            </a>` : ''}
                        <button onclick="mealPlanDisplay.copyIngredients('${mealType}')" class="copy-btn">
                            📋 Copy Ingredients
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Render nutrition information
    renderNutritionInfo(nutrients, macros) {
        if (!nutrients.protein && !nutrients.carbs && !nutrients.fat) {
            return '';
        }

        return `
            <div class="nutrition-info">
                <h5>🥗 Nutrition Info:</h5>
                <div class="nutrition-grid">
                    ${nutrients.protein ? `<div class="nutrition-item">
                        <span class="nutrition-label">Protein</span>
                        <span class="nutrition-value">${nutrients.protein}g</span>
                    </div>` : ''}
                    ${nutrients.carbs ? `<div class="nutrition-item">
                        <span class="nutrition-label">Carbs</span>
                        <span class="nutrition-value">${nutrients.carbs}g</span>
                    </div>` : ''}
                    ${nutrients.fat ? `<div class="nutrition-item">
                        <span class="nutrition-label">Fat</span>
                        <span class="nutrition-value">${nutrients.fat}g</span>
                    </div>` : ''}
                    ${nutrients.fiber ? `<div class="nutrition-item">
                        <span class="nutrition-label">Fiber</span>
                        <span class="nutrition-value">${nutrients.fiber}g</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    }

    // Render diet labels
    renderDietLabels(meal) {
        const importantLabels = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto-Friendly', 'Paleo'];
        const relevantLabels = (meal.healthLabels || [])
            .filter(label => importantLabels.includes(label))
            .slice(0, 4);

        if (relevantLabels.length === 0) return '';

        return `
            <div class="diet-labels">
                ${relevantLabels.map(label => 
                    `<span class="diet-label">${label}</span>`
                ).join('')}
            </div>
        `;
    }

    // Calculate macro percentages
    calculateMacroPercentages(calories, nutrients) {
        if (!calories || calories === 0) return {};

        const proteinCals = (nutrients.protein || 0) * 4;
        const carbCals = (nutrients.carbs || 0) * 4;
        const fatCals = (nutrients.fat || 0) * 9;

        return {
            protein: Math.round((proteinCals / calories) * 100),
            carbs: Math.round((carbCals / calories) * 100),
            fat: Math.round((fatCals / calories) * 100)
        };
    }

    // Copy ingredients to clipboard
    copyIngredients(mealType) {
        if (!this.currentPlan) return;

        const currentDay = this.currentPlan.plan_json.days[this.currentDayView];
        const meal = currentDay.meals[mealType];
        
        if (meal && meal.ingredients) {
            const ingredientText = meal.ingredients.join('\n');
            
            navigator.clipboard.writeText(ingredientText).then(() => {
                this.showMessage('✅ Ingredients copied to clipboard!', 'success');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = ingredientText;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showMessage('✅ Ingredients copied to clipboard!', 'success');
            });
        }
    }

    // Display when no plans are found
    displayNoPlans() {
        const content = document.getElementById('mealPlanContent');
        if (!content) return;

        content.innerHTML = `
            <div class="no-plans">
                <div class="no-plans-icon">🍽️</div>
                <h3>No Meal Plans Found</h3>
                <p>You haven't created any meal plans yet. Start by setting your preferences and generating your first plan!</p>
                <button onclick="window.location.href='user.html'" class="btn-primary btn-large">
                    ✨ Create Your First Meal Plan
                </button>
            </div>
        `;

        // Hide stats and actions
        const statsContainer = document.getElementById('planStats');
        if (statsContainer) statsContainer.innerHTML = '';
        
        const actionsContainer = document.getElementById('viewGroceryBtn');
        if (actionsContainer) actionsContainer.style.display = 'none';
    }

    // Display error state
    displayError() {
        const content = document.getElementById('mealPlanContent');
        if (!content) return;

        content.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <h3>Unable to Load Meal Plan</h3>
                <p>There was an error loading your meal plan. Please try refreshing the page or contact support if the problem persists.</p>
                <div class="error-actions">
                    <button onclick="window.location.reload()" class="btn-secondary">
                        🔄 Refresh Page
                    </button>
                    <button onclick="window.location.href='user.html'" class="btn-primary">
                        ← Back to Preferences
                    </button>
                </div>
            </div>
        `;
    }

    // Utility functions
    showLoading(show) {
        const content = document.getElementById('mealPlanContent');
        if (!content) return;

        if (show) {
            content.innerHTML = `
                <div class="loading-placeholder">
                    <div class="spinner"></div>
                    <p>Loading your meal plan...</p>
                </div>
            `;
        }
    }

    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        
        messagesContainer.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }
}

// Initialize display manager
let mealPlanDisplay;

document.addEventListener('DOMContentLoaded', function() {
    // Wait for auth manager to be ready
    setTimeout(() => {
        if (authManager && authManager.getCurrentUser()) {
            mealPlanDisplay = new MealPlanDisplayManager();
        }
    }, 100);
});
