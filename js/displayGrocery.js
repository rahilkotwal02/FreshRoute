// Display and manage grocery lists
class GroceryListDisplayManager {
    constructor() {
        this.currentGroceryList = null;
        this.currentPlan = null;
        this.init();
    }

    async init() {
        // Check authentication
        if (!authManager || !authManager.getCurrentUser()) {
            console.error('User not authenticated');
            return;
        }

        await this.loadLatestGroceryList();
    }

    // Load the latest grocery list for the user - FIXED
    async loadLatestGroceryList() {
        try {
            this.showLoading(true);
            
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            console.log('Loading grocery lists for user:', userId);

            // First try to get grocery list with meal plan data
            const { data, error } = await supabase
                .from('grocery_lists')
                .select(`
                    *,
                    meal_plans (
                        date_range,
                        preferences_json,
                        plan_json
                    )
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(1);

            console.log('Grocery list query result:', { data, error });

            if (error) {
                throw error;
            }

            if (!data || data.length === 0) {
                console.log('No grocery lists found');
                this.displayNoGroceryList();
                return;
            }

            this.currentGroceryList = data[0];
            this.currentPlan = data[0].meal_plans;
            console.log('Loaded grocery list:', this.currentGroceryList);
            this.displayGroceryList(data[0]);

        } catch (error) {
            console.error('Error loading grocery list:', error);
            
            // Try alternative approach - load meal plans first
            try {
                console.log('Trying alternative approach - loading from meal plans...');
                await this.loadFromMealPlans();
            } catch (altError) {
                console.error('Alternative approach also failed:', altError);
                this.showMessage('Failed to load grocery list. Please try again.', 'error');
                this.displayError();
            }
        } finally {
            this.showLoading(false);
        }
    }

    // Alternative loading method - ADDED
    async loadFromMealPlans() {
        const supabase = authManager.getSupabase();
        const userId = authManager.getCurrentUser().id;

        // Get the latest meal plan
        const { data: planData, error: planError } = await supabase
            .from('meal_plans')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (planError || !planData) {
            this.displayNoGroceryList();
            return;
        }

        // Check if grocery list exists for this plan
        const { data: groceryData, error: groceryError } = await supabase
            .from('grocery_lists')
            .select('*')
            .eq('plan_id', planData.id)
            .single();

        if (groceryError || !groceryData) {
            // Generate grocery list from meal plan if it doesn't exist
            console.log('Grocery list not found, generating from meal plan...');
            await this.generateGroceryListFromPlan(planData);
        } else {
            this.currentGroceryList = groceryData;
            this.currentPlan = planData;
            this.displayGroceryList(groceryData);
        }
    }

    // Generate grocery list from existing meal plan - ADDED
    async generateGroceryListFromPlan(planData) {
        try {
            const groceryList = this.extractGroceryListFromPlan(planData);
            
            if (!groceryList || Object.keys(groceryList.categories).length === 0) {
                this.displayNoGroceryList();
                return;
            }

            // Save the generated grocery list
            const supabase = authManager.getSupabase();
            const { data, error } = await supabase
                .from('grocery_lists')
                .insert([{
                    user_id: planData.user_id,
                    plan_id: planData.id,
                    grocery_json: groceryList
                }])
                .select()
                .single();

            if (error) {
                console.error('Error saving generated grocery list:', error);
                // Still display the generated list even if saving fails
                this.currentGroceryList = { grocery_json: groceryList };
                this.currentPlan = planData;
                this.displayGroceryList({ grocery_json: groceryList });
            } else {
                this.currentGroceryList = data;
                this.currentPlan = planData;
                this.displayGroceryList(data);
            }

        } catch (error) {
            console.error('Error generating grocery list from plan:', error);
            this.displayNoGroceryList();
        }
    }

    // Extract grocery list from meal plan data - ADDED
    extractGroceryListFromPlan(planData) {
        const groceryList = {
            categories: {},
            totalItems: 0,
            generatedAt: new Date().toISOString()
        };

        if (!planData.plan_json || !planData.plan_json.days) {
            return groceryList;
        }

        // Extract ingredients from all meals
        planData.plan_json.days.forEach(day => {
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

    // Display the grocery list
    displayGroceryList(groceryData) {
        this.displayGroceryStats(groceryData);
        this.renderGroceryList(groceryData.grocery_json);
    }

    // Display grocery list statistics
    displayGroceryStats(groceryData) {
        const statsContainer = document.getElementById('groceryStats');
        if (!statsContainer) return;

        const groceryList = groceryData.grocery_json;
        const categories = Object.keys(groceryList.categories);
        const totalItems = groceryList.totalItems || this.calculateTotalItems(groceryList.categories);
        const checkedItems = this.calculateCheckedItems(groceryList.categories);
        const progress = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;

        // Get plan info
        const planInfo = this.currentPlan;
        const planDays = planInfo ? (planInfo.plan_json?.totalDays || 1) : 1;
        const dietType = planInfo ? (planInfo.preferences_json?.dietType || 'Unknown') : 'Unknown';

        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${categories.length}</div>
                <div class="stat-label">Categories</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${totalItems}</div>
                <div class="stat-label">Total Items</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${progress}%</div>
                <div class="stat-label">Progress</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${planDays}</div>
                <div class="stat-label">Days Planned</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${dietType.charAt(0).toUpperCase() + dietType.slice(1)}</div>
                <div class="stat-label">Diet Type</div>
            </div>
        `;
    }

    // Render the grocery list
    renderGroceryList(groceryList) {
        const content = document.getElementById('groceryListContent');
        if (!content) return;

        const categories = groceryList.categories;
        
        if (!categories || Object.keys(categories).length === 0) {
            this.displayNoGroceryList();
            return;
        }

        let html = '<div class="grocery-grid">';

        // Sort categories by priority
        const sortedCategories = this.sortCategoriesByPriority(Object.keys(categories));

        sortedCategories.forEach(category => {
            const items = categories[category];
            if (items && items.length > 0) {
                html += this.renderCategoryCard(category, items);
            }
        });

        html += '</div>';
        
        // Add summary section
        html += this.renderGrocerySummary(groceryList);
        
        content.innerHTML = html;
    }

    // Render individual category card
    renderCategoryCard(category, items) {
        const checkedCount = items.filter(item => item.checked).length;
        const totalCount = items.length;
        const progress = Math.round((checkedCount / totalCount) * 100);
        const icon = this.getCategoryIcon(category);

        return `
            <div class="grocery-category" data-category="${category}">
                <h3 class="category-header">
                    <span class="category-icon">${icon}</span>
                    <span class="category-name">${category}</span>
                    <span class="item-count">${checkedCount}/${totalCount}</span>
                </h3>
                
                <div class="category-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>
                
                <ul class="grocery-list">
                    ${items.map((item, index) => this.renderGroceryItem(item, category, index)).join('')}
                </ul>
                
                <div class="category-actions">
                    <button onclick="groceryDisplay.toggleAllItems('${category}', false)" class="toggle-btn">
                        ☐ Uncheck All
                    </button>
                    <button onclick="groceryDisplay.toggleAllItems('${category}', true)" class="toggle-btn">
                        ☑ Check All
                    </button>
                </div>
            </div>
        `;
    }

    // Render individual grocery item
    renderGroceryItem(item, category, index) {
        const itemId = `${category}-${index}`;
        
        return `
            <li class="grocery-item ${item.checked ? 'checked' : ''}">
                <input type="checkbox" 
                       id="${itemId}" 
                       ${item.checked ? 'checked' : ''}
                       onchange="groceryDisplay.toggleGroceryItem('${category}', ${index})">
                <label for="${itemId}" class="item-label">
                    <span class="item-name">${item.name}</span>
                    ${item.original !== item.name ? 
                        `<span class="item-detail">${item.original}</span>` : ''}
                </label>
                <button onclick="groceryDisplay.removeItem('${category}', ${index})" 
                        class="remove-btn" title="Remove item">
                    ✕
                </button>
            </li>
        `;
    }

    // Render grocery summary
    renderGrocerySummary(groceryList) {
        const totalItems = this.calculateTotalItems(groceryList.categories);
        const checkedItems = this.calculateCheckedItems(groceryList.categories);
        const remainingItems = totalItems - checkedItems;
        const estimatedTime = Math.ceil(remainingItems * 1.5); // 1.5 minutes per item

        return `
            <div class="grocery-summary">
                <h3>📊 Shopping Summary</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <span class="summary-label">Items to Shop:</span>
                        <span class="summary-value">${remainingItems} of ${totalItems}</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Estimated Time:</span>
                        <span class="summary-value">${estimatedTime} minutes</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Completion:</span>
                        <span class="summary-value">${Math.round((checkedItems / totalItems) * 100)}%</span>
                    </div>
                    <div class="summary-item">
                        <span class="summary-label">Last Updated:</span>
                        <span class="summary-value">${new Date(groceryList.generatedAt || Date.now()).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Toggle individual grocery item
    toggleGroceryItem(category, index) {
        if (!this.currentGroceryList || !this.currentGroceryList.grocery_json.categories[category]) {
            return;
        }

        const item = this.currentGroceryList.grocery_json.categories[category][index];
        item.checked = !item.checked;

        // Update the UI
        this.updateItemDisplay(category, index, item.checked);
        this.updateCategoryProgress(category);
        this.updateGroceryStats();

        // Save changes to database
        this.saveGroceryListChanges();
    }

    // Toggle all items in a category
    toggleAllItems(category, checked) {
        if (!this.currentGroceryList || !this.currentGroceryList.grocery_json.categories[category]) {
            return;
        }

        const items = this.currentGroceryList.grocery_json.categories[category];
        items.forEach((item, index) => {
            item.checked = checked;
            this.updateItemDisplay(category, index, checked);
        });

        this.updateCategoryProgress(category);
        this.updateGroceryStats();
        this.saveGroceryListChanges();
    }

    // Remove item from list
    removeItem(category, index) {
        if (!this.currentGroceryList || !this.currentGroceryList.grocery_json.categories[category]) {
            return;
        }

        if (confirm('Remove this item from your grocery list?')) {
            this.currentGroceryList.grocery_json.categories[category].splice(index, 1);
            
            // If category is empty, remove it
            if (this.currentGroceryList.grocery_json.categories[category].length === 0) {
                delete this.currentGroceryList.grocery_json.categories[category];
            }

            // Re-render the entire list
            this.renderGroceryList(this.currentGroceryList.grocery_json);
            this.updateGroceryStats();
            this.saveGroceryListChanges();
            
            this.showMessage('Item removed from grocery list', 'success');
        }
    }

    // Update item display
    updateItemDisplay(category, index, checked) {
        const itemElement = document.getElementById(`${category}-${index}`);
        if (itemElement) {
            itemElement.checked = checked;
            const listItem = itemElement.closest('.grocery-item');
            if (listItem) {
                listItem.classList.toggle('checked', checked);
            }
        }
    }

    // Update category progress
    updateCategoryProgress(category) {
        const categoryElement = document.querySelector(`[data-category="${category}"]`);
        if (!categoryElement) return;

        const items = this.currentGroceryList.grocery_json.categories[category];
        const checkedCount = items.filter(item => item.checked).length;
        const totalCount = items.length;
        const progress = Math.round((checkedCount / totalCount) * 100);

        const progressFill = categoryElement.querySelector('.progress-fill');
        const itemCount = categoryElement.querySelector('.item-count');
        
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (itemCount) itemCount.textContent = `${checkedCount}/${totalCount}`;
    }

    // Update grocery stats
    updateGroceryStats() {
        if (!this.currentGroceryList) return;
        this.displayGroceryStats(this.currentGroceryList);
    }

    // Save changes to database
    async saveGroceryListChanges() {
        try {
            const supabase = authManager.getSupabase();
            
            const { error } = await supabase
                .from('grocery_lists')
                .update({
                    grocery_json: this.currentGroceryList.grocery_json
                })
                .eq('id', this.currentGroceryList.id);

            if (error) {
                console.error('Error saving grocery list changes:', error);
            }

        } catch (error) {
            console.error('Error saving grocery list changes:', error);
        }
    }

    // Calculate total items
    calculateTotalItems(categories) {
        return Object.values(categories).reduce((total, items) => total + items.length, 0);
    }

    // Calculate checked items
    calculateCheckedItems(categories) {
        return Object.values(categories).reduce((total, items) => {
            return total + items.filter(item => item.checked).length;
        }, 0);
    }

    // Helper functions for ingredient processing
    categorizeIngredient(ingredient) {
        const categories = {
            'Proteins': [
                'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'turkey', 'eggs', 
                'tofu', 'tempeh', 'beans', 'lentils', 'chickpeas', 'quinoa', 'shrimp'
            ],
            'Vegetables': [
                'tomato', 'onion', 'carrot', 'broccoli', 'spinach', 'lettuce', 'cucumber', 
                'pepper', 'bell pepper', 'garlic', 'celery', 'mushroom', 'zucchini', 
                'cauliflower', 'kale', 'cabbage', 'potato', 'sweet potato', 'asparagus'
            ],
            'Fruits': [
                'apple', 'banana', 'orange', 'berries', 'strawberry', 'blueberry', 
                'lemon', 'lime', 'grapes', 'mango', 'pineapple', 'avocado', 'peach'
            ],
            'Grains & Carbs': [
                'rice', 'pasta', 'bread', 'oats', 'flour', 'cereal', 'quinoa', 
                'barley', 'bulgur', 'couscous', 'noodles', 'crackers', 'tortilla'
            ],
            'Dairy': [
                'milk', 'cheese', 'yogurt', 'butter', 'cream', 'feta', 'mozzarella', 
                'parmesan', 'cottage cheese', 'sour cream', 'greek yogurt'
            ],
            'Pantry Staples': [
                'oil', 'olive oil', 'vinegar', 'salt', 'pepper', 'honey', 'sugar', 
                'maple syrup', 'vanilla', 'baking powder', 'flour', 'soy sauce'
            ],
            'Herbs & Spices': [
                'basil', 'oregano', 'thyme', 'rosemary', 'parsley', 'cilantro', 
                'cinnamon', 'paprika', 'cumin', 'turmeric', 'ginger', 'bay leaves'
            ],
            'Nuts & Seeds': [
                'almonds', 'walnuts', 'pecans', 'cashews', 'peanuts', 'seeds', 
                'chia seeds', 'flax seeds', 'sunflower seeds', 'pumpkin seeds'
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

    cleanIngredientText(ingredient) {
        return ingredient
            .replace(/^\d+\s*(\d+\/\d+)?\s*(cup|cups|tablespoon|tablespoons|teaspoon|teaspoons|tbsp|tsp|oz|ounce|ounces|pound|pounds|lb|lbs|clove|cloves|slice|slices|piece|pieces|large|medium|small|whole|can|jar|package|bunch)?\s*/i, '')
            .replace(/,.*$/, '')
            .replace(/\(.*\)/, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Get category icon
    getCategoryIcon(category) {
        const icons = {
            'Proteins': '🥩',
            'Vegetables': '🥬',
            'Fruits': '🍎',
            'Grains & Carbs': '🌾',
            'Dairy': '🥛',
            'Pantry Staples': '🏺',
            'Herbs & Spices': '🌿',
            'Nuts & Seeds': '🥜',
            'Other': '📦'
        };
        return icons[category] || '📦';
    }

    // Sort categories by priority
    sortCategoriesByPriority(categories) {
        const priority = [
            'Proteins', 'Vegetables', 'Fruits', 'Grains & Carbs', 
            'Dairy', 'Nuts & Seeds', 'Herbs & Spices', 'Pantry Staples', 'Other'
        ];
        
        return categories.sort((a, b) => {
            const aIndex = priority.indexOf(a);
            const bIndex = priority.indexOf(b);
            
            if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            
            return aIndex - bIndex;
        });
    }

    // Display when no grocery list is found
    displayNoGroceryList() {
        const content = document.getElementById('groceryListContent');
        if (!content) return;

        content.innerHTML = `
            <div class="no-grocery-list">
                <div class="no-list-icon">🛒</div>
                <h3>No Grocery List Found</h3>
                <p>You haven't generated a grocery list yet. Create a meal plan first, and we'll automatically generate your shopping list!</p>
                <div class="no-list-actions">
                    <button onclick="window.location.href='user.html'" class="btn-primary btn-large">
                        📝 Create Meal Plan
                    </button>
                    <button onclick="window.location.href='meal-planner.html'" class="btn-secondary">
                        🍽️ View Meal Plans
                    </button>
                </div>
            </div>
        `;

        // Hide stats
        const statsContainer = document.getElementById('groceryStats');
        if (statsContainer) statsContainer.innerHTML = '';
    }

    // Display error state
    displayError() {
        const content = document.getElementById('groceryListContent');
        if (!content) return;

        content.innerHTML = `
            <div class="error-state">
                <div class="error-icon">❌</div>
                <h3>Unable to Load Grocery List</h3>
                <p>There was an error loading your grocery list. Please try refreshing the page.</p>
                <div class="error-actions">
                    <button onclick="window.location.reload()" class="btn-secondary">
                        🔄 Refresh Page
                    </button>
                    <button onclick="window.location.href='meal-planner.html'" class="btn-primary">
                        ← Back to Meal Plan
                    </button>
                </div>
            </div>
        `;
    }

    // Utility functions
    showLoading(show) {
        const content = document.getElementById('groceryListContent');
        if (!content) return;

        if (show) {
            content.innerHTML = `
                <div class="loading-placeholder">
                    <div class="spinner"></div>
                    <p>Loading your grocery list...</p>
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

// Global functions for print and export
function printGroceryList() {
    if (!groceryDisplay || !groceryDisplay.currentGroceryList) {
        alert('No grocery list to print');
        return;
    }

    const printWindow = window.open('', '_blank');
    const groceryList = groceryDisplay.currentGroceryList.grocery_json;
    
    let printContent = `
        <html>
            <head>
                <title>Grocery List</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
                    h1 { color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
                    h2 { color: #667eea; margin-top: 25px; margin-bottom: 10px; }
                    ul { list-style-type: none; padding-left: 0; }
                    li { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; }
                    .checkbox { width: 20px; height: 20px; border: 2px solid #667eea; margin-right: 12px; }
                    .category-count { color: #666; font-size: 0.9em; }
                    .summary { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px; }
                    @media print { .no-print { display: none; } }
                </style>
            </head>
            <body>
                <h1>🛒 Grocery Shopping List</h1>
                <div class="summary">
                    <strong>Generated:</strong> ${new Date().toLocaleDateString()}<br>
                    <strong>Total Items:</strong> ${groceryDisplay.calculateTotalItems(groceryList.categories)}
                </div>
    `;
    
    Object.entries(groceryList.categories).forEach(([category, items]) => {
        if (items.length > 0) {
            const uncheckedItems = items.filter(item => !item.checked);
            printContent += `
                <h2>${groceryDisplay.getCategoryIcon(category)} ${category} 
                    <span class="category-count">(${uncheckedItems.length} items)</span>
                </h2>
                <ul>
            `;
            uncheckedItems.forEach(item => {
                printContent += `
                    <li>
                        <div class="checkbox"></div>
                        ${item.name}
                    </li>
                `;
            });
            printContent += '</ul>';
        }
    });
    
    printContent += '</body></html>';
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function exportGroceryList() {
    if (!groceryDisplay || !groceryDisplay.currentGroceryList) {
        alert('No grocery list to export');
        return;
    }

    const groceryList = groceryDisplay.currentGroceryList.grocery_json;
    let csvContent = "Category,Item,Status\n";
    
    Object.entries(groceryList.categories).forEach(([category, items]) => {
        items.forEach(item => {
            const status = item.checked ? 'Checked' : 'Unchecked';
            csvContent += `"${category}","${item.name}","${status}"\n`;
        });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grocery-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    groceryDisplay.showMessage('✅ Grocery list exported successfully!', 'success');
}

// Initialize grocery display manager
let groceryDisplay;

document.addEventListener('DOMContentLoaded', function() {
    // Wait for auth manager to be ready
    setTimeout(() => {
        if (authManager && authManager.getCurrentUser()) {
            groceryDisplay = new GroceryListDisplayManager();
        }
    }, 100);
});
