// MCQ Handler - Centralized MCQ Management System
// This script automatically loads and displays MCQs for the current page

let mcqData = {};
let currentPagePath = '';
let userAnswers = {};

// Initialize MCQ system
document.addEventListener('DOMContentLoaded', function() {
    initializeMCQ();
});

// Load MCQ data from JSON file
function loadMCQData() {
    // Resolve the path to mcq-data.json from the pages directory
    // This works for both Electron and web deployments
    const baseURL = window.location.href;
    const isPagesDirectory = baseURL.includes('/pages/');
    
    let dataPath;
    
    if (isPagesDirectory) {
        // Extract the base URL up to /pages/
        const pagesIndex = baseURL.indexOf('/pages/');
        const baseDir = baseURL.substring(0, pagesIndex + 7); // includes '/pages/'
        dataPath = baseDir + 'mcq-data.json';
    } else {
        // Fallback for root level (shouldn't happen but just in case)
        dataPath = new URL('pages/mcq-data.json', window.location.origin + '/').href;
    }
    
    console.log('Loading MCQ data from:', dataPath);
    
    return fetch(dataPath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load MCQ data: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('MCQ data loaded successfully:', Object.keys(data).length, 'pages');
            mcqData = data;
        })
        .catch(error => {
            console.error('Error loading MCQ data:', error);
            console.error('Attempted path:', dataPath);
            console.error('Current page URL:', baseURL);
        });
}

// Get current page path
function getCurrentPagePath() {
    const currentURL = window.location.pathname;
    
    // Find 'pages' index (case-insensitive) and build path from there
    const lowerURL = currentURL.toLowerCase();
    const pagesIndex = lowerURL.indexOf('/pages/');
    
    if (pagesIndex !== -1) {
        // Extract everything after '/pages/' - preserving original case
        const relativePath = currentURL.substring(pagesIndex + 7); // '/pages/'.length = 7
        const decodedPath = decodeURIComponent(relativePath);
        
        // Ensure the path ends with .html if it doesn't already
        let finalPath = decodedPath;
        if (!finalPath.toLowerCase().endsWith('.html')) {
            finalPath += '.html';
        }
        
        console.log('Detected page path:', finalPath);
        return finalPath;
    }
    
    // Fallback: try to get from window.location directly
    const pathParts = currentURL.split('/').filter(p => p);
    
    // Handle cases where 'pages' might be capitalized or in URL
    for (let i = 0; i < pathParts.length; i++) {
        if (pathParts[i].toLowerCase() === 'pages' && i < pathParts.length - 1) {
            const relativePath = pathParts.slice(i + 1).join('/');
            let finalPath = decodeURIComponent(relativePath);
            
            // Ensure the path ends with .html
            if (!finalPath.toLowerCase().endsWith('.html')) {
                finalPath += '.html';
            }
            
            console.log('Detected page path (fallback):', finalPath);
            return finalPath;
        }
    }
    
    console.warn('Could not detect page path from URL:', currentURL);
    return '';
}

// Shuffle array using Fisher-Yates algorithm
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Initialize MCQ button and load data
function initializeMCQ() {
    currentPagePath = getCurrentPagePath();
    console.log('Initializing MCQ for page:', currentPagePath);
    
    loadMCQData().then(() => {
        console.log('Checking if MCQ data exists for current page...');
        console.log('Available pages:', Object.keys(mcqData));
        
        if (mcqData[currentPagePath]) {
            console.log('MCQs found for page:', currentPagePath);
            // MCQs exist for this page - button will show
            addMCQButton();
            
            // Restore modal state after page refresh
            if (sessionStorage.getItem('mcqModalOpen') === 'true') {
                openMCQModal();
                sessionStorage.removeItem('mcqModalOpen'); // Clear the flag
            }
        } else {
            console.warn('No MCQs found for page:', currentPagePath);
        }
    });
}

// Display MCQs in modal with shuffled questions and answers
function displayMCQs() {
    const pageData = mcqData[currentPagePath];
    
    if (!pageData) {
        return; // No MCQs for this page
    }
    
    const container = document.getElementById('mcq-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Shuffle questions
    const shuffledQuestions = shuffleArray(pageData.questions);
    
    shuffledQuestions.forEach((question, index) => {
        // Create a copy of options with their original indices
        const optionsWithIndex = question.options.map((option, idx) => ({
            text: option,
            originalIndex: idx
        }));
        
        // Shuffle options
        const shuffledOptions = shuffleArray(optionsWithIndex);
        
        // Find the new index of the correct answer
        const correctAnswerIndex = shuffledOptions.findIndex(
            opt => opt.originalIndex === question.correct
        );
        
        const questionDiv = document.createElement('div');
        questionDiv.className = 'mcq-question';
        questionDiv.innerHTML = `
            <div class="question-title">Q${index + 1}: ${question.question}</div>
            <div class="options-container">
                ${shuffledOptions.map((option, optionIndex) => `
                    <div class="option">
                        <input type="radio" id="q${question.id}_opt${optionIndex}" 
                               name="question_${question.id}" value="${optionIndex}"
                               onchange="checkAnswer(${question.id}, ${correctAnswerIndex}, '${question.explanation || ''}')">
                        <label for="q${question.id}_opt${optionIndex}" class="option-label">${option.text}</label>
                    </div>
                `).join('')}
            </div>
            <div id="feedback_${question.id}" class="answer-feedback"></div>
        `;
        container.appendChild(questionDiv);
    });
}

// Check answer and provide feedback
function checkAnswer(questionId, correctAnswer, explanation) {
    const selected = document.querySelector(`input[name="question_${questionId}"]:checked`);
    const feedback = document.getElementById(`feedback_${questionId}`);
    
    if (!selected) return;
    
    const selectedValue = parseInt(selected.value);
    userAnswers[questionId] = selectedValue;
    
    // Disable all radio buttons for this question
    const allRadios = document.querySelectorAll(`input[name="question_${questionId}"]`);
    allRadios.forEach(radio => {
        radio.disabled = true;
    });
    
    // Remove previous feedback classes
    const optionsContainer = selected.closest('.mcq-question').querySelector('.options-container');
    optionsContainer.querySelectorAll('.option').forEach(opt => {
        opt.classList.remove('correct-answer', 'wrong-answer');
        // Add a disabled class for styling
        opt.classList.add('disabled');
    });
    
    if (selectedValue === correctAnswer) {
        selected.closest('.option').classList.add('correct-answer');
        feedback.innerHTML = `<span style="color: #28a745;"><strong>✓ Correct!</strong> ${explanation}</span>`;
    } else {
        selected.closest('.option').classList.add('wrong-answer');
        const correctOption = document.querySelector(`input[name="question_${questionId}"][value="${correctAnswer}"]`);
        if (correctOption) {
            correctOption.closest('.option').classList.add('correct-answer');
        }
        feedback.innerHTML = `<span style="color: #dc3545;"><strong>✗ Incorrect.</strong> ${explanation}</span>`;
    }
}

// Open MCQ Modal and display shuffled questions
function openMCQModal() {
    displayMCQs(); // Shuffle and display questions when opening
    const modal = document.getElementById('mcq-modal');
    if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '10000';
        // Save modal state so it persists on refresh
        sessionStorage.setItem('mcqModalOpen', 'true');
    }
}

// Close MCQ Modal
function closeMCQModal() {
    const modal = document.getElementById('mcq-modal');
    if (modal) {
        modal.style.display = 'none';
        // Clear the modal state when closing
        sessionStorage.removeItem('mcqModalOpen');
    }
}

// Reset MCQs
function resetMCQs() {
    userAnswers = {};
    
    // Re-enable all radio buttons and clear selections
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.checked = false;
        radio.disabled = false;
    });
    
    // Clear feedback
    document.querySelectorAll('.answer-feedback').forEach(feedback => {
        feedback.innerHTML = '';
    });
    
    // Remove all styling classes
    document.querySelectorAll('.mcq-question').forEach(question => {
        question.querySelectorAll('.option').forEach(opt => {
            opt.classList.remove('correct-answer', 'wrong-answer', 'disabled');
        });
    });
}

// Add MCQ Button
function addMCQButton() {
    if (document.getElementById('mcq-button-fixed')) {
        console.log('MCQ button already exists');
        return; // Button already exists
    }
    
    const button = document.createElement('button');
    button.id = 'mcq-button-fixed';
    button.className = 'mcq-button-fixed';
    button.innerText = '📝 Questions';
    button.onclick = openMCQModal;
    button.title = 'Click to see multiple choice questions';
    button.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background-color: #007bff;
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 50px;
        cursor: pointer;
        font-size: 16px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
        z-index: 99;
        font-family: inherit;
    `;
    
    document.body.appendChild(button);
    console.log('MCQ button added to page');
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('mcq-modal');
    if (event.target === modal) {
        closeMCQModal();
    }
});

// Add CSS for disabled state
const style = document.createElement('style');
style.textContent = `
    .option.disabled {
        cursor: not-allowed;
        opacity: 0.8;
    }
    
    .option.disabled:hover {
        background-color: inherit;
        border-color: inherit;
    }
    
    .option.disabled input[type="radio"] {
        cursor: not-allowed;
    }
    
    .option.disabled .option-label {
        cursor: not-allowed;
    }
`;
document.head.appendChild(style);