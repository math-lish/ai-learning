// ==================== 設定 ====================
const CONFIG = {
    classes: {
        '1C': { name: '1C', password: 'class1c2026', display: '中一C' },
        '3D': { name: '3D', password: 'class3d2026', display: '中三D' },
        'S5G2': { name: 'S5G2', password: 's5group2', display: '中五Group2' }
    },
    queue: {
        timeLimit: 5 * 60 * 1000, // 5分鐘 (毫秒)
        checkInterval: 30000 // 30秒check一次排隊
    }
};

// ==================== 狀態 ====================
let state = {
    currentStudent: null,
    questionCount: {},
    queue: [],
    queueTimer: null,
    sessionTimer: null,
    timeRemaining: CONFIG.queue.timeLimit,
    isInSession: false
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateStats();
});

// 載入本地儲存
function loadState() {
    const saved = localStorage.getItem('aiTutorState');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.questionCount = parsed.questionCount || {};
    }
}

// 儲存狀態
function saveState() {
    localStorage.setItem('aiTutorState', JSON.stringify({
        questionCount: state.questionCount
    }));
}

// ==================== 登入 ====================
function login() {
    const classId = document.getElementById('class-select').value;
    const password = document.getElementById('password-input').value;
    const errorMsg = document.getElementById('login-error');
    
    if (!classId) {
        errorMsg.textContent = '請選擇班別';
        return;
    }
    
    if (!password) {
        errorMsg.textContent = '請輸入密碼';
        return;
    }
    
    if (CONFIG.classes[classId].password !== password) {
        errorMsg.textContent = '密碼錯誤，請重試';
        return;
    }
    
    // 登入成功
    state.currentStudent = {
        classId: classId,
        name: CONFIG.classes[classId].display,
        loginTime: Date.now()
    };
    
    // 初始化該班計數
    if (!state.questionCount[classId]) {
        state.questionCount[classId] = 0;
    }
    
    showScreen('question-screen');
    document.getElementById('student-class').textContent = state.currentStudent.name;
    document.getElementById('question-count').textContent = state.questionCount[classId];
    
    // 加入排隊
    addToQueue();
}

// ==================== 排隊系統 ====================
function addToQueue() {
    const student = state.currentStudent;
    const existingIndex = state.queue.findIndex(s => s.classId === student.classId);
    
    if (existingIndex === -1) {
        state.queue.push({
            ...student,
            joinTime: Date.now(),
            questionsToday: state.questionCount[student.classId]
        });
    }
    
    updateQueueDisplay();
    startQueueCheck();
}

function updateQueueDisplay() {
    const myIndex = state.queue.findIndex(s => s.classId === state.currentStudent.classId);
    const queueCount = state.queue.length - 1; // 排除自己
    
    document.getElementById('queue-count').textContent = Math.max(0, queueCount);
    
    // 計算優先順序
    const priority = calculatePriority(state.currentStudent.classId);
    document.getElementById('class-queue-priority').textContent = 
        `第${priority}位 (問題少既優先)`;
    
    document.getElementById('selflearn-queue').textContent = 
        queueCount > 0 ? `前面有${queueCount}位同學` : '到你喇！';
}

function calculatePriority(classId) {
    // 按問題次數少既優先，同次數先到先得
    const sorted = [...state.queue].sort((a, b) => {
        if (a.questionsToday !== b.questionsToday) {
            return a.questionsToday - b.questionsToday;
        }
        return a.joinTime - b.joinTime;
    });
    
    return sorted.findIndex(s => s.classId === classId) + 1;
}

function startQueueCheck() {
    if (state.queueTimer) clearInterval(state.queueTimer);
    
    state.queueTimer = setInterval(() => {
        updateQueueDisplay();
        checkMyTurn();
    }, CONFIG.queue.checkInterval);
}

function checkMyTurn() {
    if (state.isInSession) return;
    
    const myIndex = state.queue.findIndex(s => s.classId === state.currentStudent.classId);
    
    if (myIndex === 0) {
        // 到我喇！
        clearInterval(state.queueTimer);
        startSession();
    }
}

function startSession() {
    state.isInSession = true;
    state.timeRemaining = CONFIG.queue.timeLimit;
    
    showScreen('answer-screen');
    document.getElementById('answer-student-class').textContent = state.currentStudent.name;
    
    // 開始計時
    state.sessionTimer = setInterval(() => {
        state.timeRemaining -= 1000;
        updateSessionTimer();
        
        if (state.timeRemaining <= 0) {
            endSession(true); // timeout
        }
    }, 1000);
}

function updateSessionTimer() {
    const minutes = Math.floor(state.timeRemaining / 60000);
    const seconds = Math.floor((state.timeRemaining % 60000) / 1000);
    document.getElementById('time-remaining').textContent = 
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // 變紅
    if (state.timeRemaining < 60000) {
        document.getElementById('answer-timer').style.background = '#E74C3C';
    }
}

function endSession(timeout = false) {
    if (state.sessionTimer) clearInterval(state.sessionTimer);
    
    state.isInSession = false;
    
    // 從排隊移除
    state.queue = state.queue.filter(s => s.classId !== state.currentStudent.classId);
    
    if (timeout) {
        alert('時間到！但你可以繼續留低自學，等下一輪');
    }
    
    // 返回問題輸入畫面
    showScreen('question-screen');
    startQueueCheck();
}

// ==================== 問題提交 ====================
function submitQuestion() {
    const questionText = document.getElementById('question-text').value.trim();
    const photoFile = document.getElementById('photo-upload').files[0];
    
    if (!questionText && !photoFile) {
        alert('請輸入問題或上傳相片');
        return;
    }
    
    // 顯示問題
    document.getElementById('display-question').textContent = questionText || '(無文字描述)';
    
    // 顯示相片
    const photoPreview = document.getElementById('display-photo');
    photoPreview.innerHTML = '';
    if (photoFile) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(photoFile);
        img.style.maxWidth = '300px';
        img.style.borderRadius = '8px';
        photoPreview.appendChild(img);
    }
    
    // 更新計數
    state.questionCount[state.currentStudent.classId]++;
    saveState();
    document.getElementById('question-count').textContent = state.questionCount[state.currentStudent.classId];
    
    // 模擬AI回覆 (實際會call API)
    generateAIResponse(questionText, photoFile);
}

// ==================== AI 回覆 ====================
function generateAIResponse(question, photo) {
    const responseDiv = document.getElementById('ai-response');
    responseDiv.innerHTML = '🤖 AI 導師分析緊...\n\n';
    
    // 模擬回覆 (呢度係mock，等你set up API後可以改)
    setTimeout(() => {
        const mockResponse = `📚 分析：

首先，我理解你既問題係關於「${question.slice(0, 20)}...」

等我逐步教你：

1️⃣ **理解題目**
   - 我地要先睇清楚題目要求咩

2️⃣ **諗一諗**
   - 用我地學過既方法...
   
3️⃣ **動手做**
   - 跟住呢個步驟...

💡 **溫馨提示**：
   - 記得檢查答案
   - 如果唔明可以再問我

🌟 **你做得好好！** 繼續努力！`;

        responseDiv.textContent = mockResponse;
    }, 1500);
}

function requestMore() {
    const responseDiv = document.getElementById('ai-response');
    responseDiv.innerHTML += '\n\n📝 **再詳細解釋：**\n\n(等你問多啲...)';
}

function markDone() {
    alert('多謝使用！記得溫故知新！🎉');
    location.reload();
}

// ==================== 自學功能 ====================
function startSelfLearn() {
    showScreen('selflearn-screen');
}

function openMathGames() {
    window.location.href = 'games/index.html';
}

function openPractice() {
    window.location.href = 'tutor/index.html';
}

function openNotes() {
    window.location.href = 'stories.html';
}

function checkQueue() {
    updateQueueDisplay();
}

// ==================== 工具 ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function updateStats() {
    // 更新排隊資訊
    if (state.currentStudent) {
        updateQueueDisplay();
    }
}
