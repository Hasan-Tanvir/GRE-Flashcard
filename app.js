import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCiT11TuABndvE_fTxrrEJcPO0EQBlbPyo",
  authDomain: "gre-flashcard-29284.firebaseapp.com",
  projectId: "gre-flashcard-29284",
  storageBucket: "gre-flashcard-29284.firebasestorage.app",
  messagingSenderId: "224238292323",
  appId: "1:224238292323:web:1f85cb2c2d680f25149756",
  measurementId: "G-53Y5XWJQ20"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

let currentSyncKey = null;
let isCloudSyncing = false;
let unsubscribeListener = null;
let currentViewMode = localStorage.getItem('greFlashcardsViewMode') || 'card';

let vocabularyData = [];
let currentCategory = null;
let currentSubcategory = null;
let currentWords = [];
let currentIndex = 0;
let isFlipped = false;
let knownWords = new Set();
let notKnownWords = new Set();
let previousView = 'categories';
let currentListView = 'all-words';
let currentFilter = 'all';
let debounceTimer = null;
let syncDebounceTimer = null;
let longPressTimer = null;
let longPressWordData = null;
let previewShown = false;

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
const SWIPE_THRESHOLD = 50;

const categoryIcons = {
    'Praise & Approval': 'fa-star',
    'Criticism & Disapproval': 'fa-thumbs-down',
    'Stubbornness & Obstinacy': 'fa-anchor',
    'Deception, Trickery & Dishonesty': 'fa-masks-theater',
    'Truth, Honesty & Openness': 'fa-heart',
    'Anger, Hostility & Conflict': 'fa-bolt',
    'Friendliness, Agreement & Harmony': 'fa-hands-holding',
    'Greed, Excess & Self-Interest': 'fa-gem',
    'Generosity, Altruism & Selflessness': 'fa-hands-holding-circle',
    'Intelligence, Insight & Shrewdness': 'fa-lightbulb',
    'Foolishness, Stupidity & Naivety': 'fa-face-dizzy',
    'Brevity, Conciseness & Lengthiness': 'fa-align-left',
    'Bravery & Cowardice': 'fa-shield-halved',
    'Carefulness & Carelessness': 'fa-eye',
    'Hardship, Relief & Calmness': 'fa-wind'
};

const categorySection = document.getElementById('category-section');
const subcategorySection = document.getElementById('subcategory-section');
const flashcardSection = document.getElementById('flashcard-section');
const wordsListSection = document.getElementById('words-list-section');
const loadingSection = document.getElementById('loading-section');
const categoryList = document.getElementById('category-list');
const subcategoryList = document.getElementById('subcategory-list');
const categoryTitle = document.getElementById('category-title');
const subcategoryTitle = document.getElementById('subcategory-title');
const listTitle = document.getElementById('list-title');
const flashcardEl = document.getElementById('flashcard');
const flashcardFrontEl = flashcardEl.querySelector('.flashcard-front');
const flashcardBackEl = flashcardEl.querySelector('.flashcard-back');
const wordEl = document.getElementById('word');
const posEl = document.getElementById('pos');
const phoneticEl = document.getElementById('phonetic');
const englishEl = document.getElementById('english');
const banglaEl = document.getElementById('bangla');
const synonymsEl = document.getElementById('synonyms');
const sentencesEl = document.getElementById('sentences');
const wordsListEl = document.getElementById('words-list');
const currentCardEl = document.getElementById('current-card');
const totalCardsEl = document.getElementById('total-cards');
const prevBtn = document.getElementById('prev-card');
const nextBtn = document.getElementById('next-card');
const shuffleBtn = document.getElementById('shuffle-cards');
const miniKnowBtn = document.getElementById('mini-know-btn');
const miniNotKnowBtn = document.getElementById('mini-notknow-btn');
const miniResetBtn = document.getElementById('mini-reset-btn');
const miniKnowBtnBack = document.getElementById('mini-know-btn-back');
const miniNotKnowBtnBack = document.getElementById('mini-notknow-btn-back');
const miniResetBtnBack = document.getElementById('mini-reset-btn-back');
const soundBtn = document.getElementById('sound-btn');
const soundBtnBack = document.getElementById('sound-btn-back');
const backToCategoriesBtn = document.getElementById('back-to-categories');
const backToPrevBtn = document.getElementById('back-to-prev');
const backToMenuBtn = document.getElementById('back-to-menu');
const navBtns = document.querySelectorAll('.nav-btn');
const searchInput = document.getElementById('search-input');
const searchIconPrefix = document.getElementById('search-icon-prefix');
const searchContainer = searchInput.closest('.search-container');
const suggestionsContainer = document.getElementById('suggestions-container');
const filterBtns = document.querySelectorAll('.filter-btn');
const syncStatusMenuEl = document.getElementById('sync-status-menu');
const setSyncBtnMenuEl = document.getElementById('setsync-btn-menu');
const kebabContainerEl = document.getElementById('kebab-menu-container');
const kebabBtnEl = document.getElementById('kebab-menu-btn');
const kebabDropdownEl = document.getElementById('kebab-dropdown');
const syncModalEl = document.getElementById('sync-modal');
const syncKeyInputEl = document.getElementById('sync-key-input');
const saveSyncBtnEl = document.getElementById('save-sync-btn');
const cancelSyncBtnEl = document.getElementById('cancel-sync-btn');
const viewModeBtns = document.querySelectorAll('.view-mode-btn, .kebab-view-item');
const flashcardLayoutEl = document.getElementById('flashcard-layout');
const sideWordsListEl = document.getElementById('side-words-list');
const flashcardContainerEl = document.querySelector('.flashcard-container');
const clearBtn = document.getElementById('clear-btn');

function updateSearchContainerValue() {
    if (searchInput.value.trim()) {
        searchContainer.classList.add('has-value');
    } else {
        searchContainer.classList.remove('has-value');
    }
}

if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        updateSearchContainerValue();
        suggestionsContainer.classList.remove('show');
        searchInput.focus();
    });
}

if (searchInput) {
    searchInput.addEventListener('input', updateSearchContainerValue);
}

function toggleKebabMenu(forceClose = false) {
    if (forceClose) {
        kebabDropdownEl.classList.remove('show');
        kebabBtnEl.classList.remove('active');
    } else {
        const isShown = kebabDropdownEl.classList.toggle('show');
        kebabBtnEl.classList.toggle('active', isShown);
    }
}

if (kebabBtnEl) {
    kebabBtnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleKebabMenu();
    });
}

document.addEventListener('click', (e) => {
    if (!kebabContainerEl.contains(e.target)) {
        toggleKebabMenu(true);
    }
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
        hideSuggestions();
    }
});

function pronounceSpecificWord(word) {
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function setSyncStatus(status, message) {
    if (syncStatusMenuEl) {
        syncStatusMenuEl.classList.remove('synced', 'error');
        const iEl = syncStatusMenuEl.querySelector('i');
        const spanEl = syncStatusMenuEl.querySelector('span');
        
        if (status === 'syncing') {
            if (iEl) { iEl.className = 'fas fa-circle-notch fa-spin'; }
            if (spanEl) { spanEl.textContent = message || 'Syncing...'; }
        } else if (status === 'synced') {
            syncStatusMenuEl.classList.add('synced');
            if (iEl) { iEl.className = 'fas fa-check-circle'; }
            if (spanEl) { spanEl.textContent = message || 'Synced'; }
        } else if (status === 'error') {
            syncStatusMenuEl.classList.add('error');
            if (iEl) { iEl.className = 'fas fa-exclamation-triangle'; }
            if (spanEl) { spanEl.textContent = message || 'Sync Error'; }
        } else {
            if (iEl) { iEl.className = 'fas fa-cloud'; }
            if (spanEl) { spanEl.textContent = message || 'Not Synced'; }
        }
    }
}

function sanitizeSyncKey(key) {
    return key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

function hashSyncKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function getDocId(syncKey) {
    const sanitized = sanitizeSyncKey(syncKey);
    const hashed = hashSyncKey(syncKey);
    return `sync_${hashed}_${sanitized.substring(0, 10)}`;
}

async function saveToCloud() {
    if (!currentSyncKey) return;
    
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
        try {
            setSyncStatus('syncing');
            isCloudSyncing = true;
            const docId = getDocId(currentSyncKey);
            const docRef = doc(db, "progress", docId);
            await setDoc(docRef, {
                syncKey: sanitizeSyncKey(currentSyncKey),
                knownWords: Array.from(knownWords),
                notKnownWords: Array.from(notKnownWords),
                updatedAt: new Date().toISOString()
            }, { merge: true });
            setSyncStatus('synced');
            isCloudSyncing = false;
        } catch (e) {
            console.error("Cloud save error:", e);
            setSyncStatus('error', 'Save Failed');
            isCloudSyncing = false;
        }
    }, 500);
}

async function loadFromCloud() {
    if (!currentSyncKey) return;
    try {
        setSyncStatus('syncing');
        const docId = getDocId(currentSyncKey);
        const docRef = doc(db, "progress", docId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const cloudUpdatedAt = new Date(data.updatedAt || 0);
            const localUpdatedAt = new Date(localStorage.getItem('greFlashcardsUpdatedAt') || 0);
            
            if (cloudUpdatedAt > localUpdatedAt) {
                if (data.knownWords) knownWords = new Set(data.knownWords);
                if (data.notKnownWords) notKnownWords = new Set(data.notKnownWords);
                saveToLocalStorage(false);
                refreshCurrentViews();
            } else {
                saveToCloud();
            }
        } else {
            saveToCloud();
        }
        setSyncStatus('synced');
        listenToCloudChanges();
    } catch (e) {
        console.error("Cloud load error:", e);
        setSyncStatus('error', 'Load Failed');
    }
}

function listenToCloudChanges() {
    if (!currentSyncKey) return;
    if (unsubscribeListener) unsubscribeListener();
    
    const docId = getDocId(currentSyncKey);
    const docRef = doc(db, "progress", docId);
    unsubscribeListener = onSnapshot(docRef, (docSnap) => {
        if (isCloudSyncing) return;
        if (docSnap.exists()) {
            const data = docSnap.data();
            const cloudUpdatedAt = new Date(data.updatedAt || 0);
            const localUpdatedAt = new Date(localStorage.getItem('greFlashcardsUpdatedAt') || 0);
            
            if (cloudUpdatedAt > localUpdatedAt) {
                setSyncStatus('syncing', 'Receiving changes...');
                if (data.knownWords) knownWords = new Set(data.knownWords);
                if (data.notKnownWords) notKnownWords = new Set(data.notKnownWords);
                saveToLocalStorage(false);
                refreshCurrentViews();
                setTimeout(() => setSyncStatus('synced'), 500);
            }
        }
    }, (error) => {
        console.error("Snapshot error:", error);
        setSyncStatus('error', 'Connection Lost');
    });
}

function saveToLocalStorage(updateCloud = true) {
    localStorage.setItem('greFlashcardsKnown', JSON.stringify([...knownWords]));
    localStorage.setItem('greFlashcardsNotKnown', JSON.stringify([...notKnownWords]));
    localStorage.setItem('greFlashcardsUpdatedAt', new Date().toISOString());
    if (updateCloud && currentSyncKey) saveToCloud();
}

function loadFromLocalStorage() {
    try {
        const known = localStorage.getItem('greFlashcardsKnown');
        const notKnown = localStorage.getItem('greFlashcardsNotKnown');
        const savedKey = localStorage.getItem('greFlashcardsSyncKey');
        const savedView = localStorage.getItem('greFlashcardsViewMode');
        if (known) knownWords = new Set(JSON.parse(known));
        if (notKnown) notKnownWords = new Set(JSON.parse(notKnown));
        if (savedKey) {
            currentSyncKey = savedKey;
        }
        if (savedView) {
            currentViewMode = savedView === 'single' ? 'card' : savedView;
        }
        applyViewMode();
    } catch (e) {
        console.error('Error loading from localStorage:', e);
    }
}

function applyViewMode() {
    flashcardLayoutEl.classList.remove('card', 'list', 'split');
    flashcardLayoutEl.classList.add(currentViewMode);
    viewModeBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === currentViewMode) {
            btn.classList.add('active');
        }
    });
}

function setViewMode(mode) {
    if (!['card', 'list', 'split'].includes(mode)) return;
    currentViewMode = mode;
    localStorage.setItem('greFlashcardsViewMode', currentViewMode);
    applyViewMode();
    toggleKebabMenu(true);
}

viewModeBtns.forEach(btn => {
    btn.addEventListener('click', () => setViewMode(btn.dataset.view));
});

function openSyncModal() {
    syncKeyInputEl.value = currentSyncKey || '';
    syncModalEl.style.display = 'flex';
    toggleKebabMenu(true);
    setTimeout(() => syncKeyInputEl.focus(), 100);
}

function closeSyncModal() {
    syncModalEl.style.display = 'none';
}

async function saveSyncKey() {
    const newKey = syncKeyInputEl.value.trim();
    if (!newKey) {
        alert('Please enter a sync key!');
        return;
    }
    if (unsubscribeListener) {
        unsubscribeListener();
        unsubscribeListener = null;
    }
    currentSyncKey = newKey;
    localStorage.setItem('greFlashcardsSyncKey', newKey);
    closeSyncModal();
    await loadFromCloud();
}

if (setSyncBtnMenuEl) {
    setSyncBtnMenuEl.addEventListener('click', openSyncModal);
}
if (cancelSyncBtnEl) {
    cancelSyncBtnEl.addEventListener('click', closeSyncModal);
}
if (saveSyncBtnEl) {
    saveSyncBtnEl.addEventListener('click', saveSyncKey);
}
if (syncKeyInputEl) {
    syncKeyInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') saveSyncKey();
    });
}
if (syncModalEl) {
    syncModalEl.addEventListener('click', (e) => {
        if (e.target === syncModalEl) closeSyncModal();
    });
}

function pronounceWord() {
    if (currentWords.length === 0) return;
    const wordData = currentWords[currentIndex];
    pronounceSpecificWord(wordData.word);
}

if (soundBtn) soundBtn.addEventListener('click', (e) => { e.stopPropagation(); pronounceWord(); });
if (soundBtnBack) soundBtnBack.addEventListener('click', (e) => { e.stopPropagation(); pronounceWord(); });

async function loadVocabularyData() {
      try {
        const response = await fetch('data.json');
        vocabularyData = await response.json();
        loadFromLocalStorage();
        updateSearchContainerValue();
        if (currentSyncKey) {
            await loadFromCloud();
        } else {
            setSyncStatus('idle', 'Not Synced');
        }
        loadingSection.classList.add('hidden');
        renderCategories();
        showSection('categories');
    } catch (error) {
        console.error('Error loading vocabulary data:', error);
        loadingSection.innerHTML = '<h2>Error loading vocabulary data!</h2>';
    }
}

function refreshCurrentViews() {
    if (!categorySection.classList.contains('hidden')) {
        renderCategories();
    } else if (!subcategorySection.classList.contains('hidden')) {
        renderSubcategories();
    } else if (!flashcardSection.classList.contains('hidden')) {
        renderSideWordsList();
    } else if (!wordsListSection.classList.contains('hidden')) {
        if (currentListView === 'all-words') {
            renderWordsList(getAllWords(), 'All Words');
        } else if (currentListView === 'known-words') {
            renderWordsList(getAllWords().filter(w => knownWords.has(getWordKey(w))), 'Known Words');
        } else if (currentListView === 'not-known-words') {
            renderWordsList(getAllWords().filter(w => notKnownWords.has(getWordKey(w))), 'Not Known Words');
        }
    }
}

function renderCategories() {
    categoryList.innerHTML = '';
    vocabularyData.forEach((cat, index) => {
        const card = document.createElement('div');
        card.className = 'category-card';
        const iconClass = categoryIcons[cat.category] || 'fa-book';
        let totalWords = 0;
        cat.subCategories.forEach(sub => totalWords += sub.words.length);
        card.innerHTML = `
            <div class="card-serial">${index + 1}</div>
            <div class="card-icon"><i class="fas ${iconClass}"></i></div>
            <div class="card-content">
                <h3>${cat.category}</h3>
                <p>${totalWords} words</p>
            </div>
        `;
        card.addEventListener('click', () => selectCategory(index));
        categoryList.appendChild(card);
    });
}

function selectCategory(index) {
    currentCategory = vocabularyData[index];
    categoryTitle.textContent = currentCategory.category;
    renderSubcategories();
    previousView = 'categories';
    showSection('subcategory');
}

function getFilteredWords(words, filter) {
    if (filter === 'all') return words;
    return words.filter(w => {
        const key = getWordKey(w);
        if (filter === 'known') return knownWords.has(key);
        if (filter === 'not-known') return notKnownWords.has(key);
        return true;
    });
}

function renderSubcategories() {
    subcategoryList.innerHTML = '';
    currentCategory.subCategories.forEach((subcat, index) => {
        const filteredWords = getFilteredWords(subcat.words, currentFilter);
        if (filteredWords.length === 0 && currentFilter !== 'all') return;
        
        const card = document.createElement('div');
        card.className = 'subcategory-card';
        card.dataset.index = index;
        card.innerHTML = `
            <div class="card-serial">${index + 1}</div>
            <div class="card-icon"><i class="fas fa-folder"></i></div>
            <div class="card-content">
                <h3>${subcat.name}</h3>
                <p>${filteredWords.length} words</p>
            </div>
        `;
        card.addEventListener('click', (e) => {
            selectSubcategory(parseInt(e.currentTarget.dataset.index));
        });
        subcategoryList.appendChild(card);
    });
}

function updateFilterButtons(filter) {
    currentFilter = filter;
    filterBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) btn.classList.add('active');
    });
    renderSubcategories();
}

function selectSubcategory(index) {
    currentSubcategory = currentCategory.subCategories[index];
    currentWords = [...getFilteredWords(currentSubcategory.words, currentFilter)];
    currentIndex = 0;
    isFlipped = false;
    subcategoryTitle.textContent = currentSubcategory.name;
    totalCardsEl.textContent = currentWords.length;
    updateFlashcard();
    renderSideWordsList();
    previousView = 'subcategory';
    showSection('flashcard');
}

function getWordKey(wordData) {
    return wordData.word.toLowerCase();
}

function highlightWordInSentence(sentence, word) {
    const wordLower = word.toLowerCase();
    const wordPattern = new RegExp(`\\b(${wordLower})\\b`, 'gi');
    return sentence.replace(wordPattern, (match) => `<span class="highlight-word">${match}</span>`);
}

function showWordPreview(wordData) {
    if (previewShown) return;
    previewShown = true;
    
    const overlay = document.createElement('div');
    overlay.className = 'word-preview-overlay';
    overlay.id = 'word-preview-overlay';
    
    const previewCard = document.createElement('div');
    previewCard.className = 'word-preview-card';
    previewCard.innerHTML = `
        <h3>${wordData.word}</h3>
        <div class="back-content" style="width: 100%; text-align: left;">
            <h4><i class="fas fa-tags"></i> Part of Speech</h4>
            <p class="pos-text" style="color: white; font-weight: 600; margin-bottom: 1.25rem;">${wordData.pos}</p>
            
            <h4><i class="fas fa-volume-up"></i> Phonetic</h4>
            <p class="phonetic-text" style="color: #93c5fd; font-style: italic; margin-bottom: 1.25rem;">${wordData.phonetic}</p>
            
            <h4><i class="fas fa-book"></i> English Definition</h4>
            <p class="english-text" style="color: white; margin-bottom: 1.25rem; line-height: 1.7;">${wordData.english}</p>
            
            <h4><i class="fas fa-language"></i> Bangla Meaning</h4>
            <p class="bangla-text" style="color: #86efac; font-weight: 600; margin-bottom: 1.25rem; line-height: 1.7;">${wordData.bangla}</p>
            
            <h4><i class="fas fa-sync-alt"></i> Synonyms</h4>
            <div class="synonyms-container" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem;">
                ${wordData.synonyms.map(syn => `<span class="synonym-tag">${syn}</span>`).join('')}
            </div>
            
            <h4><i class="fas fa-file-alt"></i> Example Sentences</h4>
            <ul class="sentences-list" style="color: #e2e8f0; padding-left: 1.25rem; line-height: 1.8;">
                ${wordData.sentences.map(sent => `<li style="margin-bottom: 0.75rem;">${highlightWordInSentence(sent, wordData.word)}</li>`).join('')}
            </ul>
        </div>
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'word-preview-close';
    closeBtn.innerHTML = '<i class="fas fa-times"></i>';
    
    function closePreview() {
        if (document.getElementById('word-preview-overlay')) {
            document.getElementById('word-preview-overlay').remove();
            previewShown = false;
        }
    }
    
    closeBtn.addEventListener('click', closePreview);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePreview();
    });
    
    overlay.appendChild(previewCard);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
}

function renderSideWordsList() {
    if (!sideWordsListEl) return;
    sideWordsListEl.innerHTML = '';
    currentWords.forEach((wordData, index) => {
        const wordKey = getWordKey(wordData);
        const isKnown = knownWords.has(wordKey);
        const isNotKnown = notKnownWords.has(wordKey);
        let statusClass = 'pending';
        if (isKnown) statusClass = 'known';
        else if (isNotKnown) statusClass = 'not-known';
        
        const item = document.createElement('div');
        item.className = `side-word-item ${index === currentIndex ? 'active' : ''}`;
        item.innerHTML = `
            <div class="side-word-status ${statusClass}"></div>
            <div class="side-word-info">
                <div class="side-word-text">${wordData.word}</div>
                <div class="side-word-pos">${wordData.pos}</div>
            </div>
            <div class="side-word-actions">
                <button class="list-icon-btn list-notknow" title="Mark as Not Known" data-action="notknow" data-idx="${index}">
                    <i class="fas fa-times"></i>
                </button>
                <button class="list-icon-btn list-reset" title="Reset Status" data-action="reset" data-idx="${index}">
                    <i class="fas fa-rotate-left"></i>
                </button>
                <button class="list-icon-btn list-know" title="Mark as Known" data-action="know" data-idx="${index}">
                    <i class="fas fa-check"></i>
                </button>
                <button class="side-word-sound" title="Pronounce" data-action="sound" data-idx="${index}">
                    <i class="fas fa-volume-up"></i>
                </button>
            </div>
        `;
        
        item.querySelectorAll('[data-action]').forEach(actionBtn => {
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = actionBtn.dataset.action;
                const idx = parseInt(actionBtn.dataset.idx);
                const targetWord = currentWords[idx];
                const targetKey = getWordKey(targetWord);
                if (action === 'know') {
                    knownWords.add(targetKey);
                    notKnownWords.delete(targetKey);
                    saveToLocalStorage();
                    if (idx === currentIndex) updateFlashcard();
                    else renderSideWordsList();
                } else if (action === 'notknow') {
                    notKnownWords.add(targetKey);
                    knownWords.delete(targetKey);
                    saveToLocalStorage();
                    if (idx === currentIndex) updateFlashcard();
                    else renderSideWordsList();
                } else if (action === 'reset') {
                    knownWords.delete(targetKey);
                    notKnownWords.delete(targetKey);
                    saveToLocalStorage();
                    if (idx === currentIndex) updateFlashcard();
                    else renderSideWordsList();
                } else if (action === 'sound') {
                    pronounceSpecificWord(targetWord.word);
                }
            });
        });
        
        function startLongPress() {
            longPressWordData = wordData;
            longPressTimer = setTimeout(() => {
                showWordPreview(wordData);
                longPressTimer = null;
            }, 500);
        }
        
        function cancelLongPress() {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        }
        
        item.addEventListener('mousedown', startLongPress);
        item.addEventListener('mouseup', cancelLongPress);
        item.addEventListener('mouseleave', cancelLongPress);
        item.addEventListener('touchstart', startLongPress, { passive: true });
        item.addEventListener('touchend', cancelLongPress);
        item.addEventListener('touchcancel', cancelLongPress);
        item.addEventListener('touchmove', cancelLongPress);
        
        item.addEventListener('click', (e) => {
            if (longPressTimer === null && longPressWordData === wordData && previewShown) {
                return;
            }
            if (previewShown) return;
            if (e.target.closest('[data-action]')) return;
            currentIndex = index;
            isFlipped = false;
            updateFlashcard();
            renderSideWordsList();
        });
        
        sideWordsListEl.appendChild(item);
    });
    
    if (sideWordsListEl.children[currentIndex]) {
        sideWordsListEl.children[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function getCardColorIndex(word) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
        hash = word.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 8;
}

function applyCardColor(word) {
    for (let i = 0; i < 8; i++) {
        flashcardFrontEl.classList.remove(`color-${i}`);
        flashcardBackEl.classList.remove(`color-${i}`);
    }
    const colorIdx = getCardColorIndex(word);
    flashcardFrontEl.classList.add(`color-${colorIdx}`);
    flashcardBackEl.classList.add(`color-${colorIdx}`);
}

function updateFlashcard() {
    if (currentWords.length === 0) {
        wordEl.textContent = 'No words found';
        posEl.textContent = '';
        phoneticEl.textContent = '';
        englishEl.textContent = '';
        banglaEl.textContent = '';
        synonymsEl.innerHTML = '';
        sentencesEl.innerHTML = '';
        currentCardEl.textContent = 0;
        flashcardEl.classList.remove('flipped');
        isFlipped = false;
        updateButtons();
        return;
    }
    const wordData = currentWords[currentIndex];
    wordEl.textContent = wordData.word;
    posEl.textContent = wordData.pos;
    phoneticEl.textContent = wordData.phonetic;
    englishEl.textContent = wordData.english;
    banglaEl.textContent = wordData.bangla;
    synonymsEl.innerHTML = wordData.synonyms.map(syn => `<span class="synonym-tag">${syn}</span>`).join('');
    sentencesEl.innerHTML = wordData.sentences.map(sent => `<li>${highlightWordInSentence(sent, wordData.word)}</li>`).join('');
    currentCardEl.textContent = currentIndex + 1;
    flashcardEl.classList.remove('flipped');
    isFlipped = false;
    applyCardColor(wordData.word.toLowerCase());
    updateButtons();
    renderSideWordsList();
}

function flipCard() {
    flashcardEl.classList.toggle('flipped');
    isFlipped = !isFlipped;
}

function nextCard() {
    if (currentIndex < currentWords.length - 1) {
        currentIndex++;
        updateFlashcard();
    }
}

function prevCard() {
    if (currentIndex > 0) {
        currentIndex--;
        updateFlashcard();
    }
}

function handleKnow() {
    if (currentWords.length === 0) return;
    const wordKey = getWordKey(currentWords[currentIndex]);
    knownWords.add(wordKey);
    notKnownWords.delete(wordKey);
    saveToLocalStorage();
    nextCard();
}

function handleNotKnown() {
    if (currentWords.length === 0) return;
    const wordKey = getWordKey(currentWords[currentIndex]);
    notKnownWords.add(wordKey);
    knownWords.delete(wordKey);
    saveToLocalStorage();
    const [word] = currentWords.splice(currentIndex, 1);
    currentWords.push(word);
    updateFlashcard();
}

function handleReset() {
    if (currentWords.length === 0) return;
    const wordKey = getWordKey(currentWords[currentIndex]);
    knownWords.delete(wordKey);
    notKnownWords.delete(wordKey);
    saveToLocalStorage();
    updateFlashcard();
}

function updateButtons() {
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === currentWords.length - 1;
}

function shuffleCards() {
    for (let i = currentWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentWords[i], currentWords[j]] = [currentWords[j], currentWords[i]];
    }
    currentIndex = 0;
    updateFlashcard();
}

function getAllWords() {
    let allWords = [];
    vocabularyData.forEach(cat => {
        cat.subCategories.forEach(sub => {
            allWords = allWords.concat(sub.words);
        });
    });
    return allWords;
}

function renderWordsList(words, title) {
    listTitle.textContent = title;
    wordsListEl.innerHTML = '';
    words.forEach((wordData, index) => {
        const wordKey = getWordKey(wordData);
        const isKnown = knownWords.has(wordKey);
        const isNotKnown = notKnownWords.has(wordKey);
        const card = document.createElement('div');
        card.className = 'word-card';
        let statusHTML = '';
        if (isKnown) statusHTML = '<span class="word-status known">Known</span>';
        else if (isNotKnown) statusHTML = '<span class="word-status not-known">Not Known</span>';
        
        card.innerHTML = `
            <div class="word-card-header">
                <div class="card-serial">${index + 1}</div>
                <div style="flex: 1; min-width: 0;">
                    <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${wordData.word}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">${wordData.pos}</p>
                </div>
                <div class="side-word-actions" style="display: flex; gap: 5px; align-items: center; margin-right: 0.5rem;">
                    <button class="list-icon-btn list-notknow" title="Mark as Not Known" data-action="notknow">
                        <i class="fas fa-times"></i>
                    </button>
                    <button class="list-icon-btn list-reset" title="Reset Status" data-action="reset">
                        <i class="fas fa-rotate-left"></i>
                    </button>
                    <button class="list-icon-btn list-know" title="Mark as Known" data-action="know">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="side-word-sound word-list-sound" title="Pronounce" data-action="sound">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>
                ${statusHTML}
            </div>
        `;
        
        card.querySelectorAll('[data-action]').forEach(actionBtn => {
            actionBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = actionBtn.dataset.action;
                const targetKey = getWordKey(wordData);
                if (action === 'know') {
                    knownWords.add(targetKey);
                    notKnownWords.delete(targetKey);
                    saveToLocalStorage();
                    renderWordsList(words, title);
                } else if (action === 'notknow') {
                    notKnownWords.add(targetKey);
                    knownWords.delete(targetKey);
                    saveToLocalStorage();
                    renderWordsList(words, title);
                } else if (action === 'reset') {
                    knownWords.delete(targetKey);
                    notKnownWords.delete(targetKey);
                    saveToLocalStorage();
                    renderWordsList(words, title);
                } else if (action === 'sound') {
                    pronounceSpecificWord(wordData.word);
                }
            });
        });
        
        let localLongPressTimer = null;
        function startPreviewLongPress() {
            localLongPressTimer = setTimeout(() => {
                showWordPreview(wordData);
                localLongPressTimer = null;
            }, 500);
        }
        function cancelPreviewLongPress() {
            if (localLongPressTimer) {
                clearTimeout(localLongPressTimer);
                localLongPressTimer = null;
            }
        }
        
        card.addEventListener('mousedown', startPreviewLongPress);
        card.addEventListener('mouseup', cancelPreviewLongPress);
        card.addEventListener('mouseleave', cancelPreviewLongPress);
        card.addEventListener('touchstart', startPreviewLongPress, { passive: true });
        card.addEventListener('touchend', cancelPreviewLongPress);
        card.addEventListener('touchcancel', cancelPreviewLongPress);
        card.addEventListener('touchmove', cancelPreviewLongPress);
        
        card.addEventListener('click', (e) => {
            if (previewShown) return;
            if (e.target.closest('[data-action]')) return;
            currentWords = [wordData];
            currentIndex = 0;
            subcategoryTitle.textContent = wordData.word;
            totalCardsEl.textContent = 1;
            updateFlashcard();
            previousView = currentListView;
            showSection('flashcard');
        });
        
        wordsListEl.appendChild(card);
    });
}

function showSection(section) {
    categorySection.classList.add('hidden');
    subcategorySection.classList.add('hidden');
    flashcardSection.classList.add('hidden');
    wordsListSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    
    navBtns.forEach(btn => btn.classList.remove('active'));
    if (['categories', 'all-words', 'known-words', 'not-known-words'].includes(section)) {
        document.querySelector(`[data-view="${section}"]`).classList.add('active');
    }

    if (section === 'categories') {
        categorySection.classList.remove('hidden');
    } else if (section === 'subcategory') {
        subcategorySection.classList.remove('hidden');
    } else if (section === 'flashcard') {
        flashcardSection.classList.remove('hidden');
    } else if (section === 'words-list') {
        wordsListSection.classList.remove('hidden');
    }
}

navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        currentListView = view;
        if (view === 'categories') {
            showSection('categories');
        } else if (view === 'all-words') {
            renderWordsList(getAllWords(), 'All Words');
            showSection('words-list');
        } else if (view === 'known-words') {
            const knownWordsList = getAllWords().filter(w => knownWords.has(getWordKey(w)));
            renderWordsList(knownWordsList, 'Known Words');
            showSection('words-list');
        } else if (view === 'not-known-words') {
            const notKnownWordsList = getAllWords().filter(w => notKnownWords.has(getWordKey(w)));
            renderWordsList(notKnownWordsList, 'Not Known Words');
            showSection('words-list');
        }
    });
});

backToCategoriesBtn.addEventListener('click', () => showSection('categories'));
backToPrevBtn.addEventListener('click', () => {
    if (previousView === 'subcategory') {
        showSection('subcategory');
    } else if (['all-words', 'known-words', 'not-known-words'].includes(previousView)) {
        currentListView = previousView;
        navBtns.forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-view="${previousView}"]`).classList.add('active');
        if (previousView === 'all-words') {
            renderWordsList(getAllWords(), 'All Words');
        } else if (previousView === 'known-words') {
            renderWordsList(getAllWords().filter(w => knownWords.has(getWordKey(w))), 'Known Words');
        } else if (previousView === 'not-known-words') {
            renderWordsList(getAllWords().filter(w => notKnownWords.has(getWordKey(w))), 'Not Known Words');
        }
        showSection('words-list');
    } else {
        showSection('categories');
    }
});
backToMenuBtn.addEventListener('click', () => showSection('categories'));

flashcardEl.addEventListener('click', flipCard);
nextBtn.addEventListener('click', nextCard);
prevBtn.addEventListener('click', prevCard);
shuffleBtn.addEventListener('click', shuffleCards);
if (miniKnowBtn) miniKnowBtn.addEventListener('click', (e) => { e.stopPropagation(); handleKnow(); });
if (miniNotKnowBtn) miniNotKnowBtn.addEventListener('click', (e) => { e.stopPropagation(); handleNotKnown(); });
if (miniResetBtn) miniResetBtn.addEventListener('click', (e) => { e.stopPropagation(); handleReset(); });
if (miniKnowBtnBack) miniKnowBtnBack.addEventListener('click', (e) => { e.stopPropagation(); handleKnow(); });
if (miniNotKnowBtnBack) miniNotKnowBtnBack.addEventListener('click', (e) => { e.stopPropagation(); handleNotKnown(); });
if (miniResetBtnBack) miniResetBtnBack.addEventListener('click', (e) => { e.stopPropagation(); handleReset(); });

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
}

function handleSwipe() {
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > SWIPE_THRESHOLD) {
        if (diffX < 0) {
            nextCard();
        } else {
            prevCard();
        }
    }
}

flashcardContainerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
flashcardContainerEl.addEventListener('touchend', handleTouchEnd, { passive: true });

function searchWords(query) {
    if (!query.trim()) {
        return getAllWords();
    }
    const lowerQuery = query.toLowerCase().trim();
    return getAllWords().filter(word => {
        return (
            word.word.toLowerCase().includes(lowerQuery) ||
            word.english.toLowerCase().includes(lowerQuery) ||
            word.bangla.includes(lowerQuery) ||
            word.synonyms.some(syn => syn.toLowerCase().includes(lowerQuery))
        );
    });
}

function handleSearch() {
    const query = searchInput.value;
    const results = searchWords(query);
    hideSuggestions();
    updateSearchContainerValue();
    navBtns.forEach(btn => btn.classList.remove('active'));
    currentListView = 'search';
    if (query.trim()) {
        renderWordsList(results, `Search Results for "${query}"`);
    } else {
        renderWordsList(getAllWords(), 'All Words');
    }
    showSection('words-list');
}

function clearSearch() {
    searchInput.value = '';
    updateSearchContainerValue();
    hideSuggestions();
    showSection('categories');
    navBtns.forEach(btn => btn.classList.remove('active'));
    navBtns[0].classList.add('active');
}

function showSuggestions(query) {
    if (!query.trim()) {
        hideSuggestions();
        return;
    }
    const results = searchWords(query).slice(0, 10);
    if (results.length === 0) {
        hideSuggestions();
        return;
    }
    suggestionsContainer.innerHTML = results.map(word => `
        <div class="suggestion-item" data-word="${word.word}">
            <span class="suggestion-word">${word.word}</span>
            <span class="suggestion-pos">${word.pos}</span>
        </div>
    `).join('');
    suggestionsContainer.classList.add('show');
    
    suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const word = item.dataset.word;
            searchInput.value = word;
            updateSearchContainerValue();
            hideSuggestions();
            const wordData = getAllWords().find(w => w.word === word);
            if (wordData) {
                currentWords = [wordData];
                currentIndex = 0;
                isFlipped = false;
                subcategoryTitle.textContent = wordData.word;
                totalCardsEl.textContent = 1;
                updateFlashcard();
                previousView = 'search';
                showSection('flashcard');
            }
        });
    });
}

function hideSuggestions() {
    suggestionsContainer.classList.remove('show');
    suggestionsContainer.innerHTML = '';
}

function handleInputChange() {
    updateSearchContainerValue();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        showSuggestions(searchInput.value);
    }, 300);
}

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});
searchInput.addEventListener('input', handleInputChange);

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        updateFilterButtons(btn.dataset.filter);
    });
});

document.addEventListener('keydown', (e) => {
    if (!flashcardSection.classList.contains('hidden')) {
        if (e.key === 'ArrowLeft') prevCard();
        else if (e.key === 'ArrowRight') nextCard();
        else if (e.key === ' ') { e.preventDefault(); flipCard(); }
        else if (e.key.toLowerCase() === 'k') handleKnow();
        else if (e.key.toLowerCase() === 'n') handleNotKnown();
        else if (e.key.toLowerCase() === 'r') handleReset();
        else if (e.key.toLowerCase() === 's') pronounceWord();
    }
});

loadVocabularyData();
