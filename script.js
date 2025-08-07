// Create floating bubbles
function createBubbles() {
    const bubblesContainer = document.getElementById('bubbles');
    const bubbleCount = 15;
    
    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        
        // Random size (10px to 100px)
        const size = Math.random() * 90 + 10;
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        
        // Random position
        bubble.style.left = `${Math.random() * 100}vw`;
        bubble.style.top = `${Math.random() * 100}vh`;
        
        // Random animation
        bubble.style.animationDuration = `${Math.random() * 15 + 10}s`;
        bubble.style.animationDelay = `${Math.random() * 5}s`;
        
        bubblesContainer.appendChild(bubble);
    }
}

// Button hover effects
document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'scale(1.05) translateY(-3px)';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'scale(1)';
    });
});

// Initialize on load
window.addEventListener('load', createBubbles);
