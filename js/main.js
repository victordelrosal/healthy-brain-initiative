/**
 * Healthy Brains Initiative — Main JavaScript
 * Handles signature pad, form submission, counter sync, and interactions
 * Now with Firebase integration
 */

// Firebase imports
import { savePledgeToFirebase, getPledgeCount, subscribeToPledgeCount, signInWithGoogle, linkPledgeToUser, onAuthChange, saveEmailSubscriber, addEmailToPledge, getPublicPledges } from './firebase-config.js';

// Base count (existing pledges before going live)
const BASE_PLEDGE_COUNT = 0;

// Track real-time count
let currentPledgeCount = BASE_PLEDGE_COUNT;

// Track the current pledge ID (for linking to auth)
let currentPledgeId = null;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize components
    initSignaturePad();
    initPledgeForm();
    initCounters();
    initSmoothScroll();
    initNavScroll();

    // Subscribe to real-time pledge count updates
    initRealtimeCounter();

    // Load public pledge names for social proof
    loadPublicPledgeNames();
});

/* ===========================
   REALTIME COUNTER (Firebase)
   =========================== */

async function initRealtimeCounter() {
    try {
        // Get initial count from Firebase
        const firebaseCount = await getPledgeCount();
        currentPledgeCount = BASE_PLEDGE_COUNT + firebaseCount;
        syncAllCounters();

        // Subscribe to real-time updates
        subscribeToPledgeCount((count) => {
            currentPledgeCount = BASE_PLEDGE_COUNT + count;
            syncAllCounters();
        });
    } catch (error) {
        console.error('Error initializing counter:', error);
        // Fallback to localStorage count
        const localPledges = JSON.parse(localStorage.getItem('healthyBrain_pledges') || '[]');
        currentPledgeCount = BASE_PLEDGE_COUNT + localPledges.length;
        syncAllCounters();
    }
}

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

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Validate signature
        if (!signaturePad || signaturePad.isEmpty()) {
            alert('Please sign the commitment to proceed.');
            return;
        }

        // Get the main commitment checkbox
        const commit1 = form.querySelector('[name="commit-1"]');

        // Check the commitment is selected
        if (!commit1.checked) {
            alert('Please check the commitment box to proceed.');
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
            commitment: 'No smartphone until secondary school',
            signatureSVG: getSignatureSVG(),
            signatureImage: getSignatureDataURL(),
            timestamp: new Date().toISOString()
        };

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Saving...';
        submitBtn.disabled = true;

        // Save to Firebase
        const result = await savePledgeToFirebase(formData);

        if (result.success) {
            console.log('Pledge saved to Firebase:', result.id);
            currentPledgeId = result.id;
        } else {
            console.log('Firebase save failed, saving locally');
            // Fallback to localStorage
            savePledgeLocally(formData);
        }

        // Also save locally as backup
        savePledgeLocally(formData);

        // Show success message with signature and social proof
        showSuccessMessage(formData.signatureSVG, formData.displayName);

        // Reset button (though it's hidden now)
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    });

    // Set up Google sign-in button
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', handleGoogleSignIn);
    }

    // Set up email form
    const emailForm = document.getElementById('email-form');
    if (emailForm) {
        emailForm.addEventListener('submit', handleEmailSubmit);
    }
}

/**
 * Handle Google sign-in after pledge submission
 */
async function handleGoogleSignIn() {
    const btn = document.getElementById('google-signin-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>Signing in...</span>';
    btn.disabled = true;

    const result = await signInWithGoogle();

    if (result.success) {
        // Link the pledge to the user and save email
        if (currentPledgeId) {
            await linkPledgeToUser(currentPledgeId, result.user.uid, result.user.email);
            await addEmailToPledge(currentPledgeId, result.user.email);
        }

        // Also save to subscribers collection
        await saveEmailSubscriber(result.user.email, currentPledgeId);

        // Update UI to show success state
        showContactSuccess(result.user.email);
    } else {
        btn.innerHTML = originalText;
        btn.disabled = false;
        console.error('Sign-in failed:', result.error);
    }
}

/**
 * Handle email form submission
 */
async function handleEmailSubmit(e) {
    e.preventDefault();

    const emailInput = document.getElementById('contact-email');
    const email = emailInput.value.trim();
    const submitBtn = e.target.querySelector('button[type="submit"]');

    if (!email) return;

    // Show loading state
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Saving...';
    submitBtn.disabled = true;

    // Save email to subscribers collection (links via pledgeId)
    const result = await saveEmailSubscriber(email, currentPledgeId);

    if (result.success) {
        showContactSuccess(email);
    } else {
        // Restore button on error
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        console.error('Failed to save email:', result.error);
    }
}

/**
 * Show contact success message and reveal badge
 */
function showContactSuccess(email) {
    const signInSection = document.getElementById('signin-section');
    if (signInSection) {
        signInSection.innerHTML = `
            <div class="signed-in-confirmation">
                <span class="signed-in-icon">✓</span>
                <p><strong>You're on the list!</strong></p>
                <p class="signed-in-note">We'll send occasional updates to ${email}. No spam, ever.</p>
            </div>
        `;
    }

    // Show the shareable badge
    const badge = document.getElementById('shareable-badge');
    if (badge) {
        badge.style.display = 'block';
        badge.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Save pledge to localStorage (backup)
 */
function savePledgeLocally(data) {
    let pledges = JSON.parse(localStorage.getItem('healthyBrain_pledges') || '[]');
    pledges.push(data);
    localStorage.setItem('healthyBrain_pledges', JSON.stringify(pledges));
    console.log('Pledge saved locally');
}

/**
 * Show success message after form submission
 */
async function showSuccessMessage(signatureSVG, userDisplayName) {
    const form = document.getElementById('pledge-form');
    const success = document.getElementById('pledge-success');
    const updatedCount = document.getElementById('updated-count');
    const signatureDisplay = document.getElementById('signature-display');

    if (form && success) {
        form.style.display = 'none';
        success.style.display = 'block';

        // Update the count in success message
        if (updatedCount) {
            updatedCount.textContent = currentPledgeCount;
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

        // Load and display social proof names
        loadSuccessSocialProof(userDisplayName);

        // Scroll to success message
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Load social proof names in success state
 */
async function loadSuccessSocialProof(userDisplayName) {
    const container = document.getElementById('success-pledge-names');
    if (!container) return;

    try {
        const pledges = await getPublicPledges(15);

        // Build name tags - user first (highlighted), then others
        let namesHTML = `<span class="pledge-name-tag you">${userDisplayName} (you!)</span>`;

        pledges.forEach(pledge => {
            // Skip if it's the same as user (might not be in list yet due to timing)
            if (pledge.displayName !== userDisplayName) {
                namesHTML += `<span class="pledge-name-tag">${pledge.displayName}</span>`;
            }
        });

        container.innerHTML = namesHTML;

    } catch (error) {
        console.error('Error loading success social proof:', error);
        // Show just the user if we can't load others
        container.innerHTML = `<span class="pledge-name-tag you">${userDisplayName} (you!)</span>`;
    }
}

/* ===========================
   COUNTERS
   =========================== */

// Counter element IDs
const COUNTER_IDS = ['hero-count', 'nav-count', 'family-count', 'updated-count', 'mobile-cta-count'];

function initCounters() {
    syncAllCounters();
    animateCountersOnScroll();
}

/**
 * Get total pledge count
 */
function getTotalPledgeCount() {
    return currentPledgeCount;
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
 * Only animate if we have a non-zero count (Firebase has loaded)
 */
function animateCountersOnScroll() {
    const heroCounter = document.getElementById('hero-count');
    const familyCounter = document.getElementById('family-count');

    // Track which counters have animated
    const animated = {
        hero: false,
        family: false
    };

    // Create observer for hero counter
    if (heroCounter) {
        const heroObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const count = getTotalPledgeCount();
                // Only animate if we have data and haven't animated yet
                if (entry.isIntersecting && !animated.hero && count > 0) {
                    animated.hero = true;
                    animateNumber(heroCounter, 0, count, 1200);
                }
            });
        }, { threshold: 0.5 });
        heroObserver.observe(heroCounter);
    }

    // Create observer for family counter (commitment section)
    if (familyCounter) {
        const familyObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const count = getTotalPledgeCount();
                // Only animate if we have data and haven't animated yet
                if (entry.isIntersecting && !animated.family && count > 0) {
                    animated.family = true;
                    animateNumber(familyCounter, 0, count, 1500);
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
    const mobileCta = document.getElementById('mobile-sticky-cta');
    const hero = document.querySelector('.hero');

    if (!nav) return;

    // Get hero height for mobile CTA trigger
    const heroHeight = hero ? hero.offsetHeight : 500;

    // Add shadow on scroll + show/hide mobile CTA
    window.addEventListener('scroll', function() {
        if (window.scrollY > 100) {
            nav.classList.add('nav-scrolled');
        } else {
            nav.classList.remove('nav-scrolled');
        }

        // Show mobile CTA after scrolling past hero
        if (mobileCta) {
            if (window.scrollY > heroHeight * 0.7) {
                mobileCta.classList.add('visible');
            } else {
                mobileCta.classList.remove('visible');
            }
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
        "I've committed to protecting my child's healthy brain development as part of the Healthy Brains Initiative. " +
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

/* ===========================
   SOCIAL PROOF
   =========================== */

/**
 * Load and display public pledge names for social proof
 */
async function loadPublicPledgeNames() {
    const container = document.getElementById('pledge-names');
    const socialProofSection = document.getElementById('social-proof');

    if (!container || !socialProofSection) return;

    try {
        const pledges = await getPublicPledges(20);

        if (pledges.length === 0) {
            // Hide section if no pledges yet
            socialProofSection.style.display = 'none';
            return;
        }

        // Show section
        socialProofSection.style.display = 'block';

        // Create name tags
        const namesHTML = pledges.map(pledge => {
            const classInfo = pledge.childClass ? ` <span class="pledge-class">(${pledge.childClass})</span>` : '';
            return `<span class="pledge-name-tag">${pledge.displayName}${classInfo}</span>`;
        }).join('');

        container.innerHTML = namesHTML;

    } catch (error) {
        console.error('Error loading public pledges:', error);
        socialProofSection.style.display = 'none';
    }
}
