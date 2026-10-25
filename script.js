const SCORE = 50;
let DICTIONARY_SET = new Set();
let activeBoardLetters = [];
let playerpoints = 0;
let aipoints = 0;
let Ailoss = false;
let playerFound = new Set();
let Aifound = new Set();
let aiTimeoutId = null;
let aiAvailableBoardWords = [];

const playerGrid = document.getElementById("player-grid");
const aiGrid = document.getElementById("ai-grid");
const wordInput = document.getElementById("word-input");
const wordFeedback = document.getElementById("word-feedback");
const playerWordsUl = document.getElementById("player-words");
const aiWordsUl = document.getElementById("ai-words");
const playerScoreSpan = document.getElementById("player-score");
const aiScoreSpan = document.getElementById("ai-score");
const playerCup = document.getElementById("player-cup");
const aiCup = document.getElementById("ai-cup");
const aiLiveInput = document.getElementById("ai-live-input");
const enterBtn = document.getElementById("enter-btn");
const cancelBtn = document.getElementById("cancel-btn");

function calcPoints(word) {
    const len = word.length;
    if (len === 2) return 5;
    if (len === 3) return 2;
    if (len === 4) return 3;
    if (len === 5) return 5;
    if (len >= 6) return 6;
    return 0;
}

async function loadDictionaryFile() {
    const response = await fetch('words.txt');
    if (!response.ok) {
        throw new Error(`Dictionary request failed with HTTP ${response.status}`);
    }

    const textData = await response.text();
    const wordArray = textData.split(/\r?\n/);
    DICTIONARY_SET.clear();
    
    wordArray.forEach(line => {
        const word = line.trim().toLowerCase();
        if (word.length >= 2) {
            DICTIONARY_SET.add(word);
        }
    });
    console.log(`Dictionary loaded! ${DICTIONARY_SET.size} words ready.`);
}

function setupBoard() {
    playerGrid.innerHTML = "";
    aiGrid.innerHTML = "";
    activeBoardLetters = [];
    
    const vowels = "AEIOU";
    const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
    
    for (let i = 0; i < 25; i++) {
        const char = Math.random() < 0.35 
            ? vowels[Math.floor(Math.random() * vowels.length)]
            : consonants[Math.floor(Math.random() * consonants.length)];
        activeBoardLetters.push(char);
    }
    
    activeBoardLetters.forEach(char => {
        const pTile = document.createElement("div");
        pTile.classList.add("letter-tile");
        pTile.innerText = char;
        playerGrid.appendChild(pTile);
        
        const aTile = document.createElement("div");
        aTile.classList.add("letter-tile");
        aTile.innerText = char;
        aiGrid.appendChild(aTile);
    });

    findWordsForAI();
}

function countBoardLetters() {
    const letterCounts = new Map();
    for (const letter of activeBoardLetters) {
        letterCounts.set(letter, (letterCounts.get(letter) || 0) + 1);
    }
    return letterCounts;
}

function canFormWordFromBoard(word, availableLetters = countBoardLetters()) {
    const neededLetters = new Map();
    for (const letter of word.toUpperCase()) {
        const needed = (neededLetters.get(letter) || 0) + 1;
        if (needed > (availableLetters.get(letter) || 0)) {
            return false;
        }
        neededLetters.set(letter, needed);
    }
    return true;
}

function findWordsForAI() {
    const availableLetters = countBoardLetters();
    aiAvailableBoardWords = Array.from(DICTIONARY_SET)
        .filter(word => canFormWordFromBoard(word, availableLetters))
        .map(word => word.toUpperCase());
}

function renderPearls(container, count) {
    const pearlLimit = 50;
    const pearlsToAdd = Math.min(count, pearlLimit - container.children.length);
    for (let i = 0; i < pearlsToAdd; i++) {
        const position = container.children.length + 1;
        const pearl = document.createElement("div");
        pearl.classList.add("boba-pearl");
        pearl.style.gridRow = String(5 - Math.floor((position - 1) / 10));
        pearl.style.gridColumn = String((position - 1) % 10 + 1);
        container.appendChild(pearl);
    }
}

function submitPlayerWord() {
    const input = wordInput.value.trim().toUpperCase();
    wordInput.value = "";

    if (input.length < 2) {
        wordFeedback.innerText = "Enter a word with at least 2 letters.";
        return;
    }
    if (playerFound.has(input)) {
        wordFeedback.innerText = "You already found that word.";
        return;
    }

    if (!DICTIONARY_SET.has(input.toLowerCase())) {
        wordFeedback.innerText = "That word isn't in the dictionary.";
        return;
    }
    if (!canFormWordFromBoard(input)) {
        wordFeedback.innerText = "That word needs letters that aren't available on the board.";
        return;
    }

    playerFound.add(input);

    const pts = calcPoints(input);
    playerpoints += pts;
    playerScoreSpan.innerText = playerpoints;
    renderPearls(playerCup, pts);

    const li = document.createElement("li");
    li.innerHTML = `<span>${input}</span><span>+${pts}</span>`;
    playerWordsUl.appendChild(li);

    playerWordsUl.scrollTop = playerWordsUl.scrollHeight;
    wordFeedback.innerText = `Accepted! +${pts} points.`;

    checkMatchState();
}

enterBtn.addEventListener("click", submitPlayerWord);
wordInput.addEventListener("keydown", (e) => { if(e.key === "Enter") submitPlayerWord(); });
cancelBtn.addEventListener("click", () => { wordInput.value = ""; });

function generateAiWordSuggestion() {
    let unspent = aiAvailableBoardWords.filter(w => !Aifound.has(w));
    if (unspent.length === 0) return null;

    const lengths = Ailoss ? [3, 4] : [3, 4, 5];
    const targetLength = lengths[Math.floor(Math.random() * lengths.length)];

    let filtered = unspent.filter(w => w.length === targetLength);
    
    if (filtered.length === 0) {
        for (let l of lengths) {
            filtered = unspent.filter(w => w.length === l);
            if (filtered.length > 0) break;
        }
    }

    return filtered.length > 0 ? filtered[Math.floor(Math.random() * filtered.length)] : unspent[Math.floor(Math.random() * unspent.length)];
}

function triggerAICycle() {
    if (playerpoints >= SCORE || aipoints >= SCORE) return;
    
    const targetWord = generateAiWordSuggestion();
    
    if (!targetWord) {
        aiTimeoutId = setTimeout(triggerAICycle, 4000);
        return;
    }
    
    let currentString = "";
    let charIndex = 0;
    let typingSpeed = Ailoss ? 450 : 200;
    
    let streamTimer = setInterval(() => {
        currentString += targetWord[charIndex];
        aiLiveInput.innerText = currentString;
        charIndex++;
        
        if (charIndex >= targetWord.length) {
            clearInterval(streamTimer);
            
            aiTimeoutId = setTimeout(() => {
                aiLiveInput.innerText = "...";
                
                Aifound.add(targetWord);
                const pts = calcPoints(targetWord);
                aipoints += pts;
                aiScoreSpan.innerText = aipoints;
                renderPearls(aiCup, pts);
                
                const li = document.createElement("li");
                li.innerHTML = `<span>${targetWord}</span><span>+${pts}</span>`;
                aiWordsUl.appendChild(li);
                
                checkMatchState();
                
                let nextActionDelay = Ailoss ? 8000 : 3000;
                aiTimeoutId = setTimeout(triggerAICycle, nextActionDelay);
                
            }, 600);
        }
    }, typingSpeed);
}

async function init() {
    if (aiTimeoutId) clearTimeout(aiTimeoutId);
    Ailoss = Math.random() < 0.70;
    try {
        await loadDictionaryFile();
    } catch (error) {
        console.error("Could not load the text file database:", error);
        wordFeedback.innerText = "Could not load the word list. Check the published words.txt file, then reload.";
        return;
    }
    setupBoard();
    aiTimeoutId = setTimeout(triggerAICycle, 2000);
}

function checkMatchState() {
    if (playerpoints >= SCORE) {
        clearTimeout(aiTimeoutId);
        alert("Victory! have your sweet victory twin!");
        location.reload();
    } else if (aipoints >= SCORE) {
        clearTimeout(aiTimeoutId);
        alert("Defeat! The Clanker filled its cup first.");
        location.reload();
    }
}

window.onload = init;
