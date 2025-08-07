// Firebase Configuration
// Replace with your Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

// Storage Layer - Can switch between Firebase and Local Storage
const storage = {
    initialized: false,
    saveToFirebase: false, // Set to true when Firebase is configured
    db: null,
    auth: null,
    
    // Initialize Firebase (optional)
    async init() {
        // Check if Firebase config is provided
        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            console.log('Using local storage only. Configure Firebase for cloud sync.');
            this.saveToFirebase = false;
            return;
        }
        
        try {
            // Dynamic import of Firebase (only load if configured)
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
            const { getFirestore, doc, setDoc, getDoc, collection, query, where, orderBy, limit, getDocs } = 
                await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const { getAuth, signInAnonymously, onAuthStateChanged } = 
                await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
            
            // Initialize Firebase
            const app = initializeApp(firebaseConfig);
            this.db = getFirestore(app);
            this.auth = getAuth(app);
            
            // Anonymous auth for simplicity
            await signInAnonymously(this.auth);
            
            onAuthStateChanged(this.auth, (user) => {
                if (user) {
                    app.user = user;
                    this.saveToFirebase = true;
                    this.syncFromCloud();
                }
            });
            
            this.initialized = true;
            console.log('Firebase initialized successfully');
        } catch (error) {
            console.log('Firebase initialization failed, using local storage:', error);
            this.saveToFirebase = false;
        }
    },
    
    // Save habits to Firebase
    async saveHabits(habits) {
        if (!this.saveToFirebase || !app.user) return;
        
        try {
            const userDoc = doc(this.db, 'users', app.user.uid);
            await setDoc(userDoc, {
                habits: habits,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving habits to Firebase:', error);
        }
    },
    
    // Save records to Firebase
    async saveRecords(records) {
        if (!this.saveToFirebase || !app.user) return;
        
        try {
            const userDoc = doc(this.db, 'users', app.user.uid);
            await setDoc(userDoc, {
                records: records,
                updatedAt: new Date().toISOString()
            }, { merge: true });
        } catch (error) {
            console.error('Error saving records to Firebase:', error);
        }
    },
    
    // Sync from cloud
    async syncFromCloud() {
        if (!this.saveToFirebase || !app.user) return;
        
        try {
            const userDoc = doc(this.db, 'users', app.user.uid);
            const docSnap = await getDoc(userDoc);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Merge with local data (prefer newer)
                const localUpdate = localStorage.getItem('habitscope_last_update');
                const cloudUpdate = data.updatedAt;
                
                if (!localUpdate || new Date(cloudUpdate) > new Date(localUpdate)) {
                    // Cloud is newer
                    if (data.habits) {
                        app.habits = data.habits;
                        localStorage.setItem('habitscope_habits', JSON.stringify(data.habits));
                    }
                    if (data.records) {
                        app.records = data.records;
                        localStorage.setItem('habitscope_records', JSON.stringify(data.records));
                    }
                    localStorage.setItem('habitscope_last_update', cloudUpdate);
                    
                    // Refresh UI
                    if (typeof renderHabits === 'function') {
                        renderHabits();
                        updateProgress();
                        updateAnalytics();
                    }
                }
            }
        } catch (error) {
            console.error('Error syncing from cloud:', error);
        }
    },
    
    // Get leaderboard data (for gamification)
    async getLeaderboard() {
        if (!this.saveToFirebase) return [];
        
        try {
            const q = query(
                collection(this.db, 'leaderboard'),
                orderBy('streak', 'desc'),
                limit(10)
            );
            
            const querySnapshot = await getDocs(q);
            const leaderboard = [];
            
            querySnapshot.forEach((doc) => {
                leaderboard.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return leaderboard;
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return [];
        }
    },
    
    // Save user stats for leaderboard
    async updateLeaderboard(stats) {
        if (!this.saveToFirebase || !app.user) return;
        
        try {
            const leaderboardDoc = doc(this.db, 'leaderboard', app.user.uid);
            await setDoc(leaderboardDoc, {
                userId: app.user.uid,
                streak: stats.currentStreak,
                totalCompleted: stats.totalCompleted,
                weeklyAverage: stats.weeklyAvg,
                updatedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating leaderboard:', error);
        }
    }
};

// Mock Data Generator (for demo/testing)
const mockData = {
    generateSampleRecords() {
        const records = {};
        const habits = ['h1', 'h2', 'h3', 'h4', 'h5'];
        
        // Generate data for the last 30 days
        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            
            records[dateKey] = {};
            
            // Randomly complete habits (70% chance)
            habits.forEach(habitId => {
                records[dateKey][habitId] = Math.random() > 0.3;
            });
        }
        
        return records;
    },
    
    generateStreakData() {
        const records = {};
        const habits = ['h1', 'h2', 'h3', 'h4', 'h5'];
        
        // Generate a perfect streak for the last 7 days
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            
            records[dateKey] = {};
            
            // Complete all habits
            habits.forEach(habitId => {
                records[dateKey][habitId] = true;
            });
        }
        
        return records;
    },
    
    loadDemoData() {
        // Load sample data for demo purposes
        const demoRecords = this.generateSampleRecords();
        localStorage.setItem('habitscope_records', JSON.stringify(demoRecords));
        
        // Reload the app
        if (typeof location !== 'undefined') {
            location.reload();
        }
    }
};

// Analytics Integration (for tracking user behavior)
const analytics = {
    track(event, properties = {}) {
        // Integration point for analytics services
        // Could connect to Google Analytics, Mixpanel, etc.
        console.log('Analytics Event:', event, properties);
        
        // Store locally for analysis
        const events = JSON.parse(localStorage.getItem('habitscope_events') || '[]');
        events.push({
            event,
            properties,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 100 events
        if (events.length > 100) {
            events.shift();
        }
        
        localStorage.setItem('habitscope_events', JSON.stringify(events));
    },
    
    // Track key metrics for viral growth
    trackEngagement() {
        const stats = {
            daysActive: this.getDaysActive(),
            habitsCompleted: this.getTotalHabitsCompleted(),
            shareCount: this.getShareCount(),
            sessionDuration: this.getSessionDuration()
        };
        
        this.track('engagement_metrics', stats);
        return stats;
    },
    
    getDaysActive() {
        const records = JSON.parse(localStorage.getItem('habitscope_records') || '{}');
        return Object.keys(records).length;
    },
    
    getTotalHabitsCompleted() {
        const records = JSON.parse(localStorage.getItem('habitscope_records') || '{}');
        let total = 0;
        
        Object.values(records).forEach(dayRecords => {
            total += Object.values(dayRecords).filter(v => v).length;
        });
        
        return total;
    },
    
    getShareCount() {
        return parseInt(localStorage.getItem('habitscope_share_count') || '0');
    },
    
    getSessionDuration() {
        const startTime = parseInt(sessionStorage.getItem('habitscope_session_start') || Date.now());
        return Math.floor((Date.now() - startTime) / 1000); // in seconds
    },
    
    // A/B Testing Framework
    getVariant(experimentName, variants = ['control', 'variant']) {
        let experiments = JSON.parse(localStorage.getItem('habitscope_experiments') || '{}');
        
        if (!experiments[experimentName]) {
            // Assign random variant
            experiments[experimentName] = variants[Math.floor(Math.random() * variants.length)];
            localStorage.setItem('habitscope_experiments', JSON.stringify(experiments));
        }
        
        return experiments[experimentName];
    }
};

// Growth Hacks for reaching 100M visits
const growth = {
    // Viral sharing mechanics
    generateShareableImage() {
        // Create canvas with user's progress
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');
        
        // Background gradient
        const gradient = ctx.createLinearGradient(0, 0, 1200, 630);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1200, 630);
        
        // Add text and stats
        ctx.fillStyle = 'white';
        ctx.font = 'bold 72px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('My HabitScope Journey', 600, 200);
        
        // Add stats
        const stats = calculateCurrentStats();
        ctx.font = '48px Inter';
        ctx.fillText(`🔥 ${stats.currentStreak} Day Streak`, 600, 350);
        ctx.fillText(`📊 ${stats.weeklyAvg}% Weekly Average`, 600, 450);
        
        return canvas.toDataURL('image/png');
    },
    
    // Referral system
    getReferralCode() {
        let code = localStorage.getItem('habitscope_referral_code');
        if (!code) {
            code = Math.random().toString(36).substring(2, 8).toUpperCase();
            localStorage.setItem('habitscope_referral_code', code);
        }
        return code;
    },
    
    trackReferral(code) {
        if (code) {
            localStorage.setItem('habitscope_referred_by', code);
            analytics.track('referral_signup', { code });
        }
    },
    
    // Gamification elements
    achievements: [
        { id: 'first_habit', name: 'First Step', description: 'Complete your first habit', icon: '🎯' },
        { id: 'perfect_day', name: 'Perfect Day', description: 'Complete all habits in one day', icon: '⭐' },
        { id: 'week_streak', name: 'Week Warrior', description: '7-day streak', icon: '🔥' },
        { id: 'month_streak', name: 'Habit Master', description: '30-day streak', icon: '👑' },
        { id: 'early_bird', name: 'Early Bird', description: 'Complete habits before 9 AM', icon: '🌅' },
        { id: 'night_owl', name: 'Night Owl', description: 'Complete habits after 9 PM', icon: '🌙' },
        { id: 'comeback', name: 'Comeback Kid', description: 'Return after 3+ days', icon: '💪' },
        { id: 'social_butterfly', name: 'Social Butterfly', description: 'Share progress 5 times', icon: '🦋' }
    ],
    
    checkAchievements() {
        const unlocked = JSON.parse(localStorage.getItem('habitscope_achievements') || '[]');
        const newAchievements = [];
        
        // Check each achievement condition
        this.achievements.forEach(achievement => {
            if (!unlocked.includes(achievement.id)) {
                if (this.isAchievementUnlocked(achievement.id)) {
                    unlocked.push(achievement.id);
                    newAchievements.push(achievement);
                }
            }
        });
        
        if (newAchievements.length > 0) {
            localStorage.setItem('habitscope_achievements', JSON.stringify(unlocked));
            this.showAchievementNotification(newAchievements[0]);
        }
        
        return newAchievements;
    },
    
    isAchievementUnlocked(achievementId) {
        const stats = calculateCurrentStats();
        
        switch(achievementId) {
            case 'first_habit':
                return stats.totalHabits > 0;
            case 'perfect_day':
                return stats.todayCompletion === 100;
            case 'week_streak':
                return stats.currentStreak >= 7;
            case 'month_streak':
                return stats.currentStreak >= 30;
            case 'early_bird':
                return new Date().getHours() < 9 && stats.todayCompletion > 0;
            case 'night_owl':
                return new Date().getHours() >= 21 && stats.todayCompletion > 0;
            case 'social_butterfly':
                return this.getShareCount() >= 5;
            default:
                return false;
        }
    },
    
    showAchievementNotification(achievement) {
        // Create achievement popup
        const popup = document.createElement('div');
        popup.className = 'achievement-popup';
        popup.innerHTML = `
            <div class="achievement-content">
                <span class="achievement-icon">${achievement.icon}</span>
                <div>
                    <h3>Achievement Unlocked!</h3>
                    <p>${achievement.name}</p>
                    <small>${achievement.description}</small>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            popup.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => popup.remove(), 300);
        }, 3000);
    }
};

// Session tracking
sessionStorage.setItem('habitscope_session_start', Date.now());

// Initialize storage on load
storage.init();