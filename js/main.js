/**
 * Healthy Brain Initiative — Main JavaScript
 * Handles signature pad, form submission, counter sync, and interactions
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    initSignaturePad();
    initPledgeForm();
    initCounters();
    initSmoothScroll();
    initNavScroll();
});

/* ===========================
   SIGNATURE PAD
   =========================== */

let signaturePad;

function initSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    if (!canvas) return;

    // Set up signature pad
    signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: '#1a1a2e',
        minWidth: 1,
        maxWidth: 3,
        throttle: 16,
        velocityFilterWeight: 0.7
    });

    // Handle canvas resize for responsive design
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;

        const ctx = canvas.getContext('2d');
        ctx.scale(ratio, ratio);

        // Clear the canvas on resize
        signaturePad.clear();
    }

    // Initial resize
    resizeCanvas();

    // Resize on window resize (debounced)
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(resizeCanvas, 200);
    });

    // Clear signature button
    const clearButton = document.getElementById('clear-signature');
    if (clearButton) {
        clearButton.addEventListener('click', function() {
            signaturePad.clear();
        });
    }
}

/**
 * Get signature as SVG string
 */
function getSignatureSVG() {
    if (!signaturePad || signaturePad.isEmpty()) {
        return null;
    }

    // Get SVG data
    const svgData = signaturePad.toSVG();
    return svgData;
}

/**
 * Get signature as Data URL (PNG)
 */
function getSignatureDataURL() {
    if (!signaturePad || signaturePad.isEmpty()) {
        return null;
    }

    return signaturePad.toDataURL('image/png');
}

/* ===========================
   PLEDGE FORM
   =========================== */

function initPledgeForm() {
    const form = document.getElementById('pledge-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Validate signature
        if (!signaturePad || signaturePad.isEmpty()) {
            alert('Please sign the commitment to proceed.');
            return;
        }

        // Get commitment checkboxes
        const commit1 = form.querySelector('[name="commit-1"]');
        const commit2 = form.querySelector('[name="commit-2"]');
        const commit3 = form.querySelector('[name="commit-3"]');
        const commit4 = form.querySelector('[name="commit-4"]');

        // Check at least one commitment is selected
        if (!commit1.checked && !commit2.checked && !commit3.checked && !commit4.checked) {
            alert('Please select at least one commitment.');
            return;
        }

        // Get privacy preference
        const privacyOption = form.querySelector('[name="privacy"]:checked');
        const isPublic = privacyOption ? privacyOption.value === 'public' : true;

        // Gather form data
        const fullName = document.getElementById('parent-name').value;
        const formData = {
            parentName: fullName,
            displayName: isPublic ? fullName : getPrivateDisplayName(fullName),
            isPublic: isPublic,
            childClass: document.getElementById('child-class').value,
            commitments: {
                noSmartphone: commit1.checked,
                noSocialMedia: commit2.checked,
                phoneFreeSchool: commit3.checked,
                leadByExample: commit4.checked
            },
            signatureSVG: getSignatureSVG(),
            signatureImage: getSignatureDataURL(),
            timestamp: new Date().toISOString()
        };

        // In production, this would send to a backend
        // For now, we'll store in localStorage for demo purposes
        savePledge(formData);

        // Show success message with signature
        showSuccessMessage(formData.signatureSVG);

        // Update all counters
        syncAllCounters();
    });
}

/**
 * Save pledge to localStorage (demo) or send to backend (production)
 */
function savePledge(data) {
    // For demo: store in localStorage
    let pledges = JSON.parse(localStorage.getItem('healthyBrain_pledges') || '[]');
    pledges.push(data);
    localStorage.setItem('healthyBrain_pledges', JSON.stringify(pledges));

    // Log for demo purposes
    console.log('Pledge saved:', data);
    console.log('Signature SVG length:', data.signatureSVG ? data.signatureSVG.length : 0);

    // In production, you would send this to your backend:
    /*
    fetch('/api/pledges', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        console.log('Pledge saved to server:', result);
    })
    .catch(error => {
        console.error('Error saving pledge:', error);
    });
    */
}

/**
 * Show success message after form submission
 */
function showSuccessMessage(signatureSVG) {
    const form = document.getElementById('pledge-form');
    const success = document.getElementById('pledge-success');
    const updatedCount = document.getElementById('updated-count');
    const signatureDisplay = document.getElementById('signature-display');

    if (form && success) {
        form.style.display = 'none';
        success.style.display = 'block';

        // Update the count in success message
        const totalCount = getTotalPledgeCount();
        if (updatedCount) {
            updatedCount.textContent = totalCount;
        }

        // Display the signature
        if (signatureDisplay && signatureSVG) {
            signatureDisplay.innerHTML = signatureSVG;
            // Style the SVG to fit nicely
            const svg = signatureDisplay.querySelector('svg');
            if (svg) {
                svg.style.width = '100%';
                svg.style.maxWidth = '300px';
                svg.style.height = 'auto';
            }
        }

        // Scroll to success message
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/* ===========================
   COUNTERS
   =========================== */

// Counter element IDs
const COUNTER_IDS = ['hero-count', 'nav-count', 'family-count', 'updated-count'];

function initCounters() {
    syncAllCounters();
    animateCountersOnScroll();
}

/**
 * Get total pledge count (demo + simulated base)
 */
function getTotalPledgeCount() {
    // Get actual pledges from localStorage
    const pledges = JSON.parse(localStorage.getItem('healthyBrain_pledges') || '[]');
    const actualCount = pledges.length;

    // For demo purposes, add a base number to make it feel real
    // In production, this would come from the database
    const baseCount = 47; // Simulated existing pledges

    return baseCount + actualCount;
}

/**
 * Sync all counter displays to the same value
 */
function syncAllCounters() {
    const count = getTotalPledgeCount();

    COUNTER_IDS.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = count;
        }
    });
}

/**
 * Animate counters when they scroll into view
 */
function animateCountersOnScroll() {
    const heroCounter = document.getElementById('hero-count');
    const familyCounter = document.getElementById('family-count');

    const targetCount = getTotalPledgeCount();

    // Track which counters have animated
    const animated = {
        hero: false,
        family: false
    };

    // Create observer for hero counter
    if (heroCounter) {
        const heroObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !animated.hero) {
                    animated.hero = true;
                    animateNumber(heroCounter, 0, targetCount, 1200);
                }
            });
        }, { threshold: 0.5 });
        heroObserver.observe(heroCounter);
    }

    // Create observer for family counter (commitment section)
    if (familyCounter) {
        const familyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !animated.family) {
                    animated.family = true;
                    animateNumber(familyCounter, 0, targetCount, 1500);
                }
            });
        }, { threshold: 0.5 });
        familyObserver.observe(familyCounter);
    }
}

/**
 * Animate a number from start to end
 */
function animateNumber(element, start, end, duration) {
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease out cubic)
        const easeOut = 1 - Math.pow(1 - progress, 3);

        const current = Math.floor(start + (end - start) * easeOut);
        element.textContent = current;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

/* ===========================
   NAVIGATION
   =========================== */

function initNavScroll() {
    const nav = document.querySelector('.nav-sticky');
    if (!nav) return;

    // Add shadow on scroll
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            nav.classList.add('nav-scrolled');
        } else {
            nav.classList.remove('nav-scrolled');
        }
    });
}

/* ===========================
   SMOOTH SCROLL
   =========================== */

function initSmoothScroll() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const navHeight = document.querySelector('.nav-sticky')?.offsetHeight || 0;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/* ===========================
   SHARE FUNCTIONALITY
   =========================== */

function shareWhatsApp() {
    const text = encodeURIComponent(
        "I've committed to protecting my child's healthy brain development as part of the Newport Healthy Brain Initiative. " +
        "Join other Newport families: " +
        window.location.href
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
}

// Make share function globally available
window.shareWhatsApp = shareWhatsApp;

/* ===========================
   UTILITY FUNCTIONS
   =========================== */

/**
 * Create a private display name from full name
 * e.g., "Sarah Murphy" becomes "Sarah M."
 */
function getPrivateDisplayName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0]; // Just first name if no surname
    }
    const firstName = parts[0];
    const surnameInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstName} ${surnameInitial}.`;
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Check if element is in viewport
 */
function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}
