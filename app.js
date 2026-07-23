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
let currentViewMode = localStorage.getItem('greFlashcardsViewMode') || 'single';

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
const flashcard = document.getElementById('flashcard');
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
const soundBtn = document.getElementById('sound-btn');
const backToCategoriesBtn = document.getElementById('back-to-categories');
const backToPrevBtn = document.getElementById('back-to-prev');
const backToMenuBtn = document.getElementById('back-to-menu');
const navBtns = document.querySelectorAll('.nav-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');
const suggestionsContainer = document.getElementById('suggestions-container');
const filterBtns = document.querySelectorAll('.filter-btn');
const syncStatusEl = document.getElementById('sync-status');
const setSyncBtnEl = document.getElementById('setsync-btn');
const syncModalEl = document.getElementById('sync-modal');
const syncKeyInputEl = document.getElementById('sync-key-input');
const saveSyncBtnEl = document.getElementById('save-sync-btn');
const cancelSyncBtnEl = document.getElementById('cancel-sync-btn');
const toggleViewBtn = document.getElementById('toggle-view-btn');
const flashcardLayoutEl = document.getElementById('flashcard-layout');
const sideWordsListEl = document.getElementById('side-words-list');

function setSyncStatus(status, message) {
    syncStatusEl.classList.remove('synced', 'error');
    syncStatusEl.className = 'sync-status';
    
    if (status === 'syncing') {
        syncStatusEl.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> ${message || 'Syncing...'}`;
    } else if (status === 'synced') {
        syncStatusEl.classList.add('synced');
        syncStatusEl.innerHTML = `<i class="fas fa-check-circle"></i> ${message || 'Synced'}`;
    } else if (status === 'error') {
        syncStatusEl.classList.add('error');
        syncStatusEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message || 'Sync Error'}`;
    } else {
        syncStatusEl.innerHTML = `<i class="fas fa-cloud"></i> ${message || 'Not Synced'}`;
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
            currentViewMode = savedView;
        }
        applyViewMode();
    } catch (e) {
        console.error('Error loading from localStorage:', e);
    }
}

function applyViewMode() {
    flashcardLayoutEl.classList.remove('single', 'split');
    flashcardLayoutEl.classList.add(currentViewMode);
}

function toggleViewMode() {
    currentViewMode = currentViewMode === 'single' ? 'split' : 'single';
    localStorage.setItem('greFlashcardsViewMode', currentViewMode);
    applyViewMode();
}

toggleViewBtn.addEventListener('click', toggleViewMode);

function openSyncModal() {
    syncKeyInputEl.value = currentSyncKey || '';
    syncModalEl.style.display = 'flex';
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

setSyncBtnEl.addEventListener('click', openSyncModal);
cancelSyncBtnEl.addEventListener('click', closeSyncModal);
saveSyncBtnEl.addEventListener('click', saveSyncKey);
syncKeyInputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveSyncKey();
});
syncModalEl.addEventListener('click', (e) => {
    if (e.target === syncModalEl) closeSyncModal();
});

function pronounceWord() {
    if (currentWords.length === 0) return;
    const wordData = currentWords[currentIndex];
    const utterance = new SpeechSynthesisUtterance(wordData.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

soundBtn.addEventListener('click', pronounceWord);

async function loadVocabularyData() {
      try {
        const response = await fetch('data.json');
        vocabularyData = await response.json();
        loadFromLocalStorage();
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
        `;
        item.addEventListener('click', () => {
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
        flashcard.classList.remove('flipped');
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
    flashcard.classList.remove('flipped');
    isFlipped = false;
    updateButtons();
    renderSideWordsList();
}

function flipCard() {
    flashcard.classList.toggle('flipped');
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
                <div style="flex: 1">
                    <h3>${wordData.word}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.25rem;">${wordData.pos}</p>
                </div>
                ${statusHTML}
            </div>
        `;
        card.addEventListener('click', () => {
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

flashcard.addEventListener('click', flipCard);
nextBtn.addEventListener('click', nextCard);
prevBtn.addEventListener('click', prevCard);
shuffleBtn.addEventListener('click', shuffleCards);
miniKnowBtn.addEventListener('click', (e) => { e.stopPropagation(); handleKnow(); });
miniNotKnowBtn.addEventListener('click', (e) => { e.stopPropagation(); handleNotKnown(); });
miniResetBtn.addEventListener('click', (e) => { e.stopPropagation(); handleReset(); });

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
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        showSuggestions(searchInput.value);
    }, 300);
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});
searchInput.addEventListener('input', handleInputChange);
clearBtn.addEventListener('click', clearSearch);

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        updateFilterButtons(btn.dataset.filter);
    });
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
        hideSuggestions();
    }
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
