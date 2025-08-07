// Core App State
const app = {
    currentDate: new Date(),
    selectedDate: new Date(),
    habits: [],
    records: {},
    streaks: {},
    settings: {
        theme: 'auto',
        notifications: false,
        reminderTime: '09:00'
    },
    user: null
};

// Default Habits for New Users
const DEFAULT_HABITS = [
    { id: 'h1', name: '💧 Drink 8 glasses of water', category: 'health' },
    { id: 'h2', name: '🏃 Exercise for 30 minutes', category: 'fitness' },
    { id: 'h3', name: '📚 Read for 20 minutes', category: 'learning' },
    { id: 'h4', name: '🧘 Meditate for 10 minutes', category: 'mindfulness' },
    { id: 'h5', name: '✍️ Write in journal', category: 'reflection' }
];

// AI Feedback Messages (Claude API placeholder)
const AI_FEEDBACK_TEMPLATES = [
    {
        condition: (stats) => stats.todayCompletion === 100,
        messages: [
            "🎉 Perfect day! You've completed all your habits. Your consistency is building unstoppable momentum!",
            "💯 Incredible! 100% completion today. You're proving that excellence is a habit, not an act!",
            "⭐ Outstanding performance! Days like this compound into life-changing results!"
        ]
    },
    {
        condition: (stats) => stats.currentStreak >= 7,
        messages: [
            `🔥 ${stats.currentStreak} days in a row! You're on fire! This streak is becoming your new identity!`,
            `💪 ${stats.currentStreak}-day streak! You've moved from motivation to discipline. Keep going!`,
            `🚀 Wow! ${stats.currentStreak} consecutive days! You're in the top 5% of habit builders!`
        ]
    },
    {
        condition: (stats) => stats.todayCompletion >= 80,
        messages: [
            "🌟 Excellent progress today! You're so close to a perfect score. One more push!",
            "💪 Strong performance! You're building the foundation for lasting change!",
            "✨ Great job! Your consistency is inspiring. Tomorrow, aim for 100%!"
        ]
    },
    {
        condition: (stats) => stats.weeklyAvg >= 70,
        messages: [
            `📈 Your weekly average is ${stats.weeklyAvg}%! You're trending upward. Success is inevitable!`,
            `🎯 Solid ${stats.weeklyAvg}% weekly completion! You're outperforming 80% of users!`,
            `💫 ${stats.weeklyAvg}% this week! Your future self will thank you for this consistency!`
        ]
    },
    {
        condition: (stats) => stats.todayCompletion < 50 && stats.todayCompletion > 0,
        messages: [
            "🌱 Every habit counts! You've started, and that's what matters. Finish strong!",
            "💡 Progress over perfection! Each checked box is a vote for your best self!",
            "🔄 You're building momentum! Complete one more habit to unlock your potential!"
        ]
    },
    {
        condition: (stats) => stats.todayCompletion === 0 && new Date().getHours() < 20,
        messages: [
            "☀️ The day is still young! Start with your easiest habit to build momentum!",
            "🎯 Your future depends on what you do today. Start with just one habit!",
            "⏰ Perfect time to start! Studies show evening habits have 23% higher completion rates!"
        ]
    },
    {
        condition: () => true,
        messages: [
            "🌟 Remember: You're not just building habits, you're building a new identity!",
            "💭 Small daily improvements lead to staggering long-term results. Keep going!",
            "🏆 You're closer than you think. One more day of effort makes all the difference!"
        ]
    }
];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    checkInstallPrompt();
    hideSplashScreen();
});

function initializeApp() {
    loadSettings();
    loadHabits();
    loadRecords();
    updateDateDisplay();
    renderHabits();
    updateProgress();
    updateAnalytics();
    generateAIFeedback();
    
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed'));
    }
}

function hideSplashScreen() {
    setTimeout(() => {
        document.getElementById('splash').classList.add('hidden');
    }, 1500);
}

// Event Listeners
function setupEventListeners() {
    // Date Navigation
    document.getElementById('prevDay').addEventListener('click', () => navigateDate(-1));
    document.getElementById('nextDay').addEventListener('click', () => navigateDate(1));
    
    // Add Habit
    document.getElementById('addHabitBtn').addEventListener('click', showAddHabitForm);
    document.getElementById('confirmAddBtn').addEventListener('click', addHabit);
    document.getElementById('cancelAddBtn').addEventListener('click', hideAddHabitForm);
    document.getElementById('newHabitInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addHabit();
    });
    
    // Settings
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('notificationsToggle').addEventListener('change', toggleNotifications);
    document.getElementById('reminderTime').addEventListener('change', updateReminderTime);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('resetBtn').addEventListener('click', resetData);
    
    // Theme
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => changeTheme(btn.dataset.theme));
    });
    
    // Analytics Filter
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateChart(btn.dataset.period);
        });
    });
    
    // AI Feedback
    document.getElementById('refreshFeedback').addEventListener('click', generateAIFeedback);
    
    // Share
    document.getElementById('shareBtn').addEventListener('click', shareProgress);
    document.getElementById('twitterShareBtn').addEventListener('click', shareOnTwitter);
}

// Date Navigation
function navigateDate(direction) {
    const newDate = new Date(app.selectedDate);
    newDate.setDate(newDate.getDate() + direction);
    
    // Don't allow future dates
    if (newDate > app.currentDate) return;
    
    app.selectedDate = newDate;
    updateDateDisplay();
    renderHabits();
    updateProgress();
}

function updateDateDisplay() {
    const dateElement = document.getElementById('currentDate');
    const isToday = isSameDay(app.selectedDate, app.currentDate);
    
    dateElement.querySelector('.date-day').textContent = isToday ? 'Today' : 
        app.selectedDate.toLocaleDateString('en-US', { weekday: 'short' });
    dateElement.querySelector('.date-full').textContent = 
        app.selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    
    // Disable next button if today
    document.getElementById('nextDay').style.opacity = isToday ? '0.3' : '1';
    document.getElementById('nextDay').style.pointerEvents = isToday ? 'none' : 'auto';
}

// Habits Management
function loadHabits() {
    const saved = localStorage.getItem('habitscope_habits');
    if (saved) {
        app.habits = JSON.parse(saved);
    } else {
        app.habits = DEFAULT_HABITS;
        saveHabits();
    }
}

function saveHabits() {
    localStorage.setItem('habitscope_habits', JSON.stringify(app.habits));
    if (app.user && storage.saveToFirebase) {
        storage.saveHabits(app.habits);
    }
}

function renderHabits() {
    const container = document.getElementById('habitsList');
    const dateKey = getDateKey(app.selectedDate);
    const todayRecords = app.records[dateKey] || {};
    
    if (app.habits.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <p style="font-size: 18px; margin-bottom: 8px;">No habits yet</p>
                <p style="font-size: 14px;">Add your first habit to start tracking!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = app.habits.map(habit => {
        const isCompleted = todayRecords[habit.id] || false;
        const streak = calculateStreak(habit.id);
        
        return `
            <div class="habit-item ${isCompleted ? 'completed' : ''}" data-id="${habit.id}">
                <div class="habit-checkbox" onclick="toggleHabit('${habit.id}')"></div>
                <div class="habit-content" onclick="toggleHabit('${habit.id}')">
                    <div class="habit-name">${habit.name}</div>
                    ${streak > 0 ? `<div class="habit-streak">🔥 ${streak} day streak</div>` : ''}
                </div>
                <div class="habit-actions">
                    <button class="habit-action-btn delete" onclick="deleteHabit('${habit.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14zM10 11v6M14 11v6"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function toggleHabit(habitId) {
    const dateKey = getDateKey(app.selectedDate);
    
    if (!app.records[dateKey]) {
        app.records[dateKey] = {};
    }
    
    app.records[dateKey][habitId] = !app.records[dateKey][habitId];
    saveRecords();
    renderHabits();
    updateProgress();
    updateAnalytics();
    
    // Generate feedback on completion
    const completed = Object.values(app.records[dateKey]).filter(v => v).length;
    if (completed === app.habits.length) {
        generateAIFeedback();
        confetti();
    }
}

function showAddHabitForm() {
    document.getElementById('quickAddForm').classList.remove('hidden');
    document.getElementById('newHabitInput').focus();
}

function hideAddHabitForm() {
    document.getElementById('quickAddForm').classList.add('hidden');
    document.getElementById('newHabitInput').value = '';
}

function addHabit() {
    const input = document.getElementById('newHabitInput');
    const name = input.value.trim();
    
    if (!name) return;
    
    const newHabit = {
        id: 'h' + Date.now(),
        name: name,
        category: 'custom',
        createdAt: new Date().toISOString()
    };
    
    app.habits.push(newHabit);
    saveHabits();
    renderHabits();
    hideAddHabitForm();
    updateProgress();
}

function deleteHabit(habitId) {
    if (!confirm('Are you sure you want to delete this habit?')) return;
    
    app.habits = app.habits.filter(h => h.id !== habitId);
    
    // Clean up records
    Object.keys(app.records).forEach(dateKey => {
        if (app.records[dateKey][habitId]) {
            delete app.records[dateKey][habitId];
        }
    });
    
    saveHabits();
    saveRecords();
    renderHabits();
    updateProgress();
    updateAnalytics();
}

// Records Management
function loadRecords() {
    const saved = localStorage.getItem('habitscope_records');
    if (saved) {
        app.records = JSON.parse(saved);
    }
}

function saveRecords() {
    localStorage.setItem('habitscope_records', JSON.stringify(app.records));
    if (app.user && storage.saveToFirebase) {
        storage.saveRecords(app.records);
    }
}

// Progress Tracking
function updateProgress() {
    const dateKey = getDateKey(app.selectedDate);
    const todayRecords = app.records[dateKey] || {};
    const completed = Object.values(todayRecords).filter(v => v).length;
    const total = app.habits.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Update progress ring
    const circle = document.getElementById('progressCircle');
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    // Update text
    document.getElementById('progressPercent').textContent = percentage + '%';
    
    // Update streak
    updateStreakDisplay();
}

function updateStreakDisplay() {
    const streak = calculateCurrentStreak();
    document.getElementById('streakCount').textContent = streak;
    
    if (streak > 0) {
        document.getElementById('streakBadge').style.display = 'flex';
    }
}

function calculateStreak(habitId) {
    let streak = 0;
    let date = new Date(app.currentDate);
    
    while (true) {
        const dateKey = getDateKey(date);
        if (app.records[dateKey] && app.records[dateKey][habitId]) {
            streak++;
            date.setDate(date.getDate() - 1);
        } else {
            break;
        }
    }
    
    return streak;
}

function calculateCurrentStreak() {
    let streak = 0;
    let date = new Date(app.currentDate);
    
    // Check if today is complete
    const todayKey = getDateKey(date);
    const todayRecords = app.records[todayKey] || {};
    const todayCompleted = Object.values(todayRecords).filter(v => v).length;
    
    if (todayCompleted !== app.habits.length) {
        date.setDate(date.getDate() - 1);
    }
    
    while (true) {
        const dateKey = getDateKey(date);
        const records = app.records[dateKey] || {};
        const completed = Object.values(records).filter(v => v).length;
        
        if (completed === app.habits.length && app.habits.length > 0) {
            streak++;
            date.setDate(date.getDate() - 1);
        } else {
            break;
        }
    }
    
    return streak;
}

// Analytics
let chartInstance = null;

function updateAnalytics() {
    updateChart('week');
    calculateStats();
}

function updateChart(period = 'week') {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const data = getChartData(period);
    
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Completion %',
                data: data.values,
                backgroundColor: 'rgba(99, 102, 241, 0.8)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: (value) => value + '%'
                    }
                }
            }
        }
    });
}

function getChartData(period) {
    const labels = [];
    const values = [];
    const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    const date = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(date.getDate() - i);
        const dateKey = getDateKey(d);
        const records = app.records[dateKey] || {};
        const completed = Object.values(records).filter(v => v).length;
        const percentage = app.habits.length > 0 ? Math.round((completed / app.habits.length) * 100) : 0;
        
        if (period === 'week') {
            labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        } else if (period === 'month') {
            labels.push(d.getDate());
        } else {
            if (i % 30 === 0) {
                labels.push(d.toLocaleDateString('en-US', { month: 'short' }));
            } else {
                labels.push('');
            }
        }
        
        values.push(percentage);
    }
    
    return { labels, values };
}

function calculateStats() {
    let totalCompleted = 0;
    let daysTracked = 0;
    let bestStreak = 0;
    let currentStreak = 0;
    
    // Calculate total completed and days tracked
    Object.keys(app.records).forEach(dateKey => {
        const records = app.records[dateKey];
        const completed = Object.values(records).filter(v => v).length;
        if (completed > 0) {
            totalCompleted += completed;
            daysTracked++;
        }
    });
    
    // Calculate best streak
    app.habits.forEach(habit => {
        const streak = calculateStreak(habit.id);
        bestStreak = Math.max(bestStreak, streak);
    });
    
    currentStreak = calculateCurrentStreak();
    bestStreak = Math.max(bestStreak, currentStreak);
    
    // Calculate average completion
    const avgCompletion = daysTracked > 0 ? 
        Math.round((totalCompleted / (daysTracked * app.habits.length)) * 100) : 0;
    
    // Update UI
    document.getElementById('totalCompleted').textContent = totalCompleted;
    document.getElementById('avgCompletion').textContent = avgCompletion + '%';
    document.getElementById('bestStreak').textContent = bestStreak;
}

// AI Feedback
function generateAIFeedback() {
    const stats = calculateCurrentStats();
    
    // Find matching condition
    const feedbackSet = AI_FEEDBACK_TEMPLATES.find(template => template.condition(stats));
    const messages = feedbackSet ? feedbackSet.messages : AI_FEEDBACK_TEMPLATES[AI_FEEDBACK_TEMPLATES.length - 1].messages;
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    // Animate feedback update
    const feedbackElement = document.getElementById('aiFeedback');
    feedbackElement.style.opacity = '0';
    
    setTimeout(() => {
        feedbackElement.textContent = message;
        feedbackElement.style.opacity = '1';
    }, 300);
}

function calculateCurrentStats() {
    const todayKey = getDateKey(app.currentDate);
    const todayRecords = app.records[todayKey] || {};
    const todayCompleted = Object.values(todayRecords).filter(v => v).length;
    const todayCompletion = app.habits.length > 0 ? Math.round((todayCompleted / app.habits.length) * 100) : 0;
    
    // Calculate weekly average
    let weekTotal = 0;
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = getDateKey(date);
        const records = app.records[dateKey] || {};
        const completed = Object.values(records).filter(v => v).length;
        weekTotal += app.habits.length > 0 ? (completed / app.habits.length) * 100 : 0;
    }
    const weeklyAvg = Math.round(weekTotal / 7);
    
    return {
        todayCompletion,
        weeklyAvg,
        currentStreak: calculateCurrentStreak(),
        totalHabits: app.habits.length
    };
}

// Share Functionality
function shareProgress() {
    const stats = calculateCurrentStats();
    const text = `🎯 HabitScope Progress Update!\n\n` +
                `📊 Today: ${stats.todayCompletion}% complete\n` +
                `🔥 Current Streak: ${stats.currentStreak} days\n` +
                `📈 Weekly Average: ${stats.weeklyAvg}%\n\n` +
                `Join me on my habit journey! 🚀`;
    
    if (navigator.share) {
        navigator.share({
            title: 'My HabitScope Progress',
            text: text,
            url: 'https://habitscope.app'
        }).catch(err => console.log('Share cancelled'));
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(text);
        alert('Progress copied to clipboard!');
    }
}

function shareOnTwitter() {
    const stats = calculateCurrentStats();
    const text = `🎯 Day ${stats.currentStreak} of building better habits!\n\n` +
                `Today: ${stats.todayCompletion}% complete\n` +
                `Week Avg: ${stats.weeklyAvg}%\n\n` +
                `Track your habits with #HabitScope`;
    
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=https://habitscope.app`;
    window.open(url, '_blank');
}

// Settings
function loadSettings() {
    const saved = localStorage.getItem('habitscope_settings');
    if (saved) {
        app.settings = { ...app.settings, ...JSON.parse(saved) };
    }
    applyTheme(app.settings.theme);
}

function saveSettings() {
    localStorage.setItem('habitscope_settings', JSON.stringify(app.settings));
}

function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
    
    // Update UI to match current settings
    document.getElementById('notificationsToggle').checked = app.settings.notifications;
    document.getElementById('reminderTime').value = app.settings.reminderTime;
    document.getElementById('timePickerGroup').classList.toggle('active', app.settings.notifications);
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === app.settings.theme);
    });
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function changeTheme(theme) {
    app.settings.theme = theme;
    saveSettings();
    applyTheme(theme);
    
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
    });
}

function applyTheme(theme) {
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.body.setAttribute('data-theme', theme);
    }
}

function toggleNotifications(e) {
    app.settings.notifications = e.target.checked;
    saveSettings();
    
    document.getElementById('timePickerGroup').classList.toggle('active', e.target.checked);
    
    if (e.target.checked) {
        requestNotificationPermission();
    }
}

function updateReminderTime(e) {
    app.settings.reminderTime = e.target.value;
    saveSettings();
    scheduleNotification();
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function scheduleNotification() {
    // This would integrate with service worker for background notifications
    console.log('Notification scheduled for', app.settings.reminderTime);
}

// Data Management
function exportData() {
    const data = {
        habits: app.habits,
        records: app.records,
        settings: app.settings,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `habitscope-backup-${getDateKey(new Date())}.json`;
    a.click();
}

function resetData() {
    if (!confirm('This will delete all your habits and progress. Are you sure?')) return;
    
    localStorage.clear();
    app.habits = DEFAULT_HABITS;
    app.records = {};
    app.settings = {
        theme: 'auto',
        notifications: false,
        reminderTime: '09:00'
    };
    
    saveHabits();
    saveRecords();
    saveSettings();
    
    renderHabits();
    updateProgress();
    updateAnalytics();
    generateAIFeedback();
    
    closeSettings();
}

// PWA Install
let deferredPrompt;

function checkInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install prompt after user has used app for a bit
        setTimeout(() => {
            if (deferredPrompt) {
                document.getElementById('installPrompt').classList.remove('hidden');
            }
        }, 30000); // Show after 30 seconds
    });
    
    document.getElementById('installBtn').addEventListener('click', installApp);
    document.getElementById('dismissInstall').addEventListener('click', () => {
        document.getElementById('installPrompt').classList.add('hidden');
    });
}

function installApp() {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted install');
        }
        deferredPrompt = null;
        document.getElementById('installPrompt').classList.add('hidden');
    });
}

// Utility Functions
function getDateKey(date) {
    return date.toISOString().split('T')[0];
}

function isSameDay(date1, date2) {
    return getDateKey(date1) === getDateKey(date2);
}

// Confetti Animation
function confetti() {
    // Simple confetti effect for 100% completion
    const colors = ['#6366f1', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
    const confettiCount = 50;
    
    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'fixed';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-10px';
        confetti.style.borderRadius = '50%';
        confetti.style.zIndex = '9999';
        confetti.style.pointerEvents = 'none';
        
        document.body.appendChild(confetti);
        
        const duration = Math.random() * 3 + 2;
        const distance = Math.random() * 300 + 100;
        
        confetti.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translateY(${distance}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ], {
            duration: duration * 1000,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
        
        setTimeout(() => confetti.remove(), duration * 1000);
    }
}