class CharacterCustomizer {
    constructor() {
        this.currentCategory = 'hair';
        this.currentStyles = {
            hair: 'hair-style-1',
            eyes: 'eyes-style-1',
            top: 'top-style-1',
            bottom: 'bottom-style-1',
            shoes: 'shoes-style-1',
            glasses: '',
            hat: '',
            jewelry: '',
            bag: ''
        };
        
        this.styleOptions = {
            hair: [
                { id: 'hair-style-1', name: 'Brown Classic', class: 'hair-style-1' },
                { id: 'hair-style-2', name: 'Blonde Wavy', class: 'hair-style-2' },
                { id: 'hair-style-3', name: 'Black Curly', class: 'hair-style-3' },
                { id: 'hair-style-4', name: 'Red Messy', class: 'hair-style-4' },
                { id: 'hair-style-5', name: 'Purple Punk', class: 'hair-style-5' },
                { id: 'hair-style-6', name: 'Brown Pixie', class: 'hair-style-6' },
                { id: 'hair-style-7', name: 'Red Bob', class: 'hair-style-7' },
                { id: 'hair-style-8', name: 'Green Mohawk', class: 'hair-style-8' },
                { id: 'hair-style-9', name: 'Pink Ombre', class: 'hair-style-9' },
                { id: 'hair-style-10', name: 'Cyan Waves', class: 'hair-style-10' },
                { id: 'none', name: 'Bald', class: '' }
            ],
            eyes: [
                { id: 'eyes-style-1', name: 'Brown Eyes', class: 'eyes-style-1' },
                { id: 'eyes-style-2', name: 'Blue Eyes', class: 'eyes-style-2' },
                { id: 'eyes-style-3', name: 'Green Eyes', class: 'eyes-style-3' },
                { id: 'eyes-style-4', name: 'Hazel Eyes', class: 'eyes-style-4' },
                { id: 'eyes-style-5', name: 'Sleepy Eyes', class: 'eyes-style-5' }
            ],
            top: [
                { id: 'top-style-1', name: 'Red T-Shirt', class: 'top-style-1' },
                { id: 'top-style-2', name: 'Teal Blouse', class: 'top-style-2' },
                { id: 'top-style-3', name: 'Blue Hoodie', class: 'top-style-3' },
                { id: 'top-style-4', name: 'Green Sweater', class: 'top-style-4' },
                { id: 'top-style-5', name: 'Yellow Tank', class: 'top-style-5' },
                { id: 'top-style-6', name: 'Purple Shirt', class: 'top-style-6' },
                { id: 'top-style-7', name: 'Pink Crop Top', class: 'top-style-7' },
                { id: 'top-style-8', name: 'Forest Jacket', class: 'top-style-8' },
                { id: 'top-style-9', name: 'Orange Polo', class: 'top-style-9' },
                { id: 'top-style-10', name: 'Ocean Tee', class: 'top-style-10' },
                { id: 'top-style-11', name: 'Striped Shirt', class: 'top-style-11' },
                { id: 'top-style-12', name: 'Galaxy Top', class: 'top-style-12' },
                { id: 'none', name: 'No Top', class: '' }
            ],
            bottom: [
                { id: 'bottom-style-1', name: 'Dark Jeans', class: 'bottom-style-1' },
                { id: 'bottom-style-2', name: 'Purple Leggings', class: 'bottom-style-2' },
                { id: 'bottom-style-3', name: 'Green Cargo', class: 'bottom-style-3' },
                { id: 'bottom-style-4', name: 'Khaki Shorts', class: 'bottom-style-4' },
                { id: 'bottom-style-5', name: 'Red Pants', class: 'bottom-style-5' },
                { id: 'bottom-style-6', name: 'Gray Slacks', class: 'bottom-style-6' },
                { id: 'bottom-style-7', name: 'Violet Skirt', class: 'bottom-style-7' },
                { id: 'bottom-style-8', name: 'Teal Capris', class: 'bottom-style-8' },
                { id: 'bottom-style-9', name: 'Gold Pants', class: 'bottom-style-9' },
                { id: 'bottom-style-10', name: 'Orange Shorts', class: 'bottom-style-10' },
                { id: 'bottom-style-11', name: 'Silver Jeans', class: 'bottom-style-11' },
                { id: 'bottom-style-12', name: 'Pinstripe Pants', class: 'bottom-style-12' },
                { id: 'none', name: 'No Bottom', class: '' }
            ],
            shoes: [
                { id: 'shoes-style-1', name: 'Black Sneakers', class: 'shoes-style-1' },
                { id: 'shoes-style-2', name: 'Brown Boots', class: 'shoes-style-2' },
                { id: 'shoes-style-3', name: 'Red High-tops', class: 'shoes-style-3' },
                { id: 'shoes-style-4', name: 'White Tennis', class: 'shoes-style-4' },
                { id: 'shoes-style-5', name: 'Gold Loafers', class: 'shoes-style-5' },
                { id: 'shoes-style-6', name: 'Purple Heels', class: 'shoes-style-6' },
                { id: 'shoes-style-7', name: 'Pink Flats', class: 'shoes-style-7' },
                { id: 'shoes-style-8', name: 'Cyan Sandals', class: 'shoes-style-8' },
                { id: 'shoes-style-9', name: 'Green Crocs', class: 'shoes-style-9' },
                { id: 'shoes-style-10', name: 'Orange Clogs', class: 'shoes-style-10' },
                { id: 'none', name: 'Barefoot', class: '' }
            ],
            glasses: [
                { id: 'glasses-style-1', name: 'Black Frames', class: 'glasses-style-1' },
                { id: 'glasses-style-2', name: 'Red Sunglasses', class: 'glasses-style-2' },
                { id: 'glasses-style-3', name: 'Gold Aviators', class: 'glasses-style-3' },
                { id: 'glasses-style-4', name: 'Purple Cat-eye', class: 'glasses-style-4' },
                { id: 'none', name: 'No Glasses', class: '' }
            ],
            hat: [
                { id: 'hat-style-1', name: 'Brown Fedora', class: 'hat-style-1' },
                { id: 'hat-style-2', name: 'Red Baseball Cap', class: 'hat-style-2' },
                { id: 'hat-style-3', name: 'Navy Beanie', class: 'hat-style-3' },
                { id: 'hat-style-4', name: 'Gold Sun Hat', class: 'hat-style-4' },
                { id: 'hat-style-5', name: 'Pink Beret', class: 'hat-style-5' },
                { id: 'hat-style-6', name: 'Cyan Bucket Hat', class: 'hat-style-6' },
                { id: 'hat-style-7', name: 'Rainbow Cap', class: 'hat-style-7' },
                { id: 'none', name: 'No Hat', class: '' }
            ],
            jewelry: [
                { id: 'jewelry-style-1', name: 'Gold Necklace', class: 'jewelry-style-1' },
                { id: 'jewelry-style-2', name: 'Silver Chain', class: 'jewelry-style-2' },
                { id: 'jewelry-style-3', name: 'Ruby Pendant', class: 'jewelry-style-3' },
                { id: 'jewelry-style-4', name: 'Turquoise Stone', class: 'jewelry-style-4' },
                { id: 'jewelry-style-5', name: 'Emerald Gem', class: 'jewelry-style-5' },
                { id: 'jewelry-style-6', name: 'Rainbow Crystal', class: 'jewelry-style-6' },
                { id: 'none', name: 'No Jewelry', class: '' }
            ],
            bag: [
                { id: 'bag-style-1', name: 'Brown Backpack', class: 'bag-style-1' },
                { id: 'bag-style-2', name: 'Black Purse', class: 'bag-style-2' },
                { id: 'bag-style-3', name: 'Pink Tote', class: 'bag-style-3' },
                { id: 'bag-style-4', name: 'Purple Satchel', class: 'bag-style-4' },
                { id: 'bag-style-5', name: 'Orange Messenger', class: 'bag-style-5' },
                { id: 'bag-style-6', name: 'Cyan Crossbody', class: 'bag-style-6' },
                { id: 'bag-style-7', name: 'Striped Bag', class: 'bag-style-7' },
                { id: 'none', name: 'No Bag', class: '' }
            ]
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateOptionsGrid();
        this.updateCharacterDisplay();
    }
    
    setupEventListeners() {
        // Tab buttons
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchCategory(e.target.dataset.category);
            });
        });
        
        // Action buttons
        document.getElementById('randomize-btn').addEventListener('click', () => {
            this.randomizeCharacter();
        });
        
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetCharacter();
        });
    }
    
    switchCategory(category) {
        this.currentCategory = category;
        
        // Update tab button states
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-category="${category}"]`).classList.add('active');
        
        this.updateOptionsGrid();
    }
    
    updateOptionsGrid() {
        const optionsGrid = document.getElementById('options-grid');
        optionsGrid.innerHTML = '';
        
        this.styleOptions[this.currentCategory].forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'option-item';
            optionElement.innerHTML = option.name;
            
            if (option.class) {
                optionElement.classList.add(option.class);
            } else {
                optionElement.style.background = '#f8f9fa';
                optionElement.style.border = '2px dashed #ccc';
                optionElement.innerHTML = '✕ ' + option.name;
            }
            
            if (this.currentStyles[this.currentCategory] === option.class) {
                optionElement.classList.add('selected');
            }
            
            optionElement.addEventListener('click', () => {
                this.selectStyle(this.currentCategory, option.class);
                this.updateOptionsGrid();
                this.updateCharacterDisplay();
            });
            
            optionsGrid.appendChild(optionElement);
        });
    }
    
    selectStyle(category, styleClass) {
        this.currentStyles[category] = styleClass;
    }
    
    updateCharacterDisplay() {
        // Update all character parts
        Object.keys(this.currentStyles).forEach(category => {
            let element = document.getElementById(category);
            
            // Handle special cases for new structure
            if (category === 'eyes') {
                element = document.getElementById('eyes');
            }
            
            if (element) {
                element.className = `${category === 'eyes' ? 'eyes' : 'character-part ' + category}`;
                
                if (this.currentStyles[category]) {
                    element.classList.add(this.currentStyles[category]);
                }
            }
        });
    }
    
    randomizeCharacter() {
        Object.keys(this.styleOptions).forEach(category => {
            const options = this.styleOptions[category];
            const randomOption = options[Math.floor(Math.random() * options.length)];
            this.currentStyles[category] = randomOption.class;
        });
        
        this.updateCharacterDisplay();
        this.updateOptionsGrid();
        
        // Add extra sparkles for randomize
        for(let i = 0; i < 5; i++) {
            setTimeout(() => {
                addSparkleEffect(document.querySelector('.character-display'));
            }, i * 200);
        }
    }
    
    resetCharacter() {
        this.currentStyles = {
            hair: 'hair-style-1',
            eyes: 'eyes-style-1',
            top: 'top-style-1',
            bottom: 'bottom-style-1',
            shoes: 'shoes-style-1',
            glasses: '',
            hat: '',
            jewelry: '',
            bag: ''
        };
        
        this.updateCharacterDisplay();
        this.updateOptionsGrid();
    }
    
    saveCharacter() {
        localStorage.setItem('characterStyles', JSON.stringify(this.currentStyles));
        alert('Character saved! 💾');
    }
    
    loadCharacter() {
        const saved = localStorage.getItem('characterStyles');
        if (saved) {
            this.currentStyles = JSON.parse(saved);
            this.updateCharacterDisplay();
            this.updateOptionsGrid();
            alert('Character loaded! 📁');
        } else {
            alert('No saved character found! 🚫');
        }
    }
}

// Enhanced sparkle effect with different colors
function addSparkleEffect(element) {
    const sparkleColors = ['✨', '⭐', '🌟', '💫', '🔆'];
    const sparkle = document.createElement('div');
    sparkle.innerHTML = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
    sparkle.style.position = 'absolute';
    sparkle.style.pointerEvents = 'none';
    sparkle.style.animation = 'sparkle 1.5s ease-out forwards';
    sparkle.style.left = Math.random() * element.offsetWidth + 'px';
    sparkle.style.top = Math.random() * element.offsetHeight + 'px';
    sparkle.style.fontSize = '20px';
    sparkle.style.zIndex = '100';
    
    element.style.position = 'relative';
    element.appendChild(sparkle);
    
    setTimeout(() => {
        sparkle.remove();
    }, 1500);
}

// Add enhanced sparkle animation to CSS dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes sparkle {
        0% {
            opacity: 0;
            transform: scale(0) rotate(0deg) translateY(0px);
        }
        50% {
            opacity: 1;
            transform: scale(1.2) rotate(180deg) translateY(-10px);
        }
        100% {
            opacity: 0;
            transform: scale(0) rotate(360deg) translateY(-30px);
        }
    }
    
    .character-display {
        overflow: hidden;
    }
`;
document.head.appendChild(style);

// Add sparkle effects when customizing
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('option-item')) {
        addSparkleEffect(document.querySelector('.character-display'));
    }
});

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CharacterCustomizer();
    
    // Add welcome message with more personality
    setTimeout(() => {
        console.log('🎮 Character Customization Game Ready!');
        console.log('👤 Create your unique human character!');
        console.log('✨ Mix and match from tons of clothing options!');
        console.log('👗 Explore different styles: casual, formal, funky!');
        console.log('🎲 Use Randomize for surprise fashion combinations!');
        console.log('💾 Your creations auto-save in your browser!');
    }, 500);
});