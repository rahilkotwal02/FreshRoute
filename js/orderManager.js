// Order Management System for Basic Order Preparation
class OrderManager {
    constructor() {
        this.currentOrder = null;
        this.orderHistory = [];
        this.supportedStores = {
            'walmart': {
                name: 'Walmart',
                website: 'https://www.walmart.com/grocery',
                icon: '🏪',
                categories: this.getWalmartCategories()
            },
            'target': {
                name: 'Target',
                website: 'https://www.target.com/c/grocery',
                icon: '🎯',
                categories: this.getTargetCategories()
            },
            'kroger': {
                name: 'Kroger',
                website: 'https://www.kroger.com',
                icon: '🛒',
                categories: this.getKrogerCategories()
            },
            'amazon': {
                name: 'Amazon Fresh',
                website: 'https://www.amazon.com/amazonfreash',
                icon: '📦',
                categories: this.getAmazonCategories()
            },
            'instacart': {
                name: 'Instacart',
                website: 'https://www.instacart.com',
                icon: '🥕',
                categories: this.getInstacartCategories()
            }
        };
        this.init();
    }

    init() {
        // Check authentication
        if (!authManager || !authManager.getCurrentUser()) {
            console.error('User not authenticated');
            return;
        }
        
        this.loadOrderHistory();
        this.setupOrderButtons();
    }

    // Prepare order from current grocery list
    async prepareOrder(groceryList, storeName = null) {
        try {
            const order = {
                id: this.generateOrderId(),
                user_id: authManager.getCurrentUser().id,
                grocery_list_id: groceryList.id,
                created_at: new Date().toISOString(),
                store: storeName,
                status: 'prepared',
                items: this.formatItemsForOrder(groceryList.grocery_json),
                total_items: this.calculateTotalItems(groceryList.grocery_json.categories),
                estimated_cost: this.estimateOrderCost(groceryList.grocery_json.categories),
                notes: '',
                delivery_preferences: {
                    type: 'pickup', // pickup or delivery
                    date: this.getNextAvailableDate(),
                    time_slot: 'flexible'
                }
            };

            this.currentOrder = order;
            await this.saveOrder(order);
            
            return order;
        } catch (error) {
            console.error('Error preparing order:', error);
            throw error;
        }
    }

    // Format items for order
    formatItemsForOrder(groceryListJson) {
        const formattedItems = {};
        
        Object.entries(groceryListJson.categories).forEach(([category, items]) => {
            formattedItems[category] = items
                .filter(item => !item.checked) // Only unchecked items
                .map(item => ({
                    name: item.name,
                    original: item.original,
                    quantity: this.extractQuantity(item.original),
                    unit: this.extractUnit(item.original),
                    estimated_price: this.estimateItemPrice(item.name, category),
                    priority: this.getItemPriority(item.name, category)
                }));
        });

        return formattedItems;
    }

    // Generate different order formats
    generateOrderFormats(order) {
        return {
            simple_list: this.generateSimpleList(order),
            categorized_list: this.generateCategorizedList(order),
            store_format: this.generateStoreFormat(order),
            shopping_checklist: this.generateShoppingChecklist(order),
            email_format: this.generateEmailFormat(order)
        };
    }

    // Generate simple shopping list
    generateSimpleList(order) {
        let list = `🛒 Shopping List - ${new Date(order.created_at).toLocaleDateString()}\n\n`;
        
        Object.entries(order.items).forEach(([category, items]) => {
            if (items.length > 0) {
                list += `${this.getCategoryIcon(category)} ${category}:\n`;
                items.forEach(item => {
                    list += `  • ${item.original || item.name}\n`;
                });
                list += '\n';
            }
        });

        list += `\nTotal Items: ${order.total_items}`;
        list += `\nEstimated Cost: $${order.estimated_cost.toFixed(2)}`;
        
        return list;
    }

    // Generate categorized list for store navigation
    generateCategorizedList(order) {
        const storeLayout = this.getOptimalStoreLayout();
        let list = `🏪 Store-Optimized Shopping List\n`;
        list += `Generated: ${new Date(order.created_at).toLocaleDateString()}\n`;
        list += `Estimated Total: $${order.estimated_cost.toFixed(2)}\n\n`;

        storeLayout.forEach(section => {
            const sectionItems = [];
            Object.entries(order.items).forEach(([category, items]) => {
                if (section.categories.includes(category) && items.length > 0) {
                    sectionItems.push(...items.map(item => ({ ...item, category })));
                }
            });

            if (sectionItems.length > 0) {
                list += `🚶 ${section.name}:\n`;
                sectionItems.forEach(item => {
                    const priority = item.priority === 'high' ? '⭐' : '';
                    list += `  ☐ ${item.original || item.name} ${priority}\n`;
                });
                list += '\n';
            }
        });

        return list;
    }

    // Generate store-specific format
    generateStoreFormat(order, storeName) {
        const store = this.supportedStores[storeName];
        if (!store) return this.generateSimpleList(order);

        let format = `${store.icon} ${store.name} Shopping List\n`;
        format += `${store.website}\n\n`;
        format += `Order ID: ${order.id}\n`;
        format += `Date: ${new Date(order.created_at).toLocaleDateString()}\n`;
        format += `Items: ${order.total_items} | Est. Cost: $${order.estimated_cost.toFixed(2)}\n\n`;

        // Map to store categories
        const storeCategoryMapping = this.mapToStoreCategories(order.items, store.categories);
        
        Object.entries(storeCategoryMapping).forEach(([storeCategory, items]) => {
            if (items.length > 0) {
                format += `📍 ${storeCategory}:\n`;
                items.forEach(item => {
                    format += `  • ${item.quantity || ''} ${item.name}\n`;
                });
                format += '\n';
            }
        });

        format += `\n💡 Tips for ${store.name}:\n`;
        format += this.getStoreTips(storeName);

        return format;
    }

    // Generate shopping checklist
    generateShoppingChecklist(order) {
        let checklist = `✅ Interactive Shopping Checklist\n`;
        checklist += `📅 ${new Date(order.created_at).toLocaleDateString()}\n\n`;

        Object.entries(order.items).forEach(([category, items]) => {
            if (items.length > 0) {
                checklist += `${this.getCategoryIcon(category)} ${category} (${items.length} items):\n`;
                items.forEach((item, index) => {
                    checklist += `  ☐ ${item.original || item.name}`;
                    if (item.estimated_price > 0) {
                        checklist += ` - ~$${item.estimated_price.toFixed(2)}`;
                    }
                    checklist += '\n';
                });
                checklist += '\n';
            }
        });

        checklist += `\n📊 Order Summary:\n`;
        checklist += `• Total Items: ${order.total_items}\n`;
        checklist += `• Estimated Cost: $${order.estimated_cost.toFixed(2)}\n`;
        checklist += `• Preparation Time: ~${Math.ceil(order.total_items * 1.5)} minutes\n`;

        return checklist;
    }

    // Generate email format
    generateEmailFormat(order) {
        let email = {
            subject: `Grocery Shopping List - ${new Date(order.created_at).toLocaleDateString()}`,
            body: `Hello!\n\nHere's your grocery shopping list prepared by Smart Meal Planner:\n\n`
        };

        email.body += this.generateCategorizedList(order);
        
        email.body += `\n\n🚗 Delivery Preferences:\n`;
        email.body += `• Type: ${order.delivery_preferences.type}\n`;
        email.body += `• Preferred Date: ${order.delivery_preferences.date}\n`;
        email.body += `• Time: ${order.delivery_preferences.time_slot}\n`;

        email.body += `\n\n📱 Generated by Smart Meal Planner\n`;
        email.body += `Order ID: ${order.id}`;

        return email;
    }

    // Save order to database
    async saveOrder(order) {
        try {
            const supabase = authManager.getSupabase();
            
            const { data, error } = await supabase
                .from('orders')
                .insert([{
                    id: order.id,
                    user_id: order.user_id,
                    grocery_list_id: order.grocery_list_id,
                    store: order.store,
                    status: order.status,
                    items_json: order.items,
                    total_items: order.total_items,
                    estimated_cost: order.estimated_cost,
                    delivery_preferences: order.delivery_preferences,
                    notes: order.notes,
                    created_at: order.created_at
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('Order saved successfully:', data);
            this.orderHistory.push(data);
            return data;

        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    }

    // Load order history
    async loadOrderHistory() {
        try {
            const supabase = authManager.getSupabase();
            const userId = authManager.getCurrentUser().id;

            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            this.orderHistory = data || [];
            console.log('Order history loaded:', this.orderHistory);

        } catch (error) {
            console.error('Error loading order history:', error);
        }
    }

    // Utility functions
    extractQuantity(ingredientText) {
        const match = ingredientText.match(/^(\d+(?:\.\d+)?(?:\s*\d+\/\d+)?)/);
        return match ? match[1].trim() : '1';
    }

    extractUnit(ingredientText) {
        const units = ['cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'lbs', 'piece', 'pieces', 'can', 'jar', 'package'];
        const lowerText = ingredientText.toLowerCase();
        
        for (const unit of units) {
            if (lowerText.includes(unit)) {
                return unit;
            }
        }
        return 'item';
    }

    estimateItemPrice(itemName, category) {
        const priceRanges = {
            'Proteins': { min: 3, max: 12, avg: 7 },
            'Vegetables': { min: 1, max: 5, avg: 2.5 },
            'Fruits': { min: 1, max: 6, avg: 3 },
            'Grains & Carbs': { min: 1, max: 4, avg: 2 },
            'Dairy': { min: 2, max: 8, avg: 4 },
            'Pantry Staples': { min: 1, max: 6, avg: 3 },
            'Herbs & Spices': { min: 1, max: 4, avg: 2 },
            'Nuts & Seeds': { min: 2, max: 8, avg: 5 }
        };

        const range = priceRanges[category] || { avg: 3 };
        return range.avg + (Math.random() - 0.5) * 2; // Add some variation
    }

    calculateTotalItems(categories) {
        return Object.values(categories).reduce((total, items) => {
            return total + items.filter(item => !item.checked).length;
        }, 0);
    }

    estimateOrderCost(categories) {
        let total = 0;
        Object.entries(categories).forEach(([category, items]) => {
            items.filter(item => !item.checked).forEach(item => {
                total += this.estimateItemPrice(item.name, category);
            });
        });
        return total;
    }

    getItemPriority(itemName, category) {
        const highPriorityItems = ['milk', 'bread', 'eggs', 'chicken', 'rice', 'pasta'];
        return highPriorityItems.some(priority => 
            itemName.toLowerCase().includes(priority.toLowerCase())
        ) ? 'high' : 'normal';
    }

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

    getOptimalStoreLayout() {
        return [
            {
                name: 'Produce Section',
                categories: ['Fruits', 'Vegetables']
            },
            {
                name: 'Meat & Seafood',
                categories: ['Proteins']
            },
            {
                name: 'Dairy & Eggs',
                categories: ['Dairy']
            },
            {
                name: 'Bakery & Bread',
                categories: ['Grains & Carbs']
            },
            {
                name: 'Pantry & Canned Goods',
                categories: ['Pantry Staples']
            },
            {
                name: 'Snacks & Nuts',
                categories: ['Nuts & Seeds']
            },
            {
                name: 'Spices & Condiments',
                categories: ['Herbs & Spices']
            },
            {
                name: 'Other Items',
                categories: ['Other']
            }
        ];
    }

    mapToStoreCategories(items, storeCategories) {
        // Map our categories to store-specific categories
        const mapped = {};
        Object.keys(storeCategories).forEach(category => {
            mapped[category] = [];
        });

        Object.entries(items).forEach(([category, categoryItems]) => {
            const storeCategory = this.findBestStoreCategory(category, storeCategories);
            if (mapped[storeCategory]) {
                mapped[storeCategory].push(...categoryItems);
            }
        });

        return mapped;
    }

    findBestStoreCategory(category, storeCategories) {
        const categoryMapping = {
            'Proteins': ['Meat', 'Seafood', 'Deli', 'Protein'],
            'Vegetables': ['Produce', 'Fresh', 'Vegetables'],
            'Fruits': ['Produce', 'Fresh', 'Fruits'],
            'Dairy': ['Dairy', 'Refrigerated', 'Milk'],
            'Grains & Carbs': ['Bakery', 'Bread', 'Pantry'],
            'Pantry Staples': ['Pantry', 'Canned Goods', 'Grocery'],
            'Herbs & Spices': ['Spices', 'Condiments', 'Pantry'],
            'Nuts & Seeds': ['Snacks', 'Nuts', 'Health Food']
        };

        const possibleMatches = categoryMapping[category] || [category];
        
        for (const match of possibleMatches) {
            const found = Object.keys(storeCategories).find(storeCategory =>
                storeCategory.toLowerCase().includes(match.toLowerCase())
            );
            if (found) return found;
        }

        return Object.keys(storeCategories)[0] || 'General';
    }

    getStoreTips(storeName) {
        const tips = {
            'walmart': '• Use Walmart app for easy navigation\n• Check for rollback prices\n• Visit early morning for best selection',
            'target': '• Use Target Circle for discounts\n• Check endcaps for deals\n• RedCard saves 5% on groceries',
            'kroger': '• Use Kroger Plus card for savings\n• Check weekly ad for specials\n• Digital coupons available in app',
            'amazon': '• Free delivery on orders $35+\n• Check Prime member deals\n• Schedule delivery for convenience',
            'instacart': '• Compare prices across stores\n• Tip your shopper fairly\n• Check for replacement preferences'
        };
        
        return tips[storeName] || '• Compare prices for best deals\n• Bring reusable bags\n• Check expiration dates';
    }

    // Store category definitions
    getWalmartCategories() {
        return {
            'Fresh Produce': ['Fruits', 'Vegetables'],
            'Meat & Seafood': ['Fresh meat', 'Seafood'],
            'Dairy & Eggs': ['Milk', 'Cheese', 'Eggs'],
            'Deli & Bakery': ['Deli meats', 'Fresh bread'],
            'Pantry': ['Canned goods', 'Pasta', 'Rice'],
            'Frozen': ['Frozen vegetables', 'Frozen meals'],
            'Snacks': ['Chips', 'Nuts', 'Crackers'],
            'Beverages': ['Water', 'Juice', 'Soda']
        };
    }

    getTargetCategories() {
        return {
            'Fresh Food': ['Produce', 'Meat', 'Dairy'],
            'Pantry Essentials': ['Canned goods', 'Grains', 'Condiments'],
            'Frozen': ['Frozen foods'],
            'Snacks & Candy': ['Snacks', 'Nuts'],
            'Beverages': ['Drinks', 'Water'],
            'Health & Beauty': ['Vitamins', 'Personal care']
        };
    }

    getKrogerCategories() {
        return {
            'Produce': ['Fresh fruits', 'Vegetables'],
            'Meat Department': ['Fresh meat', 'Seafood'],
            'Dairy': ['Milk', 'Cheese', 'Yogurt'],
            'Natural Foods': ['Organic', 'Health foods'],
            'Grocery': ['Pantry items', 'Canned goods'],
            'Frozen Foods': ['Frozen items'],
            'Floral & Garden': ['Herbs', 'Flowers']
        };
    }

    getAmazonCategories() {
        return {
            'Fresh': ['Produce', 'Meat', 'Dairy'],
            'Pantry': ['Non-perishables', 'Canned goods'],
            'Frozen': ['Frozen foods'],
            'Beverages': ['Drinks'],
            'Snacks': ['Chips', 'Nuts'],
            'Health & Personal Care': ['Vitamins', 'Care items']
        };
    }

    getInstacartCategories() {
        return {
            'Produce': ['Fruits', 'Vegetables'],
            'Meat & Seafood': ['Fresh meat'],
            'Dairy & Eggs': ['Dairy products'],
            'Pantry': ['Shelf-stable items'],
            'Frozen': ['Frozen foods'],
            'Beverages': ['Drinks'],
            'Snacks & Candy': ['Snacks'],
            'Other': ['Miscellaneous']
        };
    }

    getNextAvailableDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toLocaleDateString();
    }

    generateOrderId() {
        return 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    }

    setupOrderButtons() {
        // This will be called to set up order buttons in the grocery list page
        this.addOrderButtonsToGroceryPage();
    }

    addOrderButtonsToGroceryPage() {
        // Add order preparation buttons to the grocery list page
        const actionContainer = document.querySelector('.plan-actions');
        if (actionContainer && !document.getElementById('orderActions')) {
            const orderActionsHtml = `
                <div id="orderActions" class="order-actions">
                    <button onclick="orderManager.showOrderModal()" class="btn-success">
                        🛒 Prepare Order
                    </button>
                    <button onclick="orderManager.showOrderHistory()" class="btn-info">
                        📋 Order History
                    </button>
                </div>
            `;
            actionContainer.insertAdjacentHTML('beforeend', orderActionsHtml);
        }
    }

    async showOrderModal() {
        if (!groceryDisplay || !groceryDisplay.currentGroceryList) {
            alert('No grocery list available for order preparation');
            return;
        }

        // Create and show order preparation modal
        this.createOrderModal();
    }

    createOrderModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('orderModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div id="orderModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🛒 Prepare Your Order</h3>
                        <button onclick="orderManager.closeOrderModal()" class="close-btn">✕</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="order-options">
                            <h4>Choose Order Format:</h4>
                            
                            <div class="format-grid">
                                <button onclick="orderManager.prepareFormat('simple')" class="format-btn">
                                    📝 Simple List
                                    <span class="format-desc">Basic shopping list</span>
                                </button>
                                
                                <button onclick="orderManager.prepareFormat('categorized')" class="format-btn">
                                    🗂️ Store Layout
                                    <span class="format-desc">Organized by store sections</span>
                                </button>
                                
                                <button onclick="orderManager.prepareFormat('checklist')" class="format-btn">
                                    ✅ Interactive Checklist
                                    <span class="format-desc">Check off items while shopping</span>
                                </button>
                                
                                <button onclick="orderManager.prepareFormat('email')" class="format-btn">
                                    📧 Email Format
                                    <span class="format-desc">Share via email</span>
                                </button>
                            </div>
                            
                            <div class="store-selection">
                                <h4>Select Store (Optional):</h4>
                                <div class="store-grid">
                                    ${Object.entries(this.supportedStores).map(([key, store]) => `
                                        <button onclick="orderManager.prepareStoreFormat('${key}')" class="store-btn">
                                            ${store.icon} ${store.name}
                                        </button>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    async prepareFormat(formatType) {
        try {
            const order = await this.prepareOrder(groceryDisplay.currentGroceryList);
            const formats = this.generateOrderFormats(order);
            
            let content = '';
            switch(formatType) {
                case 'simple':
                    content = formats.simple_list;
                    break;
                case 'categorized':
                    content = formats.categorized_list;
                    break;
                case 'checklist':
                    content = formats.shopping_checklist;
                    break;
                case 'email':
                    const emailFormat = formats.email_format;
                    this.openEmailClient(emailFormat.subject, emailFormat.body);
                    this.closeOrderModal();
                    return;
            }
            
            this.showOrderPreview(content, formatType);
            
        } catch (error) {
            console.error('Error preparing order:', error);
            alert('Failed to prepare order. Please try again.');
        }
    }

    async prepareStoreFormat(storeKey) {
        try {
            const order = await this.prepareOrder(groceryDisplay.currentGroceryList, storeKey);
            const content = this.generateStoreFormat(order, storeKey);
            
            this.showOrderPreview(content, `${this.supportedStores[storeKey].name} Format`);
            
        } catch (error) {
            console.error('Error preparing store format:', error);
            alert('Failed to prepare store format. Please try again.');
        }
    }

    showOrderPreview(content, title) {
        const previewHtml = `
            <div id="orderPreview" class="modal-overlay">
                <div class="modal-content large">
                    <div class="modal-header">
                        <h3>📋 ${title}</h3>
                        <button onclick="orderManager.closePreview()" class="close-btn">✕</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="preview-actions">
                            <button onclick="orderManager.copyToClipboard()" class="btn-info">
                                📋 Copy to Clipboard
                            </button>
                            <button onclick="orderManager.downloadAsText()" class="btn-secondary">
                                💾 Download as Text
                            </button>
                            <button onclick="orderManager.printOrder()" class="btn-primary">
                                🖨️ Print
                            </button>
                        </div>
                        
                        <div class="order-content">
                            <pre id="orderText">${content}</pre>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', previewHtml);
        this.closeOrderModal();
    }

    copyToClipboard() {
        const orderText = document.getElementById('orderText').textContent;
        navigator.clipboard.writeText(orderText).then(() => {
            this.showMessage('✅ Order copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = orderText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showMessage('✅ Order copied to clipboard!', 'success');
        });
    }

    downloadAsText() {
        const orderText = document.getElementById('orderText').textContent;
        const blob = new Blob([orderText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `grocery-order-${new Date().toISOString().split('T')[0]}.txt`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.showMessage('✅ Order downloaded successfully!', 'success');
    }

    printOrder() {
        const orderText = document.getElementById('orderText').textContent;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Grocery Order</title>
                    <style>
                        body { font-family: monospace; margin: 20px; line-height: 1.4; }
                        pre { white-space: pre-wrap; word-wrap: break-word; }
                    </style>
                </head>
                <body>
                    <pre>${orderText}</pre>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    openEmailClient(subject, body) {
        const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;
        this.showMessage('📧 Email client opened with your order!', 'success');
    }

    closeOrderModal() {
        const modal = document.getElementById('orderModal');
        if (modal) modal.remove();
    }

    closePreview() {
        const preview = document.getElementById('orderPreview');
        if (preview) preview.remove();
    }

    showOrderHistory() {
        // Implementation for showing order history
        const historyHtml = `
            <div id="orderHistoryModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>📋 Order History</h3>
                        <button onclick="orderManager.closeOrderHistory()" class="close-btn">✕</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="order-history-list">
                            ${this.orderHistory.length > 0 ? 
                                this.orderHistory.map(order => `
                                    <div class="history-item">
                                        <div class="history-header">
                                            <h4>Order ${order.id}</h4>
                                            <span class="order-date">${new Date(order.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div class="history-details">
                                            <span>${order.total_items} items</span>
                                            <span>$${order.estimated_cost.toFixed(2)} estimated</span>
                                            <span class="order-status ${order.status}">${order.status}</span>
                                        </div>
                                    </div>
                                `).join('') :
                                '<p class="no-history">No order history found.</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', historyHtml);
    }

    closeOrderHistory() {
        const modal = document.getElementById('orderHistoryModal');
        if (modal) modal.remove();
    }

    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('messages') || 
                                 document.querySelector('.grocery-container') ||
                                 document.body;

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

// Initialize order manager
let orderManager;

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        if (authManager && authManager.getCurrentUser()) {
            orderManager = new OrderManager();
        }
    }, 500);
});
