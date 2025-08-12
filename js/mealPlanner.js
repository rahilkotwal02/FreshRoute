// Meal planning module with Edamam API integration
class MealPlannerManager {
    constructor() {
        this.preferences = null;
        this.currentPlan = null;
        this.usedRecipeIds = new Set(); // Track used recipes for variety
        this.init();
    }

    init() {
        // Check if we have auth manager and user is authenticated
        if (!authManager || !authManager.getCurrentUser()) {
            console.error('User not authenticated');
            return;
        }

        // Bind form submission
        const form = document.getElementById('preferencesForm');
        if (form) {
            form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }
    }

    // Handle form submission
    async handleFormSubmit(e) {
        e.preventDefault();
        
        const preferences = this.getFormData();
        
        if (!this.validatePreferences(preferences)) {
            return;
        }

        this.preferences = preferences;
        this.usedRecipeIds.clear(); // Reset used recipes for new plan
        
        try {
            await this.generateMealPlan(preferences);
        } catch (error) {
            console.error('Error generating meal plan:', error);
            this.showMessage('Failed to generate meal plan. Please try again.', 'error');
        }
    }

    // Get form data
    getFormData() {
        return {
            dietType: document.getElementById('dietType').value,
            healthLabels: document.getElementById('healthLabels').value,
            mealsPerDay: parseInt(document.getElementById('mealsPerDay').value),
            planType: document.getElementById('planType').value,
            calories: document.getElementById('calories').value ? parseInt(document.getElementById('calories').value) : null,
            cuisine: document.getElementById('cuisine').value
        };
    }

    // Validate preferences
    validatePreferences(preferences) {
        if (!preferences.dietType) {
            this.showMessage('Please select a diet preference.', 'error');
            return false;
        }

        if (!preferences.mealsPerDay) {
            this.showMessage('Please select number of meals per day.', 'error');
            return false;
        }

        if (!preferences.planType) {
            this.showMessage('Please select a plan type.', 'error');
            return false;
        }

        if (preferences.calories && (preferences.calories < 1000 || preferences.calories > 5000)) {
            this.showMessage('Please enter a realistic calorie target (1000-5000).', 'error');
            return false;
        }

        return true;
    }

    // Generate meal plan using Edamam API
    async generateMealPlan(preferences) {
        this.showLoading(true, 'Analyzing your preferences...');
        
        try {
            const daysCount = preferences.planType === 'weekly' ? 7 : 1;
            const mealTypes = this.getMealTypes(preferences.mealsPerDay);
            
            const plan = {
                id: null, // Will be set after saving to database
                user_id: authManager.getCurrentUser().id,
                date_range: this.getDateRange(daysCount),
                preferences_json: preferences,
                plan_json: {
                    days: [],
                    createdAt: new Date().toISOString(),
                    totalDays: daysCount,
                    mealsPerDay: preferences.mealsPerDay
                },
                created_at: new Date().toISOString()
            };

            // Generate meals for each day
            for (let day = 1; day <= daysCount; day++) {
                this.showLoading(true, `Generating day ${day} of ${daysCount}...`);
                
                const dayPlan = await this.generateDayPlan(day, mealTypes, preferences);
                plan.plan_json.days.push(dayPlan);
                
                // Add delay to respect API rate limits
                if (day < daysCount) {
                    await this.delay(1500); // Increased delay for better variety
                }
            }

            // Save meal plan to Supabase FIRST
            this.showLoading(true, 'Saving your meal plan...');
            const savedPlan = await this.saveMealPlan(plan);
            plan.id = savedPlan.id; // Update with database ID
            
            // THEN generate and save grocery list
            this.showLoading(true, 'Generating grocery list...');
            await this.generateAndSaveGroceryList(plan);

            this.currentPlan = plan;
            this.showMessage('🎉 Meal plan and grocery list generated successfully!', 'success');
            
            // Redirect to meal planner page
            setTimeout(() => {
                window.location.href = 'meal-planner.html';
            }, 1500);

        } catch (error) {
            console.error('Error in generateMealPlan:', error);
            this.showMessage('Failed to generate meal plan. Please try again.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Generate plan for a single day - FIXED for variety
    async generateDayPlan(dayNumber, mealTypes, preferences) {
        const dayPlan = {
            day: dayNumber,
            date: this.getDateForDay(dayNumber),
            meals: {}
        };

        for (const mealType of mealTypes) {
            try {
                const recipe = await this.fetchRecipeForMeal(mealType, preferences, dayNumber);
                dayPlan.meals[mealType] = recipe;
                
                // Add small delay between meal types
                await this.delay(500);
            } catch (error) {
                console.error(`Error fetching ${mealType} for day ${dayNumber}:`, error);
                dayPlan.meals[mealType] = this.getFallbackRecipe(mealType, dayNumber);
            }
        }

        return dayPlan;
    }

    // Fetch recipe from Edamam API - FIXED for variety
    async fetchRecipeForMeal(mealType, preferences, dayNumber = 1) {
        const query = this.getQueryForMealType(mealType, preferences, dayNumber);
        const apiParams = this.buildApiParams(query, preferences, dayNumber);
        
        try {
            const response = await fetch(`${window.EDAMAM_CONFIG.baseUrl}?${apiParams}`);
            
            if (!response.ok) {
                throw new Error(`API responded with status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.hits && data.hits.length > 0) {
                // Filter out already used recipes for variety
                let availableRecipes = data.hits.filter(hit => !this.usedRecipeIds.has(hit.recipe.uri));
                
                // If all recipes are used, allow reuse but from different starting point
                if (availableRecipes.length === 0) {
                    availableRecipes = data.hits;
                }
                
                // Select different recipes based on day number
                const startIndex = Math.min((dayNumber - 1) % 5, availableRecipes.length - 1);
                const selectedHit = availableRecipes[startIndex] || availableRecipes[0];
                const recipe = selectedHit.recipe;
                
                // Mark recipe as used
                this.usedRecipeIds.add(recipe.uri);
                
                return this.formatRecipe(recipe, mealType);
            } else {
                throw new Error('No recipes found');
            }
            
        } catch (error) {
            console.error('API fetch error:', error);
            throw error;
        }
    }

    // Build API parameters - FIXED for variety
    buildApiParams(query, preferences, dayNumber = 1) {
        const params = new URLSearchParams({
            q: query,
            app_id: window.EDAMAM_CONFIG.appId,
            app_key: window.EDAMAM_CONFIG.appKey,
            from: (dayNumber - 1) * 3, // Different starting point for each day
            to: dayNumber * 15 + 5 // Get more recipes for variety
        });

        // Add diet parameter
        if (preferences.dietType && preferences.dietType !== 'balanced') {
            params.append('diet', preferences.dietType);
        }

        // Add health labels
        if (preferences.healthLabels) {
            params.append('health', preferences.healthLabels);
        }

        // Add calorie range
        if (preferences.calories) {
            const caloriesPerMeal = Math.round(preferences.calories / preferences.mealsPerDay);
            const minCal = Math.max(50, caloriesPerMeal - 200);
            const maxCal = caloriesPerMeal + 200;
            params.append('calories', `${minCal}-${maxCal}`);
        }

        // Add cuisine type
        if (preferences.cuisine) {
            params.append('cuisineType', preferences.cuisine);
        }

        return params.toString();
    }

    // Get query for specific meal type - FIXED for variety
    getQueryForMealType(mealType, preferences, dayNumber = 1) {
        const mealQueries = {
            breakfast: [
                'breakfast omelette', 'pancakes', 'oatmeal bowl', 'cereal', 'avocado toast', 
                'smoothie bowl', 'breakfast burrito', 'yogurt parfait', 'french toast',
                'breakfast sandwich', 'chia pudding', 'granola', 'breakfast quinoa', 'muffins'
            ],
            lunch: [
                'healthy salad', 'chicken sandwich', 'soup bowl', 'wrap', 'grain bowl', 
                'quinoa salad', 'pasta salad', 'buddha bowl', 'poke bowl', 'burrito bowl',
                'noodle soup', 'rice bowl', 'mediterranean bowl', 'veggie wrap'
            ],
            dinner: [
                'grilled chicken', 'pasta dinner', 'rice bowl', 'salmon dinner', 'beef stir fry', 
                'vegetable curry', 'roasted vegetables', 'fish tacos', 'pork chops',
                'lamb dinner', 'seafood pasta', 'chicken curry', 'beef steak', 'tofu stir fry'
            ],
            snack: [
                'healthy snack', 'fruit bowl', 'nuts mix', 'yogurt parfait', 
                'smoothie', 'energy bars', 'trail mix', 'protein smoothie',
                'cheese crackers', 'hummus dip', 'vegetable chips', 'fruit smoothie'
            ]
        };

        const queries = mealQueries[mealType] || ['healthy meal'];
        
        // Use day number and meal type to select different queries for variety
        const queryIndex = ((dayNumber - 1) * 2 + Math.floor(Math.random() * 2)) % queries.length;
        let selectedQuery = queries[queryIndex];
        
        // Add diet-specific terms
        if (preferences.dietType === 'vegetarian' || preferences.healthLabels === 'vegetarian') {
            selectedQuery += ' vegetarian';
        }
        if (preferences.dietType === 'vegan' || preferences.healthLabels === 'vegan') {
            selectedQuery += ' vegan';
        }
        if (preferences.dietType === 'low-carb') {
            selectedQuery += ' low carb';
        }
        if (preferences.dietType === 'keto-friendly') {
            selectedQuery += ' keto';
        }

        return selectedQuery;
    }

    // Format recipe data
    formatRecipe(recipe, mealType) {
        return {
            id: this.generateId(),
            mealType: mealType,
            label: recipe.label,
            image: recipe.image || 'https://via.placeholder.com/300x200?text=Recipe',
            url: recipe.url,
            calories: Math.round(recipe.calories),
            servings: recipe.yield || 1,
            ingredients: recipe.ingredientLines || [],
            cookTime: recipe.totalTime || 30,
            nutrients: {
                protein: recipe.totalNutrients?.PROCNT ? Math.round(recipe.totalNutrients.PROCNT.quantity) : null,
                carbs: recipe.totalNutrients?.CHOCDF ? Math.round(recipe.totalNutrients.CHOCDF.quantity) : null,
                fat: recipe.totalNutrients?.FAT ? Math.round(recipe.totalNutrients.FAT.quantity) : null,
                fiber: recipe.totalNutrients?.FIBTG ? Math.round(recipe.totalNutrients.FIBTG.quantity) : null
            },
            dietLabels: recipe.dietLabels || [],
            healthLabels: recipe.healthLabels || []
        };
    }

    // Get fallback recipe when API fails - FIXED with day variety
    getFallbackRecipe(mealType, dayNumber = 1) {
        const fallbackRecipes = {
            breakfast: [
                {
                    id: this.generateId(),
                    mealType: 'breakfast',
                    label: 'Healthy Oatmeal Bowl',
                    image: 'https://via.placeholder.com/300x200?text=Oatmeal+Bowl',
                    url: '#',
                    calories: 320,
                    servings: 1,
                    ingredients: [
                        '1 cup rolled oats',
                        '1.5 cups milk or plant-based milk',
                        '1 banana, sliced',
                        '2 tablespoons honey or maple syrup',
                        '1/4 cup mixed berries',
                        '2 tablespoons chopped nuts'
                    ],
                    cookTime: 10,
                    nutrients: { protein: 12, carbs: 54, fat: 8, fiber: 8 }
                },
                {
                    id: this.generateId(),
                    mealType: 'breakfast',
                    label: 'Avocado Toast with Eggs',
                    image: 'https://via.placeholder.com/300x200?text=Avocado+Toast',
                    url: '#',
                    calories: 380,
                    servings: 1,
                    ingredients: [
                        '2 slices whole grain bread',
                        '1 ripe avocado',
                        '2 eggs',
                        '1 tablespoon olive oil',
                        'Salt and pepper to taste',
                        'Red pepper flakes (optional)'
                    ],
                    cookTime: 15,
                    nutrients: { protein: 18, carbs: 32, fat: 22, fiber: 12 }
                }
            ],
            lunch: [
                {
                    id: this.generateId(),
                    mealType: 'lunch',
                    label: 'Mediterranean Power Bowl',
                    image: 'https://via.placeholder.com/300x200?text=Mediterranean+Bowl',
                    url: '#',
                    calories: 380,
                    servings: 1,
                    ingredients: [
                        '2 cups mixed greens',
                        '1/2 cup quinoa, cooked',
                        '1/2 cucumber, diced',
                        '1 medium tomato, diced',
                        '1/4 cup feta cheese',
                        '2 tablespoons olive oil',
                        '1 tablespoon lemon juice',
                        '2 tablespoons hummus'
                    ],
                    cookTime: 15,
                    nutrients: { protein: 15, carbs: 32, fat: 18, fiber: 8 }
                },
                {
                    id: this.generateId(),
                    mealType: 'lunch',
                    label: 'Chicken Caesar Salad',
                    image: 'https://via.placeholder.com/300x200?text=Caesar+Salad',
                    url: '#',
                    calories: 420,
                    servings: 1,
                    ingredients: [
                        '4 oz grilled chicken breast',
                        '3 cups romaine lettuce',
                        '1/4 cup parmesan cheese',
                        '2 tablespoons caesar dressing',
                        '1/2 cup croutons',
                        '1 tablespoon lemon juice'
                    ],
                    cookTime: 20,
                    nutrients: { protein: 35, carbs: 18, fat: 22, fiber: 4 }
                }
            ],
            dinner: [
                {
                    id: this.generateId(),
                    mealType: 'dinner',
                    label: 'Grilled Chicken with Roasted Vegetables',
                    image: 'https://via.placeholder.com/300x200?text=Chicken+Dinner',
                    url: '#',
                    calories: 450,
                    servings: 1,
                    ingredients: [
                        '6 oz chicken breast',
                        '1 cup broccoli florets',
                        '1 medium sweet potato, cubed',
                        '1 bell pepper, sliced',
                        '2 tablespoons olive oil',
                        '1 teaspoon garlic powder',
                        'Salt and pepper to taste',
                        '1 tablespoon herbs (rosemary or thyme)'
                    ],
                    cookTime: 25,
                    nutrients: { protein: 42, carbs: 28, fat: 14, fiber: 6 }
                },
                {
                    id: this.generateId(),
                    mealType: 'dinner',
                    label: 'Salmon with Quinoa and Asparagus',
                    image: 'https://via.placeholder.com/300x200?text=Salmon+Dinner',
                    url: '#',
                    calories: 520,
                    servings: 1,
                    ingredients: [
                        '6 oz salmon fillet',
                        '3/4 cup cooked quinoa',
                        '1 bunch asparagus, trimmed',
                        '2 tablespoons olive oil',
                        '1 lemon, sliced',
                        '2 cloves garlic, minced',
                        'Salt and pepper to taste'
                    ],
                    cookTime: 30,
                    nutrients: { protein: 38, carbs: 35, fat: 20, fiber: 8 }
                }
            ],
            snack: [
                {
                    id: this.generateId(),
                    mealType: 'snack',
                    label: 'Apple with Almond Butter',
                    image: 'https://via.placeholder.com/300x200?text=Healthy+Snack',
                    url: '#',
                    calories: 180,
                    servings: 1,
                    ingredients: [
                        '1 medium apple, sliced',
                        '2 tablespoons almond butter',
                        '1 tablespoon chia seeds (optional)',
                        'Pinch of cinnamon'
                    ],
                    cookTime: 2,
                    nutrients: { protein: 6, carbs: 24, fat: 8, fiber: 7 }
                },
                {
                    id: this.generateId(),
                    mealType: 'snack',
                    label: 'Greek Yogurt with Berries',
                    image: 'https://via.placeholder.com/300x200?text=Yogurt+Parfait',
                    url: '#',
                    calories: 150,
                    servings: 1,
                    ingredients: [
                        '1 cup Greek yogurt',
                        '1/2 cup mixed berries',
                        '1 tablespoon honey',
                        '2 tablespoons granola'
                    ],
                    cookTime: 2,
                    nutrients: { protein: 15, carbs: 20, fat: 3, fiber: 4 }
                }
            ]
        };

        const options = fallbackRecipes[mealType] || fallbackRecipes.lunch;
        // Use day number to select different fallback recipes
        return options[(dayNumber - 1) % options.length];
    }

    // Save meal plan to Supabase - FIXED
    async saveMealPlan(plan) {
        try {
            const supabase = authManager.getSupabase();
            
            const { data, error } = await supabase
                .from('meal_plans')
                .insert([{
                    user_id: plan.user_id,
                    date_range: plan.date_range,
                    preferences_json: plan.preferences_json,
                    plan_json: plan.plan_json
                }])
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('Meal plan saved successfully:', data);
            return data;

        } catch (error) {
            console.error('Error saving meal plan:', error);
            throw error;
        }
    }

    // Generate and save grocery list - FIXED
    async generateAndSaveGroceryList(plan) {
        try {
            console.log('Generating grocery list for plan ID:', plan.id);
            
            const groceryList = this.generateGroceryList(plan);
            
            if (!groceryList || Object.keys(groceryList.categories).length === 0) {
                throw new Error('No grocery items could be generated');
            }
            
            const supabase = authManager.getSupabase();
            
            const { data, error } = await supabase
                .from('grocery_lists')
                .insert([{
                    user_id: plan.user_id,
                    plan_id: plan.id, // Make sure this is the database ID
                    grocery_json: groceryList
                }])
                .select()
                .single();

            if (error) {
                console.error('Grocery list save error:', error);
                throw error;
            }

            console.log('Grocery list saved successfully:', data);
            return data;

        } catch (error) {
            console.error('Error saving grocery list:', error);
            // Show warning but don't fail the entire process
            this.showMessage('⚠️ Meal plan created but grocery list failed to save. Try refreshing the grocery list page.', 'warning');
        }
    }

    // Generate grocery list from meal plan - ENHANCED
    generateGroceryList(plan) {
        const groceryList = {
            categories: {},
            totalItems: 0,
            generatedAt: new Date().toISOString()
        };

        // Extract ingredients from all meals
        plan.plan_json.days.forEach(day => {
            Object.values(day.meals).forEach(meal => {
                if (meal && meal.ingredients) {
                    meal.ingredients.forEach(ingredient => {
                        const category = this.categorizeIngredient(ingredient);
                        const cleanIngredient = this.cleanIngredientText(ingredient);
                        
                        if (!groceryList.categories[category]) {
                            groceryList.categories[category] = [];
                        }
                        
                        // Check for duplicates
                        const exists = groceryList.categories[category].some(item => 
                            item.name.toLowerCase() === cleanIngredient.toLowerCase()
                        );
                        
                        if (!exists && cleanIngredient.length > 2) {
                            groceryList.categories[category].push({
                                name: cleanIngredient,
                                original: ingredient,
                                checked: false
                            });
                            groceryList.totalItems++;
                        }
                    });
                }
            });
        });

        return groceryList;
    }

    // Categorize ingredients - ENHANCED
    categorizeIngredient(ingredient) {
        const categories = {
            'Proteins': [
                'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'turkey', 'eggs', 
                'tofu', 'tempeh', 'beans', 'lentils', 'chickpeas', 'quinoa', 'shrimp',
                'cod', 'lamb', 'bacon', 'ham', 'sausage'
            ],
            'Vegetables': [
                'tomato', 'onion', 'carrot', 'broccoli', 'spinach', 'lettuce', 'cucumber', 
                'pepper', 'bell pepper', 'garlic', 'celery', 'mushroom', 'zucchini', 
                'cauliflower', 'kale', 'cabbage', 'potato', 'sweet potato', 'asparagus',
                'green beans', 'corn', 'peas', 'eggplant', 'radish', 'beets'
            ],
            'Fruits': [
                'apple', 'banana', 'orange', 'berries', 'strawberry', 'blueberry', 
                'lemon', 'lime', 'grapes', 'mango', 'pineapple', 'avocado', 'peach',
                'pear', 'kiwi', 'watermelon', 'cantaloupe', 'cherries', 'plums'
            ],
            'Grains & Carbs': [
                'rice', 'pasta', 'bread', 'oats', 'flour', 'cereal', 'quinoa', 
                'barley', 'bulgur', 'couscous', 'noodles', 'crackers', 'tortilla',
                'bagel', 'muffin', 'granola'
            ],
            'Dairy': [
                'milk', 'cheese', 'yogurt', 'butter', 'cream', 'feta', 'mozzarella', 
                'parmesan', 'cottage cheese', 'sour cream', 'greek yogurt', 'cheddar'
            ],
            'Pantry Staples': [
                'oil', 'olive oil', 'vinegar', 'salt', 'pepper', 'honey', 'sugar', 
                'maple syrup', 'vanilla', 'baking powder', 'flour', 'soy sauce',
                'hot sauce', 'ketchup', 'mustard', 'mayo', 'coconut oil'
            ],
            'Herbs & Spices': [
                'basil', 'oregano', 'thyme', 'rosemary', 'parsley', 'cilantro', 
                'cinnamon', 'paprika', 'cumin', 'turmeric', 'ginger', 'bay leaves',
                'chili powder', 'garlic powder', 'onion powder', 'black pepper'
            ],
            'Nuts & Seeds': [
                'almonds', 'walnuts', 'pecans', 'cashews', 'peanuts', 'seeds', 
                'chia seeds', 'flax seeds', 'sunflower seeds', 'pumpkin seeds',
                'pine nuts', 'pistachios', 'hazelnuts'
            ]
        };

        const lowerIngredient = ingredient.toLowerCase();
        
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => lowerIngredient.includes(keyword))) {
                return category;
            }
        }
        
        return 'Other';
    }

    // Clean ingredient text - ENHANCED
    cleanIngredientText(ingredient) {
        return ingredient
            .replace(/^\d+\s*(\d+\/\d+)?\s*(cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|tbsp|tsp|oz|ounce|ounces|pound|pounds|lb|lbs|clove|cloves|slice|slices|piece|pieces|large|medium|small|whole|can|jar|package|bunch|head|stalk|sprig|pinch|dash)?\s*/i, '')
            .replace(/,.*$/, '')
            .replace(/\(.*\)/, '')
            .replace(/\s+/g, ' ')
            .replace(/\b(fresh|dried|chopped|diced|sliced|minced|crushed|ground|whole|organic|raw|cooked)\b/gi, '')
            .trim();
    }

    // Utility functions
    getMealTypes(mealsPerDay) {
        const allMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
        return allMealTypes.slice(0, mealsPerDay);
    }

    getDateRange(daysCount) {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + daysCount - 1);
        
        return `${startDate.toDateString()} - ${endDate.toDateString()}`;
    }

    getDateForDay(dayNumber) {
        const date = new Date();
        date.setDate(date.getDate() + dayNumber - 1);
        return date.toDateString();
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // UI utility functions
    showLoading(show, message = 'Processing...') {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loadingText');
        
        if (loading) {
            loading.classList.toggle('hidden', !show);
            if (loadingText && message) {
                loadingText.textContent = message;
            }
        }
    }

    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;

        // Clear previous messages
        messagesContainer.innerHTML = '';

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
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

// Initialize meal planner manager
let mealPlannerManager;

document.addEventListener('DOMContentLoaded', function() {
    // Wait for auth manager to be ready
    setTimeout(() => {
        if (authManager && authManager.getCurrentUser()) {
            mealPlannerManager = new MealPlannerManager();
        }
    }, 100);
});
